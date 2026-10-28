// Hold the record lock through mail submission and the durable sent marker.
// Rollback on send rejection permits a retry; concurrent requests serialize.
// SMTP acceptance followed by a process/commit failure remains ambiguous (SMTP
// has no transactional idempotency key), so delivery cannot be exactly-once.
export async function sendReviewOnce(database, collection, id, version, send) {
  if (!["listing_revisions", "listing_posts"].includes(collection)) {
    throw new Error("Invalid review collection");
  }
  return database.transaction(async (trx) => {
    const current = await trx(collection).select("status", "review_notification_version")
      .where({ id }).forUpdate().first();
    if (!current || current.status !== "pending" ||
        String(current.review_notification_version) !== String(version)) return false;
    const key = { collection, record_id: id, version };
    const claimed = await trx("findelio_review_mail_deliveries").insert(key)
      .onConflict(["collection", "record_id", "version"]).ignore().returning("record_id");
    if (!claimed.length) return false;
    await send();
    return true;
  });
}
