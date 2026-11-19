BEGIN;

-- Directus filters /folders by type internally. The website service could read
-- id/name, but the implicit type filter made even the Public-folder lookup fail.
-- Preserve the existing row filter and grant only the additional read field.
UPDATE directus_permissions
SET fields = fields || ',type'
WHERE collection = 'directus_folders'
  AND action = 'read'
  AND policy = 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
  AND fields IS NOT NULL
  AND NOT ('*' = ANY(string_to_array(fields, ',')))
  AND NOT ('type' = ANY(string_to_array(fields, ',')));

COMMIT;
