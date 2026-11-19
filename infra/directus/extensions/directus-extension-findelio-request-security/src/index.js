import { createHmac } from "node:crypto";
import { registerTwoFactor } from "./two-factor.js";
import { loginAccountKey, normalizeLoginEmail } from "./login-budget.js";
import {
  createRequestLimiter,
  isServerAccount,
} from "../../directus-extension-findelio-review-notification/dist/request-security.js";

const requestSecurityHook = (hooks, context) => {
  const { init, filter } = hooks;
  const { database, env, logger } = context;
  const consume = createRequestLimiter(database);
  registerTwoFactor(hooks, context, consume);
  const key = (value) => createHmac("sha256", String(env.SECRET)).update(value).digest("hex");
  // Directus 12.5 invokes websocket.authenticate AFTER checking credentials.
  // auth.login is the shared pre-password boundary for REST and WebSocket.
  filter("auth.login", async (payload, { provider, status }) => {
    if (provider !== "default" || status !== "pending") return payload;
    const fail = (code, status) => Object.assign(new Error(code), { name: "DirectusError", code, status });
    const email = normalizeLoginEmail(payload.email);
    if (!email || email.length > 254) throw fail("INVALID_PAYLOAD", 400);
    let allowed;
    try {
      allowed = await consume(loginAccountKey(env.SECRET, email), 10, 900);
    } catch {
      logger.error("Findelio account login limiter unavailable");
      throw fail("SERVICE_UNAVAILABLE", 503);
    }
    if (!allowed) throw fail("REQUESTS_EXCEEDED", 429);
    return payload;
  });
  init("routes.before", ({ app }) => {
    app.use("/auth/login", async (req, res, next) => {
      if (req.method !== "POST") return next();
      try {
        // Website login already limits the visitor's IP. A verified service
        // token avoids treating every website visitor as one shared proxy IP.
        const service = await isServerAccount(database, req.accountability);
        const ipAllowed = service || await consume(`cms-login-ip:${key(req.ip || "unknown")}`, 30, 900);
        if (!ipAllowed) {
          res.set("Retry-After", "900");
          return res.status(429).json({ errors: [{ extensions: { code: "REQUESTS_EXCEEDED" } }] });
        }
        return next();
      } catch (error) {
        logger.error(error, "Findelio login limiter unavailable");
        return res.status(503).json({ errors: [{ extensions: { code: "SERVICE_UNAVAILABLE" } }] });
      }
    });
  });
};

export default requestSecurityHook;
