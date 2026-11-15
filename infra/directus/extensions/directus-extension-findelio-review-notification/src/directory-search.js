import { isServerAccount } from './request-security.js';

const languages = { 'de-ch': 'de-CH', en: 'en-US', sk: 'sk-SK', cs: 'cs-CZ', hu: 'hu-HU', pl: 'pl-PL', ru: 'ru-RU', 'pt-pt': 'pt-PT', ro: 'ro-RO', vi: 'vi-VN' };
export function searchParameters(input) {
  const text = key => {
    if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > 200)) throw new Error('invalid_data');
    return input[key]?.trim() || '';
  };
  const locale = text('locale');
  const query = text('q');
  const page = input.page === undefined ? 1 : Number(input.page);
  if (!Object.hasOwn(languages, locale) || !query || !Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new Error('invalid_data');
  return { query, locale, translation: languages[locale], language: text('sprache'), industry: text('branche'), canton: text('kanton'), location: text('ort'), limit: input.suggest === '1' ? 6 : 10, offset: input.suggest === '1' ? 0 : (page - 1) * 10 };
}

// Only published, visible profile content is searched. Bound values and strpos
// treat punctuation, SQL syntax and wildcard characters as ordinary search text.
export const directorySearchSql = `
WITH query AS (SELECT lower(public.unaccent(:query)) AS term),
profiles AS (
  SELECT l.id, l.name, l.city, p.premium,
    lower(public.unaccent(l.name)) AS search_name,
    lower(public.unaccent(concat_ws(' ', l.name,
      regexp_replace(CASE WHEN p.premium AND :locale <> 'de-ch'
        THEN COALESCE(NULLIF(l.description_translations ->> :locale, ''), l.description)
        ELSE l.description END, '<[^>]*>', ' ', 'g'),
      (SELECT string_agg(concat_ws(' ', i.name, it.name), ' ')
        FROM listings_industries li JOIN industries i ON i.id = li.industries_id
        LEFT JOIN industries_translations it ON it.industries_id = i.id AND it.languages_code = :translation
        WHERE li.listings_id = l.id)))) AS search_text
  FROM listings l
  CROSS JOIN LATERAL (SELECT (
    EXISTS (SELECT 1 FROM subscriptions s WHERE s.listing = l.id AND s.plan = 'premium'
      AND s.status IN ('active','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > NOW()))
    OR EXISTS (SELECT 1 FROM premium_grants g WHERE g.listing = l.id AND g.revoked_at IS NULL
      AND g.starts_at <= NOW() AND (g.ends_at IS NULL OR g.ends_at > NOW()))
  ) AS premium) p
  WHERE l.status = 'published'
    AND (:language = '' OR EXISTS (SELECT 1 FROM listings_spoken_languages ls JOIN spoken_languages sl ON sl.id = ls.spoken_languages_id WHERE ls.listings_id = l.id AND sl.code = :language))
    AND (:industry = '' OR EXISTS (SELECT 1 FROM listings_industries li JOIN industries i ON i.id = li.industries_id WHERE li.listings_id = l.id AND i.code = :industry))
    AND (:canton = '' OR EXISTS (SELECT 1 FROM cantons c WHERE c.id = l.canton AND c.code = :canton))
    AND (:location = '' OR strpos(lower(public.unaccent(concat_ws(' ', l.city, l.postal_code))), lower(public.unaccent(:location))) > 0)
),
matched AS (
  SELECT profiles.*, CASE WHEN search_name = query.term THEN 0
    WHEN strpos(search_name, query.term) = 1 THEN 1
    WHEN strpos(search_name, query.term) > 0 THEN 2 ELSE 3 END AS relevance
  FROM profiles CROSS JOIN query
  WHERE NOT EXISTS (SELECT 1 FROM regexp_split_to_table(query.term, '\\s+') AS words(word)
    WHERE strpos(search_text, words.word) = 0)
),
paged AS (SELECT * FROM matched ORDER BY relevance, premium DESC, search_name, id LIMIT :limit OFFSET :offset)
SELECT (SELECT count(*)::integer FROM matched) AS total,
  COALESCE(json_agg(json_build_object('id',id,'name',name,'city',city)
    ORDER BY relevance, premium DESC, search_name, id), '[]'::json) AS items
FROM paged`;

export function registerDirectorySearch(router, { database, logger }) {
  router.get('/directory-search', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.accountability?.user) return res.status(401).json({ error: 'unauthorized' });
    let parameters;
    try { parameters = searchParameters(req.query); }
    catch { return res.status(400).json({ error: 'invalid_data' }); }
    try {
      if (!await isServerAccount(database, req.accountability)) return res.status(403).json({ error: 'forbidden' });
      const result = await database.raw(directorySearchSql, parameters).timeout(3000, { cancel: true });
      return res.json({ data: result.rows[0] });
    } catch (error) {
      logger.error(error, 'Directory search failed');
      return res.status(503).json({ error: 'unavailable' });
    }
  });
}
