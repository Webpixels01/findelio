"use client";

import UploadRequirements from "@/components/upload-requirements";

import ListingUploadPreview from "@/components/listing-upload-preview";
import { createListingImageUploader, type ImageUploadState } from "@/lib/listing-image-upload";
import PremiumBadge from "@/components/premium-badge";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
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

export type PremiumListingPayload = {
  logo_id: string | null;
  gallery_file_ids: string[];
  social_links: SocialLink[];
  opening_hours: Array<{
    day_of_week: number;
    opens_at: string;
    closes_at: string;
  }>;
  custom_cta_label: string | null;
  custom_cta_value: string | null;
};

export type PremiumListingFieldsHandle = {
  preparePayload: () => Promise<PremiumListingPayload>;
  markUploadsSaved: () => void;
};

type PendingImageRemoval =
  | { type: "logo" }
  | { type: "gallery"; imageId: string }
  | { type: "galleryFile"; index: number };

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
    customCtaLabel: string;
    customCtaValue: string;
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
    customCtaLabel: initialCustomCtaLabel,
    customCtaValue: initialCustomCtaValue,
  },
  ref,
) {
  const t = useTranslations("ListingEditor.premium");
  const tg = useTranslations("Growth");
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
  const [pendingImageRemoval, setPendingImageRemoval] =
    useState<PendingImageRemoval | null>(null);
  const [customCtaLabel, setCustomCtaLabel] = useState(initialCustomCtaLabel);
  const [customCtaValue, setCustomCtaValue] = useState(initialCustomCtaValue);

  useEffect(() => {
    if (!pendingImageRemoval) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingImageRemoval(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pendingImageRemoval]);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        number: index + 1,
        name: tCompany(`weekdays.${index + 1}`),
      })),
    [tCompany],
  );

  const preparedMedia = useRef<{ logo: ExistingImage | null; gallery: ExistingImage[] } | null>(null);
  const [uploadStates, setUploadStates] = useState<Map<File, ImageUploadState>>(new Map());
  const uploadImage = useMemo(
    () => createListingImageUploader(listingId, (file, state) => {
      setUploadStates((current) => new Map(current).set(file, state));
    }),
    [listingId],
  );

  function retryUpload(file: File) {
    // The per-image status displays the error; keep the file available for retry.
    void uploadImage([file]).catch(() => {});
  }

  useImperativeHandle(
    ref,
    () => ({
      markUploadsSaved() {
        if (!preparedMedia.current) return;
        setLogo(preparedMedia.current.logo);
        setGallery(preparedMedia.current.gallery);
        setLogoFile(null);
        setGalleryFiles([]);
        setUploadStates(new Map());
        preparedMedia.current = null;
      },
      async preparePayload() {
        preparedMedia.current = null;
        let preparedLogo = logo;
        let preparedGallery = gallery;

        let uploadError: unknown;
        if (logoFile) {
          try {
            [preparedLogo] = await uploadImage([logoFile]);
          } catch (error) {
            uploadError = error;
          }
        }

        if (galleryFiles.length > 0) {
          try {
            preparedGallery = [...gallery, ...await uploadImage(galleryFiles)];
          } catch (error) {
            uploadError ??= error;
          }
        }
        if (uploadError) throw uploadError;
        preparedMedia.current = { logo: preparedLogo, gallery: preparedGallery };

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
          custom_cta_label: customCtaLabel.trim() || null,
          custom_cta_value: customCtaValue.trim() || null,
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
      uploadImage,
      customCtaLabel,
      customCtaValue,
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

  function confirmImageRemoval() {
    if (!pendingImageRemoval) {
      return;
    }

    if (pendingImageRemoval.type === "logo") {
      setLogo(null);
      setLogoFile(null);
    } else if (pendingImageRemoval.type === "gallery") {
      setGallery((current) =>
        current.filter((item) => item.id !== pendingImageRemoval.imageId),
      );
    } else {
      setGalleryFiles((current) =>
        current.filter((_, index) => index !== pendingImageRemoval.index),
      );
    }

    setPendingImageRemoval(null);
  }

  if (!premiumEnabled) {
    return (
      <section className="rounded-3xl border border-[#bfdcff] bg-[#f2f8ff] p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <PremiumBadge>{t("badge")}</PremiumBadge>
          <h2 className="text-2xl font-extrabold">{t("title")}</h2>
        </div>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">
          {t("lockedDescription")}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["logo", "gallery", "openingHours", "socialLinks", "translations", "customCta"] as const).map(
            (feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-[#d5e8ff] bg-white p-4 font-extrabold"
              >
                <span className="mr-2 text-[var(--accent)]" aria-hidden="true">
                  ◆
                </span>
                {feature === "customCta" ? tg("customCta.title") : t(`features.${feature}`)}
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
        <PremiumBadge>{t("badge")}</PremiumBadge>
        <h2 className="text-2xl font-extrabold">{t("title")}</h2>
      </div>
      <p className="mt-3 text-[var(--muted)]">{t("description")}</p>

      <fieldset className="mt-8" disabled={disabled}>
        <legend className="text-xl font-extrabold">
          {t("features.logo")}
        </legend>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("logoHint")}</p>
        <UploadRequirements />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {logoFile || logo ? (
            <ListingUploadPreview
              key={logoFile ? `${logoFile.name}-${logoFile.lastModified}` : logo?.id}
              file={logoFile ?? undefined}
              src={logo?.assetUrl}
              alt={t("logoPreview")}
              compact
              state={logoFile ? uploadStates.get(logoFile) : undefined}
              onRetry={logoFile ? () => retryUpload(logoFile) : undefined}
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-center text-xs font-bold text-[var(--muted)]">
              {t("noLogo")}
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
                  event.target.value = "";
                }}
              />
            </label>
            {(logo || logoFile) && (
              <button
                type="button"
                className="danger-button min-h-11 px-4"
                onClick={() => setPendingImageRemoval({ type: "logo" })}
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
        <UploadRequirements />
        {(gallery.length > 0 || galleryFiles.length > 0) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((image) => (
              <div
                key={image.id}
                className="rounded-2xl border border-[var(--border)] p-3"
              >
                <ListingUploadPreview src={image.assetUrl} alt={t("galleryPreview")} />
                <button
                  type="button"
                  onClick={() =>
                    setPendingImageRemoval({
                      type: "gallery",
                      imageId: image.id,
                    })
                  }
                  className="danger-button mt-3 min-h-10 px-3 text-sm"
                >
                  {t("remove")}
                </button>
              </div>
            ))}
            {galleryFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.lastModified}-${index}`}
                className="rounded-2xl border border-dashed border-[var(--border)] p-3"
              >
                <ListingUploadPreview
                  file={file}
                  alt={t("galleryPreview")}
                  state={uploadStates.get(file)}
                  onRetry={() => retryUpload(file)}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPendingImageRemoval({
                      type: "galleryFile",
                      index,
                    })
                  }
                  className="danger-button mt-3 min-h-10 px-3 text-sm"
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
                          className="danger-button min-h-10 px-3 text-sm"
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
                className="danger-button min-h-11 px-4"
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

      <fieldset
        className="mt-8 border-t border-[var(--border)] pt-8"
        disabled={disabled}
      >
        <legend className="text-xl font-extrabold">
          {tg("customCta.title")}
        </legend>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {tg("customCta.hint")}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="field-group">
            <span className="field-label">{tg("customCta.label")}</span>
            <input
              className="field-control"
              value={customCtaLabel}
              onChange={(event) => setCustomCtaLabel(event.target.value)}
              maxLength={80}
              placeholder={tg("customCta.placeholder")}
            />
          </label>
          <label className="field-group">
            <span className="field-label">{tg("customCta.value")}</span>
            <input
              className="field-control"
              value={customCtaValue}
              onChange={(event) => setCustomCtaValue(event.target.value)}
              maxLength={500}
              placeholder={tg("customCta.valuePlaceholder")}
            />
          </label>
        </div>
      </fieldset>

      {localError && (
        <p className="mt-5 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#9d1c1c]">
          {localError}
        </p>
      )}
      <p className="mt-5 text-xs text-[var(--muted)]">{t("imageRules")}</p>

      {pendingImageRemoval && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#001734]/65 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl sm:p-8"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="image-removal-title"
            aria-describedby="image-removal-description"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-[#fff0f0] text-2xl text-[#9d1c1c]" aria-hidden="true">
              !
            </div>
            <h2
              id="image-removal-title"
              className="mt-5 text-2xl font-extrabold"
            >
              {pendingImageRemoval.type === "logo"
                ? t("removeDialog.logoTitle")
                : t("removeDialog.galleryTitle")}
            </h2>
            <p
              id="image-removal-description"
              className="mt-3 text-[var(--muted)]"
            >
              {pendingImageRemoval.type === "logo"
                ? t("removeDialog.logoDescription")
                : t("removeDialog.galleryDescription")}
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="secondary-button h-11 px-5"
                onClick={() => setPendingImageRemoval(null)}
                autoFocus
              >
                {t("removeDialog.cancel")}
              </button>
              <button
                type="button"
                className="danger-button-solid h-11 px-5"
                onClick={confirmImageRemoval}
              >
                {t("removeDialog.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});

export default ListingPremiumFields;
