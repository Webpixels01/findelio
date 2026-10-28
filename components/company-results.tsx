"use client";

import { Fragment, startTransition, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { loadListingPage } from "@/app/actions/listings";
import { LISTINGS_PAGE_SIZE, listingPageHref } from "@/lib/listing-pagination";

type ListingBatch = Awaited<ReturnType<typeof loadListingPage>>;

export default function CompanyResults({ initial, locale, filters, children }: {
  initial: ListingBatch;
  locale: AppLocale;
  filters: Record<string, string | undefined>;
  children: ReactNode;
}) {
  const t = useTranslations("Results");
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [exhausted, setExhausted] = useState(initial.items.length === 0);
  const busy = useRef(false);
  const active = useRef(true);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = !exhausted && page * LISTINGS_PAGE_SIZE < total;

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    startTransition(async () => {
      try {
        const next = await loadListingPage(locale, filters, page + 1, initial.orderDate);
        if (!active.current) return;
        setItems((previous) => {
          const known = new Set(previous.map((item) => item.id));
          return [...previous, ...next.items.filter((item) => !known.has(item.id))];
        });
        setTotal(next.total);
        setPage(next.page);
        setExhausted(next.items.length === 0);
      } catch {
        if (active.current) setError(true);
      } finally {
        busy.current = false;
        if (active.current) setLoading(false);
      }
    });
  }, [filters, hasMore, initial.orderDate, locale, page]);

  useEffect(() => {
    if (!hasMore || loading || error || !sentinel.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: "250px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, loadMore]);

  return <>
    <p className="mt-3 text-lg text-[var(--muted)]" aria-live="polite">{t("count", { count: total })}</p>
    {children}
    {items.length ? <div className="mt-10 grid gap-6 lg:grid-cols-2" aria-busy={loading}>
      {items.map((item) => <Fragment key={item.id}>{item.card}</Fragment>)}
    </div> : <div className="mt-10 rounded-3xl border border-dashed border-[#b9c9d9] bg-white p-10 text-center">
      <p className="text-xl font-bold">{t("noResults")}</p>
      <Link href="/unternehmen" locale={locale} className="primary-button mt-6 h-11 px-5">{t("clearFilters")}</Link>
    </div>}
    <div ref={sentinel} className="mt-8 text-center">
      <p role="status" className="text-[var(--muted)]">{loading ? t("loadingMore") : ""}</p>
      {error && <p role="alert" className="mb-3 text-red-700">{t("loadError")}</p>}
      <nav aria-label={t("pagination")} className="flex justify-center gap-4">
        {initial.page > 1 && <Link href={listingPageHref(filters, initial.page - 1)} locale={locale} prefetch={false} className="secondary-button h-11 px-5">{t("previousPage")}</Link>}
        {hasMore && <Link
          href={listingPageHref(filters, page + 1)} locale={locale} prefetch={false}
          className="secondary-button h-11 px-5" aria-disabled={loading}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            loadMore();
          }}
        >{error ? t("retryLoading") : t("loadMore")}</Link>}
      </nav>
    </div>
  </>;
}
