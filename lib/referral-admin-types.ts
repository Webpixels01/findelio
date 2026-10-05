export type ReferralPartner = { id: string; name: string; code: string; status: "active" | "disabled"; notes: string | null };
export type ReferralRedemption = {
  id: string; partner: string; code_snapshot: string;
  status: "pending_organization" | "pending_approval" | "pending_activation" | "granted" | "skipped_existing_premium" | "expired_unactivated" | "void";
  registered_at: string; trial_starts_at: string | null; trial_ends_at: string | null;
  skip_reason: string | null; organization_name: string | null; listing_name: string | null;
  listing_slug: string | null; email: string | null; grant_revoked_at: string | null; grant_ends_at: string | null;
};
export type ReferralOverview = { partners: ReferralPartner[]; redemptions: ReferralRedemption[]; total: number; page: number; pageCount: number; pending: number; asOf: string };
