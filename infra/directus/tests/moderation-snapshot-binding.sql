-- Offline PostgreSQL regression fixture, after applying the migration to a
-- disposable database. Temporary names exercise the production trigger body.
-- psql --set ON_ERROR_STOP=1 --file moderation-snapshot-binding.sql
BEGIN;
CREATE TEMP TABLE cleanup_targets (id integer PRIMARY KEY);
INSERT INTO cleanup_targets VALUES (1);
CREATE TEMP TABLE listing_revisions (
  id integer PRIMARY KEY, status text, data jsonb, review_version integer DEFAULT 1,
  submitted_by integer REFERENCES cleanup_targets(id) ON DELETE SET NULL,
  reviewed_by integer REFERENCES cleanup_targets(id) ON DELETE SET NULL
);
CREATE TEMP TABLE listing_posts (
  id integer PRIMARY KEY, status text, title text, review_version integer DEFAULT 1,
  image integer REFERENCES cleanup_targets(id) ON DELETE SET NULL,
  submitted_by integer REFERENCES cleanup_targets(id) ON DELETE SET NULL,
  reviewed_by integer REFERENCES cleanup_targets(id) ON DELETE SET NULL,
  replaces_post integer REFERENCES listing_posts(id) ON DELETE SET NULL
);
CREATE TRIGGER version BEFORE INSERT OR UPDATE ON listing_revisions
FOR EACH ROW EXECUTE FUNCTION findelio_moderation_version();
CREATE TRIGGER version BEFORE INSERT OR UPDATE ON listing_posts
FOR EACH ROW EXECUTE FUNCTION findelio_moderation_version();

DO $$
DECLARE v integer;
BEGIN
  INSERT INTO listing_revisions (id, status, data, review_version, submitted_by, reviewed_by) VALUES (1, 'pending', '{"name":"seen"}', 999, 1, 1);
  SELECT review_version INTO v FROM listing_revisions WHERE id=1;
  IF v <> 1 THEN RAISE EXCEPTION 'Client supplied initial version accepted'; END IF;
  UPDATE listing_revisions SET data='{"name":"unseen"}', review_version=1 WHERE id=1;
  UPDATE listing_revisions SET data='{"name":"seen"}', review_version=1 WHERE id=1;
  SELECT review_version INTO v FROM listing_revisions WHERE id=1;
  IF v <> 3 THEN RAISE EXCEPTION 'ABA edit failed to invalidate original version'; END IF;
  UPDATE listing_revisions SET status='approved' WHERE id=1;
  BEGIN
    UPDATE listing_revisions SET status='pending', data='{"name":"late edit"}' WHERE id=1;
    RAISE EXCEPTION 'Delayed editor overwrote approved revision';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO listing_posts (id, status, title, review_version, image, submitted_by, reviewed_by) VALUES (1, 'pending', 'seen', 1, 1, 1, 1);
  UPDATE listing_posts SET title='unseen' WHERE id=1;
  SELECT review_version INTO v FROM listing_posts WHERE id=1;
  IF v <> 2 THEN RAISE EXCEPTION 'Post edit failed to invalidate displayed version'; END IF;
  UPDATE listing_posts SET status='published' WHERE id=1;
  BEGIN
    UPDATE listing_posts SET status='pending', title='late edit' WHERE id=1;
    RAISE EXCEPTION 'Delayed editor overwrote published post';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE listing_posts SET image=NULL WHERE id=1;
    RAISE EXCEPTION 'Direct editor nullification bypassed immutable post guard';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO listing_posts (id, status, title, replaces_post) VALUES (2, 'published', 'replacement', 1);
  DELETE FROM cleanup_targets WHERE id=1;
  IF EXISTS (SELECT 1 FROM listing_posts WHERE id=1 AND (image IS NOT NULL OR submitted_by IS NOT NULL OR reviewed_by IS NOT NULL))
    OR EXISTS (SELECT 1 FROM listing_revisions WHERE id=1 AND (submitted_by IS NOT NULL OR reviewed_by IS NOT NULL)) THEN
    RAISE EXCEPTION 'Referential cleanup failed';
  END IF;
  UPDATE listing_posts SET status='archived' WHERE id=1;
  BEGIN
    UPDATE listing_posts SET title='late edit' WHERE id=1;
    RAISE EXCEPTION 'Archived published content mutated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  DELETE FROM listing_posts WHERE id=1;
  IF EXISTS (SELECT 1 FROM listing_posts WHERE id=2 AND replaces_post IS NOT NULL) THEN
    RAISE EXCEPTION 'Replacement reference cleanup failed';
  END IF;
END;
$$;
ROLLBACK;
