-- Native Studio enrollment for existing administrators. Customers stay optional.
UPDATE directus_policies SET enforce_tfa = true WHERE admin_access = true;
