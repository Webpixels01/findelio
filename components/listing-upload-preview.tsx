"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ImageUploadState } from "@/lib/listing-image-upload";

export default function ListingUploadPreview({ file, src, alt, state, compact = false, onRetry }: {
  file?: File;
  src?: string;
  alt: string;
  state?: ImageUploadState;
  compact?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations("ListingEditor");
  const previewRef = useRef<HTMLImageElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (previewRef.current) previewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const status = state?.status ?? (file ? "ready" : "uploaded");
  return (
    <div className="min-w-0">
      <div className={`relative overflow-hidden rounded-xl bg-[var(--surface)] ${compact ? "size-24" : "aspect-[4/3]"}`}>
        {file ? (
          // Local object URLs do not need the Next.js image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={previewRef} alt={alt} onError={() => setPreviewFailed(true)} className={`size-full ${compact ? "object-contain" : "object-cover"}`} />
        ) : src ? (
          <Image src={src} alt={alt} fill sizes={compact ? "96px" : "(max-width: 640px) 100vw, 33vw"} onError={() => setPreviewFailed(true)} className={compact ? "object-contain p-2" : "object-cover"} />
        ) : null}
      </div>
      {file && <p className="mt-2 break-all text-sm font-bold">{file.name}</p>}
      {previewFailed && <p className="mt-2 text-sm text-[var(--muted)]">{t("premium.upload.previewFailed")}</p>}
      <div role="status" aria-live="polite" className="mt-2 text-sm font-bold">
        <p className={`flex items-center gap-2 rounded-lg px-2 py-1 ${status === "failed" ? "bg-red-50 text-red-800" : status === "uploaded" ? "bg-green-50 text-green-800" : "bg-[var(--surface)] text-[var(--muted)]"}`}>
          {status === "uploading" ? <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : <span aria-hidden="true">{status === "uploaded" ? "✓" : status === "failed" ? "!" : "○"}</span>}
          {t(`premium.upload.${status}`)}
        </p>
        {state?.status === "failed" && <p className="mt-1 text-red-700">{t(`errors.${state.error}`)}</p>}
        {file && status === "uploaded" && <p className="mt-1 text-[var(--muted)]">{t("premium.upload.saveHint")}</p>}
      </div>
      {status === "failed" && onRetry && <button type="button" className="secondary-button mt-2 min-h-10 px-3 text-sm" onClick={onRetry}>{t("premium.upload.retry")}</button>}
    </div>
  );
}
