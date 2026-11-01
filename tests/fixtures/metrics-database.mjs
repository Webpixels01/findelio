export function databaseFixture(tables) {
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
