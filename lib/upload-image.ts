import "server-only";
import sharp from "sharp";

export class InvalidUploadImageError extends Error {}

/** Validate the actual raster content without changing the uploaded image. */
export async function validateUploadImage(file: File): Promise<void> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const format = jpeg ? "jpeg" : png ? "png" : webp ? "webp" : null;
  if (!format || file.type !== `image/${format}`) {
    throw new InvalidUploadImageError("Unsupported image");
  }
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000 ||
      (metadata.pages ?? 1) !== 1 || metadata.format !== format) {
      throw new Error("Invalid dimensions or format");
    }
    // stats() decodes all pixels; metadata() alone also accepts truncated files.
    await image.stats();
  } catch {
    throw new InvalidUploadImageError("Invalid image");
  }
}
