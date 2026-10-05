import "server-only";

const directusUrl = process.env.DIRECTUS_URL;
const directusPublicUrl = process.env.DIRECTUS_PUBLIC_URL ?? directusUrl;

if (!directusUrl) {
  throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
}

export function getDirectusAssetUrl(fileId: string): string {
  return new URL(`/assets/${fileId}`, directusPublicUrl).toString();
}
