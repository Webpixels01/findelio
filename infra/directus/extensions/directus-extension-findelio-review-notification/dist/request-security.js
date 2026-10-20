export const requestLimits = {
  "login-ip": [30, 900],
  "login-account": [10, 900],
  upload: [10, 3600],
  contact: [5, 900],
  metrics: [120, 60],
};

export const validClientKey = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export async function isServerAccount(database, accountability) {
  if (!accountability?.user || !accountability?.role) return false;
  const role = await database("directus_roles").select("name").where("id", accountability.role).first();
  return role?.name === "Findelio Server";
}

export function createRequestLimiter(database, { cleanup = true } = {}) {
  let nextCleanup = 0;
  return async (key, maximum, seconds) => {
    // Expiry is checked atomically, so simultaneous requests and multiple
    // Directus processes cannot reset or exceed a shared allowance.
    const result = await database.raw(`
      INSERT INTO findelio_request_limits (key, count, expires_at)
      VALUES (?, 1, NOW() + (? * INTERVAL '1 second'))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN findelio_request_limits.expires_at <= NOW()
          THEN 1 ELSE findelio_request_limits.count + 1 END,
        expires_at = CASE WHEN findelio_request_limits.expires_at <= NOW()
          THEN EXCLUDED.expires_at ELSE findelio_request_limits.expires_at END
      WHERE findelio_request_limits.expires_at <= NOW()
         OR findelio_request_limits.count < ?
      RETURNING count
    `, [key, seconds, maximum]);
    if (cleanup && Date.now() >= nextCleanup) {
      nextCleanup = Date.now() + 60_000;
      await database("findelio_request_limits").where("expires_at", "<=", database.fn.now()).delete();
    }
    return result.rows.length > 0;
  };
}
