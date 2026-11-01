-- Synthetic, pre-existing filtered service permissions reproduce the production regression.
CREATE TABLE recovery_directory (id integer PRIMARY KEY, name text, is_active boolean);
INSERT INTO recovery_directory VALUES (1, 'Published fixture', true), (2, 'Private fixture', false);
INSERT INTO directus_collections (collection, accountability) VALUES ('recovery_directory', 'all');
INSERT INTO directus_roles (id, name) VALUES ('40000000-0000-4000-8000-000000000001', 'Recovery test service');
INSERT INTO directus_policies (id, name) VALUES ('40000000-0000-4000-8000-000000000002', 'Recovery filtered permission');
INSERT INTO directus_access (id, role, policy) VALUES ('40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002');
INSERT INTO directus_users (id, email, role, status, token) VALUES ('40000000-0000-4000-8000-000000000004', 'recovery@example.com', '40000000-0000-4000-8000-000000000001', 'active', 'isolated-recovery-fixture-token');
INSERT INTO directus_permissions (policy, collection, action, permissions, fields)
VALUES ('40000000-0000-4000-8000-000000000002', 'recovery_directory', 'read', '{"is_active":{"_eq":true}}', 'id,name');
