import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OTP = /^\d{6}$/;
const setupReads = new Set(["/users/me", "/permissions/me", "/roles/me", "/server/info", "/auth", "/settings", "/findelio-security/tfa"]);
const studioBootstrapReads = new Set(["/fields", "/collections", "/relations", "/presets", "/flows", "/dashboards", "/panels", "/folders", "/extensions", "/notifications", "/translations"]);
const setupWrites = new Set(["/auth/logout", "/auth/refresh", "/users/me/tfa/generate", "/users/me/tfa/enable", "/findelio-security/tfa"]);
// Directus recognizes extension errors by this public error shape.
const failure = (code, status = 403) => Object.assign(new Error(code), { name: "DirectusError", code, status });

export function safeSetupRead(path, query) {
  if (!["/users/me", "/roles/me", "/settings"].includes(path)) return true;
  // An administrator's own profile must not become a gateway to other users
  // via deep/alias queries or relational wildcard expansion before enrollment.
  if (Object.keys(query).some(key => !["fields", "fields[]", "access_token"].includes(key))) return false;
  const fields = query.fields ?? query["fields[]"] ?? "*";
  const values = Array.isArray(fields) ? fields : [fields];
  return values.every(value => typeof value === "string" && value.split(",").every(field =>
    field === "*" || /^[a-z_][a-z0-9_]*$/i.test(field) ||
    (path === "/users/me" && ["role.id", "role.name"].includes(field))));
}

// Unverified claims are used ONLY to impose restrictions. The authenticate
// filters always return the unchanged default; Directus still verifies tokens.
export function tokenClaims(token) {
  try {
    if (typeof token !== "string" || token.split(".").length !== 3) return null;
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return typeof claims.id === "string" && UUID.test(claims.id) ? claims : null;
  } catch { return null; }
}

export function createSetupTickets(secret) {
  const sign = (value) => createHmac("sha256", String(secret)).update("findelio-tfa-setup:" + value).digest("hex");
  return {
    issue(user, key) {
      const payload = Buffer.from(JSON.stringify({ user, key, expires: Date.now() + 600_000 })).toString("base64url");
      return payload + "." + sign(payload);
    },
    read(ticket, user) {
      if (typeof ticket !== "string" || ticket.length > 2048) throw failure("INVALID_SETUP", 400);
      const [payload, signature, extra] = ticket.split(".");
      if (extra !== undefined || !signature || !/^[0-9a-f]{64}$/.test(signature) ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) throw failure("INVALID_SETUP", 400);
      const value = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (value.user !== user || value.expires <= Date.now() || !/^[A-Z2-7]{16,128}$/.test(value.key)) throw failure("INVALID_SETUP", 400);
      return value.key;
    },
  };
}

export function registerTwoFactor({ filter, init }, { database, services, env, logger }, consume) {
  const tickets = createSetupTickets(env.SECRET);

  async function state(id) {
    if (!id || !UUID.test(id)) return null;
    const result = await database.raw(`WITH RECURSIVE roles(id) AS (
      SELECT role FROM directus_users WHERE id = ?
      UNION SELECT r.parent FROM directus_roles r JOIN roles ON r.id = roles.id WHERE r.parent IS NOT NULL
    ) SELECT u.id, u.provider, (u.tfa_secret IS NOT NULL) AS enabled,
      EXISTS (SELECT 1 FROM directus_access a JOIN directus_policies p ON p.id = a.policy
        WHERE (a.user = u.id OR a.role IN (SELECT id FROM roles))
        AND (p.admin_access = true OR p.enforce_tfa = true)) AS required
      FROM directus_users u WHERE u.id = ? AND u.status = 'active'`, [id, id]);
    return result.rows[0] ?? null;
  }

  async function tokenState(token) {
    if (!token || typeof token !== "string") return null;
    const claims = tokenClaims(token);
    const id = claims?.id ?? (await database("directus_users").select("id").where({ token }).first())?.id;
    const user = await state(id);
    return user ? { ...user, pending: claims?.findelio_tfa_pending === true } : null;
  }

  filter("auth.jwt", async (payload, meta) => {
    const user = await state(meta.user);
    if (user?.required && !user.enabled) {
      return { ...payload, enforce_tfa: true, findelio_tfa_pending: true };
    }
    return payload;
  });

  // Runs before the Directus response cache, REST, GraphQL and extensions.
  filter("authenticate", async (accountability, { req }) => {
    const user = await tokenState(req.token);
    if (user && ((user.required && !user.enabled) || user.pending)) {
      const path = new URL(req.originalUrl, "http://directus").pathname.replace(/\/+$/, "").toLowerCase();
      // Studio hydrates its stores before showing its native 2FA form. Give
      // this limited session empty stores, never administrative records. Use
      // dedicated URLs before the cache so an earlier admin response cannot leak.
      if (req.method === "GET" && (studioBootstrapReads.has(path) || path === "/policies/me/globals")) {
        const notificationCount = path === "/notifications" && (req.query.aggregate || req.query["aggregate[count]"]);
        req.url = req.originalUrl = path === "/policies/me/globals" ? "/findelio-security/bootstrap-access" :
          notificationCount ? "/findelio-security/bootstrap-count" : "/findelio-security/bootstrap-empty";
        return accountability;
      }
      if (!((req.method === "GET" && setupReads.has(path) && safeSetupRead(path, req.query)) || (req.method === "POST" && setupWrites.has(path)))) {
        throw failure("TFA_SETUP_REQUIRED");
      }
    }
    return accountability;
  });

  filter("websocket.authenticate", async (accountability, { message }) => {
    let user;
    if (message.access_token) user = await tokenState(message.access_token);
    else if (message.email) user = await state((await database("directus_users").select("id").whereRaw("lower(email) = ?", [String(message.email).toLowerCase()]).first())?.id);
    else if (message.refresh_token) {
      user = await state((await database("directus_sessions").select("user").where({ token: message.refresh_token }).first())?.user);
      if (!user) throw failure("INVALID_TOKEN", 401);
    }
    if (user && ((user.required && !user.enabled) || user.pending)) throw failure("TFA_SETUP_REQUIRED");
    return accountability;
  });

  // Future administrator policies also use the native Studio setup screen.
  filter("policies.create", (payload) => payload.admin_access ? { ...payload, enforce_tfa: true } : payload);
  filter("policies.update", async (payload, { keys }) => {
    const existing = payload.admin_access === undefined && await database("directus_policies").whereIn("id", keys).where({ admin_access: true }).first();
    return payload.admin_access || existing ? { ...payload, enforce_tfa: true } : payload;
  });

  filter("users.update", async (payload, { keys }, context) => {
    if (Object.hasOwn(payload, "tfa_secret")) {
      const actor = context.accountability?.user;
      if (payload.tfa_secret === null && actor && keys.some(id => id.toLowerCase() === actor.toLowerCase()) && (await state(actor))?.required) {
        throw failure("TFA_REQUIRED");
      }
      await (context.database ?? database)("directus_sessions").whereIn("user", keys).delete();
    }
    return payload;
  });

  init("routes.before", ({ app }) => {
    for (const [path, data] of [
      ["/findelio-security/bootstrap-empty", []],
      ["/findelio-security/bootstrap-count", [{ count: { id: 0 } }]],
      ["/findelio-security/bootstrap-access", { app_access: true, admin_access: false, enforce_tfa: true }],
    ]) app.get(path, (req, res) => {
      res.set("Cache-Control", "no-store");
      if (!req.accountability?.user) return res.status(401).json({ errors: [{ extensions: { code: "INVALID_CREDENTIALS" } }] });
      return res.json({ data });
    });
    // Limit native Studio enrollment/OTP attempts as well as the website flow.
    app.use("/users", async (req, res, next) => {
      if (req.method !== "POST" || !/^\/[^/]+\/tfa\/(generate|enable|disable)\/?$/i.test(req.path) || !req.accountability?.user) return next();
      try {
        const user = await state(req.accountability.user);
        const target = decodeURIComponent(req.path.split("/")[1]).toLowerCase();
        if (/\/tfa\/disable\/?$/i.test(req.path) && (target === "me" || target === req.accountability.user.toLowerCase()) && user?.required) throw failure("TFA_REQUIRED");
        if (!(await consume(`tfa:${req.accountability.user}`, 10, 900))) throw failure("REQUESTS_EXCEEDED", 429);
        return next();
      } catch (error) { return respondError(res, error); }
    });

    app.get("/findelio-security/tfa", async (req, res) => {
      res.set("Cache-Control", "no-store");
      try {
        const user = await state(req.accountability?.user);
        if (!user) throw failure("INVALID_CREDENTIALS", 401);
        const pending = tokenClaims(req.token)?.findelio_tfa_pending === true;
        return res.json({ data: { enabled: user.enabled, required: user.required, pending, passwordSupported: user.provider === "default" } });
      } catch (error) { return respondError(res, error); }
    });

    app.post("/findelio-security/tfa", async (req, res) => {
      res.set("Cache-Control", "no-store");
      try {
        const user = await state(req.accountability?.user);
        if (!user) throw failure("INVALID_CREDENTIALS", 401);
        if (!(await consume(`tfa:${user.id}`, 10, 900))) throw failure("REQUESTS_EXCEEDED", 429);
        const { action, password, otp, ticket, backedUp } = req.body ?? {};
        const options = { knex: database, schema: req.schema, accountability: { ...req.accountability, admin: true } };
        // The elevated native service is confined to the authenticated user's ID;
        // no target ID or arbitrary field from the request is ever forwarded.
        const tfa = new services.TFAService(options);
        if (action === "generate" || action === "disable") {
          if (typeof password !== "string" || !password || password.length > 1024 || user.provider !== "default") throw failure("INVALID_PAYLOAD", 400);
          await new services.AuthenticationService(options).verifyPassword(user.id, password);
        }
        if (action === "generate") {
          const generated = await tfa.generateTFA(user.id);
          return res.json({ data: { secret: generated.secret, url: generated.url, ticket: tickets.issue(user.id, generated.secret) } });
        }
        if (typeof otp !== "string" || !OTP.test(otp)) throw failure("INVALID_OTP", 400);
        if (action === "enable") {
          if (backedUp !== true) throw failure("BACKUP_REQUIRED", 400);
          const secret = tickets.read(ticket, user.id);
          if (!(await tfa.verifyOTP(user.id, otp, secret))) throw failure("INVALID_OTP", 400);
          await tfa.enableTFA(user.id, otp, secret);
        } else if (action === "disable") {
          if (user.required) throw failure("TFA_REQUIRED");
          if (!(await tfa.verifyOTP(user.id, otp))) throw failure("INVALID_OTP", 400);
          await tfa.disableTFA(user.id);
        } else throw failure("INVALID_PAYLOAD", 400);
        // Require a fresh login after enrollment/disable, including on other devices.
        await database("directus_sessions").where({ user: user.id }).delete();
        return res.json({ data: { success: true } });
      } catch (error) { return respondError(res, error); }
    });
  });

  function respondError(res, error) {
    const status = Number(error.status) || 500;
    if (status >= 500) logger.error("Findelio two-factor operation unavailable");
    if (status === 429) res.set("Retry-After", "900");
    return res.status(status).json({ errors: [{ extensions: { code: status >= 500 ? "SERVICE_UNAVAILABLE" : error.code || "INVALID_PAYLOAD" } }] });
  }
}
