import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { searchDirectory } from '@/lib/directory-search';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const locale = query.get('locale');
  const filters = Object.fromEntries(['q', 'sprache', 'branche', 'kanton', 'ort'].map(key => [key, query.get(key) || '']));
  if (!hasLocale(routing.locales, locale) || Object.values(filters).some(value => value.length > 200)) {
    return Response.json({ error: 'invalid_data' }, { status: 400 });
  }
  if (filters.q.trim().length < 2) return Response.json({ items: [] });
  try {
    const result = await searchDirectory(locale, filters, 1, true);
    return Response.json({ items: result.items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
