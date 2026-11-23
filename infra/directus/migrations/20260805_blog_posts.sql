BEGIN;

CREATE TABLE blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar(20) NOT NULL DEFAULT 'draft',
  locale varchar(10) NOT NULL DEFAULT 'de-ch',
  slug varchar(180) NOT NULL,
  title varchar(220) NOT NULL,
  excerpt varchar(360) NOT NULL,
  body text NOT NULL,
  category varchar(100),
  author_name varchar(140) NOT NULL DEFAULT 'Findelio Redaktion',
  cover_image uuid REFERENCES directus_files(id) ON DELETE SET NULL,
  cover_alt varchar(240),
  featured boolean NOT NULL DEFAULT false,
  seo_title varchar(220),
  seo_description varchar(360),
  published_at timestamptz,
  user_created uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  date_created timestamptz NOT NULL DEFAULT now(),
  user_updated uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT blog_posts_locale_check
    CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro')),
  CONSTRAINT blog_posts_slug_check
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_posts_locale_slug_unique UNIQUE (locale, slug)
);

CREATE INDEX blog_posts_publication_idx
  ON blog_posts (locale, status, published_at DESC);

CREATE INDEX blog_posts_featured_idx
  ON blog_posts (locale, featured, published_at DESC)
  WHERE status = 'published';

INSERT INTO directus_collections (
  collection, icon, note, display_template, accountability
)
VALUES (
  'blog_posts',
  'article',
  'Mehrsprachige Findelio-Ratgeberartikel mit Entwurfs- und Veröffentlichungsstatus.',
  '{{title}} – {{locale}}',
  'all'
);

INSERT INTO directus_fields (
  collection, field, special, interface, options, display, readonly, hidden, sort, width, required
)
VALUES
  ('blog_posts', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('blog_posts', 'status', NULL, 'select-dropdown', '{"choices":[{"text":"Entwurf","value":"draft"},{"text":"Veröffentlicht","value":"published"},{"text":"Archiviert","value":"archived"}]}', 'labels', false, false, 2, 'half', true),
  ('blog_posts', 'locale', NULL, 'select-dropdown', '{"choices":[{"text":"Deutsch (Schweiz)","value":"de-ch"},{"text":"English","value":"en"},{"text":"Slovenčina","value":"sk"},{"text":"Čeština","value":"cs"},{"text":"Magyar","value":"hu"},{"text":"Polski","value":"pl"},{"text":"Русский","value":"ru"},{"text":"Português","value":"pt-pt"},{"text":"Română","value":"ro"}]}', 'labels', false, false, 3, 'half', true),
  ('blog_posts', 'title', NULL, 'input', '{"placeholder":"Klarer, hilfreicher Artikeltitel"}', NULL, false, false, 4, 'full', true),
  ('blog_posts', 'slug', NULL, 'input', '{"placeholder":"artikel-titel-in-kleinbuchstaben"}', NULL, false, false, 5, 'full', true),
  ('blog_posts', 'excerpt', NULL, 'input-multiline', '{"placeholder":"Kurze Zusammenfassung für Übersicht und Suchresultate"}', NULL, false, false, 6, 'full', true),
  ('blog_posts', 'body', NULL, 'input-rich-text-md', '{"toolbar":["bold","italic","heading","link","quote","code","bullist","numlist","table"]}', NULL, false, false, 7, 'full', true),
  ('blog_posts', 'category', NULL, 'input', '{"placeholder":"Zum Beispiel Sichtbarkeit oder Mehrsprachigkeit"}', NULL, false, false, 8, 'half', false),
  ('blog_posts', 'author_name', NULL, 'input', NULL, NULL, false, false, 9, 'half', true),
  ('blog_posts', 'cover_image', 'file', 'file-image', NULL, 'image', false, false, 10, 'full', false),
  ('blog_posts', 'cover_alt', NULL, 'input', '{"placeholder":"Was ist auf dem Titelbild zu sehen?"}', NULL, false, false, 11, 'full', false),
  ('blog_posts', 'featured', 'cast-boolean', 'boolean', NULL, 'boolean', false, false, 12, 'half', false),
  ('blog_posts', 'published_at', NULL, 'datetime', NULL, 'datetime', false, false, 13, 'half', false),
  ('blog_posts', 'seo_title', NULL, 'input', '{"placeholder":"Optional; sonst wird der Artikeltitel verwendet"}', NULL, false, false, 14, 'full', false),
  ('blog_posts', 'seo_description', NULL, 'input-multiline', '{"placeholder":"Optional; sonst wird die Zusammenfassung verwendet"}', NULL, false, false, 15, 'full', false),
  ('blog_posts', 'user_created', 'user-created', 'select-dropdown-m2o', NULL, 'user', true, true, 16, 'half', false),
  ('blog_posts', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 17, 'half', false),
  ('blog_posts', 'user_updated', 'user-updated', 'select-dropdown-m2o', NULL, 'user', true, true, 18, 'half', false),
  ('blog_posts', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 19, 'half', false);

INSERT INTO directus_relations (
  many_collection, many_field, one_collection, one_deselect_action
)
VALUES
  ('blog_posts', 'cover_image', 'directus_files', 'nullify'),
  ('blog_posts', 'user_created', 'directus_users', 'nullify'),
  ('blog_posts', 'user_updated', 'directus_users', 'nullify');

COMMIT;
