import "server-only";

export type TeamRole = "owner" | "admin" | "editor";
export type ManageableTeamRole = Exclude<TeamRole, "owner">;

export type TeamMember = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: TeamRole;
  status: "active";
  can_change_role: boolean;
  can_remove: boolean;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: ManageableTeamRole;
  status: "pending";
  expires_at: string;
  date_created: string;
};

export type TeamOrganization = {
  id: string;
  name: string;
  current_role: TeamRole;
  invite_roles: ManageableTeamRole[];
  members: TeamMember[];
  invitations: TeamInvitation[];
};

export type PublicTeamInvitation = {
  email: string;
  role: ManageableTeamRole;
  expires_at: string;
  locale: string;
  organization_name: string;
};

export type CompletedInvitationRegistration = {
  access_token: string;
  refresh_token: string;
  expires: number;
  membership_id: string;
  organization_name: string;
  locale: string;
};

type DirectusEndpointResponse<T> = {
  data?: T;
  error?: string;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

export class DirectusTeamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DirectusTeamError";
  }
}

function getDirectusUrl(): string {
  const directusUrl = process.env.DIRECTUS_URL;

  if (!directusUrl) {
    throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
  }

  return directusUrl;
}

async function readEndpointResponse<T>(response: Response): Promise<T> {
  let payload: DirectusEndpointResponse<T> = {};

  try {
    payload = (await response.json()) as DirectusEndpointResponse<T>;
  } catch {
    // A successful DELETE intentionally returns an empty response body.
  }

  if (!response.ok) {
    const code =
      payload.error ?? payload.errors?.[0]?.extensions?.code ?? "unknown";
    const message = payload.errors?.[0]?.message ?? code;
    throw new DirectusTeamError(message, response.status, code);
  }

  return payload.data as T;
}

async function teamRequest<T>(
  path: string,
  options: {
    accessToken?: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: HeadersInit = {};

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(
    new URL(`/findelio-team-management${path}`, getDirectusUrl()),
    {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    },
  );

  return readEndpointResponse<T>(response);
}

export function getAccountTeamOverview(
  accessToken: string,
): Promise<TeamOrganization[]> {
  return teamRequest<TeamOrganization[]>("/", { accessToken });
}

export function createTeamInvitation(
  accessToken: string,
  values: {
    organization_id: string;
    email: string;
    role: ManageableTeamRole;
    locale: string;
  },
): Promise<TeamInvitation> {
  return teamRequest<TeamInvitation>("/invitations", {
    accessToken,
    method: "POST",
    body: values,
  });
}

export async function cancelTeamInvitation(
  accessToken: string,
  invitationId: string,
): Promise<void> {
  await teamRequest<void>(`/invitations/${invitationId}`, {
    accessToken,
    method: "DELETE",
  });
}

export function updateTeamMemberRole(
  accessToken: string,
  memberId: string,
  role: ManageableTeamRole,
): Promise<{ id: string; role: ManageableTeamRole }> {
  return teamRequest(`/members/${memberId}`, {
    accessToken,
    method: "PATCH",
    body: { role },
  });
}

export async function removeTeamMember(
  accessToken: string,
  memberId: string,
): Promise<void> {
  await teamRequest<void>(`/members/${memberId}`, {
    accessToken,
    method: "DELETE",
  });
}

export function getPublicTeamInvitation(
  token: string,
): Promise<PublicTeamInvitation> {
  return teamRequest<PublicTeamInvitation>(
    `/invitations/${encodeURIComponent(token)}`,
  );
}

export function acceptTeamInvitation(
  accessToken: string,
  token: string,
): Promise<{ membership_id: string; organization_name: string }> {
  return teamRequest("/accept", {
    accessToken,
    method: "POST",
    body: { token },
  });
}

export function completeInvitationRegistration(
  verificationToken: string,
  invitationToken: string,
): Promise<CompletedInvitationRegistration> {
  return teamRequest<CompletedInvitationRegistration>(
    "/complete-registration",
    {
      method: "POST",
      body: {
        verification_token: verificationToken,
        invitation_token: invitationToken,
      },
    },
  );
}
