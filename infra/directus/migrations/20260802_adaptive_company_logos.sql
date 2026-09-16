BEGIN;

UPDATE directus_permissions
SET fields = fields || ',width,height'
WHERE collection = 'directus_files'
  AND action = 'read'
  AND policy = 'b6735d88-ef24-4a9f-ae36-dfbf522eba65'
  AND fields IS NOT NULL
  AND fields <> '*'
  AND fields NOT LIKE '%width%'
  AND fields NOT LIKE '%height%';

COMMIT;
