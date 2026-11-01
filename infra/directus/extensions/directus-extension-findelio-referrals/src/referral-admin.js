import { randomUUID } from "node:crypto";
import { isReferralRegistrationEnabled } from "./referral-utils.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set(["pending_organization", "pending_approval", "pending_activation", "granted", "skipped_existing_premium", "expired_unactivated", "void"]);

export function partnerInput(body, creating) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (name.length < 2 || name.length > 255 || notes.length > 2000) return null;
  if (!["active", "disabled"].includes(body.status)) return null;
  const values = { name, notes: notes || null, status: body.status };
  if (creating) {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(code)) return null;
    values.code = code;
  } else if ("code" in body) {
    // Codes never change: already distributed links and historical attribution remain stable.
    return null;
  }
  if (Object.keys(body).some((key) => !["name", "notes", "status", ...(creating ? ["code"] : [])].includes(key))) return null;
  return values;
}

export function overviewInput(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return null;
  const partner = query.partner || null, status = query.status || null;
  if (partner && (typeof partner !== "string" || !uuid.test(partner))) return null;
  if (status && !statuses.has(status)) return null;
  return { page, partner, status };
}

export function registerAdminRoutes(router, { database, env, getSchema, logger, services }) {
  function gate(req, res) {
    if (!isReferralRegistrationEnabled(env)) { res.status(503).json({ error: "feature_disabled" }); return false; }
    if (!req.accountability?.user) { res.status(401).json({ error: "unauthorized" }); return false; }
    if (req.accountability.admin !== true) { res.status(403).json({ error: "forbidden" }); return false; }
    res.set?.("Cache-Control", "no-store");
    return true;
  }
  function failed(res, error) {
    // Do not echo DB errors, which may contain personal data.
    if (error.code === "23505" || error.code === "RECORD_NOT_UNIQUE") {
      return res.status(409).json({ error: "code_exists" });
    }
    logger.warn("Referral administration request failed");
    return res.status(500).json({ error: "request_failed" });
  }
  router.get("/admin/access", (req, res) => {
    if (gate(req, res)) return res.json({ data: { allowed: true } });
  });
  router.get("/admin/overview", async (req, res) => {
    if (!gate(req, res)) return;
    const filter = overviewInput(req.query);
    if (!filter) return res.status(400).json({ error: "invalid_data" });
    try {
      const partners = await database("referral_partners")
        .select("id", "name", "code", "status", "notes").orderBy("name").orderBy("id");
      const base = database("referral_redemptions as r");
      if (filter.partner) base.where("r.partner", filter.partner);
      if (filter.status) base.where("r.status", filter.status);
      const counts = await base.clone().select("r.status").count("r.id as count").groupBy("r.status");
      const total = counts.reduce((sum, row) => sum + Number(row.count), 0);
      const pageCount = Math.max(1, Math.ceil(total / 25));
      const page = Math.min(filter.page, pageCount);
      const redemptions = await base.clone()
        .leftJoin("organizations as o", "r.organization", "o.id")
        .leftJoin("listings as l", "r.trial_listing", "l.id")
        .leftJoin("premium_grants as g", "r.premium_grant", "g.id")
        .leftJoin("directus_users as u", "r.user", "u.id")
        .select("r.id", "r.partner", "r.code_snapshot", "r.status", "r.registered_at",
          "r.trial_starts_at", "r.trial_ends_at", "r.skip_reason",
          "o.name as organization_name", "l.name as listing_name", "l.slug as listing_slug",
          "u.email as email", "g.revoked_at as grant_revoked_at", "g.ends_at as grant_ends_at")
        .orderBy("r.registered_at", "desc").orderBy("r.id", "desc").offset((page - 1) * 25).limit(25);
      return res.json({ data: { partners, redemptions, total, page, pageCount, asOf: new Date().toISOString(),
        pending: Number(counts.find((row) => row.status === "pending_activation")?.count ?? 0) } });
    } catch (error) { return failed(res, error); }
  });
  router.post("/admin/partners", async (req, res) => {
    if (!gate(req, res)) return;
    const values = partnerInput(req.body, true);
    if (!values) return res.status(400).json({ error: "invalid_data" });
    try {
      const service = new services.ItemsService("referral_partners", {
        schema: await getSchema(), knex: database, accountability: req.accountability,
      });
      const id = await service.createOne({ id: randomUUID(), ...values });
      return res.status(201).json({ data: { id } });
    } catch (error) { return failed(res, error); }
  });
  router.patch("/admin/partners/:id", async (req, res) => {
    if (!gate(req, res)) return;
    const values = partnerInput(req.body, false);
    if (!uuid.test(req.params.id) || !values) return res.status(400).json({ error: "invalid_data" });
    try {
      if (!await database("referral_partners").where({ id: req.params.id }).first("id")) {
        return res.status(404).json({ error: "not_found" });
      }
      const service = new services.ItemsService("referral_partners", {
        schema: await getSchema(), knex: database, accountability: req.accountability,
      });
      await service.updateOne(req.params.id, { ...values, date_updated: new Date().toISOString() });
      return res.json({ data: { id: req.params.id } });
    } catch (error) { return failed(res, error); }
  });
}
