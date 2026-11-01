"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Review = { id: string; author_name: string; rating: number; body: string; response: string | null; created_at: string; status: string; version: number; listing_name?: string; listing_slug?: string };
type PublicData = { reviews: Review[]; count: number; average: number; own: Review | null; canReview: boolean; authenticated: boolean };
async function api(path: string, method = "GET", body?: object) {
  const response = await fetch(`/api/customer-reviews${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "unavailable");
  return result.data;
}
function StarIcon({ filled = false }: { filled?: boolean }) {
  return <svg className="review-star-icon" data-filled={filled} viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96Z" /></svg>;
}
function Stars({ rating }: { rating: number }) {
  return <span className="review-rating-stars" role="img" aria-label={`${rating.toFixed(1)} / 5`}>{[1, 2, 3, 4, 5].map(value => <StarIcon key={value} filled={value <= Math.round(rating)} />)}</span>;
}
export function ReviewSummary({ listing, slug }: { listing: string; slug?: string }) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  const [data, setData] = useState<PublicData | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => { void api(`?listing=${listing}&summary=1`).then(value => { if (active) setData(value); }).catch(() => {}); };
    load();
    window.addEventListener("findelio-reviews-changed", load);
    return () => { active = false; window.removeEventListener("findelio-reviews-changed", load); };
  }, [listing]);
  if (!data) return null;
  const content = data.count ? <><Stars rating={data.average} /> {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(data.average)} · {t("count", { count: data.count })}</> : t("empty");
  return slug ? <Link href={`/unternehmen/${slug}#reviews`} className="mt-2 block text-sm hover:underline">{content}</Link> : <a href="#reviews" className="mt-2 block text-sm hover:underline">{content}</a>;
}
export function CustomerReviews({ listing, slug }: { listing: string; slug: string }) {
  const t = useTranslations("Reviews");
  const tv = useTranslations("Visitor");
  const locale = useLocale();
  const [data, setData] = useState<PublicData | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api(`?listing=${listing}&page=${page}`).then(value => { if (active) { setData(value); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [listing, page, revision]);
  return <section id="reviews" className="mt-10 scroll-mt-24 rounded-2xl border border-[var(--border)] bg-white p-6">
    <h2 className="text-2xl font-extrabold">{t("title")}</h2>
    {error ? <p role="alert">{t("error")} <button onClick={() => setRevision(value => value + 1)} className="underline">{t("retry")}</button></p> : !data ? <p>{t("loading")}</p> : <>
      <p className="my-4">{data.count ? <><Stars rating={data.average} /> {data.average.toFixed(1)} · {t("count", { count: data.count })}</> : t("empty")}</p>
      {data.reviews.map(review => <ReviewCard key={review.id} review={review} />)}
      <div className="my-4 flex flex-wrap gap-4">
        {page > 0 && <button className="secondary-button px-6 py-3" onClick={() => setPage(page - 1)}>{t("previous")}</button>}
        {(page + 1) * 20 < data.count && <button className="secondary-button px-6 py-3" onClick={() => setPage(page + 1)}>{t("next")}</button>}
      </div>
      {!data.authenticated ? <div className="space-y-4"><p>{tv("verification")}</p><div className="flex flex-wrap gap-3"><Link className="primary-button px-8 py-4" href={`/login?next=${encodeURIComponent(`/${locale}/unternehmen/${slug}#reviews`)}`}>{t("login")}</Link><Link className="secondary-button px-6 py-3" href="/registrieren">{tv("register")}</Link></div></div> : data.canReview ? <ReviewForm key={`${data.own?.version || 0}-${revision}`} listing={listing} own={data.own} onSaved={() => setRevision(value => value + 1)} /> : <p className="text-sm text-[var(--muted)]">{t("ownCompany")}</p>}
    </>}
  </section>;
}
function ReviewCard({ review }: { review: Review }) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  return <article className="border-t border-[var(--border)] py-5">
    <p className="font-bold">{review.author_name} <Stars rating={review.rating} /></p>
    <time className="text-sm text-[var(--muted)]" dateTime={review.created_at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(review.created_at))}</time>
    <p className="mt-3 whitespace-pre-wrap break-words">{review.body}</p>
    {review.response && <blockquote className="mt-4 border-l-4 border-[var(--accent)] bg-[var(--surface)] p-4"><p className="font-bold">{t("response")}</p><p className="mt-2 whitespace-pre-wrap break-words">{review.response}</p></blockquote>}
  </article>;
}
function ReviewForm({ listing, own, onSaved }: { listing: string; own: Review | null; onSaved: () => void }) {
  const t = useTranslations("Reviews");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="mt-6 space-y-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try { await api("", "POST", { listing, rating: Number(form.get("rating")), body: form.get("body"), version: own?.version }); window.dispatchEvent(new Event("findelio-reviews-changed")); onSaved(); }
    catch (error) { setError(error instanceof Error ? error.message : "unavailable"); }
    finally { setBusy(false); }
  }}>
    <h3 className="text-lg font-bold">{own ? t("edit") : t("write")}</h3>
    <p className="text-sm text-[var(--muted)]">{t("moderation")}</p>
    {own && <p role="status">{t(own.status === "approved" ? "approved" : own.status === "rejected" ? "rejected" : "pending")}</p>}
    <fieldset>
      <legend>{t("rating")}</legend>
      <div className="review-stars">
        {[1, 2, 3, 4, 5].map(value => <label key={value} className="review-star">
          <input type="radio" name="rating" value={value} defaultChecked={own?.rating === value} required aria-label={`${t("rating")}: ${value} / 5`} />
          <StarIcon />
        </label>)}
      </div>
    </fieldset>
    <label className="block">{t("text")}<textarea name="body" defaultValue={own?.body || ""} minLength={10} maxLength={3000} required rows={5} className="field-control mt-1 block w-full" /></label>
    {error && <p role="alert">{t(error === "conflict" ? "conflict" : error === "rate_limited" ? "rateLimited" : "error")}</p>}
    <button disabled={busy} className="primary-button px-8 py-4 disabled:opacity-50">{busy ? t("saving") : t("submit")}</button>
  </form>;
}
export function ReviewManager() {
  const t = useTranslations("Reviews");
  const [data, setData] = useState<{ admin: boolean; reviews: Review[]; more: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; api(`/manage?page=${page}`).then(value => { if (active) { setData(value); setError(false); } }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [page, revision]);
  return <div><h1 className="text-3xl font-extrabold">{t("title")}</h1>{error ? <p role="alert">{t("error")} <button className="underline" onClick={() => setRevision(v => v + 1)}>{t("retry")}</button></p> : !data ? <p>{t("loading")}</p> : <>
    <p className="my-4">{data.admin ? t("adminIntro") : t("companyIntro")}</p>
    {!data.reviews.length && <p>{t("nothing")}</p>}
    {data.reviews.map(review => <div key={`${review.id}-${review.version}`} className="my-5 rounded-2xl border border-[var(--border)] bg-white p-6"><Link className="font-bold underline" href={`/unternehmen/${review.listing_slug}#reviews`}>{review.listing_name}</Link><ReviewCard review={review} /><ReviewAction review={review} admin={data.admin} onSaved={() => setRevision(v => v + 1)} /></div>)}
    <div className="flex flex-wrap gap-4">{page > 0 && <button className="secondary-button px-6 py-3" onClick={() => setPage(page - 1)}>{t("previous")}</button>}{data.more && <button className="secondary-button px-6 py-3" onClick={() => setPage(page + 1)}>{t("next")}</button>}</div>
  </>}</div>;
}
function ReviewAction({ review, admin, onSaved }: { review: Review; admin: boolean; onSaved: () => void }) {
  const t = useTranslations("Reviews");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const act = async (action: string, response?: string) => {
    setBusy(true); setError("");
    try { await api(`/${review.id}`, "PATCH", { action, response, version: review.version }); onSaved(); }
    catch (error) { setError(error instanceof Error ? error.message : "unavailable"); }
    finally { setBusy(false); }
  };
  return <div>{admin ? <div className="flex flex-wrap gap-3"><button disabled={busy} className="primary-button px-8 py-4" onClick={() => act("approve")}>{t("approve")}</button><button disabled={busy} className="secondary-button px-6 py-3" onClick={() => act("reject")}>{t("reject")}</button></div> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); void act("reply", String(new FormData(event.currentTarget).get("response"))); }}><label className="block">{t("response")}<textarea name="response" defaultValue={review.response || ""} required maxLength={3000} rows={4} className="field-control mt-1 w-full" /></label><button disabled={busy} className="primary-button px-8 py-4">{t("reply")}</button></form>}{error && <p role="alert">{t(error === "conflict" ? "conflict" : "error")}</p>}</div>;
}
