BEGIN;

CREATE TABLE deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(20) NOT NULL,
  organization uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  listing uuid REFERENCES listings(id) ON DELETE SET NULL,
  target_name varchar(255) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  reason text,
  requested_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  locale varchar(10) NOT NULL DEFAULT 'de-ch',
  decided_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  decision_note text,
  decided_at timestamptz,
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deletion_requests_entity_type_check
    CHECK (entity_type IN ('listing', 'organization')),
  CONSTRAINT deletion_requests_status_check
    CHECK (status IN ('pending', 'cancelled', 'rejected', 'approved')),
  CONSTRAINT deletion_requests_locale_check
    CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro')),
  CONSTRAINT deletion_requests_target_check
    CHECK (
      (entity_type = 'listing' AND listing IS NOT NULL) OR
      (entity_type = 'organization' AND listing IS NULL)
    )
);

CREATE UNIQUE INDEX deletion_requests_pending_listing_unique
  ON deletion_requests (listing)
  WHERE status = 'pending' AND entity_type = 'listing';

CREATE UNIQUE INDEX deletion_requests_pending_organization_unique
  ON deletion_requests (organization)
  WHERE status = 'pending' AND entity_type = 'organization';

CREATE INDEX deletion_requests_status_created_idx
  ON deletion_requests (status, date_created DESC);

INSERT INTO directus_collections (
  collection, icon, note, display_template, accountability
)
VALUES (
  'deletion_requests',
  'delete_sweep',
  'Prüfpflichtige Löschanfragen für Organisationen und Firmeneinträge.',
  '{{target_name}} – {{status}}',
  'all'
);

INSERT INTO directus_fields (
  collection, field, special, interface, options, display, readonly, hidden, sort, width, required
)
VALUES
  ('deletion_requests', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('deletion_requests', 'entity_type', NULL, 'select-dropdown', '{"choices":[{"text":"Firmeneintrag","value":"listing"},{"text":"Organisation","value":"organization"}]}', 'labels', true, false, 2, 'half', true),
  ('deletion_requests', 'organization', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', 'related-values', true, false, 3, 'full', true),
  ('deletion_requests', 'listing', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', 'related-values', true, false, 4, 'full', false),
  ('deletion_requests', 'target_name', NULL, 'input', NULL, NULL, true, false, 5, 'full', true),
  ('deletion_requests', 'status', NULL, 'select-dropdown', '{"choices":[{"text":"Offen","value":"pending"},{"text":"Zurückgezogen","value":"cancelled"},{"text":"Abgelehnt","value":"rejected"},{"text":"Bestätigt","value":"approved"}]}', 'labels', true, false, 6, 'half', true),
  ('deletion_requests', 'reason', NULL, 'input-multiline', NULL, NULL, true, false, 7, 'full', false),
  ('deletion_requests', 'requested_by', 'm2o', 'select-dropdown-m2o', '{"template":"{{first_name}} {{last_name}} – {{email}}"}', 'related-values', true, false, 8, 'full', false),
  ('deletion_requests', 'locale', NULL, 'select-dropdown', '{"choices":[{"text":"Deutsch","value":"de-ch"},{"text":"English","value":"en"},{"text":"Slovenčina","value":"sk"},{"text":"Čeština","value":"cs"},{"text":"Magyar","value":"hu"},{"text":"Polski","value":"pl"},{"text":"Русский","value":"ru"},{"text":"Português","value":"pt-pt"},{"text":"Română","value":"ro"}]}', 'labels', true, false, 9, 'half', true),
  ('deletion_requests', 'decided_by', 'm2o', 'select-dropdown-m2o', '{"template":"{{first_name}} {{last_name}} – {{email}}"}', 'related-values', true, false, 10, 'full', false),
  ('deletion_requests', 'decision_note', NULL, 'input-multiline', NULL, NULL, true, false, 11, 'full', false),
  ('deletion_requests', 'decided_at', NULL, 'datetime', NULL, 'datetime', true, false, 12, 'half', false),
  ('deletion_requests', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 13, 'half', false),
  ('deletion_requests', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 14, 'half', false);

INSERT INTO directus_relations (
  many_collection, many_field, one_collection, one_deselect_action
)
VALUES
  ('deletion_requests', 'organization', 'organizations', 'nullify'),
  ('deletion_requests', 'listing', 'listings', 'nullify'),
  ('deletion_requests', 'requested_by', 'directus_users', 'nullify'),
  ('deletion_requests', 'decided_by', 'directus_users', 'nullify');

COMMIT;
