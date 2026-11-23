-- Existing ownership restrictions must survive the licensed upgrade unchanged.
CREATE TABLE upgrade_owned_entries (id integer PRIMARY KEY, owner uuid REFERENCES directus_users(id), title text);
INSERT INTO directus_collections (collection, accountability) VALUES ('upgrade_owned_entries', 'all');
INSERT INTO directus_roles (id, name) VALUES ('50000000-0000-4000-8000-000000000001', 'Upgrade ownership fixture');
INSERT INTO directus_policies (id, name) VALUES ('50000000-0000-4000-8000-000000000002', 'Upgrade ownership fixture');
INSERT INTO directus_access (id, role, policy) VALUES ('50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002');
INSERT INTO directus_users (id, email, role, status, token) VALUES
 ('50000000-0000-4000-8000-000000000004', 'upgrade-owner@example.com', '50000000-0000-4000-8000-000000000001', 'active', 'isolated-upgrade-owner-token'),
 ('50000000-0000-4000-8000-000000000005', 'upgrade-other@example.com', '50000000-0000-4000-8000-000000000001', 'active', 'isolated-upgrade-other-token');
INSERT INTO upgrade_owned_entries VALUES
 (1, '50000000-0000-4000-8000-000000000004', 'Own entry'),
 (2, '50000000-0000-4000-8000-000000000005', 'Other entry');
INSERT INTO directus_permissions (policy, collection, action, permissions, fields) VALUES
 ('50000000-0000-4000-8000-000000000002', 'upgrade_owned_entries', 'read', '{"owner":{"_eq":"$CURRENT_USER"}}', 'id,title'),
 ('50000000-0000-4000-8000-000000000002', 'upgrade_owned_entries', 'update', '{"owner":{"_eq":"$CURRENT_USER"}}', 'title');

-- Run the production upgrade check against real filtered reads as well.
DO $$
DECLARE collection_name text;
BEGIN
  FOREACH collection_name IN ARRAY ARRAY['cantons', 'industries', 'spoken_languages'] LOOP
    EXECUTE format('CREATE TABLE %I (id integer PRIMARY KEY, is_active boolean)', collection_name);
    EXECUTE format('INSERT INTO %I VALUES (1, true), (2, false)', collection_name);
    INSERT INTO directus_collections (collection, accountability) VALUES (collection_name, 'all');
    INSERT INTO directus_permissions (policy, collection, action, permissions, fields)
    VALUES ('40000000-0000-4000-8000-000000000002', collection_name, 'read', '{"is_active":{"_eq":true}}', 'id');
  END LOOP;
END $$;
