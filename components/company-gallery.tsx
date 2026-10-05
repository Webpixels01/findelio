import { getTranslations } from "next-intl/server";
import type { GalleryItem } from "@/lib/directus";
import { getDirectusAssetUrl } from "@/lib/directus-assets";
import CompanyGalleryLightbox from "@/components/company-gallery-lightbox";

type CompanyGalleryProps = {
  items: GalleryItem[];
  title: string;
  companyName: string;
};

export default async function CompanyGallery({
  items,
  title,
  companyName,
}: CompanyGalleryProps) {
  if (items.length === 0) {
    return null;
  }

  const t = await getTranslations("Company");
  const images = items.map((item, index) => ({
    id: String(item.id),
    url: getDirectusAssetUrl(item.directus_files_id),
    alt: t("galleryImage", {
      company: companyName,
      current: index + 1,
      total: items.length,
    }),
    openLabel: t("galleryOpen", { current: index + 1 }),
  }));

  return (
    <section className="mt-9 border-t border-[var(--border)] pt-8">
      <h2 className="text-2xl font-extrabold">{title}</h2>

      <CompanyGalleryLightbox
        images={images}
        labels={{
          dialog: t("galleryDialog"),
          close: t("galleryClose"),
          previous: t("galleryPrevious"),
          next: t("galleryNext"),
        }}
      />
    </section>
  );
}
