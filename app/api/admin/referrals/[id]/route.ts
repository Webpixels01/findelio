import { NextResponse } from "next/server";
import { proxyReferralAdmin } from "@/lib/referral-admin-server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  return proxyReferralAdmin(request, `partners/${encodeURIComponent(id)}`, "PATCH");
}
