BEGIN;

CREATE OR REPLACE FUNCTION findelio_set_blog_published_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := COALESCE(NEW.date_updated, CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS findelio_blog_published_at_trigger ON blog_posts;

CREATE TRIGGER findelio_blog_published_at_trigger
BEFORE INSERT OR UPDATE OF status, published_at ON blog_posts
FOR EACH ROW
EXECUTE FUNCTION findelio_set_blog_published_at();

UPDATE blog_posts
SET published_at = COALESCE(date_updated, date_created, CURRENT_TIMESTAMP)
WHERE status = 'published'
  AND published_at IS NULL;

UPDATE directus_fields
SET note = 'Wird beim Veröffentlichen automatisch gesetzt. Für eine geplante Veröffentlichung kann ein zukünftiger Zeitpunkt gewählt werden.'
WHERE collection = 'blog_posts'
  AND field = 'published_at';

COMMIT;
