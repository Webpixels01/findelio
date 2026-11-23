import "server-only";
import type { AppLocale } from "@/i18n/routing";

export type SearchSuggestion = { id: string; name: string; city: string };
export async function searchDirectory(locale: AppLocale, filters: Record<string, string | undefined>, page = 1, suggest = false): Promise<{ items: SearchSuggestion[]; total: number }> {
  const url = new URL('/findelio-review-notification/directory-search', process.env.DIRECTUS_URL);
  url.searchParams.set('locale', locale);
  url.searchParams.set('page', String(page));
  if (suggest) url.searchParams.set('suggest', '1');
  for (const key of ['q', 'sprache', 'branche', 'kanton', 'ort']) {
    const value = filters[key];
    if (value !== undefined && (typeof value !== 'string' || value.length > 200)) throw new Error('Invalid search filter');
    if (value?.trim()) url.searchParams.set(key, value.trim());
  }
  const token = process.env.DIRECTUS_TOKEN?.trim();
  if (!token) throw new Error('Directus-Konfiguration fehlt.');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Directory search failed: ${response.status}`);
  return (await response.json()).data;
}
