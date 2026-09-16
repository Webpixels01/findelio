BEGIN;

INSERT INTO directus_permissions (
  collection,
  action,
  permissions,
  validation,
  presets,
  fields,
  policy
)
SELECT
  'blog_posts',
  'read',
  '{"_and":[{"status":{"_eq":"published"}},{"published_at":{"_nnull":true}},{"published_at":{"_lte":"$NOW"}}]}'::json,
  NULL,
  NULL,
  'id,status,locale,slug,title,excerpt,body,category,author_name,cover_image,cover_alt,featured,seo_title,seo_description,published_at,date_updated',
  'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
WHERE NOT EXISTS (
  SELECT 1
  FROM directus_permissions
  WHERE collection = 'blog_posts'
    AND action = 'read'
    AND policy = 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
);

UPDATE directus_fields
SET options = '{"folder":"5f624475-f28b-4ae9-9826-8f5160a58e3f"}'::json
WHERE collection = 'blog_posts'
  AND field = 'cover_image';

COMMIT;
