import { createHmac } from "node:crypto";

// Shared across partners, workers and new-registration/resend paths. Failed mail
// attempts retain their allowance: transport errors must not enable a mail loop.
export async function consumeVerificationBudget(database, email, secret) {
  if (!secret) throw new Error("Verification budget secret is required");
  const recipientKey = createHmac("sha256", String(secret))
    .update(email.trim().toLowerCase()).digest("hex");
  const result = await database.raw(`
    INSERT INTO findelio_verification_mail_budget
      (recipient_key, count, expires_at, next_allowed_at)
    VALUES (?, 1, NOW() + INTERVAL '1 day', NOW() + INTERVAL '60 seconds')
    ON CONFLICT (recipient_key) DO UPDATE SET
      count = CASE WHEN findelio_verification_mail_budget.expires_at <= NOW()
        THEN 1 ELSE findelio_verification_mail_budget.count + 1 END,
      expires_at = CASE WHEN findelio_verification_mail_budget.expires_at <= NOW()
        THEN EXCLUDED.expires_at ELSE findelio_verification_mail_budget.expires_at END,
      next_allowed_at = EXCLUDED.next_allowed_at
    WHERE findelio_verification_mail_budget.next_allowed_at <= NOW()
      AND (findelio_verification_mail_budget.expires_at <= NOW()
        OR findelio_verification_mail_budget.count < 3)
    RETURNING recipient_key
  `, [recipientKey]);
  return result.rows.length > 0;
}
