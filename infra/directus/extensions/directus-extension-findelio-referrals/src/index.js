import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { registerApprovalRoutes } from "./referral-approval.js";
import { registerAdminRoutes } from "./referral-admin.js";
import {
  classifyRegistrationUser,
  emailFailsPublicRegistrationFilter,
  isCompetingEmailRegistrationError,
  isReferralRegistrationEnabled,
  isUrlAllowed,
  normalizeEmail,
  normalizeReferralCode,
} from "./referral-utils.js";

// The official pnpm-based Directus image exposes @directus/api, but does not
// hoist its dependencies beside extensions. Resolve the pinned host's modules.
const hostRequire = createRequire(createRequire(import.meta.url).resolve("@directus/api"));
const jwt = hostRequire("jsonwebtoken");
const { validatePayload } = await import(pathToFileURL(hostRequire.resolve("@directus/utils")).href);

async function stall(ms, startedAt) {
  const elapsed = performance.now() - startedAt;
  const wait = Math.max(0, ms - elapsed);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

async function getUserByEmail(trx, email) {
  return trx("directus_users")
    .select("id", "role", "status", "email", "password", "provider")
    .whereRaw("LOWER(??) = ?", ["email", normalizeEmail(email)])
    .first();
}

async function sendVerificationMail({
  MailService,
  schema,
  email,
  firstName,
  lastName,
  verificationUrl,
  secret,
  tokenTtl,
  logger,
}) {
  const mailService = new MailService({
    schema,
    accountability: null,
  });
  const token = jwt.sign(
    { email, scope: "pending-registration" },
    secret,
    {
      expiresIn: tokenTtl || "7d",
      issuer: "directus",
    },
  );
  const url = new URL(verificationUrl);
  url.searchParams.set("token", token);

  await mailService
    .send({
      to: email,
      subject: "Verify your email address",
      template: {
        name: "user-registration",
        data: {
          url: url.toString(),
          email,
          first_name: firstName,
          last_name: lastName,
        },
      },
    })
    .catch(() => {
      logger.error("Could not send email verification mail");
    });
}

const findelioReferralsEndpoint = {
  id: "findelio-referrals",
  handler: (router, { database, env, getSchema, logger, services, emitter }) => {
    const { MailService, UsersService } = services;
    registerApprovalRoutes(router, { database, env, getSchema, logger, services, emitter });
    registerAdminRoutes(router, { database, env, getSchema, logger, services });

    router.post("/register", async (req, res) => {
      const startedAt = performance.now();
      const stallMs = Number(env.REGISTER_STALL_TIME ?? 500);

      // Reject before any referral_* table access when the feature is off.
      if (!isReferralRegistrationEnabled(env)) {
        return res.status(503).json({ error: "feature_disabled" });
      }

      const firstName =
        typeof req.body?.first_name === "string"
          ? req.body.first_name.trim()
          : "";
      const lastName =
        typeof req.body?.last_name === "string"
          ? req.body.last_name.trim()
          : "";
      const email = normalizeEmail(req.body?.email);
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";
      const verificationUrl =
        typeof req.body?.verification_url === "string"
          ? req.body.verification_url.trim()
          : "";
      const referralCode = normalizeReferralCode(req.body?.referral_code);

      if (!email || !password || !firstName || !lastName || !verificationUrl) {
        return res.status(400).json({ error: "invalid_data" });
      }

      if (!isUrlAllowed(verificationUrl, env.USER_REGISTER_URL_ALLOW_LIST)) {
        return res.status(400).json({ error: "invalid_verification_url" });
      }

      if (
        !referralCode ||
        referralCode.length < 3 ||
        referralCode.length > 64
      ) {
        return res.status(400).json({ error: "invalid_referral" });
      }

      try {
        const schema = await getSchema();
        const settings = await database("directus_settings")
          .select(
            "public_registration",
            "public_registration_verify_email",
            "public_registration_role",
            "public_registration_email_filter",
          )
          .first();

        if (!settings?.public_registration) {
          await stall(stallMs, startedAt);
          return res.status(403).json({ error: "forbidden" });
        }

        if (
          emailFailsPublicRegistrationFilter(
            settings.public_registration_email_filter,
            email,
            validatePayload,
          )
        ) {
          await stall(stallMs, startedAt);
          return res.status(403).json({ error: "forbidden" });
        }

        const publicRegistrationRole =
          settings.public_registration_role ?? null;
        const hasEmailVerification = Boolean(
          settings.public_registration_verify_email,
        );

        let shouldSendMail = false;

        await database.transaction(async (trx) => {
          const partner = await trx("referral_partners")
            .select("id", "code", "status")
            .whereRaw("lower(btrim(code)) = ?", [referralCode.toLowerCase()])
            .forUpdate()
            .first();

          if (!partner || partner.status !== "active") {
            const error = new Error("invalid_referral");
            error.status = 400;
            throw error;
          }

          const existing = await getUserByEmail(trx, email);
          const classification = classifyRegistrationUser(
            existing,
            hasEmailVerification,
          );

          if (classification !== "create") {
            // Existing users: never insert a redemption; optionally resend mail.
            shouldSendMail = classification === "resend_only";
            return;
          }

          // UsersService.createOne uses knex: trx — same transaction as the
          // redemption insert below. Failure of either rolls both back.
          const usersService = new UsersService({
            accountability: null,
            schema,
            knex: trx,
          });

          const userId = await usersService.createOne({
            email,
            password,
            role: publicRegistrationRole,
            status: hasEmailVerification ? "unverified" : "active",
            first_name: firstName,
            last_name: lastName,
          });

          await trx("referral_redemptions").insert({
            id: randomUUID(),
            partner: partner.id,
            code_snapshot: partner.code,
            user: userId,
            status: "pending_organization",
            registered_at: trx.fn.now(),
            date_created: trx.fn.now(),
            date_updated: trx.fn.now(),
          });

          shouldSendMail = hasEmailVerification;
        });

        if (shouldSendMail) {
          await sendVerificationMail({
            MailService,
            schema,
            email,
            firstName,
            lastName,
            verificationUrl,
            secret: env.SECRET,
            tokenTtl: env.EMAIL_VERIFICATION_TOKEN_TTL,
            logger,
          });
        }

        await stall(stallMs, startedAt);
        return res.status(204).send();
      } catch (error) {
        if (error?.status === 400 && error.message === "invalid_referral") {
          await stall(stallMs, startedAt);
          return res.status(400).json({ error: "invalid_referral" });
        }

        if (isCompetingEmailRegistrationError(error)) {
          await stall(stallMs, startedAt);
          return res.status(204).send();
        }

        // Directus validation extensions can contain the submitted password.
        // Neither return nor log the raw error or validation metadata.
        if (error?.code === "FAILED_VALIDATION") {
          await stall(stallMs, startedAt);
          return res.status(400).json({ error: "invalid_data" });
        }

        logger.error("Findelio referral registration failed");
        await stall(stallMs, startedAt);
        return res.status(500).json({ error: "registration_failed" });
      }
    });
  },
};

export default findelioReferralsEndpoint;
