BEGIN;

-- Directus assigns uploaded_by from the service token on multipart upload.
-- Permit the service to assign ONLY its own Public uploads to the authenticated
-- customer after the website has checked listing access and image content.
INSERT INTO directus_permissions (collection, action, permissions, validation, fields, policy)
SELECT 'directus_files', 'update',
  '{"_and":[{"uploaded_by":{"_eq":"$CURRENT_USER"}},{"folder":{"_eq":"5f624475-f28b-4ae9-9826-8f5160a58e3f"}}]}'::json,
  '{"uploaded_by":{"_nnull":true}}'::json,
  'uploaded_by', 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
WHERE NOT EXISTS (
  SELECT 1 FROM directus_permissions
  WHERE collection = 'directus_files' AND action = 'update'
    AND policy = 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
);

COMMIT;
