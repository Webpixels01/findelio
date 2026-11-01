import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseFixture } from './fixtures/metrics-database.mjs';
import { getMetricListings } from '../infra/directus/extensions/directus-extension-findelio-review-notification/src/metric-listings.js';

test('tracks all published listings regardless of premium entitlement, excluding unpublished and unrequested listings', async () => {
  const tables = { listings: ['trial', 'unlimited', 'both', 'paid', 'past_due', 'expired', 'revoked', 'future', 'draft', 'free'].map(id => ({ id, status: id === 'draft' ? 'draft' : 'published' })), subscriptions: [], premium_grants: [] };
  const now = new Date('2026-11-01T12:00:00Z');
  const grant = (listing, overrides = {}) => tables.premium_grants.push({ listing, starts_at: '2026-08-01T00:00:00Z', ends_at: null, revoked_at: null, ...overrides });
  grant('trial', { ends_at: '2026-12-01T00:00:00Z' }); grant('unlimited'); grant('both'); grant('both'); grant('draft');
  grant('expired', { ends_at: now.toISOString() }); grant('revoked', { revoked_at: '2026-10-01T00:00:00Z' }); grant('future', { starts_at: '2026-12-01T00:00:00Z' });
  tables.subscriptions.push(
    { listing: 'unlimited', plan: 'premium', status: 'cancelled', current_period_end: '2028-08-01T00:00:00Z' },
    { listing: 'trial', plan: 'premium', status: 'active', current_period_end: '2026-08-29T00:00:00Z' },
    ...['paid', 'both', 'past_due'].map(listing => ({ listing, plan: 'premium', status: listing === 'past_due' ? 'past_due' : 'active', current_period_end: null })),
  );
  const db = databaseFixture(tables);
  assert.deepEqual((await getMetricListings(db, tables.listings.map(x => x.id), now)).map(x => x.id).sort(), ['both', 'expired', 'free', 'future', 'paid', 'past_due', 'revoked', 'trial', 'unlimited']);
  assert.deepEqual(await getMetricListings(db, ['free', 'free', 'draft', 'missing']), [{ id: 'free' }]);
  assert.deepEqual(await getMetricListings(db, []), []);
  assert.deepEqual(await getMetricListings(db, ['trial'], now), [{ id: 'trial' }]);
});
