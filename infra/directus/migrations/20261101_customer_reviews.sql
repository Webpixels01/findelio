BEGIN;
-- Private storage: access is exclusively through the checked endpoint, never /items.
CREATE TABLE IF NOT EXISTS findelio_customer_reviews (
  id uuid PRIMARY KEY,
  listing uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  author uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 3000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  version integer NOT NULL DEFAULT 1,
  response text CHECK (char_length(response) <= 3000),
  response_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  reviewed_by uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing, author)
);
CREATE INDEX IF NOT EXISTS findelio_customer_reviews_public ON findelio_customer_reviews(listing, status, created_at DESC);
CREATE INDEX IF NOT EXISTS findelio_customer_reviews_pending ON findelio_customer_reviews(status, updated_at);
COMMIT;
