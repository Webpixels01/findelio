import { randomUUID } from "node:crypto";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportedLocales = new Set([
  "de-ch",
  "en",
  "sk",
  "cs",
  "hu",
  "pl",
  "ru",
  "pt-pt",
  "ro",
]);

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function activeMembership(database, userId, organizationId) {
  return database("organization_members as memberships")
    .join("organizations", "memberships.organization", "organizations.id")
    .select(
      "memberships.role",
      "memberships.organization",
      "organizations.name as organization_name",
      "organizations.status as organization_status",
    )
    .where({
      "memberships.user": userId,
      "memberships.organization": organizationId,
      "memberships.status": "active",
    })
    .first();
}

async function currentPremiumAccess(database, listingIds) {
  if (listingIds.length === 0) return [];

  return database("subscriptions")
    .select(
      "id",
      "listing",
      "status",
      "cancel_at_period_end",
      "current_period_end",
    )
    .whereIn("listing", listingIds)
    .where("plan", "premium")
    .whereIn("status", ["active", "past_due"])
    .andWhere((builder) => {
      builder
        .whereNull("current_period_end")
        .orWhere("current_period_end", ">", database.fn.now());
    });
}

function archiveAvailableAt(subscriptions) {
  if (subscriptions.length === 0) return null;
  if (subscriptions.some((subscription) => !subscription.current_period_end)) {
    return null;
  }

  return subscriptions.reduce((latest, subscription) => {
    const value = new Date(subscription.current_period_end).getTime();
    return value > latest ? value : latest;
  }, 0);
}

async function targetListingIds(database, request) {
  if (request.entity_type === "listing") {
    return request.listing ? [request.listing] : [];
  }

  const rows = await database("listings")
    .select("id")
    .where("organization", request.organization);
  return rows.map((row) => row.id);
}

async function archiveListings(trx, listingIds) {
  if (listingIds.length === 0) return;

  await trx("listings")
    .whereIn("id", listingIds)
    .update({ status: "archived" });
  await trx("listing_revisions")
    .whereIn("listing", listingIds)
    .whereIn("status", ["draft", "pending"])
    .update({ status: "superseded" });
  await trx("listing_posts")
    .whereIn("listing", listingIds)
    .whereNot("status", "archived")
    .update({ status: "archived", date_updated: trx.fn.now() });
}

const findelioDeletionRequestsEndpoint = {
  id: "findelio-deletion-requests",
  handler: (router, { database, env, getSchema, logger, services }) => {
    const { MailService } = services;
    router.get("/", async (req, res) => {
      const userId = req.accountability?.user;
      if (!userId) return res.status(401).json({ error: "unauthorized" });

      try {
        const memberships = await database("organization_members")
          .select("organization", "role")
          .where({ user: userId, status: "active" });
        if (memberships.length === 0) return res.json({ data: [] });

        const roles = new Map(
          memberships.map((membership) => [
            membership.organization,
            membership.role,
          ]),
        );
        const requests = await database("deletion_requests")
          .select(
            "id",
            "entity_type",
            "organization as organization_id",
            "listing as listing_id",
            "target_name",
            "status",
            "reason",
            "date_created",
          )
          .whereIn("organization", [...roles.keys()])
          .where("status", "pending")
          .orderBy("date_created", "desc");

        return res.json({
          data: requests
            .filter(
              (request) =>
                request.entity_type === "listing" ||
                roles.get(request.organization_id) === "owner",
            )
            .map((request) => ({
              ...request,
              can_cancel:
                request.entity_type === "listing" ||
                roles.get(request.organization_id) === "owner",
            })),
        });
      } catch (error) {
        logger.error(error, "Findelio deletion request overview failed");
        return res.status(500).json({ error: "load_failed" });
      }
    });

    router.post("/", async (req, res) => {
      const userId = req.accountability?.user;
      const entityType = String(req.body?.entity_type ?? "").trim();
      const targetId = String(req.body?.target_id ?? "").trim();
      const reason = String(req.body?.reason ?? "").trim();
      const requestedLocale = String(req.body?.locale ?? "").trim();
      const locale = supportedLocales.has(requestedLocale)
        ? requestedLocale
        : "de-ch";

      if (!userId) return res.status(401).json({ error: "unauthorized" });
      if (
        !["listing", "organization"].includes(entityType) ||
        !uuidPattern.test(targetId) ||
        reason.length > 2000
      ) {
        return res.status(400).json({ error: "invalid_data" });
      }

      const recipient = String(env.ADMIN_NOTIFICATION_EMAIL ?? "").trim();
      const siteUrl = String(env.FINDELIO_SITE_URL ?? "")
        .trim()
        .replace(/\/$/, "");
      if (!recipient || !siteUrl) {
        logger.error(
          "ADMIN_NOTIFICATION_EMAIL or FINDELIO_SITE_URL is missing",
        );
        return res.status(500).json({ error: "configuration_error" });
      }

      let createdRequest = null;
      try {
        const result = await database.transaction(async (trx) => {
          let listing = null;
          let organization = null;

          if (entityType === "listing") {
            listing = await trx("listings")
              .select("id", "name", "organization", "status")
              .where("id", targetId)
              .forUpdate()
              .first();
            if (!listing) fail("not_found", 404);
            organization = await trx("organizations")
              .select("id", "name", "status")
              .where("id", listing.organization)
              .first();
          } else {
            organization = await trx("organizations")
              .select("id", "name", "status")
              .where("id", targetId)
              .forUpdate()
              .first();
          }

          if (
            !organization ||
            organization.status !== "active" ||
            (listing && listing.status === "archived")
          ) {
            fail("not_found", 404);
          }

          const membership = await activeMembership(
            trx,
            userId,
            organization.id,
          );
          if (
            !membership ||
            (entityType === "organization" && membership.role !== "owner")
          ) {
            fail("forbidden", 403);
          }

          const existing = await trx("deletion_requests")
            .select("id")
            .where({
              entity_type: entityType,
              status: "pending",
              ...(entityType === "listing"
                ? { listing: targetId }
                : { organization: targetId }),
            })
            .first();
          if (existing) fail("request_exists", 409);

          const listingIds = listing
            ? [listing.id]
            : (
                await trx("listings")
                  .select("id")
                  .where("organization", organization.id)
              ).map((row) => row.id);
          const premiumAccess = await currentPremiumAccess(trx, listingIds);
          if (
            premiumAccess.some(
              (subscription) => !subscription.cancel_at_period_end,
            )
          ) {
            fail("premium_not_cancelled", 409);
          }

          const request = {
            id: randomUUID(),
            entity_type: entityType,
            organization: organization.id,
            listing: listing?.id ?? null,
            target_name: listing?.name ?? organization.name,
            status: "pending",
            reason: reason || null,
            requested_by: userId,
            locale,
          };
          await trx("deletion_requests").insert(request);
          const requester = await trx("directus_users")
            .select("first_name", "last_name", "email")
            .where("id", userId)
            .first();

          return {
            id: request.id,
            entity_type: request.entity_type,
            organization_id: request.organization,
            listing_id: request.listing,
            target_name: request.target_name,
            status: request.status,
            reason: request.reason,
            date_created: new Date().toISOString(),
            can_cancel: true,
            organization_name: organization.name,
            requester_name:
              [requester?.first_name, requester?.last_name]
                .filter(Boolean)
                .join(" ") || requester?.email || "Unbekannter Benutzer",
            requester_email: requester?.email ?? "",
          };
        });
        createdRequest = result;

        const entityLabel =
          result.entity_type === "listing" ? "Firmeneintrag" : "Organisation";
        const intro =
          result.entity_type === "listing"
            ? "Ein Firmeneintrag wurde zur Archivierung eingereicht."
            : "Eine Organisation wurde zur Archivierung eingereicht.";
        const reviewPath = "/de-ch/dashboard/pruefung";
        const reviewUrl = `${siteUrl}/api/auth/refresh?next=${encodeURIComponent(
          reviewPath,
        )}&locale=de-ch`;
        const mailReason = result.reason || "Kein Grund angegeben";
        const requester = result.requester_email
          ? `${result.requester_name} (${result.requester_email})`
          : result.requester_name;
        const mailService = new MailService({
          schema: await getSchema(),
          accountability: req.accountability,
          knex: database,
        });

        await mailService.send({
          to: recipient,
          subject: `Löschanfrage wartet auf Prüfung: ${result.target_name}`,
          text: `${intro}\n\nTyp: ${entityLabel}\nOrganisation: ${result.organization_name}\nInhalt: ${result.target_name}\nAngefragt von: ${requester}\nGrund: ${mailReason}\n\nLöschanfrage prüfen:\n${reviewUrl}`,
          template: {
            name: "deletion-request-notification",
            data: {
              intro,
              entityLabel,
              organizationName: result.organization_name,
              targetName: result.target_name,
              requester,
              reason: mailReason,
              reviewUrl,
            },
          },
        });

        const responseData = {
          id: result.id,
          entity_type: result.entity_type,
          organization_id: result.organization_id,
          listing_id: result.listing_id,
          target_name: result.target_name,
          status: result.status,
          reason: result.reason,
          date_created: result.date_created,
          can_cancel: result.can_cancel,
        };

        return res.status(201).json({ data: responseData });
      } catch (error) {
        if (createdRequest?.id) {
          await database("deletion_requests")
            .where({ id: createdRequest.id, status: "pending" })
            .update({ status: "cancelled", date_updated: database.fn.now() });
        }
        const knownStatus = Number(error?.status);
        if ([400, 403, 404, 409].includes(knownStatus)) {
          return res.status(knownStatus).json({ error: error.message });
        }
        logger.error(error, "Findelio deletion request creation failed");
        return res.status(500).json({ error: "send_failed" });
      }
    });

    router.delete("/:id", async (req, res) => {
      const userId = req.accountability?.user;
      const requestId = String(req.params.id ?? "").trim();
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      if (!uuidPattern.test(requestId)) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const request = await database("deletion_requests")
          .select("id", "entity_type", "organization", "status")
          .where("id", requestId)
          .first();
        if (!request || request.status !== "pending") {
          return res.status(404).json({ error: "not_found" });
        }

        const membership = await activeMembership(
          database,
          userId,
          request.organization,
        );
        if (
          !membership ||
          (request.entity_type === "organization" &&
            membership.role !== "owner")
        ) {
          return res.status(403).json({ error: "forbidden" });
        }

        await database("deletion_requests")
          .where({ id: requestId, status: "pending" })
          .update({ status: "cancelled", date_updated: database.fn.now() });
        return res.status(204).send();
      } catch (error) {
        logger.error(error, "Findelio deletion request cancellation failed");
        return res.status(500).json({ error: "update_failed" });
      }
    });

    router.get("/admin", async (req, res) => {
      if (!req.accountability?.admin) {
        return res.status(403).json({ error: "forbidden" });
      }

      try {
        const requests = await database("deletion_requests as requests")
          .join("organizations", "requests.organization", "organizations.id")
          .leftJoin("listings", "requests.listing", "listings.id")
          .leftJoin("directus_users as users", "requests.requested_by", "users.id")
          .select(
            "requests.id",
            "requests.entity_type",
            "requests.organization as organization_id",
            "requests.listing as listing_id",
            "requests.target_name",
            "requests.status",
            "requests.reason",
            "requests.date_created",
            "organizations.name as organization_name",
            "users.first_name as requester_first_name",
            "users.last_name as requester_last_name",
            "users.email as requester_email",
          )
          .where("requests.status", "pending")
          .orderBy("requests.date_created");

        const data = [];
        for (const request of requests) {
          const listingIds = await targetListingIds(database, {
            entity_type: request.entity_type,
            organization: request.organization_id,
            listing: request.listing_id,
          });
          const premiumAccess = await currentPremiumAccess(database, listingIds);
          const availableAt = archiveAvailableAt(premiumAccess);
          data.push({
            ...request,
            can_approve: premiumAccess.length === 0,
            archive_available_at:
              availableAt === null ? null : new Date(availableAt).toISOString(),
          });
        }

        return res.json({ data });
      } catch (error) {
        logger.error(error, "Findelio deletion request review load failed");
        return res.status(500).json({ error: "load_failed" });
      }
    });

    router.patch("/admin/:id", async (req, res) => {
      const userId = req.accountability?.user;
      const requestId = String(req.params.id ?? "").trim();
      const action = String(req.body?.action ?? "").trim();
      const note = String(req.body?.note ?? "").trim();

      if (!req.accountability?.admin || !userId) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (
        !uuidPattern.test(requestId) ||
        !["approve", "reject"].includes(action) ||
        note.length > 2000 ||
        (action === "reject" && note.length < 3)
      ) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        await database.transaction(async (trx) => {
          const request = await trx("deletion_requests")
            .select("*")
            .where("id", requestId)
            .forUpdate()
            .first();
          if (!request || request.status !== "pending") {
            fail("not_found", 404);
          }

          if (action === "approve") {
            const listingIds = await targetListingIds(trx, request);
            const premiumAccess = await currentPremiumAccess(trx, listingIds);
            if (premiumAccess.length > 0) fail("premium_active", 409);

            await archiveListings(trx, listingIds);
            if (request.entity_type === "organization") {
              await trx("organizations")
                .where("id", request.organization)
                .update({ status: "archived" });
              await trx("organization_invitations")
                .where({ organization: request.organization, status: "pending" })
                .update({ status: "cancelled", date_updated: trx.fn.now() });
              await trx("deletion_requests")
                .where({ organization: request.organization, status: "pending" })
                .whereNot("id", request.id)
                .update({
                  status: "cancelled",
                  decision_note: "Organisation archiviert.",
                  decided_by: userId,
                  decided_at: trx.fn.now(),
                  date_updated: trx.fn.now(),
                });
            }
          }

          await trx("deletion_requests")
            .where({ id: request.id, status: "pending" })
            .update({
              status: action === "approve" ? "approved" : "rejected",
              decision_note: note || null,
              decided_by: userId,
              decided_at: trx.fn.now(),
              date_updated: trx.fn.now(),
            });
        });

        return res.json({ data: { id: requestId, status: action } });
      } catch (error) {
        const knownStatus = Number(error?.status);
        if ([400, 404, 409].includes(knownStatus)) {
          return res.status(knownStatus).json({ error: error.message });
        }
        logger.error(error, "Findelio deletion request decision failed");
        return res.status(500).json({ error: "update_failed" });
      }
    });
  },
};

export default findelioDeletionRequestsEndpoint;
