import { randomUUID } from "node:crypto";
import { getReferralTrialEndsAt } from "./referral-dates.js";
import { isReferralRegistrationEnabled } from "./referral-utils.js";

export function workflowError(code, status = 409) {
  return Object.assign(new Error(code), { status, code });
}

export function hasFullReviewAccess(access) {
  return access?.listing_revisions?.read?.access === "full"
    && access?.listing_revisions?.update?.access === "full"
    && access?.listings?.update?.access === "full";
}

async function collectionAccess(accountability, context) {
  // Same evaluator as Directus 11.17.4 GET /permissions/me. Lazy import keeps
  // the disabled feature independent of this version-specific API entry point.
  const { fetchAccountabilityCollectionAccess } = await import(
    "@directus/api/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access"
  );
  return fetchAccountabilityCollectionAccess(accountability, context);
}

export function listingPatch(data, reviewedAt) {
  const patch = {};
  for (const field of [
    "name", "description", "street", "postal_code", "city", "canton",
    "public_email", "phone", "website_url", "address_visibility",
    "description_translations", "social_links", "custom_cta_label", "custom_cta_value",
  ]) {
    if (data[field] !== undefined) patch[field] = data[field];
  }
  if (data.logo_id !== undefined) patch.logo = data.logo_id;
  return { ...patch, status: "published", published_at: reviewedAt };
}

export function activationDecision(redemption, premium, now) {
  if (redemption.premium_grant || redemption.status !== "pending_activation") {
    return redemption.status;
  }
  if (redemption.trial_decision !== "eligible") throw workflowError("invalid_reservation");
  if (!redemption.trial_listing || !redemption.trial_starts_at || !redemption.trial_ends_at) {
    throw workflowError("invalid_reservation");
  }
  const end = new Date(redemption.trial_ends_at).getTime();
  if (!Number.isFinite(end)) throw workflowError("invalid_reservation");
  if (end <= now.getTime()) return "expired_unactivated";
  if (premium) return "skipped_existing_premium";
  return "granted";
}

export async function activePremium(trx, listing, now) {
  const subscription = await trx("subscriptions")
    .where({ listing, plan: "premium" }).whereIn("status", ["active", "past_due"])
    .where((q) => q.whereNull("current_period_end").orWhere("current_period_end", ">", now))
    .first("id");
  if (subscription) return "active_subscription";
  const grant = await trx("premium_grants").where({ listing }).whereNull("revoked_at")
    .where("starts_at", "<=", now)
    .where((q) => q.whereNull("ends_at").orWhere("ends_at", ">", now)).first("id");
  return grant ? "active_grant" : null;
}

function result(row) {
  if (!row) return { status: "none" };
  return {
    redemption_id: row.id, status: row.status, trial_listing: row.trial_listing,
    trial_starts_at: row.trial_starts_at, trial_ends_at: row.trial_ends_at,
    premium_grant: row.premium_grant ?? null,
  };
}

// Retain existing relation rows/IDs; remove only obsolete rows and duplicates.
export async function syncRows(service, filter, desired, key, options) {
  const existing = await service.readByQuery({ filter, fields: ["*"], limit: -1 });
  const wanted = new Map(desired.map((row) => [key(row), row]));
  const seen = new Set();
  const remove = [];
  for (const row of existing) {
    const value = key(row);
    if (!wanted.has(value) || seen.has(value)) remove.push(row.id);
    else seen.add(value);
  }
  if (remove.length) await service.deleteMany(remove, options);
  const insert = [...wanted].filter(([value]) => !seen.has(value)).map(([, row]) => row);
  if (insert.length) await service.createMany(insert, options);
}

/** All services use the caller's permissions and the same outer transaction.
 * Action hooks are collected until commit; filters still run transactionally.
 */
export function createApprovalWorkflow({ database, services, getSchema, emitter, logger, now = () => new Date(), getCollectionAccess = collectionAccess }) {
  const { ItemsService, PermissionsService } = services;
  async function transaction(work) {
    const events = [];
    const value = await database.transaction((trx) => work(trx, {
      bypassEmitAction: (event) => events.push(event),
    }));
    for (const event of events) {
      try { emitter.emitAction(event.event, event.meta, event.context); }
      catch { logger.warn("Referral action hook failed after commit"); }
    }
    return value;
  }

  async function approve(revisionId, accountability) {
    const schema = await getSchema();
    return transaction(async (trx, options) => {
      if (!accountability?.user || !hasFullReviewAccess(await getCollectionAccess(accountability, { schema, knex: trx }))) {
        throw workflowError("forbidden", 403);
      }
      // Read with the caller's permissions before inspecting/locking raw rows.
      const service = (collection) => new ItemsService(collection, { schema, knex: trx, accountability });
      const revisions = service("listing_revisions");
      const visible = await revisions.readOne(revisionId, { fields: ["id", "listing"] });
      const listingId = typeof visible.listing === "object" ? visible.listing?.id : visible.listing;
      if (!listingId) throw workflowError("not_found", 404);
      const permissions = new PermissionsService({ schema, knex: trx, accountability });
      const revisionAccess = await permissions.getItemPermissions("listing_revisions", revisionId);
      const listingAccess = await permissions.getItemPermissions("listings", listingId);
      if (!revisionAccess.update?.access || !listingAccess.update?.access) {
        throw workflowError("forbidden", 403);
      }

      const initialListing = await trx("listings").where({ id: listingId }).first("organization");
      if (!initialListing) throw workflowError("not_found", 404);
      // Common lock order: organization -> listing -> revision -> redemption.
      // The org lock serializes the ENTIRE publish operation, not just claims.
      if (initialListing.organization) {
        await trx("organizations").where({ id: initialListing.organization }).forUpdate().first("id");
      }
      const listing = await trx("listings").where({ id: listingId }).forUpdate().first();
      if (listing.organization !== initialListing.organization) throw workflowError("organization_changed");
      const revision = await trx("listing_revisions").where({ id: revisionId }).forUpdate().first();
      if (revision?.listing !== listingId) throw workflowError("revision_changed");
      // Same reviewer may retry a lost response; no re-publish or time reset.
      if (revision.status === "approved" && revision.reviewed_by === accountability.user) {
        const row = await trx("referral_redemptions").where({ trial_listing: listingId }).first();
        return result(row);
      }
      if (revision.status !== "pending") throw workflowError("revision_not_pending");
      const data = typeof revision.data === "string" ? JSON.parse(revision.data) : revision.data;
      if (!data || !Array.isArray(data.industry_ids) || !Array.isArray(data.spoken_language_ids)) {
        throw workflowError("invalid_revision", 400);
      }
      const reviewedAt = now().toISOString();
      let redemption = listing.organization
        ? await trx("referral_redemptions").where({ organization: listing.organization }).forUpdate().first()
        : null;
      if (redemption?.status === "pending_approval" && !redemption.trial_listing) {
        // Guard against legacy/manual publication while the feature was disabled.
        // Historical approved revisions survive suspension and re-approval.
        const historical = await trx("listing_revisions as r")
          .join("listings as l", "r.listing", "l.id")
          .where("l.organization", listing.organization).where("r.status", "approved").first("r.id");
        const published = await trx("listings").where({ organization: listing.organization })
          .where((q) => q.whereNotNull("published_at").orWhere("status", "published")).first("id");
        if (historical || published) {
          await trx("referral_redemptions").where({ id: redemption.id }).update({
            status: "void", skip_reason: "previous_publication", resolved_at: reviewedAt, date_updated: reviewedAt,
          });
        } else {
          const premium = await activePremium(trx, listingId, reviewedAt);
          await trx("referral_redemptions").where({ id: redemption.id }).update({
            trial_listing: listingId, trial_starts_at: reviewedAt,
            trial_ends_at: getReferralTrialEndsAt(new Date(reviewedAt)).toISOString(),
            reserved_at: reviewedAt, date_updated: reviewedAt,
            trial_decision: premium ? "skipped_existing_premium" : "eligible",
            status: premium ? "skipped_existing_premium" : "pending_activation",
            skip_reason: premium, resolved_at: premium ? reviewedAt : null,
          });
        }
      }
      await service("listings").updateOne(listingId, listingPatch(data, reviewedAt), options);
      for (const [collection, reference, ids] of [
        ["listings_industries", "industries_id", data.industry_ids],
        ["listings_spoken_languages", "spoken_languages_id", data.spoken_language_ids],
        ["listings_files", "directus_files_id", data.gallery_file_ids],
      ]) {
        if (ids === undefined) continue;
        if (!Array.isArray(ids)) throw workflowError("invalid_revision", 400);
        await syncRows(service(collection), { listings_id: { _eq: listingId } },
          ids.map((id) => ({ listings_id: listingId, [reference]: id })),
          (row) => typeof row[reference] === "object" ? row[reference]?.id : row[reference], options);
      }
      if (data.opening_hours !== undefined) {
        if (!Array.isArray(data.opening_hours)) throw workflowError("invalid_revision", 400);
        await syncRows(service("listing_opening_hours"), { listing: { _eq: listingId } },
          data.opening_hours.map(({ day_of_week, opens_at, closes_at }) => ({ listing: listingId, day_of_week, opens_at, closes_at })),
          (row) => `${row.day_of_week}:${row.opens_at.slice(0, 5)}:${row.closes_at.slice(0, 5)}`, options);
      }
      await revisions.updateOne(revisionId, {
        status: "approved", rejection_reason: null, reviewed_by: accountability.user, reviewed_at: reviewedAt,
      }, options);
      // Fail closed if a policy preset/filter changed the requested decision.
      const savedListing = await trx("listings").where({ id: listingId }).first("status", "organization");
      const savedRevision = await trx("listing_revisions").where({ id: revisionId }).first("status", "reviewed_by");
      if (savedListing.status !== "published" || savedListing.organization !== listing.organization
        || savedRevision.status !== "approved" || savedRevision.reviewed_by !== accountability.user) {
        throw workflowError("approval_overridden");
      }
      redemption = await trx("referral_redemptions").where({ trial_listing: listingId }).first();
      return result(redemption);
    });
  }

  async function activate(redemptionId, grantedBy) {
    const schema = await getSchema();
    return transaction(async (trx, options) => {
      const initial = await trx("referral_redemptions").where({ id: redemptionId }).first();
      if (!initial) throw workflowError("not_found", 404);
      if (initial.organization) await trx("organizations").where({ id: initial.organization }).forUpdate().first("id");
      const listing = initial.trial_listing
        ? await trx("listings").where({ id: initial.trial_listing }).forUpdate().first()
        : null;
      const row = await trx("referral_redemptions").where({ id: redemptionId }).forUpdate().first();
      if (row.trial_listing !== initial.trial_listing || row.organization !== initial.organization) {
        throw workflowError("reservation_changed");
      }
      if (row.status !== "pending_activation" || row.premium_grant) return result(row);
      if (!listing || listing.organization !== row.organization) throw workflowError("organization_changed");
      const at = now();
      const premium = await activePremium(trx, row.trial_listing, at.toISOString());
      const status = activationDecision(row, premium, at);
      const patch = { status, resolved_at: at.toISOString(), date_updated: at.toISOString() };
      if (status === "granted") {
        // Privileged write is tightly scoped to the locked, server-owned reservation.
        // No arbitrary listing, dates, reason or user supplied by the caller.
        const grants = new ItemsService("premium_grants", { schema, knex: trx });
        patch.premium_grant = await grants.createOne({
          id: randomUUID(), listing: row.trial_listing, granted_by: grantedBy,
          reason: `Empfehlung ${row.code_snapshot}`, starts_at: row.trial_starts_at, ends_at: row.trial_ends_at,
        }, options);
      } else if (status === "skipped_existing_premium") {
        // Keep trial_decision (the approval-time decision) immutable.
        patch.skip_reason = `activation_${premium}`;
      }
      await trx("referral_redemptions").where({ id: row.id }).update(patch);
      return result({ ...row, ...patch });
    });
  }
  return { approve, activate };
}

export function registerApprovalRoutes(router, context) {
  const workflow = createApprovalWorkflow(context);
  const { env, logger } = context;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function gate(req, res, adminOnly) {
    if (!isReferralRegistrationEnabled(env)) { res.status(503).json({ error: "feature_disabled" }); return false; }
    if (!req.accountability?.user) { res.status(401).json({ error: "unauthorized" }); return false; }
    if (adminOnly && req.accountability.admin !== true) { res.status(403).json({ error: "forbidden" }); return false; }
    return true;
  }
  function fail(res, error) {
    const status = error.status ?? (error.code === "FORBIDDEN" ? 403 : 500);
    logger.warn({ code: error.code ?? "workflow_failed" }, "Referral workflow failed");
    return res.status(status >= 400 && status <= 599 ? status : 500).json({ error: status < 500 ? (error.code ?? "forbidden") : "workflow_failed" });
  }
  router.post("/approve-revision", async (req, res) => {
    if (!gate(req, res, false)) return;
    if (!uuid.test(req.body?.revision_id ?? "")) return res.status(400).json({ error: "invalid_data" });
    try {
      let outcome = await workflow.approve(req.body.revision_id, req.accountability);
      if (outcome.status === "pending_activation") {
        try { outcome = await workflow.activate(outcome.redemption_id, req.accountability.user); }
        catch { logger.warn("Referral activation pending; retry required"); }
      }
      return res.json({ data: outcome });
    } catch (error) { return fail(res, error); }
  });
  router.post("/activate", async (req, res) => {
    // Explicit Directus admin policy; review rights alone do not grant retries.
    if (!gate(req, res, true)) return;
    if (!uuid.test(req.body?.redemption_id ?? "")) return res.status(400).json({ error: "invalid_data" });
    try { return res.json({ data: await workflow.activate(req.body.redemption_id, req.accountability.user) }); }
    catch (error) { return fail(res, error); }
  });
}
