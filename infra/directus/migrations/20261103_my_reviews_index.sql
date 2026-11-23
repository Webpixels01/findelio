BEGIN;
CREATE INDEX IF NOT EXISTS findelio_customer_reviews_author ON findelio_customer_reviews(author, created_at DESC, id);
COMMIT;
