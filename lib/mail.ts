import "server-only";

export type ListingReviewNotification = {
  listingId: string;
  revisionId: string;
  kind: "new_listing" | "listing_revision";
};

export type ListingDecisionNotification = {
  revisionId: string;
  action: "approve" | "reject" | "suspend";
  reason?: string;
};

export type ContactNotification = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  locale: string;
};

function getDirectusUrl(): string {
  const directusUrl = process.env.DIRECTUS_URL;

  if (!directusUrl) {
    throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
  }

  return directusUrl;
}

function getDirectusServerToken(): string {
  const directusToken = process.env.DIRECTUS_TOKEN;

  if (!directusToken) {
    throw new Error("DIRECTUS_TOKEN fehlt in der Datei .env.local");
  }

  return directusToken;
}

export async function sendListingReviewNotification(
  accessToken: string,
  notification: ListingReviewNotification,
): Promise<void> {
  const response = await fetch(
    new URL("/findelio-review-notification", getDirectusUrl()),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listing_id: notification.listingId,
        revision_id: notification.revisionId,
        kind: notification.kind,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Directus-Mailversand fehlgeschlagen (${response.status}).`);
  }
}

export async function sendListingDecisionNotification(
  accessToken: string,
  notification: ListingDecisionNotification,
): Promise<void> {
  const response = await fetch(
    new URL("/findelio-review-notification/decision", getDirectusUrl()),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision_id: notification.revisionId,
        action: notification.action,
        reason: notification.reason,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Directus-Kundenbenachrichtigung fehlgeschlagen (${response.status}).`,
    );
  }
}

export async function sendContactNotification(
  notification: ContactNotification,
): Promise<void> {
  const response = await fetch(
    new URL("/findelio-review-notification/contact", getDirectusUrl()),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDirectusServerToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notification),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Directus-Kontaktversand fehlgeschlagen (${response.status}).`);
  }
}
