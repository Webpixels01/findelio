import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  DirectusAccountError,
  uploadAccountListingImages,
} from "@/lib/directus-account";
import {
  DirectusAuthError,
  getDirectusCurrentUser,
  refreshDirectusSession,
} from "@/lib/directus-auth";

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return (
    origin ===
    new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin
  );
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const tokens = await refreshDirectusSession(refreshToken);
    await saveAuthTokens(tokens);
    return tokens.access_token;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

async function uploadWithToken(
  accessToken: string,
  listingId: string,
  files: File[],
) {
  const currentUser = await getDirectusCurrentUser(accessToken);

  return uploadAccountListingImages(
    accessToken,
    listingId,
    files,
    currentUser.id,
  );
}

function errorResponse(error: DirectusAccountError) {
  if (error.code === "PREMIUM_REQUIRED") {
    return NextResponse.json(
      { error: "premium_required" },
      { status: 403 },
    );
  }

  if (error.code === "INVALID_IMAGE") {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  if (error.code === "FILE_TOO_LARGE") {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  if (error.code === "TOO_MANY_FILES") {
    return NextResponse.json({ error: "too_many_files" }, { status: 400 });
  }

  if (error.status === 403) {
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  if (error.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ error: "upload_failed" }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const { id } = await params;
  const listingId = id.trim();

  if (!listingId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  let accessToken = await getAccessToken();

  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const images = await uploadWithToken(accessToken, listingId, files);
    return NextResponse.json(
      { success: true, images },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof DirectusAccountError && error.status === 401) {
      const refreshedAccessToken = await refreshAccessToken();

      if (refreshedAccessToken) {
        try {
          const images = await uploadWithToken(
            refreshedAccessToken,
            listingId,
            files,
          );
          return NextResponse.json(
            { success: true, images },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (retryError) {
          error = retryError;
        }
      }
    }

    if (error instanceof DirectusAccountError) {
      console.warn(
        "Premium-Bild konnte nicht hochgeladen werden:",
        error.code ?? error.status,
      );
      return errorResponse(error);
    }

    if (error instanceof DirectusAuthError) {
      await clearAuthCookies();
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    console.error("Premium-Bild konnte nicht hochgeladen werden:", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
