BEGIN;

ALTER TABLE listings
  ADD COLUMN custom_cta_label varchar(80),
  ADD COLUMN custom_cta_value varchar(500);

CREATE TABLE listing_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  type varchar(20) NOT NULL DEFAULT 'update',
  status varchar(20) NOT NULL DEFAULT 'draft',
  title varchar(180) NOT NULL,
  excerpt text,
  body text,
  image uuid REFERENCES directus_files(id) ON DELETE SET NULL,
  cta_label varchar(80),
  cta_url varchar(500),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  submitted_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  replaces_post uuid REFERENCES listing_posts(id) ON DELETE SET NULL,
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_posts_type_check
    CHECK (type IN ('update', 'offer', 'event')),
  CONSTRAINT listing_posts_status_check
    CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'archived')),
  CONSTRAINT listing_posts_period_check
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX listing_posts_listing_idx ON listing_posts (listing);
CREATE INDEX listing_posts_public_idx
  ON listing_posts (status, published_at DESC);
CREATE INDEX listing_posts_replaces_post_idx ON listing_posts (replaces_post);

CREATE TABLE listing_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  search_impressions integer NOT NULL DEFAULT 0,
  profile_views integer NOT NULL DEFAULT 0,
  website_clicks integer NOT NULL DEFAULT 0,
  phone_clicks integer NOT NULL DEFAULT 0,
  email_clicks integer NOT NULL DEFAULT 0,
  social_clicks integer NOT NULL DEFAULT 0,
  custom_cta_clicks integer NOT NULL DEFAULT 0,
  post_views integer NOT NULL DEFAULT 0,
  post_cta_clicks integer NOT NULL DEFAULT 0,
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_metrics_daily_unique UNIQUE (listing, metric_date),
  CONSTRAINT listing_metrics_daily_non_negative CHECK (
    search_impressions >= 0 AND profile_views >= 0 AND
    website_clicks >= 0 AND phone_clicks >= 0 AND
    email_clicks >= 0 AND social_clicks >= 0 AND
    custom_cta_clicks >= 0 AND post_views >= 0 AND
    post_cta_clicks >= 0
  )
);

CREATE INDEX listing_metrics_daily_date_idx
  ON listing_metrics_daily (metric_date DESC);

CREATE TABLE listing_metric_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  recipient varchar(254) NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_metric_reports_unique
    UNIQUE (listing, period_start, period_end, recipient)
);

INSERT INTO directus_collections (
  collection, icon, note, display_template, accountability
)
VALUES
  ('listing_posts', 'campaign', 'Premium-Aktionen und Veranstaltungen mit Freigabe.', '{{title}}', 'all'),
  ('listing_metrics_daily', 'monitoring', 'Zusammengefasste tägliche Leistungswerte ohne personenbezogene Besucherdaten.', '{{metric_date}}', 'all'),
  ('listing_metric_reports', 'outgoing_mail', 'Protokoll der versendeten monatlichen Premium-Berichte.', '{{period_start}} – {{recipient}}', 'all');

INSERT INTO directus_fields (
  collection, field, special, interface, options, display, readonly, hidden, sort, width, required
)
VALUES
  ('listings', 'custom_cta_label', NULL, 'input', '{"placeholder":"z. B. Termin vereinbaren"}', NULL, false, false, 23, 'half', false),
  ('listings', 'custom_cta_value', NULL, 'input', '{"placeholder":"https://…, mailto:… oder tel:…"}', NULL, false, false, 24, 'half', false),

  ('listing_posts', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('listing_posts', 'listing', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', 'related-values', false, false, 2, 'full', true),
  ('listing_posts', 'type', NULL, 'select-dropdown', '{"choices":[{"text":"Neuigkeit","value":"update"},{"text":"Aktion","value":"offer"},{"text":"Veranstaltung","value":"event"}]}', 'labels', false, false, 3, 'half', true),
  ('listing_posts', 'status', NULL, 'select-dropdown', '{"choices":[{"text":"Entwurf","value":"draft"},{"text":"Zur Prüfung","value":"pending"},{"text":"Veröffentlicht","value":"published"},{"text":"Abgelehnt","value":"rejected"},{"text":"Archiviert","value":"archived"}]}', 'labels', false, false, 4, 'half', true),
  ('listing_posts', 'title', NULL, 'input', NULL, NULL, false, false, 5, 'full', true),
  ('listing_posts', 'excerpt', NULL, 'input-multiline', NULL, NULL, false, false, 6, 'full', false),
  ('listing_posts', 'body', NULL, 'input-rich-text-html', NULL, NULL, false, false, 7, 'full', false),
  ('listing_posts', 'image', 'file', 'file-image', NULL, 'image', false, false, 8, 'full', false),
  ('listing_posts', 'cta_label', NULL, 'input', NULL, NULL, false, false, 9, 'half', false),
  ('listing_posts', 'cta_url', NULL, 'input', NULL, NULL, false, false, 10, 'half', false),
  ('listing_posts', 'starts_at', NULL, 'datetime', NULL, NULL, false, false, 11, 'half', false),
  ('listing_posts', 'ends_at', NULL, 'datetime', NULL, NULL, false, false, 12, 'half', false),
  ('listing_posts', 'published_at', NULL, 'datetime', NULL, NULL, false, false, 13, 'half', false),
  ('listing_posts', 'submitted_by', 'm2o', 'select-dropdown-m2o', '{"template":"{{first_name}} {{last_name}} – {{email}}"}', NULL, false, false, 14, 'half', false),
  ('listing_posts', 'submitted_at', NULL, 'datetime', NULL, NULL, false, false, 15, 'half', false),
  ('listing_posts', 'reviewed_by', 'm2o', 'select-dropdown-m2o', '{"template":"{{first_name}} {{last_name}} – {{email}}"}', NULL, false, false, 16, 'half', false),
  ('listing_posts', 'reviewed_at', NULL, 'datetime', NULL, NULL, false, false, 17, 'half', false),
  ('listing_posts', 'rejection_reason', NULL, 'input-multiline', NULL, NULL, false, false, 18, 'full', false),
  ('listing_posts', 'replaces_post', 'm2o', 'select-dropdown-m2o', '{"template":"{{title}}"}', 'related-values', true, true, 19, 'full', false),
  ('listing_posts', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 20, 'half', false),
  ('listing_posts', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 21, 'half', false),

  ('listing_metrics_daily', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('listing_metrics_daily', 'listing', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', 'related-values', false, false, 2, 'full', true),
  ('listing_metrics_daily', 'metric_date', NULL, 'datetime', '{"includeSeconds":false}', 'datetime', false, false, 3, 'full', true),
  ('listing_metrics_daily', 'search_impressions', NULL, 'input', NULL, NULL, true, false, 4, 'half', true),
  ('listing_metrics_daily', 'profile_views', NULL, 'input', NULL, NULL, true, false, 5, 'half', true),
  ('listing_metrics_daily', 'website_clicks', NULL, 'input', NULL, NULL, true, false, 6, 'half', true),
  ('listing_metrics_daily', 'phone_clicks', NULL, 'input', NULL, NULL, true, false, 7, 'half', true),
  ('listing_metrics_daily', 'email_clicks', NULL, 'input', NULL, NULL, true, false, 8, 'half', true),
  ('listing_metrics_daily', 'social_clicks', NULL, 'input', NULL, NULL, true, false, 9, 'half', true),
  ('listing_metrics_daily', 'custom_cta_clicks', NULL, 'input', NULL, NULL, true, false, 10, 'half', true),
  ('listing_metrics_daily', 'post_views', NULL, 'input', NULL, NULL, true, false, 11, 'half', true),
  ('listing_metrics_daily', 'post_cta_clicks', NULL, 'input', NULL, NULL, true, false, 12, 'half', true),
  ('listing_metrics_daily', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 13, 'half', false),
  ('listing_metrics_daily', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 14, 'half', false),

  ('listing_metric_reports', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('listing_metric_reports', 'listing', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', 'related-values', false, false, 2, 'full', true),
  ('listing_metric_reports', 'period_start', NULL, 'datetime', NULL, 'datetime', true, false, 3, 'half', true),
  ('listing_metric_reports', 'period_end', NULL, 'datetime', NULL, 'datetime', true, false, 4, 'half', true),
  ('listing_metric_reports', 'recipient', NULL, 'input', NULL, NULL, true, false, 5, 'full', true),
  ('listing_metric_reports', 'sent_at', NULL, 'datetime', NULL, 'datetime', true, false, 6, 'full', true);

INSERT INTO directus_relations (
  many_collection, many_field, one_collection, one_deselect_action
)
VALUES
  ('listing_posts', 'listing', 'listings', 'delete'),
  ('listing_posts', 'image', 'directus_files', 'nullify'),
  ('listing_posts', 'submitted_by', 'directus_users', 'nullify'),
  ('listing_posts', 'reviewed_by', 'directus_users', 'nullify'),
  ('listing_posts', 'replaces_post', 'listing_posts', 'nullify'),
  ('listing_metrics_daily', 'listing', 'listings', 'delete'),
  ('listing_metric_reports', 'listing', 'listings', 'delete');

UPDATE directus_permissions
SET fields = fields || ',custom_cta_label,custom_cta_value'
WHERE collection = 'listings'
  AND action IN ('read', 'update')
  AND fields IS NOT NULL
  AND fields NOT LIKE '%custom_cta_label%';

INSERT INTO directus_permissions (
  collection, action, permissions, validation, presets, fields, policy
)
VALUES
  ('listing_posts', 'read', '{"_and":[{"listing":{"status":{"_eq":"published"}}},{"status":{"_eq":"published"}}]}', NULL, NULL, 'id,listing,type,status,title,excerpt,body,image,cta_label,cta_url,starts_at,ends_at,published_at,date_created,date_updated', 'abf8a154-5b1c-4a46-ac9c-7300570f4f17'),
  ('listing_posts', 'read', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('listing_posts', 'create', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('listing_posts', 'update', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('listing_metrics_daily', 'read', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('listing_metrics_daily', 'create', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('listing_metrics_daily', 'update', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('listing_metric_reports', 'read', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('listing_metric_reports', 'create', NULL, NULL, NULL, '*', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65');

COMMIT;
