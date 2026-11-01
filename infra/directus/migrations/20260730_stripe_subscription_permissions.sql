BEGIN;

UPDATE directus_permissions
SET
  fields = 'id,organization,listing,status,plan,billing_interval,payment_provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,provider_price_id,amount_minor,currency',
  permissions = '{"payment_provider":{"_eq":"stripe"}}'
WHERE id = 51
  AND policy = 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
  AND collection = 'subscriptions'
  AND action = 'read';

INSERT INTO directus_permissions (
  collection,
  action,
  permissions,
  validation,
  presets,
  fields,
  policy
)
VALUES (
  'subscriptions',
  'create',
  NULL,
  '{"_and":[{"payment_provider":{"_eq":"stripe"}},{"plan":{"_eq":"premium"}},{"status":{"_in":["pending","active","past_due","cancelled","expired"]}},{"organization":{"_nnull":true}},{"listing":{"_nnull":true}},{"billing_interval":{"_in":["monthly","yearly"]}},{"currency":{"_eq":"CHF"}},{"amount_minor":{"_in":[990,9900]}}]}',
  '{"payment_provider":"stripe","plan":"premium","currency":"CHF"}',
  'organization,listing,status,plan,billing_interval,payment_provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,provider_price_id,amount_minor,currency',
  'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
);

INSERT INTO directus_permissions (
  collection,
  action,
  permissions,
  validation,
  fields,
  policy
)
VALUES (
  'subscriptions',
  'update',
  '{"payment_provider":{"_eq":"stripe"}}',
  '{"_and":[{"payment_provider":{"_eq":"stripe"}},{"plan":{"_eq":"premium"}},{"status":{"_in":["pending","active","past_due","cancelled","expired"]}},{"organization":{"_nnull":true}},{"listing":{"_nnull":true}},{"billing_interval":{"_in":["monthly","yearly"]}},{"currency":{"_eq":"CHF"}},{"amount_minor":{"_in":[990,9900]}}]}',
  'organization,listing,status,plan,billing_interval,payment_provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,provider_price_id,amount_minor,currency',
  'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
);

COMMIT;
