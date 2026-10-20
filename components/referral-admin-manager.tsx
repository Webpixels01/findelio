"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ReferralOverview, ReferralPartner, ReferralRedemption } from "@/lib/referral-admin-types";

export default function ReferralAdminManager({ initialData, locale, siteUrl }: {
  initialData: ReferralOverview | null; locale: string; siteUrl: string;
}) {
  const t = useTranslations("Referrals");
  const [data, setData] = useState(initialData);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialData ? "" : "load_failed");
  const [message, setMessage] = useState("");
  const statuses = ["pending_organization", "pending_approval", "pending_activation", "granted", "skipped_existing_premium", "expired_unactivated", "void"] as const;

  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(value)) : "–";
  function link(partner: ReferralPartner) {
    const url = new URL(`/${locale}/firma-eintragen`, siteUrl);
    url.searchParams.set("ref", partner.code);
    return url.toString();
  }
  function reset() { setEditing(null); setName(""); setCode(""); setNotes(""); setStatus("active"); }
  function edit(partner: ReferralPartner) {
    setEditing(partner.id); setName(partner.name); setCode(partner.code);
    setNotes(partner.notes ?? ""); setStatus(partner.status); setMessage("");
  }
  async function load(page = 1, partner = partnerFilter, state = statusFilter) {
    const query = new URLSearchParams({ page: String(page), partner, status: state });
    const response = await fetch(`/api/admin/referrals?${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok || !body.data) throw new Error(body.error ?? "load_failed");
    setData(body.data); setPartnerFilter(partner); setStatusFilter(state);
  }
  async function refresh(page = 1, partner = partnerFilter, state = statusFilter) {
    setBusy(true); setError(""); setMessage("");
    try { await load(page, partner, state); } catch { setError("load_failed"); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(editing ? `/api/admin/referrals/${editing}` : "/api/admin/referrals", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, notes, status, ...(!editing ? { code } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) { setError(body.error === "code_exists" ? "code_exists" : "save_failed"); return; }
      reset(); setMessage("saved");
      try { await load(data?.page ?? 1); } catch { setError("load_failed"); }
    } catch { setError("save_failed"); } finally { setBusy(false); }
  }
  async function copy(value: string) {
    setError(""); setMessage("");
    try { await navigator.clipboard.writeText(value); setMessage("copied"); }
    catch { setError("copy_failed"); }
  }
  async function retry(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/referrals/${id}/activate`, { method: "POST" });
      if (!response.ok) { setError("retry_failed"); return; }
      setMessage("retry_done");
      try { await load(data?.page ?? 1); } catch { setError("load_failed"); }
    } catch { setError("retry_failed"); } finally { setBusy(false); }
  }
  function redemptionStatus(row: ReferralRedemption) {
    if (row.status === "granted" && row.grant_revoked_at) return t("revoked");
    if (row.status === "granted" && row.grant_ends_at && data && new Date(row.grant_ends_at).getTime() <= new Date(data.asOf).getTime()) return t("expired");
    return t(`states.${row.status}`);
  }
  const panel = "rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8";
  return <div className="mt-8 grid gap-6" aria-busy={busy}>
    <div aria-live="polite" role="status">{message && <p className="rounded-xl bg-[#e8f8ed] p-4 font-bold text-[#176b35]">{t(message)}</p>}</div>
    {error && <div role="alert" className="rounded-xl border border-[#f0b4b0] bg-[#fff5f4] p-4 text-[#b42318]">
      <p>{t(error)}</p>{error === "load_failed" && <button className="mt-2 font-bold underline" disabled={busy} onClick={() => refresh()}>{t("refresh")}</button>}
    </div>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[[t("activePartners"), data.partners.filter((p) => p.status === "active").length], [t("registrations"), data.total], [t("pendingActivation"), data.pending]].map(([label, value]) =>
          <div key={label} className="rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-sm font-bold text-[var(--muted)]">{label}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></div>)}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className={panel}>
          <h2 className="text-2xl font-extrabold">{t(editing ? "editPartner" : "newPartner")}</h2>
          <p className="mt-3 text-[var(--muted)]">{t("partnerHelp")}</p>
          <form className="mt-6 grid gap-4" onSubmit={save}>
            <fieldset disabled={busy} className="grid min-w-0 gap-4">
              <label className="field-group"><span className="field-label">{t("name")}</span><input className="field-control" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={255} /></label>
              <label className="field-group"><span className="field-label">{t("code")}</span><input className="field-control" value={code} readOnly={Boolean(editing)} onChange={(e) => setCode(e.target.value)} required minLength={3} maxLength={64} pattern={"[A-Za-z0-9][A-Za-z0-9_\\-]{2,63}"} autoCapitalize="characters" spellCheck={false} aria-describedby="referral-code-help" /></label>
              <p id="referral-code-help" className="text-sm text-[var(--muted)]">{t(editing ? "codeFixed" : "codeHelp")}</p>
              <label className="field-group"><span className="field-label">{t("notes")}</span><textarea className="field-control min-h-24 py-3" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <label className="field-group"><span className="field-label">{t("status")}</span><select className="field-control" value={status} onChange={(e) => setStatus(e.target.value as "active" | "disabled")}><option value="active">{t("active")}</option><option value="disabled">{t("disabled")}</option></select></label>
              <p className="text-sm text-[var(--muted)]">{t("disableHelp")}</p>
              <div className="flex flex-wrap gap-3"><button className="primary-button h-12 px-5" type="submit">{t(busy ? "saving" : "save")}</button>{editing && <button type="button" className="px-3 font-bold" onClick={reset}>{t("cancel")}</button>}</div>
            </fieldset>
          </form>
        </section>
        <section className={panel}>
          <h2 className="text-2xl font-extrabold">{t("partners")}</h2>
          {data.partners.length === 0 && <p className="mt-5 text-[var(--muted)]">{t("noPartners")}</p>}
          <div className="mt-5 grid max-h-[650px] gap-4 overflow-y-auto">
            {data.partners.map((partner) => <article key={partner.id} className="min-w-0 rounded-2xl border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words text-lg font-extrabold">{partner.name}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${partner.status === "active" ? "bg-[#e8f8ed] text-[#176b35]" : "bg-[var(--surface)] text-[var(--muted)]"}`}>{t(partner.status)}</span></div>
              <p className="mt-3 break-all font-mono font-bold">{partner.code}</p>
              {partner.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{partner.notes}</p>}
              <label className="mt-3 block text-sm font-bold">{t("link")}<input className="mt-1 w-full min-w-0 rounded-lg border border-[var(--border)] p-2 font-normal" value={link(partner)} readOnly onFocus={(e) => e.target.select()} /></label>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold"><button disabled={busy || partner.status !== "active"} className="text-[var(--accent)] disabled:opacity-40" onClick={() => copy(link(partner))}>{t("copyLink")}</button><button disabled={busy || partner.status !== "active"} className="text-[var(--accent)] disabled:opacity-40" onClick={() => copy(partner.code)}>{t("copyCode")}</button><button disabled={busy} className="underline" onClick={() => edit(partner)}>{t("edit")}</button></div>
            </article>)}
          </div>
        </section>
      </div>
      <section className={`${panel} min-w-0`}>
        <h2 className="text-2xl font-extrabold">{t("companies")}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("overviewHelp")}</p>
        <div className="my-5 flex flex-wrap items-end gap-3">
          <label className="field-group min-w-48 flex-1"><span className="field-label">{t("partners")}</span><select className="field-control" disabled={busy} value={partnerFilter} onChange={(e) => refresh(1, e.target.value, statusFilter)}><option value="">{t("allPartners")}</option>{data.partners.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}</select></label>
          <label className="field-group min-w-48 flex-1"><span className="field-label">{t("status")}</span><select className="field-control" disabled={busy} value={statusFilter} onChange={(e) => refresh(1, partnerFilter, e.target.value)}><option value="">{t("allStates")}</option>{statuses.map((s) => <option key={s} value={s}>{t(`states.${s}`)}</option>)}</select></label>
          <button className="h-12 px-3 font-bold text-[var(--accent)]" disabled={busy} onClick={() => refresh(data.page)}>{t("refresh")}</button>
        </div>
        {data.redemptions.length === 0 ? <p className="py-6 text-[var(--muted)]">{t("noCompanies")}</p> : <div className="overflow-x-auto" role="region" aria-label={t("companies")} tabIndex={0}>
          <table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-[var(--border)]">{["company", "code", "registered", "period", "status", "actions"].map((k) => <th key={k} scope="col" className="px-3 py-3 font-extrabold">{t(k)}</th>)}</tr></thead>
            <tbody>{data.redemptions.map((row) => <tr key={row.id} className="border-b border-[var(--border)] align-top">
              <td className="max-w-60 break-words px-3 py-4"><p className="font-bold">{row.organization_name ?? t("awaitingOrganization")}</p><p className="mt-1">{row.listing_name}</p><p className="mt-1 text-[var(--muted)]">{row.email}</p></td>
              <td className="max-w-40 break-words px-3 py-4"><p>{data.partners.find((p) => p.id === row.partner)?.name}</p><p className="mt-1 font-mono">{row.code_snapshot}</p></td>
              <td className="px-3 py-4">{formatDate(row.registered_at)}</td>
              <td className="px-3 py-4"><p>{formatDate(row.trial_starts_at)}</p><p className="mt-1">{formatDate(row.trial_ends_at)}</p></td>
              <td className="max-w-64 px-3 py-4"><span className={`inline-block rounded-lg px-2 py-1 font-bold ${row.status === "pending_activation" ? "bg-[#fff4dc] text-[#875500]" : "bg-[var(--surface)]"}`}>{redemptionStatus(row)}</span>{row.skip_reason && <p className="mt-2 text-[var(--muted)]">{t(row.skip_reason === "previous_publication" ? "previousPublication" : "existingPremium")}</p>}</td>
              <td className="px-3 py-4">{row.status === "pending_activation" && <button disabled={busy} className="font-bold text-[var(--accent)]" onClick={() => retry(row.id)}>{t("retry")}</button>}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p>{t("page", { page: data.page, pages: data.pageCount, total: data.total })}</p><div className="flex gap-4"><button className="font-bold disabled:opacity-40" disabled={busy || data.page <= 1} onClick={() => refresh(data.page - 1)}>{t("previous")}</button><button className="font-bold disabled:opacity-40" disabled={busy || data.page >= data.pageCount} onClick={() => refresh(data.page + 1)}>{t("next")}</button></div></div>
      </section>
    </>}
  </div>;
}
