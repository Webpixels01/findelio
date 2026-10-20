// Synthetic directory data for pagination tests. Never connects to production.
export const locales = ['de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro', 'vi'];
export function fixture(count = 137) {
  const directory = (code, name) => ({ id: code, code, name,
    translations: locales.map(l => ({ languages_code: l === 'de-ch' ? 'de-CH' : l === 'pt-pt' ? 'pt-PT' : l, name })) });
  const industries = [directory('auto', 'Auto'), directory('it', 'IT')];
  const languages = [directory('de', 'Deutsch'), directory('sk', 'Slowakisch')];
  const listings = Array.from({ length: count }, (_, i) => ({
    id: `id-${String(i + 1).padStart(4, '0')}`, name: `Firma ${String(i + 1).padStart(4, '0')}`, slug: `firma-${i + 1}`,
    organization: 'org', status: 'published', description: 'Deutsche Beschreibung',
    description_translations: { sk: 'Slovenský opis', en: 'English description' }, logo: null,
    postal_code: i % 2 ? '8000' : '3000', city: i % 2 ? 'Zürich' : 'Bern',
    canton: { code: i % 2 ? 'ZH' : 'BE', name: i % 2 ? 'Zürich' : 'Bern' }, verification_status: 'unverified',
    industries: [{ industries_id: industries[i % 2] }],
    spoken_languages: [{ spoken_languages_id: languages[i % 2] }],
  }));
  const premium = listings.slice(-13).map(x => x.id);
  return { listings: [...listings, { ...listings[0], id: 'draft-id', name: 'Draft', status: 'draft' }], premium, industries,
    languages, cantons: [{ code: 'ZH', name: 'Zürich' }, { code: 'BE', name: 'Bern' }], requests: [], failListings: false };
}
function matches(value, filter) {
  if (Array.isArray(value)) return value.some(item => matches(item, filter));
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '_and') return expected.every(f => matches(value, f));
    if (key === '_or') return expected.some(f => matches(value, f));
    if (key === '_eq') return value === expected;
    if (key === '_in') return expected.includes(value);
    if (key === '_nin') return !expected.includes(value);
    if (key === '_icontains') return String(value).toLowerCase().includes(expected.toLowerCase());
    return matches(value?.[key], expected);
  });
}
export function reply(url, data) {
  const u = new URL(url);
  const collection = u.pathname.split('/').at(-1);
  data.requests.push(u);
  if (collection === 'subscriptions') return { data: data.premium.slice(0, 7).map(listing => ({ listing, current_period_end: null })) };
  if (collection === 'premium_grants') return { data: data.premium.slice(6).map(listing => ({ id: listing, listing, starts_at: '2020-01-01T00:00:00Z', ends_at: null, revoked_at: null })) };
  if (collection === 'industries') return { data: data.industries };
  if (collection === 'spoken_languages') return { data: data.languages };
  if (collection === 'cantons') return { data: data.cantons };
  if (collection !== 'listings') return { data: [] };
  if (data.failListings) throw new Error('Simulated Directus outage');
  const filter = JSON.parse(u.searchParams.get('filter') || '{}');
  let selected = data.listings.filter(x => matches(x, filter));
  if (u.searchParams.has('aggregate[countDistinct]')) return { data: [{ countDistinct: { id: String(selected.length) } }] };
  selected.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const offset = Number(u.searchParams.get('offset') || 0);
  const limit = Number(u.searchParams.get('limit') || 100);
  selected = selected.slice(offset, limit < 0 ? undefined : offset + limit);
  if (u.searchParams.get('fields') === 'id') selected = selected.map(({ id }) => ({ id }));
  return { data: selected };
}
