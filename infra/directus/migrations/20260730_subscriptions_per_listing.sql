BEGIN;

ALTER TABLE subscriptions
  ADD COLUMN listing uuid;

UPDATE subscriptions
SET listing = '92582676-ba64-4884-8cb4-24ff54b8aca1'
WHERE id = 'f4407327-2ae3-44e2-b5c4-14b98faddea3';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM subscriptions WHERE listing IS NULL) THEN
    RAISE EXCEPTION 'Every subscription must be assigned to a listing before the migration can continue.';
  END IF;
END
$$;

ALTER TABLE subscriptions
  ALTER COLUMN listing SET NOT NULL,
  ADD CONSTRAINT subscriptions_listing_foreign
    FOREIGN KEY (listing)
    REFERENCES listings(id)
    ON DELETE RESTRICT;

CREATE INDEX subscriptions_listing_idx ON subscriptions (listing);

UPDATE directus_fields
SET sort = sort + 1
WHERE collection = 'subscriptions'
  AND sort >= 3;

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
  'subscriptions',
  'listing',
  'm2o',
  'select-dropdown-m2o',
  '{"template":"{{name}}"}',
  false,
  false,
  3,
  'full',
  true
);

INSERT INTO directus_relations (
  many_collection,
  many_field,
  one_collection,
  one_deselect_action
)
VALUES (
  'subscriptions',
  'listing',
  'listings',
  'nullify'
);

UPDATE directus_permissions
SET fields = 'id,organization,listing,status,plan,billing_interval,payment_provider,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,amount_minor,currency'
WHERE id = 19
  AND policy = '8960feba-2b9b-40ab-a89b-49af747e6646'
  AND collection = 'subscriptions'
  AND action = 'read';

UPDATE directus_permissions
SET fields = 'status,plan,organization,listing,current_period_end'
WHERE id = 51
  AND policy = 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
  AND collection = 'subscriptions'
  AND action = 'read';

COMMIT;
