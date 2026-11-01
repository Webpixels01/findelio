BEGIN;

-- Internal tables deliberately have no Directus collection/permission entries.
CREATE TABLE IF NOT EXISTS findelio_verification_mail_budget (
  recipient_key text PRIMARY KEY,
  count integer NOT NULL CHECK (count BETWEEN 1 AND 3),
  expires_at timestamptz NOT NULL,
  next_allowed_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS findelio_review_mail_deliveries (
  collection text NOT NULL CHECK (collection IN ('listing_revisions', 'listing_posts')),
  record_id uuid NOT NULL,
  version bigint NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, record_id, version)
);
ALTER TABLE listing_revisions ADD COLUMN IF NOT EXISTS review_notification_version bigint NOT NULL DEFAULT 1;
ALTER TABLE listing_posts ADD COLUMN IF NOT EXISTS review_notification_version bigint NOT NULL DEFAULT 1;

-- Database-owned version also covers direct CMS mutations. Repeating pending or
-- touching submission/audit timestamps cannot manufacture a new mail event.
CREATE OR REPLACE FUNCTION findelio_review_notification_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored text[] := ARRAY['review_notification_version', 'review_version', 'date_updated', 'date_created',
    'user_updated', 'user_created', 'submitted_at', 'reviewed_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.review_notification_version := 1;
  ELSE
    NEW.review_notification_version := OLD.review_notification_version;
    IF NEW.status = 'pending' AND
       (to_jsonb(NEW) - ignored) IS DISTINCT FROM (to_jsonb(OLD) - ignored) THEN
      NEW.review_notification_version := OLD.review_notification_version + 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS findelio_review_notification_version ON listing_revisions;
CREATE TRIGGER findelio_review_notification_version BEFORE INSERT OR UPDATE ON listing_revisions
FOR EACH ROW EXECUTE FUNCTION findelio_review_notification_version();
DROP TRIGGER IF EXISTS findelio_review_notification_version ON listing_posts;
CREATE TRIGGER findelio_review_notification_version BEFORE INSERT OR UPDATE ON listing_posts
FOR EACH ROW EXECUTE FUNCTION findelio_review_notification_version();
COMMIT;
