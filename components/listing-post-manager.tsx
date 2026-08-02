"use client";

import { FormEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AccountListingPost } from "@/lib/directus-growth";

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function relationId(value: AccountListingPost["replaces_post"]): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export default function ListingPostManager({ listingId, posts }: { listingId: string; posts: AccountListingPost[] }) {
  const t = useTranslations("Growth.posts");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<AccountListingPost | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imageInputId = `listing-post-image-${listingId}`;
  const activelyReplacedPostIds = new Set(
    posts
      .filter((post) => post.status !== "archived")
      .map((post) => relationId(post.replaces_post))
      .filter((postId): postId is string => Boolean(postId)),
  );
  const visiblePosts = posts.filter(
    (post) => post.status !== "archived" && !activelyReplacedPostIds.has(post.id),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    let image: string | null = editingPost?.image ?? null;
    const file = data.get("image");
    if (file instanceof File && file.size > 0) {
      const upload = new FormData();
      upload.append("files", file);
      const uploadResponse = await fetch(`/api/account/listings/${listingId}/media`, { method: "POST", body: upload });
      const uploadResult = await uploadResponse.json().catch(() => null) as { images?: Array<{ id: string }> } | null;
      if (!uploadResponse.ok || !uploadResult?.images?.[0]) {
        setNotice(t("errors.upload")); setBusy(false); return;
      }
      image = uploadResult.images[0].id;
    }
    const payload = Object.fromEntries(data.entries());
    delete payload.image;
    const response = await fetch(
      editingPost
        ? `/api/account/listings/${listingId}/posts/${editingPost.id}`
        : `/api/account/listings/${listingId}/posts`,
      {
        method: editingPost ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, image, ...(editingPost ? { action: "update" } : {}) }),
      },
    );
    if (!response.ok) { setNotice(t("errors.save")); setBusy(false); return; }
    form.reset();
    setImageName(null);
    setEditingPost(null);
    setNotice(t(editingPost ? "updated" : "saved"));
    setBusy(false);
    router.refresh();
  }

  async function archive(postId: string) {
    if (!window.confirm(t("archiveConfirm"))) return;
    setBusy(true);
    await fetch(`/api/account/listings/${listingId}/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    setBusy(false);
    router.refresh();
  }

  function edit(post: AccountListingPost) {
    setEditingPost(post);
    setImageName(null);
    setNotice(null);
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function cancelEdit() {
    setEditingPost(null);
    setImageName(null);
    setNotice(null);
  }

  return (
    <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_0.8fr]">
      <form key={editingPost?.id ?? "new"} ref={formRef} onSubmit={submit} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t(editingPost ? "editTitle" : "createTitle")}</h2>
        {editingPost?.status === "published" && (
          <p className="mt-4 rounded-xl border border-[#b9daf8] bg-[#eef7ff] p-4 text-sm font-semibold text-[#174f82]">
            {t("editPublishedHint")}
          </p>
        )}
        <div className="mt-6 grid gap-5">
          <label className="field-group"><span className="field-label">{t("type")}</span><select name="type" className="field-control" defaultValue={editingPost?.type ?? "update"}><option value="update">{t("types.update")}</option><option value="offer">{t("types.offer")}</option><option value="event">{t("types.event")}</option></select></label>
          <label className="field-group"><span className="field-label">{t("title")}</span><input name="title" className="field-control" maxLength={180} defaultValue={editingPost?.title ?? ""} required /></label>
          <label className="field-group"><span className="field-label">{t("body")}</span><textarea name="body" className="field-control min-h-40" maxLength={10000} defaultValue={editingPost?.body ?? ""} /></label>
          <div className="field-group">
            <span className="field-label">{t("image")}</span>
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-center sm:flex-row">
              <input
                id={imageInputId}
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => setImageName(event.currentTarget.files?.[0]?.name ?? null)}
              />
              <label
                htmlFor={imageInputId}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 py-2 text-center font-extrabold text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-within:outline-none"
              >
                {t("imageSelect")}
              </label>
              <span className="min-w-0 text-center">
                <span className="block break-all text-sm text-[var(--muted)]">
                  {imageName ?? (editingPost?.image ? t("imageCurrent") : t("imageEmpty"))}
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {t("imageHint")}
                </span>
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="field-group"><span className="field-label">{t("startsAt")}</span><input name="starts_at" type="datetime-local" className="field-control" defaultValue={toDateTimeLocal(editingPost?.starts_at ?? null)} /></label><label className="field-group"><span className="field-label">{t("endsAt")}</span><input name="ends_at" type="datetime-local" className="field-control" defaultValue={toDateTimeLocal(editingPost?.ends_at ?? null)} /></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="field-group"><span className="field-label">{t("buttonLabel")}</span><input name="cta_label" className="field-control" maxLength={80} defaultValue={editingPost?.cta_label ?? ""} /></label><label className="field-group"><span className="field-label">{t("buttonUrl")}</span><input name="cta_url" className="field-control" placeholder="https://" maxLength={500} defaultValue={editingPost?.cta_url ?? ""} /></label></div>
          <label className="field-group"><span className="field-label">{t("status")}</span><select name="status" className="field-control" defaultValue={editingPost?.status === "draft" ? "draft" : editingPost ? "pending" : "draft"}><option value="draft">{t("statuses.draft")}</option><option value="pending">{t("statuses.pending")}</option></select></label>
        </div>
        {notice && <p className="mt-5 rounded-xl bg-[var(--surface)] p-4 font-bold">{notice}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button disabled={busy} className="primary-button h-12 px-6 disabled:opacity-60">{busy ? t("saving") : t(editingPost ? "update" : "save")}</button>
          {editingPost && <button type="button" disabled={busy} onClick={cancelEdit} className="h-12 rounded-xl border border-[var(--border)] bg-white px-6 font-extrabold">{t("cancel")}</button>}
        </div>
      </form>

      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold">{t("existingTitle")}</h2>
        {visiblePosts.length === 0 ? <p className="rounded-3xl bg-white p-6 text-[var(--muted)]">{t("empty")}</p> : visiblePosts.map((post) => (
          <article key={post.id} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wide text-[var(--accent)]">{t(`types.${post.type}`)}</p><h3 className="mt-2 text-xl font-extrabold">{post.title}</h3></div><span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold">{t(`statuses.${post.status}`)}</span></div>
            {post.rejection_reason && <p className="mt-3 rounded-xl bg-[#fff0f0] p-3 text-sm text-[#9d1c1c]">{post.rejection_reason}</p>}
            {post.status !== "archived" && <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => edit(post)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--accent)] bg-white px-4 py-2 text-center text-sm font-extrabold text-[var(--accent)] transition hover:bg-[#eef7ff] disabled:cursor-not-allowed disabled:opacity-60">{t("edit")}</button><button type="button" disabled={busy} onClick={() => archive(post.id)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#d99090] bg-white px-4 py-2 text-center text-sm font-extrabold text-[#9d1c1c] transition hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-60">{t("archive")}</button></div>}
          </article>
        ))}
      </section>
    </div>
  );
}
