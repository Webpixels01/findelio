import { createHmac } from "node:crypto";
import {
  createRequestLimiter,
  isServerAccount,
} from "../../directus-extension-findelio-review-notification/dist/request-security.js";

const requestSecurityHook = ({ init }, { database, env, logger }) => {
  const consume = createRequestLimiter(database);
  const key = (value) => createHmac("sha256", String(env.SECRET)).update(value).digest("hex");
  init("routes.before", ({ app }) => {
    app.use("/auth/login", async (req, res, next) => {
      if (req.method !== "POST") return next();
      try {
        // Website login already limits the visitor's IP. A verified service
        // token avoids treating every website visitor as one shared proxy IP.
        const service = await isServerAccount(database, req.accountability);
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const ipAllowed = service || await consume(`cms-login-ip:${key(req.ip || "unknown")}`, 30, 900);
        const accountAllowed = ipAllowed && (!email || await consume(`cms-login-account:${key(email)}`, 10, 900));
        if (!ipAllowed || !accountAllowed) {
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
