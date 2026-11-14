"use client";

import { useTranslations } from "next-intl";

export default function UploadRequirements() {
  const t = useTranslations("UploadRequirements");
  return <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t("formats")} {t("size")} {t("dimensions")}</p>;
}
