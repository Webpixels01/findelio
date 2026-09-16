import Image from "next/image";
import { getDirectusAssetUrl } from "@/lib/directus-assets";

type CompanyLogoProps = {
  fileId:
    | string
    | {
        id: string;
        width: number | null;
        height: number | null;
      }
    | null
    | undefined;
  name: string;
  size?: "card" | "detail";
};

export default function CompanyLogo({
  fileId,
  name,
  size = "card",
}: CompanyLogoProps) {
  const isDetail = size === "detail";
  const file = typeof fileId === "string" ? { id: fileId } : fileId;
  const isWide = Boolean(
    file &&
      "width" in file &&
      "height" in file &&
      file.width &&
      file.height &&
      file.width / file.height > 1.5,
  );
  const containerClass = isWide
    ? isDetail
      ? "relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
      : "relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-white"
    : isDetail
      ? "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-white"
      : "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-white";

  if (file) {
    return (
      <div className={containerClass}>
        <Image
          src={getDirectusAssetUrl(file.id)}
          alt={`${name} Logo`}
          fill
          sizes={
            isWide
              ? isDetail
                ? "112px"
                : "80px"
              : isDetail
                ? "64px"
                : "56px"
          }
          className={isWide ? "object-contain p-2" : "object-cover"}
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
