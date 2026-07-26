import "server-only";
import nodemailer from "nodemailer";

export type ListingReviewNotification = {
  listingId: string;
  listingName: string;
  kind: "new_listing" | "listing_revision";
  changedFields?: string[];
};

const fieldLabels: Record<string, string> = {
  name: "Firmenname",
  short_description: "Kurzbeschreibung",
  description: "Beschreibung",
  street: "Strasse",
  postal_code: "Postleitzahl",
  city: "Ort",
  canton: "Kanton",
  public_email: "E-Mail-Adresse",
  phone: "Telefon",
  website_url: "Website",
  address_visibility: "Adressanzeige",
  industry_ids: "Branchen",
  spoken_language_ids: "Gesprochene Sprachen",
};

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} fehlt in der Datei .env.local`);
  }

  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getReviewUrl(kind: ListingReviewNotification["kind"]): string {
  const siteUrl = requiredEnvironmentValue("NEXT_PUBLIC_SITE_URL").replace(
    /\/$/,
    "",
  );

  return kind === "listing_revision"
    ? `${siteUrl}/de-ch/dashboard/pruefung`
    : `${siteUrl}/de-ch/dashboard/firmenprofile`;
}

export async function sendListingReviewNotification(
  notification: ListingReviewNotification,
): Promise<void> {
  const host = requiredEnvironmentValue("SMTP_HOST");
  const port = Number(requiredEnvironmentValue("SMTP_PORT"));
  const user = requiredEnvironmentValue("SMTP_USER");
  const password = requiredEnvironmentValue("SMTP_PASSWORD");
  const from = requiredEnvironmentValue("MAIL_FROM");
  const to = requiredEnvironmentValue("ADMIN_NOTIFICATION_EMAIL");

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("SMTP_PORT ist ungültig.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass: password,
    },
    requireTLS: process.env.SMTP_SECURE !== "true",
  });

  const isRevision = notification.kind === "listing_revision";
  const subject = isRevision
    ? `Änderungen warten auf Freigabe: ${notification.listingName}`
    : `Neuer Eintrag wartet auf Freigabe: ${notification.listingName}`;
  const reviewUrl = getReviewUrl(notification.kind);
  const changedFields = (notification.changedFields ?? [])
    .map((field) => fieldLabels[field] ?? field)
    .sort((a, b) => a.localeCompare(b, "de"));
  const changedFieldsText =
    isRevision && changedFields.length > 0
      ? `\nGeänderte Felder:\n${changedFields.map((field) => `- ${field}`).join("\n")}`
      : "";
  const changedFieldsHtml =
    isRevision && changedFields.length > 0
      ? `<p><strong>Geänderte Felder:</strong></p><ul>${changedFields
          .map((field) => `<li>${escapeHtml(field)}</li>`)
          .join("")}</ul>`
      : "";
  const intro = isRevision
    ? "Ein bereits veröffentlichter Firmeneintrag wurde geändert und wartet auf deine Freigabe."
    : "Ein neuer Firmeneintrag wurde zur Prüfung eingereicht.";

  await transporter.sendMail({
    from,
    to,
    replyTo: from,
    subject,
    text: `${intro}\n\nFirma: ${notification.listingName}${changedFieldsText}\n\nPrüfbereich öffnen:\n${reviewUrl}\n\nListing-ID: ${notification.listingId}`,
    html: [
      `<p>${escapeHtml(intro)}</p>`,
      `<p><strong>Firma:</strong> ${escapeHtml(notification.listingName)}</p>`,
      changedFieldsHtml,
      `<p><a href="${escapeHtml(reviewUrl)}">Prüfbereich öffnen</a></p>`,
      `<p style="color:#667085;font-size:12px">Listing-ID: ${escapeHtml(notification.listingId)}</p>`,
    ].join(""),
  });
}
