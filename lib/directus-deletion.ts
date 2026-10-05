import "server-only";

export type DeletionEntityType = "listing" | "organization";

export type AccountDeletionRequest = {
  id: string;
  entity_type: DeletionEntityType;
  organization_id: string;
  listing_id: string | null;
  target_name: string;
  status: "pending";
  reason: string | null;
  date_created: string;
  can_cancel: boolean;
};

export type AdminDeletionRequest = AccountDeletionRequest & {
  organization_name: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string | null;
  can_approve: boolean;
  archive_available_at: string | null;
};

type EndpointResponse<T> = {
  data?: T;
  error?: string;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

export class DirectusDeletionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DirectusDeletionError";
  }
}

function getDirectusUrl(): string {
  const value = process.env.DIRECTUS_URL;
  if (!value) throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
  return value;
}

async function request<T>(
  path: string,
  accessToken: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(
    new URL(`/findelio-deletion-requests${path}`, getDirectusUrl()),
    {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    },
  );

  let payload: EndpointResponse<T> = {};
  try {
    payload = (await response.json()) as EndpointResponse<T>;
  } catch {
    // Successful DELETE requests intentionally have no response body.
  }

  if (!response.ok) {
    const code =
      payload.error ?? payload.errors?.[0]?.extensions?.code ?? "unknown";
    throw new DirectusDeletionError(
      payload.errors?.[0]?.message ?? code,
      response.status,
      code,
    );
  }

  return payload.data as T;
}

export function getAccountDeletionRequests(
  accessToken: string,
): Promise<AccountDeletionRequest[]> {
  return request<AccountDeletionRequest[]>("/", accessToken);
}

export function createDeletionRequest(
  accessToken: string,
  values: {
    entity_type: DeletionEntityType;
    target_id: string;
    reason: string;
    locale: string;
  },
): Promise<AccountDeletionRequest> {
  return request<AccountDeletionRequest>("/", accessToken, {
    method: "POST",
    body: values,
  });
}

export async function cancelDeletionRequest(
  accessToken: string,
  requestId: string,
): Promise<void> {
  await request<void>(`/${requestId}`, accessToken, { method: "DELETE" });
}

export function getPendingDeletionRequests(
  accessToken: string,
): Promise<AdminDeletionRequest[]> {
  return request<AdminDeletionRequest[]>("/admin", accessToken);
}

export function decideDeletionRequest(
  accessToken: string,
  requestId: string,
  action: "approve" | "reject",
  note: string,
): Promise<{ id: string; status: string }> {
  return request(`/admin/${requestId}`, accessToken, {
    method: "PATCH",
    body: { action, note },
  });
}
