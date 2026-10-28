BEGIN;

ALTER TABLE listing_posts
  ADD COLUMN IF NOT EXISTS replaces_post uuid REFERENCES listing_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS listing_posts_replaces_post_idx
  ON listing_posts (replaces_post);

INSERT INTO directus_fields (
  collection, field, special, interface, options, display,
  readonly, hidden, sort, width, required
)
SELECT
  'listing_posts', 'replaces_post', 'm2o', 'select-dropdown-m2o',
  '{"template":"{{title}}"}', 'related-values',
  true, true, 19, 'full', false
WHERE NOT EXISTS (
  SELECT 1
  FROM directus_fields
  WHERE collection = 'listing_posts' AND field = 'replaces_post'
);

INSERT INTO directus_relations (
  many_collection, many_field, one_collection, one_deselect_action
)
SELECT 'listing_posts', 'replaces_post', 'listing_posts', 'nullify'
WHERE NOT EXISTS (
  SELECT 1
  FROM directus_relations
  WHERE many_collection = 'listing_posts' AND many_field = 'replaces_post'
);

COMMIT;
