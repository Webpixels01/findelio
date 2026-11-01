// Tracking must include the same subscription and grant entitlements that make
// premium features visible on the website, including trials and unlimited grants.
export function getMetricListings(database, listingIds, now = new Date()) {
  const subscriptions = database('subscriptions').select('listing')
    .where('plan', 'premium').whereIn('status', ['active', 'past_due'])
    .where(query => query.whereNull('current_period_end').orWhere('current_period_end', '>', now));
  const grants = database('premium_grants').select('listing')
    .whereNull('revoked_at').where('starts_at', '<=', now)
    .where(query => query.whereNull('ends_at').orWhere('ends_at', '>', now));
  return database('listings').whereIn('id', listingIds).where('status', 'published')
    .where(query => query.whereIn('id', subscriptions).orWhereIn('id', grants))
    .distinct('id');
}
