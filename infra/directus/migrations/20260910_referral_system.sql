-- Referral system data foundation (NOT applied automatically).
-- Configured Directus image in repo compose files: directus/directus:11.17.4
-- (running instance version is not verified by this file).
--
-- Permissions (intentionally NOT granted here):
-- - No Public role and no Firmenkonto policy write/read on these collections.
-- - Do NOT reuse listing-review access as referral administration rights.
-- - Existing Directus policies/permissions are left unchanged.
-- - Required later (separate change, dedicated admin/policy assignment):
--   * referral_partners: create, read, update for referral administrators only
--   * referral_redemptions: read, update for referral administrators only
--   * Server/extension token access for register/bind/claim flows (not Firmenkonto)
--
-- ID types match existing schema: uuid PKs (listings, organizations, premium_grants,
-- directus_users) as used in 20260810_premium_grants.sql and related migrations.

BEGIN;

CREATE TABLE referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code varchar(64) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  notes text,
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_partners_name_check
    CHECK (length(btrim(name)) >= 2),
  CONSTRAINT referral_partners_code_check
    CHECK (
      code = btrim(code)
      AND btrim(code) <> ''
      AND length(btrim(code)) >= 3
      AND length(btrim(code)) <= 64
    ),
  CONSTRAINT referral_partners_status_check
    CHECK (status IN ('active', 'disabled'))
);

-- Unique after trim + case-fold. Stored values must already equal btrim(code);
-- indexing lower(btrim(code)) still blocks whitespace/case variants consistently.
-- Disabling a partner keeps the row and redemption history (status only).
CREATE UNIQUE INDEX referral_partners_code_unique
  ON referral_partners (lower(btrim(code)));

CREATE TABLE referral_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner uuid NOT NULL REFERENCES referral_partners(id) ON DELETE RESTRICT,
  code_snapshot varchar(64) NOT NULL,
  "user" uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
  organization uuid REFERENCES organizations(id) ON DELETE RESTRICT,
  trial_listing uuid REFERENCES listings(id) ON DELETE RESTRICT,
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  trial_decision varchar(40),
  skip_reason text,
  premium_grant uuid REFERENCES premium_grants(id) ON DELETE RESTRICT,
  status varchar(40) NOT NULL DEFAULT 'pending_organization',
  registered_at timestamptz NOT NULL DEFAULT now(),
  organization_bound_at timestamptz,
  reserved_at timestamptz,
  resolved_at timestamptz,
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_redemptions_code_snapshot_check
    CHECK (
      code_snapshot = btrim(code_snapshot)
      AND btrim(code_snapshot) <> ''
      AND length(btrim(code_snapshot)) >= 3
      AND length(btrim(code_snapshot)) <= 64
    ),
  CONSTRAINT referral_redemptions_status_check
    CHECK (
      status IN (
        'pending_organization',
        'pending_approval',
        'pending_activation',
        'granted',
        'skipped_existing_premium',
        'expired_unactivated',
        'void'
      )
    ),
  CONSTRAINT referral_redemptions_trial_decision_check
    CHECK (
      trial_decision IS NULL
      OR trial_decision IN ('eligible', 'skipped_existing_premium')
    ),
  CONSTRAINT referral_redemptions_trial_period_check
    CHECK (
      trial_ends_at IS NULL
      OR trial_starts_at IS NULL
      OR trial_ends_at > trial_starts_at
    ),
  CONSTRAINT referral_redemptions_reservation_check
    CHECK (
      (
        trial_listing IS NULL
        AND trial_starts_at IS NULL
        AND trial_ends_at IS NULL
        AND trial_decision IS NULL
        AND reserved_at IS NULL
      )
      OR (
        trial_listing IS NOT NULL
        AND trial_starts_at IS NOT NULL
        AND trial_ends_at IS NOT NULL
        AND trial_decision IS NOT NULL
        AND reserved_at IS NOT NULL
      )
    ),
  CONSTRAINT referral_redemptions_granted_check
    CHECK (
      (status <> 'granted' AND premium_grant IS NULL)
      OR (status = 'granted' AND premium_grant IS NOT NULL)
    ),
  CONSTRAINT referral_redemptions_resolved_reservation_check
    CHECK (
      status NOT IN ('pending_activation', 'granted', 'skipped_existing_premium', 'expired_unactivated')
      OR (organization IS NOT NULL AND trial_listing IS NOT NULL AND trial_decision IS NOT NULL)
    ),
  CONSTRAINT referral_redemptions_skipped_check
    CHECK (
      status <> 'skipped_existing_premium'
      OR (
        -- 'eligible' remains immutable if Premium appeared AFTER approval.
        trial_decision IN ('eligible', 'skipped_existing_premium')
        AND skip_reason IS NOT NULL
        AND length(btrim(skip_reason)) >= 3
      )
    )
);

CREATE UNIQUE INDEX referral_redemptions_user_unique
  ON referral_redemptions ("user");

CREATE UNIQUE INDEX referral_redemptions_organization_unique
  ON referral_redemptions (organization)
  WHERE organization IS NOT NULL;

CREATE UNIQUE INDEX referral_redemptions_premium_grant_unique
  ON referral_redemptions (premium_grant)
  WHERE premium_grant IS NOT NULL;

CREATE UNIQUE INDEX referral_redemptions_trial_listing_unique
  ON referral_redemptions (trial_listing)
  WHERE trial_listing IS NOT NULL;

CREATE INDEX referral_redemptions_partner_idx
  ON referral_redemptions (partner);

CREATE INDEX referral_redemptions_status_idx
  ON referral_redemptions (status, date_created DESC);

INSERT INTO directus_collections (
  collection, icon, note, display_template, accountability
)
VALUES
  (
    'referral_partners',
    'handshake',
    'Admin-verwaltete Empfehlungsgeber und Codes (ohne Benutzerkonto). Keine Firmenkonto-/Public-Rechte in dieser Migration.',
    '{{name}} – {{code}}',
    'all'
  ),
  (
    'referral_redemptions',
    'redeem',
    'Dauerhafte Empfehlungs-Einlösungen und Premium-Testreservierungen. Keine Firmenkonto-/Public-Rechte in dieser Migration.',
    '{{code_snapshot}} – {{status}}',
    'all'
  );

INSERT INTO directus_fields (
  collection, field, special, interface, options, display, readonly, hidden,
  sort, width, required
)
VALUES
  ('referral_partners', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  ('referral_partners', 'name', NULL, 'input', NULL, NULL, false, false, 2, 'half', true),
  ('referral_partners', 'code', NULL, 'input', '{"placeholder":"z. B. PARTNER2026"}', NULL, false, false, 3, 'half', true),
  (
    'referral_partners',
    'status',
    NULL,
    'select-dropdown',
    '{"choices":[{"text":"Aktiv","value":"active"},{"text":"Deaktiviert","value":"disabled"}]}',
    'labels',
    false,
    false,
    4,
    'half',
    true
  ),
  ('referral_partners', 'notes', NULL, 'input-multiline', NULL, NULL, false, false, 5, 'full', false),
  ('referral_partners', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 6, 'half', false),
  ('referral_partners', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 7, 'half', false),

  ('referral_redemptions', 'id', 'uuid', 'input', NULL, NULL, true, true, 1, 'full', false),
  (
    'referral_redemptions',
    'partner',
    'm2o',
    'select-dropdown-m2o',
    '{"template":"{{name}} ({{code}})"}',
    'related-values',
    true,
    false,
    2,
    'half',
    true
  ),
  ('referral_redemptions', 'code_snapshot', NULL, 'input', NULL, NULL, true, false, 3, 'half', true),
  (
    'referral_redemptions',
    'user',
    'm2o',
    'select-dropdown-m2o',
    '{"template":"{{first_name}} {{last_name}} – {{email}}"}',
    'related-values',
    true,
    false,
    4,
    'half',
    true
  ),
  (
    'referral_redemptions',
    'organization',
    'm2o',
    'select-dropdown-m2o',
    '{"template":"{{name}}"}',
    'related-values',
    true,
    false,
    5,
    'half',
    false
  ),
  (
    'referral_redemptions',
    'trial_listing',
    'm2o',
    'select-dropdown-m2o',
    '{"template":"{{name}}"}',
    'related-values',
    true,
    false,
    6,
    'half',
    false
  ),
  ('referral_redemptions', 'trial_starts_at', NULL, 'datetime', NULL, 'datetime', true, false, 7, 'half', false),
  ('referral_redemptions', 'trial_ends_at', NULL, 'datetime', NULL, 'datetime', true, false, 8, 'half', false),
  (
    'referral_redemptions',
    'trial_decision',
    NULL,
    'select-dropdown',
    '{"choices":[{"text":"Berechtigt","value":"eligible"},{"text":"Übersprungen (bestehendes Premium)","value":"skipped_existing_premium"}]}',
    'labels',
    true,
    false,
    9,
    'half',
    false
  ),
  ('referral_redemptions', 'skip_reason', NULL, 'input-multiline', NULL, NULL, true, false, 10, 'full', false),
  (
    'referral_redemptions',
    'premium_grant',
    'm2o',
    'select-dropdown-m2o',
    '{"template":"{{reason}}"}',
    'related-values',
    true,
    false,
    11,
    'half',
    false
  ),
  (
    'referral_redemptions',
    'status',
    NULL,
    'select-dropdown',
    '{"choices":[{"text":"Wartet auf Organisation","value":"pending_organization"},{"text":"Wartet auf Freigabe","value":"pending_approval"},{"text":"Wartet auf Aktivierung","value":"pending_activation"},{"text":"Gewährt","value":"granted"},{"text":"Übersprungen (Premium vorhanden)","value":"skipped_existing_premium"},{"text":"Abgelaufen ohne Aktivierung","value":"expired_unactivated"},{"text":"Ungültig","value":"void"}]}',
    'labels',
    true,
    false,
    12,
    'half',
    true
  ),
  ('referral_redemptions', 'registered_at', NULL, 'datetime', NULL, 'datetime', true, false, 13, 'half', true),
  ('referral_redemptions', 'organization_bound_at', NULL, 'datetime', NULL, 'datetime', true, false, 14, 'half', false),
  ('referral_redemptions', 'reserved_at', NULL, 'datetime', NULL, 'datetime', true, false, 15, 'half', false),
  ('referral_redemptions', 'resolved_at', NULL, 'datetime', NULL, 'datetime', true, false, 16, 'half', false),
  ('referral_redemptions', 'date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 17, 'half', false),
  ('referral_redemptions', 'date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 18, 'half', false);

INSERT INTO directus_relations (
  many_collection, many_field, one_collection, one_deselect_action
)
VALUES
  ('referral_redemptions', 'partner', 'referral_partners', 'nullify'),
  ('referral_redemptions', 'user', 'directus_users', 'nullify'),
  ('referral_redemptions', 'organization', 'organizations', 'nullify'),
  ('referral_redemptions', 'trial_listing', 'listings', 'nullify'),
  ('referral_redemptions', 'premium_grant', 'premium_grants', 'nullify');

COMMIT;
