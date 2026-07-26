import "server-only";

export type DirectusAuthTokens = {
  access_token: string;
  expires: number;
  refresh_token: string;
};

export type DirectusCurrentUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  avatar: string | null;
  role: {
    id: string;
    name: string;
  } | null;
};


export type DirectusPermissionAccess = {
  access: "none" | "partial" | "full";
  fields?: string[];
};

export type DirectusCurrentUserPermissions = Record<
  string,
  Partial<Record<"create" | "read" | "update" | "delete" | "share", DirectusPermissionAccess>>
>;

type DirectusDataResponse<T> = {
  data?: T;
  errors?: Array<{
    message?: string;
    extensions?: {
      code?: string;
    };
  }>;
};

export class DirectusAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DirectusAuthError";
  }
}

function getDirectusUrl(): string {
  const directusUrl = process.env.DIRECTUS_URL;

  if (!directusUrl) {
    throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
  }

  return directusUrl;
}

async function readDirectusResponse<T>(response: Response): Promise<T> {
  let result: DirectusDataResponse<T> | null = null;

  try {
    result = (await response.json()) as DirectusDataResponse<T>;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.data) {
    throw new DirectusAuthError(
      result?.errors?.[0]?.message ?? "Directus-Anfrage fehlgeschlagen.",
      response.status,
      result?.errors?.[0]?.extensions?.code,
    );
  }

  return result.data;
}

export async function loginWithDirectus(
  email: string,
  password: string,
): Promise<DirectusAuthTokens> {
  const response = await fetch(new URL("/auth/login", getDirectusUrl()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      mode: "json",
    }),
    cache: "no-store",
  });

  return readDirectusResponse<DirectusAuthTokens>(response);
}

export async function refreshDirectusSession(
  refreshToken: string,
): Promise<DirectusAuthTokens> {
  const response = await fetch(new URL("/auth/refresh", getDirectusUrl()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      mode: "json",
    }),
    cache: "no-store",
  });

  return readDirectusResponse<DirectusAuthTokens>(response);
}

export async function logoutDirectusSession(
  refreshToken: string,
): Promise<void> {
  const response = await fetch(new URL("/auth/logout", getDirectusUrl()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      mode: "json",
    }),
    cache: "no-store",
  });

  if (!response.ok && response.status !== 401) {
    throw new DirectusAuthError(
      "Die Directus-Sitzung konnte nicht beendet werden.",
      response.status,
    );
  }
}

export async function getDirectusCurrentUser(
  accessToken: string,
): Promise<DirectusCurrentUser> {
  const url = new URL("/users/me", getDirectusUrl());
  url.searchParams.set(
    "fields",
    "id,email,first_name,last_name,status,avatar,role.id,role.name",
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return readDirectusResponse<DirectusCurrentUser>(response);
}

export async function getDirectusCurrentUserPermissions(
  accessToken: string,
): Promise<DirectusCurrentUserPermissions> {
  const response = await fetch(new URL("/permissions/me", getDirectusUrl()), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return readDirectusResponse<DirectusCurrentUserPermissions>(response);
}

export function hasListingReviewAccess(
  permissions: DirectusCurrentUserPermissions,
): boolean {
  return (
    permissions.listing_revisions?.read?.access === "full" &&
    permissions.listing_revisions?.update?.access === "full" &&
    permissions.listings?.update?.access === "full"
  );
}
