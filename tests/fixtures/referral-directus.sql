-- Minimal business schema fixture, not a production schema export.
CREATE TABLE organizations (id uuid PRIMARY KEY, name text, slug text UNIQUE, status text, billing_country text);
CREATE TABLE listings (id uuid PRIMARY KEY, organization uuid REFERENCES organizations(id), name text, slug text,
 status text, published_at timestamptz, description text, street text, postal_code text, city text,
 canton uuid, public_email text, phone text, website_url text, address_visibility text, logo uuid,
 description_translations jsonb, social_links jsonb, custom_cta_label text, custom_cta_value text);
CREATE TABLE listing_revisions (id uuid PRIMARY KEY, listing uuid REFERENCES listings(id), status text,
 data jsonb, reviewed_by uuid, reviewed_at timestamptz, rejection_reason text);
CREATE TABLE subscriptions (id uuid PRIMARY KEY, listing uuid REFERENCES listings(id), plan text,
 status text, current_period_end timestamptz);
CREATE TABLE listings_industries (id serial PRIMARY KEY, listings_id uuid REFERENCES listings(id), industries_id uuid);
CREATE TABLE listings_spoken_languages (id serial PRIMARY KEY, listings_id uuid REFERENCES listings(id), spoken_languages_id uuid);
CREATE TABLE listings_files (id serial PRIMARY KEY, listings_id uuid REFERENCES listings(id), directus_files_id uuid);
CREATE TABLE listing_opening_hours (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing uuid REFERENCES listings(id), day_of_week int, opens_at time, closes_at time);

CREATE TABLE organization_members (id uuid PRIMARY KEY, organization uuid REFERENCES organizations(id), "user" uuid REFERENCES directus_users(id), role text, status text);
ALTER TABLE listing_revisions ADD submitted_by uuid REFERENCES directus_users(id);
ALTER TABLE listings ADD requested_billing_interval text;
INSERT INTO directus_policies (id,name,icon) VALUES ('b6735d88-ef24-4a9f-ae36-dfbf522eba65','Fixture premium','test');
INSERT INTO directus_collections (collection,accountability) VALUES ('organizations','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('listings','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('listing_revisions','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('subscriptions','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('listings_industries','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('listings_spoken_languages','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('listings_files','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('listing_opening_hours','all');
INSERT INTO directus_collections (collection,accountability) VALUES ('organization_members','all');
INSERT INTO directus_fields (collection,field,special) VALUES ('listings','description_translations','cast-json');
INSERT INTO directus_fields (collection,field,special) VALUES ('listings','social_links','cast-json');
INSERT INTO directus_fields (collection,field,special) VALUES ('listing_revisions','data','cast-json');
