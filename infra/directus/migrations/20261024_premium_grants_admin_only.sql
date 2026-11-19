BEGIN;

-- Free Premium grants are administrator decisions. The frontend service no
-- longer mutates them on behalf of reviewers; requests use the administrator's
-- own token. Keep reads for entitlement checks and preserve native admin access.
-- Referral approval uses its separately authorized internal ItemsService path.
DELETE FROM directus_permissions AS permission
WHERE permission.collection = 'premium_grants'
  AND permission.action IN ('create', 'update', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM directus_policies AS policy
    WHERE policy.id = permission.policy AND policy.admin_access = true
  );

COMMIT;
