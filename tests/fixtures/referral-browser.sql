-- Additional synthetic schema for the browser test, applied AFTER the base
-- fixture and premium/referral migrations. Never apply to production.
CREATE TABLE cantons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, name text);
CREATE TABLE industries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, name text);
CREATE TABLE spoken_languages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, name text);
-- Explicit fixture-only translation tables backing the queried alias.
CREATE TABLE fixture_industry_translations (id serial PRIMARY KEY, parent uuid REFERENCES industries(id), languages_code text, name text);
CREATE TABLE fixture_language_translations (id serial PRIMARY KEY, parent uuid REFERENCES spoken_languages(id), languages_code text, name text);
ALTER TABLE listings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE listings ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE listings ADD verification_status text DEFAULT 'unverified';
-- Nullable placeholder for the detail query; this fixture does not test geodata.
ALTER TABLE listings ADD location jsonb;
ALTER TABLE listings ADD CONSTRAINT fixture_canton_fk FOREIGN KEY (canton) REFERENCES cantons(id);
ALTER TABLE listing_revisions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE listing_revisions ADD submitted_at timestamptz;
ALTER TABLE listing_revisions ADD changed_fields jsonb;
ALTER TABLE subscriptions ADD organization uuid REFERENCES organizations(id);
ALTER TABLE subscriptions ADD billing_interval text;
ALTER TABLE subscriptions ADD current_period_start timestamptz;
ALTER TABLE subscriptions ADD cancel_at_period_end boolean DEFAULT false;
ALTER TABLE subscriptions ADD cancelled_at timestamptz;
ALTER TABLE subscriptions ADD amount_minor integer;
ALTER TABLE subscriptions ADD currency text;
ALTER TABLE listings_industries ADD CONSTRAINT fixture_industry_fk FOREIGN KEY (industries_id) REFERENCES industries(id);
ALTER TABLE listings_spoken_languages ADD CONSTRAINT fixture_language_fk FOREIGN KEY (spoken_languages_id) REFERENCES spoken_languages(id);
ALTER TABLE listing_revisions ADD CONSTRAINT fixture_reviewer_fk FOREIGN KEY (reviewed_by) REFERENCES directus_users(id);
INSERT INTO directus_collections (collection,accountability) VALUES
('cantons','all'),('industries','all'),('spoken_languages','all'),
('fixture_industry_translations','all'),('fixture_language_translations','all');
INSERT INTO directus_fields (collection,field,special) VALUES
('listings','id','uuid'),('listing_revisions','id','uuid'),
('listing_revisions','changed_fields','cast-json'),
('industries','translations','o2m'),('spoken_languages','translations','o2m');
INSERT INTO directus_relations (many_collection,many_field,one_collection,one_field) VALUES
('fixture_industry_translations','parent','industries','translations'),
('fixture_language_translations','parent','spoken_languages','translations');
-- Public directory queries expand these aliases through the junction tables.
-- Foreign keys alone only expose the relations from the junction side.
INSERT INTO directus_fields (collection,field,special) VALUES
('listings','industries','m2m'),('listings','spoken_languages','m2m');
INSERT INTO directus_relations (many_collection,many_field,one_collection,one_field,junction_field) VALUES
('listings_industries','listings_id','listings','industries','industries_id'),
('listings_spoken_languages','listings_id','listings','spoken_languages','spoken_languages_id');
INSERT INTO cantons (code,name) VALUES ('ZH','Zürich');
INSERT INTO industries (code,name) VALUES ('IT','IT-Dienstleistungen');
INSERT INTO spoken_languages (code,name) VALUES ('de','Deutsch'),('en','Englisch');
-- Empty auxiliary collections queried by the shared moderation overview.
CREATE TABLE listing_posts (id uuid PRIMARY KEY, listing uuid REFERENCES listings(id),
  type text, status text, title text, body text, image uuid, cta_label text, cta_url text,
  starts_at timestamptz, ends_at timestamptz, submitted_by uuid REFERENCES directus_users(id),
  submitted_at timestamptz, published_at timestamptz, rejection_reason text, replaces_post uuid);
CREATE TABLE deletion_requests (id uuid PRIMARY KEY, entity_type text,
  organization uuid REFERENCES organizations(id), listing uuid REFERENCES listings(id),
  requested_by uuid REFERENCES directus_users(id), target_name text, status text,
  reason text, date_created timestamptz);
INSERT INTO directus_collections (collection,accountability) VALUES
('listing_posts','all'),('deletion_requests','all');
