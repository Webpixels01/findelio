import "server-only";

const directusUrl = process.env.DIRECTUS_URL;

if (!directusUrl) {
  throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
}

export function getDirectusAssetUrl(fileId: string): string {
  return new URL(`/assets/${fileId}`, directusUrl).toString();
}