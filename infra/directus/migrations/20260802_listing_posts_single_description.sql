BEGIN;

UPDATE listing_posts
SET body = excerpt
WHERE (body IS NULL OR btrim(body) = '')
  AND excerpt IS NOT NULL
  AND btrim(excerpt) <> '';

UPDATE directus_fields
SET hidden = true
WHERE collection = 'listing_posts'
  AND field = 'excerpt';

COMMIT;
