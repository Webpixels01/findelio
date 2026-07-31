"use client";

import Image from "next/image";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type SocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "x";

type SocialLink = {
  platform: SocialPlatform;
  url: string;
};

type OpeningHour = {
  id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
};

type ExistingImage = {
  id: string;
  assetUrl: string;
};

type UploadedImage = ExistingImage;

export type PremiumListingPayload = {
  logo_id: string | null;
  gallery_file_ids: string[];
  social_links: SocialLink[];
  opening_hours: Array<{
    day_of_week: number;
    opens_at: string;
    closes_at: string;
  }>;
};

export type PremiumListingFieldsHandle = {
  preparePayload: () => Promise<PremiumListingPayload>;
};

type UploadResult = {
  success?: boolean;
  images?: UploadedImage[];
  error?: string;
};

const platforms: SocialPlatform[] = [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
];

function localOpeningHourId(day: number, index: number): string {
  return `${day}-${index}-${Math.random().toString(36).slice(2)}`;
}

const ListingPremiumFields = forwardRef<
  PremiumListingFieldsHandle,
  {
    listingId: string;
    premiumEnabled: boolean;
    disabled: boolean;
    logo: ExistingImage | null;
    gallery: ExistingImage[];
    socialLinks: SocialLink[];
    openingHours: Array<{
      day_of_week: number;
      opens_at: string;
      closes_at: string;
    }>;
  }
>(function ListingPremiumFields(
  {
    listingId,
    premiumEnabled,
    disabled,
    logo: initialLogo,
    gallery: initialGallery,
    socialLinks: initialSocialLinks,
    openingHours: initialOpeningHours,
  },
  ref,
) {
  const t = useTranslations("ListingEditor.premium");
  const tCompany = useTranslations("Company");
  const [logo, setLogo] = useState(initialLogo);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [gallery, setGallery] = useState(initialGallery);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [socialLinks, setSocialLinks] = useState(initialSocialLinks);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(
    initialOpeningHours.map((item, index) => ({
      ...item,
      id: localOpeningHourId(item.day_of_week, index),
      opens_at: item.opens_at.slice(0, 5),
      closes_at: item.closes_at.slice(0, 5),
    })),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        number: index + 1,
        name: tCompany(`weekdays.${index + 1}`),
      })),
    [tCompany],
  );

  const uploadImages = useCallback(
    async (files: File[]): Promise<UploadedImage[]> => {
      const formData = new FormData();

      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(
        `/api/account/listings/${listingId}/media`,
        {
          method: "POST",
          body: formData,
        },
      );
      const result = (await response.json().catch(() => null)) as
        | UploadResult
        | null;

      if (!response.ok || !result?.success || !result.images) {
        throw new Error(result?.error ?? "upload_failed");
      }

      return result.images;
    },
    [listingId],
  );

  useImperativeHandle(
    ref,
    () => ({
      async preparePayload() {
        let preparedLogo = logo;
        let preparedGallery = gallery;

        if (logoFile) {
          const [uploadedLogo] = await uploadImages([logoFile]);
          preparedLogo = uploadedLogo;
          setLogo(uploadedLogo);
          setLogoFile(null);
        }

        if (galleryFiles.length > 0) {
          const uploadedGallery = await uploadImages(galleryFiles);
          preparedGallery = [...gallery, ...uploadedGallery];
          setGallery(preparedGallery);
          setGalleryFiles([]);
        }

        return {
          logo_id: preparedLogo?.id ?? null,
          gallery_file_ids: preparedGallery.map((item) => item.id),
          social_links: socialLinks
            .map((item) => ({
              platform: item.platform,
              url: item.url.trim(),
            }))
            .filter((item) => item.url),
          opening_hours: openingHours.map(
            ({ day_of_week, opens_at, closes_at }) => ({
              day_of_week,
              opens_at,
              closes_at,
            }),
          ),
        };
      },
    }),
    [
      gallery,
      galleryFiles,
      logo,
      logoFile,
      openingHours,
      socialLinks,
      uploadImages,
    ],
  );

  function addGalleryFiles(files: File[]) {
    const availableSlots = 10 - gallery.length - galleryFiles.length;

    if (files.length > availableSlots) {
      setLocalError(t("galleryLimit"));
      return;
    }

    setGalleryFiles((current) => [...current, ...files]);
    setLocalError(null);
  }

  function addSocialLink() {
    const usedPlatforms = new Set(socialLinks.map((link) => link.platform));
    const platform = platforms.find((item) => !usedPlatforms.has(item));

    if (!platform) {
      return;
    }

    setSocialLinks((current) => [...current, { platform, url: "" }]);
  }

  function addOpeningInterval(day: number) {
    const dayIntervals = openingHours.filter(
      (item) => item.day_of_week === day,
    );

    if (dayIntervals.length >= 3) {
      return;
    }

    setOpeningHours((current) => [
      ...current,
      {
        id: localOpeningHourId(day, dayIntervals.length),
        day_of_week: day,
        opens_at: "09:00",
        closes_at: "17:00",
      },
    ]);
  }

  if (!premiumEnabled) {
    return (
      <section className="rounded-3xl border border-[#bfdcff] bg-[#f2f8ff] p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white">
            {t("badge")}
          </span>
          <h2 className="text-2xl font-extrabold">{t("title")}</h2>
        </div>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">
          {t("lockedDescription")}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["logo", "gallery", "openingHours", "socialLinks"] as const).map(
            (feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-[#d5e8ff] bg-white p-4 font-extrabold"
              >
                <span className="mr-2 text-[var(--accent)]" aria-hidden="true">
                  ◆
                </span>
                {t(`features.${feature}`)}
              </div>
            ),
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <p className="text-sm font-bold text-[var(--accent)]">
            {t("lockedHint")}
          </p>
          <Link
            href={`/dashboard/firmenprofile/${listingId}/abo`}
            className="primary-button h-10 px-4"
          >
            {t("manageSubscription")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[#bfdcff] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white">
          {t("badge")}
        </span>
        <h2 className="text-2xl font-extrabold">{t("title")}</h2>
      </div>
      <p className="mt-3 text-[var(--muted)]">{t("description")}</p>

      <fieldset className="mt-8" disabled={disabled}>
        <legend className="text-xl font-extrabold">
          {t("features.logo")}
        </legend>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("logoHint")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {logo && !logoFile ? (
            <Image
              src={logo.assetUrl}
              alt={t("logoPreview")}
              width={96}
              height={96}
              className="size-24 rounded-2xl border border-[var(--border)] bg-white object-contain p-2"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-center text-xs font-bold text-[var(--muted)]">
              {logoFile?.name ?? t("noLogo")}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <label className="secondary-button cursor-pointer px-4 py-2.5">
              {t("chooseLogo")}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setLogoFile(event.target.files?.[0] ?? null);
                  setLocalError(null);
                }}
              />
            </label>
            {(logo || logoFile) && (
              <button
                type="button"
                className="rounded-xl border border-[#e2a6a6] px-4 py-2.5 font-bold text-[#9d1c1c]"
                onClick={() => {
                  setLogo(null);
                  setLogoFile(null);
                }}
              >
                {t("remove")}
              </button>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset
        className="mt-8 border-t border-[var(--border)] pt-8"
        disabled={disabled}
      >
        <legend className="text-xl font-extrabold">
          {t("features.gallery")}
        </legend>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("galleryHint")}</p>
        {(gallery.length > 0 || galleryFiles.length > 0) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((image) => (
              <div
                key={image.id}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)]"
              >
                <Image
                  src={image.assetUrl}
                  alt={t("galleryPreview")}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setGallery((current) =>
                      current.filter((item) => item.id !== image.id),
                    )
                  }
                  className="absolute right-2 top-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-extrabold text-[#9d1c1c] shadow"
                >
                  {t("remove")}
                </button>
              </div>
            ))}
            {galleryFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center"
              >
                <p className="break-all text-sm font-bold">{file.name}</p>
                <button
                  type="button"
                  onClick={() =>
                    setGalleryFiles((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="mt-3 text-sm font-extrabold text-[#9d1c1c]"
                >
                  {t("remove")}
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="secondary-button mt-4 cursor-pointer px-4 py-2.5">
          {t("addImages")}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              addGalleryFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>
      </fieldset>

      <fieldset
        className="mt-8 border-t border-[var(--border)] pt-8"
        disabled={disabled}
      >
        <legend className="text-xl font-extrabold">
          {t("features.openingHours")}
        </legend>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t("openingHoursHint")}
        </p>
        <div className="mt-5 space-y-4">
          {weekdays.map((weekday) => {
            const intervals = openingHours
              .filter((item) => item.day_of_week === weekday.number)
              .sort((first, second) =>
                first.opens_at.localeCompare(second.opens_at),
              );

            return (
              <div
                key={weekday.number}
                className="grid gap-3 rounded-2xl bg-[var(--surface)] p-4 lg:grid-cols-[130px_1fr_auto]"
              >
                <p className="pt-2 font-extrabold">{weekday.name}</p>
                <div className="space-y-3">
                  {intervals.length === 0 ? (
                    <p className="pt-2 text-sm text-[var(--muted)]">
                      {t("closed")}
                    </p>
                  ) : (
                    intervals.map((interval) => (
                      <div
                        key={interval.id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          className="field-control w-36"
                          type="time"
                          value={interval.opens_at}
                          aria-label={t("opensAt", {
                            day: weekday.name,
                          })}
                          onChange={(event) =>
                            setOpeningHours((current) =>
                              current.map((item) =>
                                item.id === interval.id
                                  ? {
                                      ...item,
                                      opens_at: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                          required
                        />
                        <span aria-hidden="true">–</span>
                        <input
                          className="field-control w-36"
                          type="time"
                          value={interval.closes_at}
                          aria-label={t("closesAt", {
                            day: weekday.name,
                          })}
                          onChange={(event) =>
                            setOpeningHours((current) =>
                              current.map((item) =>
                                item.id === interval.id
                                  ? {
                                      ...item,
                                      closes_at: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setOpeningHours((current) =>
                              current.filter(
                                (item) => item.id !== interval.id,
                              ),
                            )
                          }
                          className="px-2 py-2 text-sm font-extrabold text-[#9d1c1c]"
                        >
                          {t("remove")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addOpeningInterval(weekday.number)}
                  disabled={disabled || intervals.length >= 3}
                  className="self-start rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-extrabold text-[var(--accent)] disabled:opacity-40"
                >
                  {t("addInterval")}
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset
        className="mt-8 border-t border-[var(--border)] pt-8"
        disabled={disabled}
      >
        <legend className="text-xl font-extrabold">
          {t("features.socialLinks")}
        </legend>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t("socialLinksHint")}
        </p>
        <div className="mt-4 space-y-3">
          {socialLinks.map((link, index) => (
            <div
              key={`${link.platform}-${index}`}
              className="grid gap-3 sm:grid-cols-[180px_1fr_auto]"
            >
              <select
                className="field-control"
                value={link.platform}
                aria-label={t("platform")}
                onChange={(event) => {
                  const platform = event.target.value as SocialPlatform;
                  setSocialLinks((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, platform } : item,
                    ),
                  );
                }}
              >
                {platforms.map((platform) => (
                  <option
                    key={platform}
                    value={platform}
                    disabled={socialLinks.some(
                      (item, itemIndex) =>
                        itemIndex !== index && item.platform === platform,
                    )}
                  >
                    {t(`platforms.${platform}`)}
                  </option>
                ))}
              </select>
              <input
                className="field-control"
                type="url"
                value={link.url}
                maxLength={500}
                placeholder="https://"
                aria-label={t("socialUrl")}
                onChange={(event) =>
                  setSocialLinks((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, url: event.target.value }
                        : item,
                    ),
                  )
                }
                required
              />
              <button
                type="button"
                onClick={() =>
                  setSocialLinks((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                className="px-3 py-2 font-extrabold text-[#9d1c1c]"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSocialLink}
          disabled={disabled || socialLinks.length >= platforms.length}
          className="secondary-button mt-4 px-4 py-2.5 disabled:opacity-40"
        >
          {t("addSocialLink")}
        </button>
      </fieldset>

      {localError && (
        <p className="mt-5 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#9d1c1c]">
          {localError}
        </p>
      )}
      <p className="mt-5 text-xs text-[var(--muted)]">{t("imageRules")}</p>
    </section>
  );
});

export default ListingPremiumFields;
