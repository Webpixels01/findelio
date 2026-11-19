-- When this migration is applied while Directus is running with Redis caching,
-- clear the Redis cache and restart Directus so its schema cache sees the field.
BEGIN;

ALTER TABLE listings
  ADD COLUMN description_translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT listings_description_translations_object_check
    CHECK (jsonb_typeof(description_translations) = 'object');

UPDATE listings
SET description = short_description
WHERE (description IS NULL OR btrim(description) = '')
  AND short_description IS NOT NULL
  AND btrim(short_description) <> '';

UPDATE directus_fields
SET hidden = true
WHERE collection = 'listings'
  AND field = 'short_description';

INSERT INTO directus_fields (
  collection,
  field,
  special,
  interface,
  options,
  readonly,
  hidden,
  sort,
  width,
  required
)
VALUES (
  'listings',
  'description_translations',
  'cast-json',
  'input-code',
  '{"language":"json"}',
  false,
  true,
  25,
  'full',
  false
);

UPDATE directus_permissions
SET fields = fields || ',description_translations'
WHERE collection = 'listings'
  AND action IN ('read', 'create', 'update')
  AND fields IS NOT NULL
  AND fields <> '*'
  AND fields NOT LIKE '%description_translations%';

COMMIT;
