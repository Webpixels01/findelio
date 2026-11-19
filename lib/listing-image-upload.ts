export type ListingImage = { id: string; assetUrl: string };
export type ImageUploadState =
  | { status: "uploading" }
  | { status: "uploaded" }
  | { status: "failed"; error: string };

// Reuse confirmed uploads and share in-flight requests when saving after a retry.
export function createListingImageUploader(
  listingId: string,
  onState: (file: File, state: ImageUploadState) => void,
) {
  const uploads = new WeakMap<File, Promise<ListingImage>>();
  return function upload(files: File[]): Promise<ListingImage[]> {
    const pending = files.filter((file) => !uploads.has(file));
    if (pending.length) {
      const request = (async (): Promise<ListingImage[]> => {
        pending.forEach((file) => onState(file, { status: "uploading" }));
        try {
          const body = new FormData();
          pending.forEach((file) => body.append("files", file));
          const response = await fetch(`/api/account/listings/${listingId}/media`, {
            method: "POST",
            body,
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.success) {
            throw new Error(result?.error ?? "upload_failed");
          }
          const images = result.images as ListingImage[] | undefined;
          if (!Array.isArray(images) || images.length !== pending.length ||
            images.some((image) => !image?.id || !image?.assetUrl)) {
            throw new Error("upload_failed");
          }
          pending.forEach((file) => onState(file, { status: "uploaded" }));
          return images;
        } catch (error) {
          const code = error instanceof Error && [
            "invalid_image", "file_too_large", "too_many_files", "unauthorized",
            "forbidden", "not_found", "premium_required",
          ].includes(error.message) ? error.message : "upload_failed";
          pending.forEach((file) => {
            uploads.delete(file);
            onState(file, { status: "failed", error: code });
          });
          throw new Error(code);
        }
      })();
      pending.forEach((file, index) => uploads.set(file, request.then((images) => images[index])));
    }
    return Promise.all(files.map((file) => uploads.get(file)!));
  };
}
