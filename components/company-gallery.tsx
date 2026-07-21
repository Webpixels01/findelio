import Image from "next/image";
import type { GalleryItem } from "@/lib/directus";
import { getDirectusAssetUrl } from "@/lib/directus-assets";

type CompanyGalleryProps = {
  items: GalleryItem[];
  title: string;
  companyName: string;
};

export default function CompanyGallery({
  items,
  title,
  companyName,
}: CompanyGalleryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-9 border-t border-[var(--border)] pt-8">
      <h2 className="text-2xl font-extrabold">{title}</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => {
          const imageUrl = getDirectusAssetUrl(
            item.directus_files_id,
          );

          return (
            <a
              key={item.id}
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
            >
              <Image
                src={imageUrl}
                alt={`${companyName} – Bild ${index + 1}`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </a>
          );
        })}
      </div>
    </section>
  );
}