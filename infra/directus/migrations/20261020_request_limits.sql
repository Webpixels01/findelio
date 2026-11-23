-- Internal counters: intentionally no Directus API permissions.
CREATE TABLE IF NOT EXISTS findelio_request_limits (
  key varchar(200) PRIMARY KEY,
  count integer NOT NULL CHECK (count > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS findelio_request_limits_expiry
  ON findelio_request_limits (expires_at);
