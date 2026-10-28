-- Run only in a disposable PostgreSQL fixture after the migration is applied.
-- Uses the real trigger function on a temporary table, not customer records.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE stripe_state_fixture (
  id integer PRIMARY KEY, payment_provider text, provider_subscription_id text,
  status text, cancel_at_period_end boolean DEFAULT false
);
CREATE TRIGGER stripe_state_guard BEFORE UPDATE ON stripe_state_fixture
  FOR EACH ROW EXECUTE FUNCTION findelio_preserve_stripe_terminal_state();
INSERT INTO stripe_state_fixture VALUES (1, 'stripe', 'sub_dummy', 'active', true);
-- A scheduled cancellation can still be reversed.
UPDATE stripe_state_fixture SET cancel_at_period_end = false WHERE id = 1;
-- A completed cancellation cannot be undone by a later stale active write.
UPDATE stripe_state_fixture SET status = 'cancelled' WHERE id = 1;
UPDATE stripe_state_fixture SET status = 'active' WHERE id = 1;
DO $$ BEGIN
  IF (SELECT status FROM stripe_state_fixture WHERE id = 1) <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled subscription was restored';
  END IF;
  BEGIN
    UPDATE stripe_state_fixture SET provider_subscription_id = 'sub_other' WHERE id = 1;
    RAISE EXCEPTION 'Identity mutation unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
INSERT INTO stripe_state_fixture VALUES (2, 'stripe', 'sub_new', 'active', false);
UPDATE stripe_state_fixture SET status = 'expired' WHERE id = 2;
UPDATE stripe_state_fixture SET status = 'past_due' WHERE id = 2;
DO $$ BEGIN
  IF (SELECT status FROM stripe_state_fixture WHERE id = 2) <> 'expired' THEN
    RAISE EXCEPTION 'Expired subscription was restored';
  END IF;
END $$;
ROLLBACK;
