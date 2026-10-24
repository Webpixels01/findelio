BEGIN;

-- Owned by PostgreSQL, never by a submitted payload. Every mutation invalidates
-- the version displayed to a reviewer, including status changes and ABA edits.
ALTER TABLE listing_revisions ADD COLUMN IF NOT EXISTS review_version integer NOT NULL DEFAULT 1;
ALTER TABLE listing_posts ADD COLUMN IF NOT EXISTS review_version integer NOT NULL DEFAULT 1;

INSERT INTO directus_fields (collection, field, interface, readonly, hidden)
SELECT collection, 'review_version', 'input', true, true
FROM (VALUES ('listing_revisions'), ('listing_posts')) AS collections(collection)
WHERE NOT EXISTS (SELECT 1 FROM directus_fields f WHERE f.collection = collections.collection AND f.field = 'review_version');

-- Preserve each policy's existing row filter and grants; only expose the
-- database-owned version alongside fields that policy can already read.
UPDATE directus_permissions
SET fields = fields || ',review_version'
WHERE collection IN ('listing_revisions', 'listing_posts') AND action = 'read'
  AND fields IS NOT NULL AND fields <> ''
  AND NOT ('*' = ANY(string_to_array(fields, ',')))
  AND NOT ('review_version' = ANY(string_to_array(fields, ',')));

CREATE OR REPLACE FUNCTION findelio_moderation_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cleanup_fields text[];
  field_name text;
  old_row jsonb;
  new_row jsonb;
  fk_cleanup boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.review_version := 1;
    RETURN NEW;
  END IF;
  -- FK ON DELETE SET NULL executes as a nested trigger. Permit only its
  -- nullification of references, never a status/content edit or reassignment.
  -- Depth alone is insufficient: every other column must remain identical.
  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);
  cleanup_fields := CASE WHEN TG_TABLE_NAME = 'listing_posts'
    THEN ARRAY['image','submitted_by','reviewed_by','replaces_post']
    ELSE ARRAY['submitted_by','reviewed_by'] END;
  fk_cleanup := pg_trigger_depth() > 1 AND old_row IS DISTINCT FROM new_row
    AND (old_row - cleanup_fields) IS NOT DISTINCT FROM (new_row - cleanup_fields);
  IF fk_cleanup THEN
    FOREACH field_name IN ARRAY cleanup_fields LOOP
      IF (old_row -> field_name) IS DISTINCT FROM (new_row -> field_name)
        AND ((new_row -> field_name) IS DISTINCT FROM 'null'::jsonb
          OR (old_row -> field_name) IS NOT DISTINCT FROM 'null'::jsonb) THEN
        fk_cleanup := false;
      END IF;
    END LOOP;
    IF fk_cleanup THEN
      NEW.review_version := OLD.review_version + 1;
      RETURN NEW;
    END IF;
  END IF;
  -- A delayed editor PATCH must not reset an approved snapshot to pending, or
  -- modify the content after the review transaction has released its row lock.
  IF TG_TABLE_NAME = 'listing_revisions' AND OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Approved revisions are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'listing_posts' AND OLD.status IN ('published', 'archived') THEN
    IF NEW.status NOT IN ('published', 'archived') OR
       (to_jsonb(NEW) - ARRAY['status','date_updated','user_updated','review_version','review_notification_version']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','date_updated','user_updated','review_version','review_notification_version']) THEN
      RAISE EXCEPTION 'Published posts require a replacement for edits' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.review_version := OLD.review_version + 1;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS findelio_moderation_version ON listing_revisions;
CREATE TRIGGER findelio_moderation_version BEFORE INSERT OR UPDATE ON listing_revisions
FOR EACH ROW EXECUTE FUNCTION findelio_moderation_version();
DROP TRIGGER IF EXISTS findelio_moderation_version ON listing_posts;
CREATE TRIGGER findelio_moderation_version BEFORE INSERT OR UPDATE ON listing_posts
FOR EACH ROW EXECUTE FUNCTION findelio_moderation_version();

COMMIT;
