BEGIN;

-- A Stripe subscription ID denotes one lifecycle. A new purchase after a
-- completed cancellation has a new ID; scheduled cancellation is still active.
-- Fail rather than silently delete/reconcile any pre-existing duplicate rows.
CREATE UNIQUE INDEX subscriptions_stripe_provider_id_unique
  ON subscriptions (provider_subscription_id)
  WHERE payment_provider = 'stripe' AND provider_subscription_id IS NOT NULL;

CREATE FUNCTION findelio_preserve_stripe_terminal_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.payment_provider = 'stripe' AND OLD.provider_subscription_id IS NOT NULL THEN
    IF NEW.payment_provider IS DISTINCT FROM OLD.payment_provider
      OR NEW.provider_subscription_id IS DISTINCT FROM OLD.provider_subscription_id THEN
      RAISE EXCEPTION 'Stripe subscription identity is immutable' USING ERRCODE = '23514';
    END IF;
    -- Row-level UPDATE locking applies this check to the committed predecessor,
    -- including when an older provider read races a cancellation write.
    IF OLD.status IN ('cancelled', 'expired') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RETURN OLD;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER findelio_stripe_terminal_state
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION findelio_preserve_stripe_terminal_state();

COMMIT;
