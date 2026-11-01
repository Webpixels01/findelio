BEGIN;
INSERT INTO directus_roles (id, name, icon, description)
VALUES ('5ec800ba-a34e-4bd6-a910-6833e8c61301', 'Besucher', 'person', 'Bestätigte Besucher können Bewertungen einreichen.') ON CONFLICT (id) DO NOTHING;
INSERT INTO directus_policies (id, name, icon, admin_access, app_access)
VALUES ('5ec800ba-a34e-4bd6-a910-6833e8c61302', 'Findelio Besucher', 'person', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO directus_access (id, role, policy)
VALUES ('5ec800ba-a34e-4bd6-a910-6833e8c61303', '5ec800ba-a34e-4bd6-a910-6833e8c61301', '5ec800ba-a34e-4bd6-a910-6833e8c61302') ON CONFLICT (id) DO NOTHING;
INSERT INTO directus_permissions (collection, action, permissions, fields, policy)
SELECT 'directus_users', 'read', '{"id":{"_eq":"$CURRENT_USER"}}'::json, 'id,email,first_name,last_name,status,avatar,role', '5ec800ba-a34e-4bd6-a910-6833e8c61302'
WHERE NOT EXISTS (SELECT 1 FROM directus_permissions WHERE policy='5ec800ba-a34e-4bd6-a910-6833e8c61302' AND collection='directus_users' AND action='read');
INSERT INTO directus_permissions (collection, action, permissions, fields, policy)
SELECT 'directus_roles', 'read', '{"id":{"_eq":"5ec800ba-a34e-4bd6-a910-6833e8c61301"}}'::json, 'id,name', '5ec800ba-a34e-4bd6-a910-6833e8c61302'
WHERE NOT EXISTS (SELECT 1 FROM directus_permissions WHERE policy='5ec800ba-a34e-4bd6-a910-6833e8c61302' AND collection='directus_roles' AND action='read');
COMMIT;
