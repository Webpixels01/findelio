BEGIN;

CREATE UNIQUE INDEX organization_members_organization_user_unique
  ON organization_members (organization, "user")
  WHERE organization IS NOT NULL AND "user" IS NOT NULL;

CREATE TABLE organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email varchar(254) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'editor',
  status varchar(20) NOT NULL DEFAULT 'pending',
  token_hash varchar(64) NOT NULL UNIQUE,
  invited_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  locale varchar(10) NOT NULL DEFAULT 'de-ch',
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_invitations_role_check
    CHECK (role IN ('admin', 'editor')),
  CONSTRAINT organization_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  CONSTRAINT organization_invitations_locale_check
    CHECK (locale IN ('de-ch', 'en', 'sk', 'cs', 'hu', 'pl', 'ru', 'pt-pt', 'ro')),
  CONSTRAINT organization_invitations_expiry_check
    CHECK (expires_at > date_created)
);

CREATE UNIQUE INDEX organization_invitations_pending_email_unique
  ON organization_invitations (organization, lower(email))
  WHERE status = 'pending';

CREATE INDEX organization_invitations_expiry_idx
  ON organization_invitations (status, expires_at);

INSERT INTO directus_collections (
  collection, icon, note, display_template, accountability
)
VALUES (
  'organization_invitations',
  'mark_email_unread',
  'Zeitlich begrenzte Einladungen für Organisationsteams.',
  '{{email}} – {{organization.name}}',
  'all'
);

INSERT INTO directus_fields (
  collection, field, special, interface, options, display, readonly, hidden, sort, width, required
)
VALUES
  ('organization_invitations', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('organization_invitations', 'organization', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', 'related-values', true, false, 2, 'full', true),
  ('organization_invitations', 'email', NULL, 'input', NULL, NULL, true, false, 3, 'full', true),
  ('organization_invitations', 'role', NULL, 'select-dropdown', '{"choices":[{"text":"Administrator","value":"admin"},{"text":"Bearbeiter","value":"editor"}]}', 'labels', true, false, 4, 'half', true),
  ('organization_invitations', 'status', NULL, 'select-dropdown', '{"choices":[{"text":"Ausstehend","value":"pending"},{"text":"Angenommen","value":"accepted"},{"text":"Zurückgezogen","value":"cancelled"},{"text":"Abgelaufen","value":"expired"}]}', 'labels', true, false, 5, 'half', true),
  ('organization_invitations', 'token_hash', NULL, 'input', NULL, NULL, true, true, 6, 'full', true),
  ('organization_invitations', 'invited_by', 'm2o', 'select-dropdown-m2o', '{"template":"{{first_name}} {{last_name}} – {{email}}"}', 'related-values', true, false, 7, 'full', false),
  ('organization_invitations', 'expires_at', NULL, 'datetime', NULL, 'datetime', true, false, 8, 'half', true),
  ('organization_invitations', 'accepted_at', NULL, 'datetime', NULL, 'datetime', true, false, 9, 'half', false),
  ('organization_invitations', 'locale', NULL, 'select-dropdown', '{"choices":[{"text":"Deutsch","value":"de-ch"},{"text":"English","value":"en"},{"text":"Slovenčina","value":"sk"},{"text":"Čeština","value":"cs"},{"text":"Magyar","value":"hu"},{"text":"Polski","value":"pl"},{"text":"Русский","value":"ru"},{"text":"Português","value":"pt-pt"},{"text":"Română","value":"ro"}]}', 'labels', true, false, 10, 'half', true),
  ('organization_invitations', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 11, 'half', false),
  ('organization_invitations', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 12, 'half', false);

INSERT INTO directus_relations (
  many_collection, many_field, one_collection, one_deselect_action
)
VALUES
  ('organization_invitations', 'organization', 'organizations', 'delete'),
  ('organization_invitations', 'invited_by', 'directus_users', 'nullify');

COMMIT;
