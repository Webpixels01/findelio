import { proxyReferralAdmin } from "@/lib/referral-admin-server";

export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["page", "partner", "status"]) if (incoming.has(key)) query.set(key, incoming.get(key)!);
  return proxyReferralAdmin(request, `overview?${query}`, "GET");
}
export async function POST(request: Request) {
  return proxyReferralAdmin(request, "partners", "POST");
}
