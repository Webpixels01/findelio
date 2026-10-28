import assert from "node:assert/strict";
import test from "node:test";
import performanceReportHook from "../infra/directus/extensions/directus-extension-findelio-performance-report/dist/index.js";

// In-memory Knex adapter: execute predicates and joins against fixture rows,
// while keeping mail delivery isolated from real recipients.
function databaseFixture(tables) {
  const compare = (a, op, b) => {
    if (b instanceof Date) { a = new Date(a).getTime(); b = b.getTime(); }
    return op === "=" ? a === b : op === ">" ? a > b : op === "<=" ? a <= b : false;
  };
  class Query {
    constructor(table) {
      this.table = table;
      this.conditions = [];
      this.joins = [];
    }
    condition(predicate, or = false) { this.conditions.push({ predicate, or }); return this; }
    matches(row) { return this.conditions.reduce((result, c, i) => i === 0 ? c.predicate(row) : c.or ? result || c.predicate(row) : result && c.predicate(row), true); }
    where(key, op, value) {
      if (typeof key === "function") {
        const group = new Query(); key(group); return this.condition(row => group.matches(row));
      }
      if (typeof key === "object") return this.condition(row => Object.entries(key).every(([k, v]) => row[k] === v));
      if (value === undefined) { value = op; op = "="; }
      return this.condition(row => compare(row[key], op, value));
    }
    orWhere(key, op, value) { return this.condition(row => compare(row[key], op, value), true); }
    whereNull(key) { return this.condition(row => row[key] == null); }
    whereNotNull(key) { return this.condition(row => row[key] != null); }
    whereIn(key, values) { return this.in(key, values, false); }
    orWhereIn(key, values) { return this.in(key, values, true); }
    in(key, values, or) { return this.condition(row => (values instanceof Query ? values.rows().map(v => Object.values(v)[0]) : values).includes(row[key]), or); }
    whereBetween(key, [start, end]) { return this.condition(row => row[key] >= start && row[key] <= end); }
    join(table, left, right) { this.joins.push({ table, left, right }); return this; }
    select(...fields) { this.fields = fields; return this; }
    distinct(...fields) { this.unique = true; return this.select(...fields); }
    sum(fields) { this.sums = fields; return this; }
    first() { return Promise.resolve(this.rows()[0]); }
    insert(row) { tables[this.table].push(row); return Promise.resolve(); }
    source(table) {
      const [name, alias = name] = table.split(" as ");
      return tables[name].map(row => ({ ...row, ...Object.fromEntries(Object.entries(row).map(([k, v]) => [`${alias}.${k}`, v])) }));
    }
    rows() {
      let rows = this.source(this.table);
      for (const { table, left, right } of this.joins) {
        rows = rows.flatMap(row => this.source(table).map(other => ({ ...row, ...other })).filter(merged => merged[left] === merged[right]));
      }
      rows = rows.filter(row => this.matches(row));
      if (this.sums) return [Object.fromEntries(Object.entries(this.sums).map(([alias, key]) => [alias, rows.reduce((sum, row) => sum + (row[key] ?? 0), 0)]))];
      if (this.fields) rows = rows.map(row => Object.fromEntries(this.fields.map(field => {
        const [key, alias = key.split(".").at(-1)] = field.split(" as "); return [alias, row[key]];
      })));
      return this.unique ? [...new Map(rows.map(row => [JSON.stringify(row), row])).values()] : rows;
    }
    then(resolve, reject) { return Promise.resolve().then(() => this.rows()).then(resolve, reject); }
  }
  return table => new Query(table);
}

function fixture() {
  const tables = { listings: [], subscriptions: [], premium_grants: [], organization_members: [], directus_users: [], listing_metric_reports: [], listing_metrics_daily: [] };
  const sent = [], errors = [];
  let run;
  performanceReportHook({ schedule(expression, callback) { assert.equal(expression, "5 8 1 * *"); run = callback; } }, {
    database: databaseFixture(tables), env: { FINDELIO_SITE_URL: "https://example.test" }, getSchema: async () => ({}),
    logger: { error: (...args) => errors.push(args) },
    services: { MailService: class { async send(message) { sent.push(message); } } },
  });
  function listing(id, { role = "owner", memberStatus = "active", userStatus = "active", email = `${id}@example.test` } = {}) {
    tables.listings.push({ id, name: id, organization: id });
    tables.organization_members.push({ organization: id, user: id, status: memberStatus, role });
    tables.directus_users.push({ id, status: userStatus, email, language: "de" });
  }
  function grant(listing, overrides = {}) {
    tables.premium_grants.push({ listing, starts_at: "2000-01-01T00:00:00Z", ends_at: "2100-01-01T00:00:00Z", revoked_at: null, ...overrides });
  }
  return { tables, sent, errors, listing, grant, run: async () => { await run(); assert.deepEqual(errors, []); } };
}

test("trial-only and unlimited grants receive reports alongside subscriptions, without duplicates", async () => {
  const f = fixture();
  for (const id of ["trial", "unlimited", "paid", "both", "past-due"]) f.listing(id);
  f.grant("trial"); f.grant("unlimited", { ends_at: null }); f.grant("both"); f.grant("both");
  for (const id of ["paid", "both", "past-due"]) f.tables.subscriptions.push({ listing: id, plan: "premium", status: id === "past-due" ? "past_due" : "active" });
  await f.run();
  assert.deepEqual(f.sent.map(m => m.to).sort(), ["both", "paid", "past-due", "trial", "unlimited"].map(id => `${id}@example.test`).sort());
  assert.equal(f.tables.listing_metric_reports.length, 5);
  await f.run();
  assert.equal(f.sent.length, 5, "a second run must not resend logged reports");
});

test("expired, future, revoked grants and ineligible owners do not receive reports", async () => {
  const f = fixture();
  for (const id of ["expired", "future", "revoked", "free"]) f.listing(id);
  f.grant("expired", { ends_at: "2001-01-01T00:00:00Z" });
  f.grant("future", { starts_at: "2099-01-01T00:00:00Z" });
  f.grant("revoked", { revoked_at: "2020-01-01T00:00:00Z" });
  for (const [id, options] of [["member", { role: "member" }], ["inactive-member", { memberStatus: "inactive" }], ["inactive-user", { userStatus: "suspended" }], ["no-email", { email: null }]]) {
    f.listing(id, options); f.grant(id);
  }
  await f.run();
  assert.equal(f.sent.length, 0);
  assert.equal(f.tables.listing_metric_reports.length, 0);
});
