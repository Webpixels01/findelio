// Collect history for every published listing, including before a premium upgrade.
// Access to the statistics remains restricted to premium owners.
export function getMetricListings(database, listingIds) {
  return database('listings').whereIn('id', listingIds).where('status', 'published')
    .distinct('id');
}
