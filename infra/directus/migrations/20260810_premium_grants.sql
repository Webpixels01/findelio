BEGIN;

CREATE TABLE premium_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premium_grants_reason_check CHECK (length(btrim(reason)) >= 3),
  CONSTRAINT premium_grants_period_check CHECK (
    ends_at IS NULL OR ends_at > starts_at
  )
);

CREATE INDEX premium_grants_listing_idx ON premium_grants (listing);
CREATE INDEX premium_grants_active_idx
  ON premium_grants (starts_at, ends_at, revoked_at);

INSERT INTO directus_collections (
  collection, icon, note, display_template, accountability
)
VALUES (
  'premium_grants',
  'card_giftcard',
  'Kostenlose Premium-Freischaltungen durch Findelio-Administratoren.',
  '{{reason}}',
  'all'
);

INSERT INTO directus_fields (
  collection, field, special, interface, options, display, readonly, hidden,
  sort, width, required
)
VALUES
  ('premium_grants', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('premium_grants', 'listing', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', 'related-values', false, false, 2, 'half', true),
  ('premium_grants', 'granted_by', 'm2o', 'select-dropdown-m2o', '{"template":"{{first_name}} {{last_name}} – {{email}}"}', NULL, true, false, 3, 'half', false),
  ('premium_grants', 'reason', NULL, 'input-multiline', '{"placeholder":"z. B. Partnerschaft oder Kulanz"}', NULL, false, false, 4, 'full', true),
  ('premium_grants', 'starts_at', NULL, 'datetime', NULL, 'datetime', false, false, 5, 'half', true),
  ('premium_grants', 'ends_at', NULL, 'datetime', NULL, 'datetime', false, false, 6, 'half', false),
  ('premium_grants', 'revoked_at', NULL, 'datetime', NULL, 'datetime', true, false, 7, 'half', false),
  ('premium_grants', 'revoked_by', 'm2o', 'select-dropdown-m2o', '{"template":"{{first_name}} {{last_name}} – {{email}}"}', NULL, true, false, 8, 'half', false),
  ('premium_grants', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 9, 'half', false),
  ('premium_grants', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 10, 'half', false);

INSERT INTO directus_relations (
  many_collection, many_field, one_collection, one_deselect_action
)
VALUES
  ('premium_grants', 'listing', 'listings', 'delete'),
  ('premium_grants', 'granted_by', 'directus_users', 'nullify'),
  ('premium_grants', 'revoked_by', 'directus_users', 'nullify');

INSERT INTO directus_permissions (
  collection, action, permissions, validation, fields, policy
)
VALUES
  ('premium_grants', 'read', NULL, NULL,
    'id,listing,granted_by,reason,starts_at,ends_at,revoked_at,revoked_by,date_created,date_updated',
    'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('premium_grants', 'create', NULL, NULL, '*',
    'b6735d88-ef24-4a9f-ae36-dfbf522eba65'),
  ('premium_grants', 'update', NULL, NULL, '*',
    'b6735d88-ef24-4a9f-ae36-dfbf522eba65');

COMMIT;
