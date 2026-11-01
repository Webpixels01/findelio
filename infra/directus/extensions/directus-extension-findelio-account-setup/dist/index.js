import { randomUUID } from "node:crypto";

function slugify(value) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 150) || "organisation"
  );
}

function isReferralRegistrationEnabled(env) {
  return (
    String(env?.FINDELIO_REFERRAL_REGISTRATION_ENABLED ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

async function createUniqueSlug(trx, name) {
  const baseSlug = slugify(name);

  await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [baseSlug]);

  const existingRows = await trx("organizations")
    .select("slug")
    .where("slug", "like", `${baseSlug}%`);
  const existingSlugs = new Set(existingRows.map((row) => row.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidate = `${baseSlug.slice(0, 160 - suffixText.length)}${suffixText}`;

    if (!existingSlugs.has(candidate)) {
      return candidate;
    }
  }

  return `${baseSlug.slice(0, 151)}-${randomUUID().slice(0, 8)}`;
}

const findelioAccountSetupEndpoint = {
  id: "findelio-account-setup",
  handler: (router, { database, env, getSchema, logger, services }) => {
    const { ItemsService } = services;

    router.post("/", async (req, res) => {
      const userId = req.accountability?.user;
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";

      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }

      if (!name || name.length > 255) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const schema = await getSchema();
        const organization = await database.transaction(async (trx) => {
          const user = await trx("directus_users")
            .select("status", "role")
            .where("id", userId)
            .forUpdate()
            .first();
          const role = user?.role
            ? await trx("directus_roles")
                .select("name")
                .where("id", user.role)
                .first()
            : null;

          if (user?.status !== "active" || role?.name !== "Firmenkonto") {
            const error = new Error("forbidden");
            error.status = 403;
            throw error;
          }

          const activeMembership = await trx("organization_members")
            .select("id")
            .where({ user: userId, status: "active" })
            .first();

          if (activeMembership) {
            const error = new Error("already_configured");
            error.status = 409;
            throw error;
          }

          const slug = await createUniqueSlug(trx, name);
          const organizationId = randomUUID();
          // Authorization is enforced above. Omitting accountability here gives
          // these two tightly scoped service writes administrator permissions.
          const organizationsService = new ItemsService("organizations", {
            schema,
            knex: trx,
          });
          const membershipsService = new ItemsService(
            "organization_members",
            {
              schema,
              knex: trx,
            },
          );

          await organizationsService.createOne({
            id: organizationId,
            name,
            slug,
            status: "active",
            billing_country: "CH",
          });

          await membershipsService.createOne({
            id: randomUUID(),
            organization: organizationId,
            user: userId,
            role: "owner",
            status: "active",
          });

          // Bind a pending referral only when the feature is enabled and a
          // redemption already exists for this authenticated user. Never create
          // a redemption here (team invitations / existing orgs stay excluded).
          if (isReferralRegistrationEnabled(env)) {
            const redemption = await trx("referral_redemptions")
              .select("id", "organization", "status")
              .where({
                user: userId,
                status: "pending_organization",
              })
              .whereNull("organization")
              .forUpdate()
              .first();

            if (redemption) {
              const updated = await trx("referral_redemptions")
                .where({
                  id: redemption.id,
                  status: "pending_organization",
                })
                .whereNull("organization")
                .update({
                  organization: organizationId,
                  organization_bound_at: trx.fn.now(),
                  status: "pending_approval",
                  date_updated: trx.fn.now(),
                });

              if (!updated) {
                const error = new Error("referral_bind_failed");
                error.status = 500;
                throw error;
              }
            }
          }

          return {
            id: organizationId,
            name,
            slug,
            status: "active",
          };
        });

        return res.status(201).json({ data: organization });
      } catch (error) {
        if (error?.status === 403) {
          return res.status(403).json({ error: "forbidden" });
        }

        if (error?.status === 409) {
          return res.status(409).json({ error: "already_configured" });
        }

        logger.error(error, "Findelio account setup failed");
        return res.status(500).json({ error: "create_failed" });
      }
    });
  },
};

export default findelioAccountSetupEndpoint;
