BEGIN;

ALTER TABLE listings
  ADD COLUMN requested_billing_interval varchar(20),
  ADD CONSTRAINT listings_requested_billing_interval_check
    CHECK (
      requested_billing_interval IS NULL
      OR requested_billing_interval IN ('monthly', 'yearly')
    );

INSERT INTO directus_fields (
  collection,
  field,
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
  'requested_billing_interval',
  'select-dropdown',
  '{"choices":[{"text":"Monatlich","value":"monthly"},{"text":"Jährlich","value":"yearly"}]}',
  false,
  true,
  26,
  'half',
  false
);

UPDATE directus_permissions
SET fields = fields || ',requested_billing_interval'
WHERE collection = 'listings'
  AND action IN ('read', 'create')
  AND policy = '8960feba-2b9b-40ab-a89b-49af747e6646'
  AND fields IS NOT NULL
  AND fields <> '*'
  AND fields NOT LIKE '%requested_billing_interval%';

COMMIT;
