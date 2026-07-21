import Image from "next/image";
import { getDirectusAssetUrl } from "@/lib/directus-assets";

type CompanyLogoProps = {
  fileId: string | null | undefined;
  name: string;
  size?: "card" | "detail";
};

export default function CompanyLogo({
  fileId,
  name,
  size = "card",
}: CompanyLogoProps) {
  const isDetail = size === "detail";

  const containerClass = isDetail
    ? "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
    : "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-white";

  if (fileId) {
    return (
      <div className={containerClass}>
        <Image
          src={getDirectusAssetUrl(fileId)}
          alt={`${name} Logo`}
          fill
          sizes={isDetail ? "64px" : "56px"}
          className="object-contain p-1.5"
        />
      </div>
    );
  }

  return (
    <div
      className={`${containerClass} bg-[#eaf4ff] font-extrabold text-[var(--accent)] ${
        isDetail ? "text-2xl" : "text-xl"
      }`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}