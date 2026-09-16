import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

const invitationLifetimeDays = 7;
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
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{40,100}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const invitationCopy = {
  "de-ch": {
    subject: "Einladung zum Findelio-Team",
    heading: "Du wurdest zu einem Findelio-Team eingeladen",
    intro: "Eine Organisation möchte ihren Findelio-Auftritt gemeinsam mit dir verwalten.",
    roleLabel: "Deine Rolle",
    roles: { admin: "Administrator", editor: "Bearbeiter" },
    expiresLabel: "Einladung gültig bis",
    button: "Einladung annehmen",
    hint: "Erstelle dein Konto mit genau dieser E-Mail-Adresse. Nach der E-Mail-Bestätigung wird die Einladung automatisch angenommen. Falls du bereits ein Findelio-Konto hast, kannst du dich stattdessen anmelden.",
  },
  en: {
    subject: "Invitation to a Findelio team",
    heading: "You have been invited to a Findelio team",
    intro: "An organization would like to manage its Findelio presence together with you.",
    roleLabel: "Your role",
    roles: { admin: "Administrator", editor: "Editor" },
    expiresLabel: "Invitation valid until",
    button: "Accept invitation",
    hint: "Create your account with this exact email address. After email confirmation, the invitation will be accepted automatically. If you already have a Findelio account, you can sign in instead.",
  },
  sk: {
    subject: "Pozvánka do tímu Findelio",
    heading: "Boli ste pozvaní do tímu Findelio",
    intro: "Organizácia chce spolu s vami spravovať svoju prezentáciu na Findelio.",
    roleLabel: "Vaša rola",
    roles: { admin: "Administrátor", editor: "Redaktor" },
    expiresLabel: "Pozvánka platí do",
    button: "Prijať pozvánku",
    hint: "Vytvorte si účet presne s touto e-mailovou adresou. Po potvrdení e-mailu sa pozvánka prijme automaticky. Ak už máte účet Findelio, môžete sa namiesto toho prihlásiť.",
  },
  cs: {
    subject: "Pozvánka do týmu Findelio",
    heading: "Byli jste pozváni do týmu Findelio",
    intro: "Organizace chce společně s vámi spravovat svou prezentaci na Findelio.",
    roleLabel: "Vaše role",
    roles: { admin: "Administrátor", editor: "Redaktor" },
    expiresLabel: "Pozvánka platí do",
    button: "Přijmout pozvánku",
    hint: "Vytvořte si účet přesně s touto e-mailovou adresou. Po potvrzení e-mailu se pozvánka přijme automaticky. Pokud už máte účet Findelio, můžete se místo toho přihlásit.",
  },
  hu: {
    subject: "Meghívás egy Findelio-csapatba",
    heading: "Meghívást kaptál egy Findelio-csapatba",
    intro: "Egy szervezet veled együtt szeretné kezelni Findelio-megjelenését.",
    roleLabel: "Szerepköröd",
    roles: { admin: "Adminisztrátor", editor: "Szerkesztő" },
    expiresLabel: "A meghívó eddig érvényes",
    button: "Meghívás elfogadása",
    hint: "Pontosan ezzel az e-mail-címmel hozd létre a fiókodat. Az e-mail-cím megerősítése után a meghívás automatikusan elfogadásra kerül. Ha már van Findelio-fiókod, inkább jelentkezz be.",
  },
  pl: {
    subject: "Zaproszenie do zespołu Findelio",
    heading: "Otrzymujesz zaproszenie do zespołu Findelio",
    intro: "Organizacja chce wspólnie z Tobą zarządzać swoją obecnością w Findelio.",
    roleLabel: "Twoja rola",
    roles: { admin: "Administrator", editor: "Redaktor" },
    expiresLabel: "Zaproszenie ważne do",
    button: "Przyjmij zaproszenie",
    hint: "Utwórz konto dokładnie z tym adresem e-mail. Po potwierdzeniu adresu zaproszenie zostanie przyjęte automatycznie. Jeśli masz już konto Findelio, zaloguj się zamiast tego.",
  },
  ru: {
    subject: "Приглашение в команду Findelio",
    heading: "Вас пригласили в команду Findelio",
    intro: "Организация хочет вместе с вами управлять своим присутствием в Findelio.",
    roleLabel: "Ваша роль",
    roles: { admin: "Администратор", editor: "Редактор" },
    expiresLabel: "Приглашение действительно до",
    button: "Принять приглашение",
    hint: "Создайте аккаунт именно с этим адресом электронной почты. После подтверждения адреса приглашение будет принято автоматически. Если у вас уже есть аккаунт Findelio, войдите в него.",
  },
  "pt-pt": {
    subject: "Convite para uma equipa Findelio",
    heading: "Recebeu um convite para uma equipa Findelio",
    intro: "Uma organização quer gerir a sua presença no Findelio em conjunto consigo.",
    roleLabel: "A sua função",
    roles: { admin: "Administrador", editor: "Editor" },
    expiresLabel: "Convite válido até",
    button: "Aceitar convite",
    hint: "Crie a sua conta exatamente com este endereço de e-mail. Após a confirmação, o convite será aceite automaticamente. Se já tiver uma conta Findelio, inicie sessão em alternativa.",
  },
  ro: {
    subject: "Invitație într-o echipă Findelio",
    heading: "Ai fost invitat într-o echipă Findelio",
    intro: "O organizație dorește să își administreze prezența pe Findelio împreună cu tine.",
    roleLabel: "Rolul tău",
    roles: { admin: "Administrator", editor: "Editor" },
    expiresLabel: "Invitație valabilă până la",
    button: "Acceptă invitația",
    hint: "Creează contul exact cu această adresă de e-mail. După confirmare, invitația va fi acceptată automat. Dacă ai deja un cont Findelio, autentifică-te în schimb.",
  },
};

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

function durationMilliseconds(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  const match = String(value ?? "")
    .trim()
    .match(/^(\d+)(ms|s|m|h|d|w)$/i);
  if (!match) return fallback;

  const factors = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return Number(match[1]) * factors[match[2].toLowerCase()];
}

function signAccessToken(payload, secret, lifetimeMs) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + Math.max(Math.floor(lifetimeMs / 1000), 60),
      iss: "directus",
    }),
  ).toString("base64url");
  const unsignedToken = `${header}.${claims}`;
  const signature = createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

async function createDirectusSession(trx, env, req, user) {
  const secret = String(env.SECRET ?? "");
  if (!secret) throw new Error("missing_secret");

  const accessLifetime = durationMilliseconds(
    env.ACCESS_TOKEN_TTL,
    15 * 60 * 1000,
  );
  const refreshLifetime = durationMilliseconds(
    env.REFRESH_TOKEN_TTL,
    7 * 24 * 60 * 60 * 1000,
  );
  const refreshToken = randomBytes(48).toString("base64url");

  await trx("directus_sessions").insert({
    token: refreshToken,
    user: user.id,
    expires: new Date(Date.now() + refreshLifetime),
    ip: req.ip ?? null,
    user_agent: req.get("user-agent")?.slice(0, 1024) ?? null,
    origin: req.get("origin") ?? null,
  });
  await trx("directus_users")
    .where("id", user.id)
    .update({ last_access: trx.fn.now() });

  return {
    access_token: signAccessToken(
      {
        id: user.id,
        role: user.role,
        app_access: false,
        admin_access: false,
      },
      secret,
      accessLifetime,
    ),
    refresh_token: refreshToken,
    expires: accessLifetime,
  };
}

function canInviteRole(actorRole, invitedRole) {
  return (
    (actorRole === "owner" && ["admin", "editor"].includes(invitedRole)) ||
    (actorRole === "admin" && invitedRole === "editor")
  );
}

function canManageTarget(actorRole, targetRole) {
  return (
    (actorRole === "owner" && ["admin", "editor"].includes(targetRole)) ||
    (actorRole === "admin" && targetRole === "editor")
  );
}

async function activeMembership(database, userId, organizationId) {
  return database("organization_members as memberships")
    .join("organizations", "memberships.organization", "organizations.id")
    .select(
      "memberships.id",
      "memberships.role",
      "memberships.organization",
      "organizations.name as organization_name",
    )
    .where({
      "memberships.user": userId,
      "memberships.organization": organizationId,
      "memberships.status": "active",
      "organizations.status": "active",
    })
    .first();
}

function teamMemberCapabilities(actor, member, userId) {
  const isSelf = member.user_id === userId;
  const canManage =
    !isSelf && canManageTarget(actor.role, member.role);

  return {
    can_change_role: canManage && actor.role === "owner",
    can_remove: canManage,
  };
}

const findelioTeamManagementEndpoint = {
  id: "findelio-team-management",
  handler: (router, { database, env, getSchema, logger, services }) => {
    const { MailService, UsersService } = services;

    router.get("/", async (req, res) => {
      const userId = req.accountability?.user;
      if (!userId) return res.status(401).json({ error: "unauthorized" });

      try {
        const actors = await database("organization_members as memberships")
          .join("organizations", "memberships.organization", "organizations.id")
          .select(
            "memberships.id",
            "memberships.role",
            "memberships.organization",
            "organizations.name as organization_name",
          )
          .where({
            "memberships.user": userId,
            "memberships.status": "active",
            "organizations.status": "active",
          })
          .orderBy("organizations.name");

        const organizationIds = actors.map((actor) => actor.organization);
        if (organizationIds.length === 0) {
          return res.json({ data: [] });
        }

        const [members, invitations] = await Promise.all([
          database("organization_members as memberships")
            .join("directus_users as users", "memberships.user", "users.id")
            .select(
              "memberships.id",
              "memberships.organization",
              "memberships.role",
              "memberships.status",
              "users.id as user_id",
              "users.first_name",
              "users.last_name",
              "users.email",
            )
            .whereIn("memberships.organization", organizationIds)
            .where("memberships.status", "active")
            .orderBy("users.first_name")
            .orderBy("users.last_name")
            .orderBy("users.email"),
          database("organization_invitations")
            .select(
              "id",
              "organization",
              "email",
              "role",
              "status",
              "expires_at",
              "date_created",
            )
            .whereIn("organization", organizationIds)
            .where("status", "pending")
            .where("expires_at", ">", database.fn.now())
            .orderBy("date_created", "desc"),
        ]);

        return res.json({
          data: actors.map((actor) => ({
            id: actor.organization,
            name: actor.organization_name,
            current_role: actor.role,
            invite_roles:
              actor.role === "owner"
                ? ["admin", "editor"]
                : actor.role === "admin"
                  ? ["editor"]
                  : [],
            members: members
              .filter((member) => member.organization === actor.organization)
              .map((member) => ({
                id: member.id,
                user_id: member.user_id,
                first_name: member.first_name,
                last_name: member.last_name,
                email: member.email,
                role: member.role,
                status: member.status,
                ...teamMemberCapabilities(actor, member, userId),
              })),
            invitations: invitations.filter(
              (invitation) => invitation.organization === actor.organization,
            ),
          })),
        });
      } catch (error) {
        logger.error(error, "Findelio team overview failed");
        return res.status(500).json({ error: "load_failed" });
      }
    });

    router.get("/invitations/:token", async (req, res) => {
      const token = String(req.params.token ?? "").trim();
      if (!tokenPattern.test(token)) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const invitation = await database("organization_invitations as invitations")
          .join("organizations", "invitations.organization", "organizations.id")
          .select(
            "invitations.email",
            "invitations.role",
            "invitations.status",
            "invitations.expires_at",
            "invitations.locale",
            "organizations.name as organization_name",
            "organizations.status as organization_status",
          )
          .where("invitations.token_hash", hashToken(token))
          .first();

        if (!invitation || invitation.organization_status !== "active") {
          return res.status(404).json({ error: "not_found" });
        }

        if (
          invitation.status !== "pending" ||
          new Date(invitation.expires_at).getTime() <= Date.now()
        ) {
          return res.status(410).json({ error: "expired" });
        }

        return res.json({
          data: {
            email: invitation.email,
            role: invitation.role,
            expires_at: invitation.expires_at,
            locale: invitation.locale,
            organization_name: invitation.organization_name,
          },
        });
      } catch (error) {
        logger.error(error, "Findelio team invitation lookup failed");
        return res.status(500).json({ error: "load_failed" });
      }
    });

    router.post("/invitations", async (req, res) => {
      const userId = req.accountability?.user;
      const organizationId = String(req.body?.organization_id ?? "").trim();
      const email = normalizeEmail(req.body?.email);
      const role = String(req.body?.role ?? "").trim();
      const requestedLocale = String(req.body?.locale ?? "").trim();
      const locale = supportedLocales.has(requestedLocale)
        ? requestedLocale
        : "de-ch";

      if (!userId) return res.status(401).json({ error: "unauthorized" });
      if (
        !uuidPattern.test(organizationId) ||
        !emailPattern.test(email) ||
        email.length > 254 ||
        !["admin", "editor"].includes(role)
      ) {
        return res.status(400).json({ error: "invalid_data" });
      }

      const siteUrl = String(env.FINDELIO_SITE_URL ?? "")
        .trim()
        .replace(/\/$/, "");
      if (!siteUrl) {
        return res.status(500).json({ error: "configuration_error" });
      }

      let invitation;
      let rawToken;

      try {
        const result = await database.transaction(async (trx) => {
          const actor = await activeMembership(
            trx,
            userId,
            organizationId,
          );
          if (!actor || !canInviteRole(actor.role, role)) {
            const error = new Error("forbidden");
            error.status = 403;
            throw error;
          }

          // Release the partial unique index for invitations whose lifetime has
          // elapsed but whose stored status has not been refreshed yet.
          await trx("organization_invitations")
            .where({ organization: organizationId, status: "pending" })
            .where("expires_at", "<=", trx.fn.now())
            .update({ status: "expired", date_updated: trx.fn.now() });

          const existingMember = await trx("organization_members as memberships")
            .join("directus_users as users", "memberships.user", "users.id")
            .select("memberships.id")
            .where("memberships.organization", organizationId)
            .whereRaw("lower(users.email) = ?", [email])
            .where("memberships.status", "active")
            .first();
          if (existingMember) {
            const error = new Error("member_exists");
            error.status = 409;
            throw error;
          }

          const existingInvitation = await trx("organization_invitations")
            .select("id")
            .where("organization", organizationId)
            .whereRaw("lower(email) = ?", [email])
            .where("status", "pending")
            .first();
          if (existingInvitation) {
            const error = new Error("invitation_exists");
            error.status = 409;
            throw error;
          }

          const recentInvitationCount = await trx("organization_invitations")
            .where("invited_by", userId)
            .where("date_created", ">", trx.raw("now() - interval '1 hour'"))
            .count("id as count")
            .first();
          if (Number(recentInvitationCount?.count ?? 0) >= 20) {
            const error = new Error("rate_limited");
            error.status = 429;
            throw error;
          }

          const pendingCount = await trx("organization_invitations")
            .where({ organization: organizationId, status: "pending" })
            .where("expires_at", ">", trx.fn.now())
            .count("id as count")
            .first();
          if (Number(pendingCount?.count ?? 0) >= 25) {
            const error = new Error("too_many_invitations");
            error.status = 409;
            throw error;
          }

          const token = randomBytes(32).toString("base64url");
          const expiresAt = new Date(
            Date.now() + invitationLifetimeDays * 24 * 60 * 60 * 1000,
          );
          const id = randomUUID();
          await trx("organization_invitations").insert({
            id,
            organization: organizationId,
            email,
            role,
            status: "pending",
            token_hash: hashToken(token),
            invited_by: userId,
            expires_at: expiresAt,
            locale,
          });

          return {
            invitation: {
              id,
              email,
              role,
              expires_at: expiresAt.toISOString(),
              organization_name: actor.organization_name,
            },
            token,
          };
        });
        invitation = result.invitation;
        rawToken = result.token;

        const copy = invitationCopy[locale];
        const invitationUrl = `${siteUrl}/${locale}/firma-eintragen?invitation=${encodeURIComponent(rawToken)}`;
        const expires = new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeZone: "Europe/Zurich",
        }).format(new Date(invitation.expires_at));
        const mailService = new MailService({
          schema: await getSchema(),
          accountability: req.accountability,
          knex: database,
        });

        await mailService.send({
          to: invitation.email,
          subject: `${copy.subject}: ${invitation.organization_name}`,
          text: `${copy.intro}\n\n${invitation.organization_name}\n${copy.roleLabel}: ${copy.roles[invitation.role]}\n${copy.expiresLabel}: ${expires}\n\n${copy.button}:\n${invitationUrl}\n\n${copy.hint}`,
          template: {
            name: "team-invitation",
            data: {
              heading: copy.heading,
              intro: copy.intro,
              organizationName: invitation.organization_name,
              roleLabel: copy.roleLabel,
              role: copy.roles[invitation.role],
              expiresLabel: copy.expiresLabel,
              expires,
              buttonLabel: copy.button,
              invitationUrl,
              hint: copy.hint,
            },
          },
        });

        return res.status(201).json({ data: invitation });
      } catch (error) {
        if (invitation?.id) {
          await database("organization_invitations")
            .where("id", invitation.id)
            .update({ status: "cancelled", date_updated: database.fn.now() });
        }

        const knownStatus = Number(error?.status);
        if ([403, 409, 429].includes(knownStatus)) {
          return res.status(knownStatus).json({ error: error.message });
        }

        logger.error(error, "Findelio team invitation failed");
        return res.status(500).json({ error: "send_failed" });
      }
    });

    router.delete("/invitations/:id", async (req, res) => {
      const userId = req.accountability?.user;
      const invitationId = String(req.params.id ?? "").trim();
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      if (!uuidPattern.test(invitationId)) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const invitation = await database("organization_invitations")
          .select("id", "organization", "role", "status")
          .where("id", invitationId)
          .first();
        if (!invitation || invitation.status !== "pending") {
          return res.status(404).json({ error: "not_found" });
        }

        const actor = await activeMembership(
          database,
          userId,
          invitation.organization,
        );
        if (!actor || !canInviteRole(actor.role, invitation.role)) {
          return res.status(403).json({ error: "forbidden" });
        }

        await database("organization_invitations")
          .where({ id: invitationId, status: "pending" })
          .update({ status: "cancelled", date_updated: database.fn.now() });
        return res.status(204).send();
      } catch (error) {
        logger.error(error, "Findelio team invitation cancellation failed");
        return res.status(500).json({ error: "update_failed" });
      }
    });

    router.patch("/members/:id", async (req, res) => {
      const userId = req.accountability?.user;
      const memberId = String(req.params.id ?? "").trim();
      const role = String(req.body?.role ?? "").trim();
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      if (!uuidPattern.test(memberId) || !["admin", "editor"].includes(role)) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const member = await database("organization_members")
          .select("id", "organization", "user", "role", "status")
          .where("id", memberId)
          .first();
        if (!member || member.status !== "active") {
          return res.status(404).json({ error: "not_found" });
        }

        const actor = await activeMembership(
          database,
          userId,
          member.organization,
        );
        if (
          !actor ||
          actor.role !== "owner" ||
          member.user === userId ||
          !["admin", "editor"].includes(member.role)
        ) {
          return res.status(403).json({ error: "forbidden" });
        }

        await database("organization_members")
          .where("id", memberId)
          .update({ role });
        return res.json({ data: { id: memberId, role } });
      } catch (error) {
        logger.error(error, "Findelio team role update failed");
        return res.status(500).json({ error: "update_failed" });
      }
    });

    router.delete("/members/:id", async (req, res) => {
      const userId = req.accountability?.user;
      const memberId = String(req.params.id ?? "").trim();
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      if (!uuidPattern.test(memberId)) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const member = await database("organization_members")
          .select("id", "organization", "user", "role", "status")
          .where("id", memberId)
          .first();
        if (!member || member.status !== "active") {
          return res.status(404).json({ error: "not_found" });
        }

        const actor = await activeMembership(
          database,
          userId,
          member.organization,
        );
        if (
          !actor ||
          member.user === userId ||
          !canManageTarget(actor.role, member.role)
        ) {
          return res.status(403).json({ error: "forbidden" });
        }

        await database("organization_members")
          .where("id", memberId)
          .update({ status: "disabled" });
        return res.status(204).send();
      } catch (error) {
        logger.error(error, "Findelio team member removal failed");
        return res.status(500).json({ error: "update_failed" });
      }
    });

    router.post("/complete-registration", async (req, res) => {
      const verificationToken = String(
        req.body?.verification_token ?? "",
      ).trim();
      const invitationToken = String(req.body?.invitation_token ?? "").trim();

      if (
        !verificationToken ||
        verificationToken.length > 2048 ||
        !tokenPattern.test(invitationToken)
      ) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const schema = await getSchema();
        const result = await database.transaction(async (trx) => {
          const invitation = await trx(
            "organization_invitations as invitations",
          )
            .join(
              "organizations",
              "invitations.organization",
              "organizations.id",
            )
            .select(
              "invitations.id",
              "invitations.organization",
              "invitations.email",
              "invitations.role",
              "invitations.status",
              "invitations.expires_at",
              "invitations.locale",
              "organizations.name as organization_name",
              "organizations.status as organization_status",
            )
            .where("invitations.token_hash", hashToken(invitationToken))
            .forUpdate()
            .first();

          if (!invitation || invitation.organization_status !== "active") {
            const error = new Error("not_found");
            error.status = 404;
            throw error;
          }
          if (
            invitation.status !== "pending" ||
            new Date(invitation.expires_at).getTime() <= Date.now()
          ) {
            const error = new Error("expired");
            error.status = 410;
            throw error;
          }

          const usersService = new UsersService({
            accountability: null,
            schema,
            knex: trx,
          });
          const userId = await usersService.verifyRegistration(
            verificationToken,
          );
          const user = await trx("directus_users as users")
            .join("directus_roles as roles", "users.role", "roles.id")
            .select(
              "users.id",
              "users.email",
              "users.role",
              "users.status",
              "roles.name as role_name",
            )
            .where("users.id", userId)
            .first();

          if (
            !user ||
            user.status !== "active" ||
            user.role_name !== "Firmenkonto" ||
            normalizeEmail(user.email) !== normalizeEmail(invitation.email)
          ) {
            const error = new Error("email_mismatch");
            error.status = 403;
            throw error;
          }

          const existingMembership = await trx("organization_members")
            .select("id")
            .where({
              organization: invitation.organization,
              user: user.id,
            })
            .forUpdate()
            .first();
          const membershipId = existingMembership?.id ?? randomUUID();

          if (existingMembership) {
            await trx("organization_members")
              .where("id", membershipId)
              .update({ role: invitation.role, status: "active" });
          } else {
            await trx("organization_members").insert({
              id: membershipId,
              organization: invitation.organization,
              user: user.id,
              role: invitation.role,
              status: "active",
            });
          }

          await trx("organization_invitations")
            .where({ id: invitation.id, status: "pending" })
            .update({
              status: "accepted",
              accepted_at: trx.fn.now(),
              date_updated: trx.fn.now(),
            });

          const tokens = await createDirectusSession(trx, env, req, user);

          return {
            ...tokens,
            membership_id: membershipId,
            organization_name: invitation.organization_name,
            locale: invitation.locale,
          };
        });

        return res.json({ data: result });
      } catch (error) {
        const knownStatus = Number(error?.status);
        if ([404, 410].includes(knownStatus)) {
          return res.status(knownStatus).json({ error: error.message });
        }
        if ([400, 401, 403].includes(knownStatus)) {
          return res.status(400).json({ error: "invalid_verification" });
        }

        logger.error(error, "Findelio invited registration failed");
        return res.status(500).json({ error: "registration_failed" });
      }
    });


    router.post("/accept", async (req, res) => {
      const userId = req.accountability?.user;
      const token = String(req.body?.token ?? "").trim();
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      if (!tokenPattern.test(token)) {
        return res.status(400).json({ error: "invalid_data" });
      }

      try {
        const result = await database.transaction(async (trx) => {
          const user = await trx("directus_users")
            .select("id", "email", "status")
            .where("id", userId)
            .forUpdate()
            .first();
          if (!user || user.status !== "active") {
            const error = new Error("forbidden");
            error.status = 403;
            throw error;
          }

          const invitation = await trx("organization_invitations as invitations")
            .join("organizations", "invitations.organization", "organizations.id")
            .select(
              "invitations.id",
              "invitations.organization",
              "invitations.email",
              "invitations.role",
              "invitations.status",
              "invitations.expires_at",
              "organizations.name as organization_name",
              "organizations.status as organization_status",
            )
            .where("invitations.token_hash", hashToken(token))
            .forUpdate()
            .first();

          if (!invitation || invitation.organization_status !== "active") {
            const error = new Error("not_found");
            error.status = 404;
            throw error;
          }
          if (
            invitation.status !== "pending" ||
            new Date(invitation.expires_at).getTime() <= Date.now()
          ) {
            const error = new Error("expired");
            error.status = 410;
            throw error;
          }
          if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
            const error = new Error("email_mismatch");
            error.status = 403;
            throw error;
          }

          const existingMembership = await trx("organization_members")
            .select("id", "status")
            .where({
              organization: invitation.organization,
              user: userId,
            })
            .forUpdate()
            .first();
          const membershipId = existingMembership?.id ?? randomUUID();

          if (existingMembership) {
            await trx("organization_members")
              .where("id", membershipId)
              .update({ role: invitation.role, status: "active" });
          } else {
            await trx("organization_members").insert({
              id: membershipId,
              organization: invitation.organization,
              user: userId,
              role: invitation.role,
              status: "active",
            });
          }

          await trx("organization_invitations")
            .where("id", invitation.id)
            .update({
              status: "accepted",
              accepted_at: trx.fn.now(),
              date_updated: trx.fn.now(),
            });

          return {
            membership_id: membershipId,
            organization_name: invitation.organization_name,
          };
        });

        return res.json({ data: result });
      } catch (error) {
        const knownStatus = Number(error?.status);
        if ([403, 404, 410].includes(knownStatus)) {
          return res.status(knownStatus).json({ error: error.message });
        }

        logger.error(error, "Findelio team invitation acceptance failed");
        return res.status(500).json({ error: "accept_failed" });
      }
    });
  },
};

export default findelioTeamManagementEndpoint;
