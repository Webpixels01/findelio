const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fieldLabels = {
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
  logo_id: "Firmenlogo",
  gallery_file_ids: "Bildergalerie",
  opening_hours: "Öffnungszeiten",
  social_links: "Social-Media-Links",
};

const contactSubjectLabels = {
  general: "Allgemeine Anfrage",
  listing: "Frage zu einem Firmeneintrag",
  account: "Konto und Anmeldung",
  partnership: "Partnerschaft",
  other: "Anderes Anliegen",
};

const findelioReviewNotificationEndpoint = {
  id: "findelio-review-notification",
  handler: (router, { database, env, getSchema, logger, services }) => {
    const { MailService } = services;

    router.post("/", async (req, res) => {
      const userId = req.accountability?.user;
      const listingId =
        typeof req.body?.listing_id === "string"
          ? req.body.listing_id.trim()
          : "";
      const revisionId =
        typeof req.body?.revision_id === "string"
          ? req.body.revision_id.trim()
          : "";
      const kind = req.body?.kind;

      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }

      if (
        !uuidPattern.test(listingId) ||
        !uuidPattern.test(revisionId) ||
        !["new_listing", "listing_revision"].includes(kind)
      ) {
        return res.status(400).json({ error: "invalid_data" });
      }

      const recipient = String(env.ADMIN_NOTIFICATION_EMAIL ?? "").trim();
      const siteUrl = String(env.FINDELIO_SITE_URL ?? "")
        .trim()
        .replace(/\/$/, "");

      if (!recipient || !siteUrl) {
        logger.error(
          "ADMIN_NOTIFICATION_EMAIL or FINDELIO_SITE_URL is missing",
        );
        return res.status(500).json({ error: "configuration_error" });
      }

      try {
        let revisionQuery = database("listing_revisions as revisions")
          .join("listings", "revisions.listing", "listings.id")
          .select(
            "revisions.changed_fields",
            "listings.name as listing_name",
            "listings.status as listing_status",
          )
          .where({
            "revisions.id": revisionId,
            "revisions.listing": listingId,
            "revisions.status": "pending",
          });

        if (req.accountability?.admin !== true) {
          revisionQuery = revisionQuery
            .join(
              "organization_members as members",
              "listings.organization",
              "members.organization",
            )
            .where({
              "revisions.submitted_by": userId,
              "members.user": userId,
              "members.status": "active",
            });
        }

        const revision = await revisionQuery.first();

        const expectedKind =
          revision?.listing_status === "published"
            ? "listing_revision"
            : "new_listing";

        if (!revision || kind !== expectedKind) {
          return res.status(403).json({ error: "forbidden" });
        }

        const changedFields =
          revision.changed_fields &&
          typeof revision.changed_fields === "object" &&
          !Array.isArray(revision.changed_fields)
            ? Object.keys(revision.changed_fields)
                .map((field) => fieldLabels[field] ?? field)
                .sort((a, b) => a.localeCompare(b, "de"))
            : [];
        const isRevision = kind === "listing_revision";
        const intro = isRevision
          ? "Ein bereits veröffentlichter Firmeneintrag wurde geändert und wartet auf deine Freigabe."
          : "Ein neuer Firmeneintrag wurde zur Prüfung eingereicht.";
        const subject = isRevision
          ? `Änderungen warten auf Freigabe: ${revision.listing_name}`
          : `Neuer Eintrag wartet auf Freigabe: ${revision.listing_name}`;
        const reviewPath = "/de-ch/dashboard/pruefung";
        const reviewUrl = `${siteUrl}/api/auth/refresh?next=${encodeURIComponent(
          reviewPath,
        )}&locale=de-ch`;
        const changedFieldsText =
          changedFields.length > 0
            ? `\n\nGeänderte Felder:\n${changedFields
                .map((field) => `- ${field}`)
                .join("\n")}`
            : "";
        const mailService = new MailService({
          schema: await getSchema(),
          accountability: req.accountability,
          knex: database,
        });

        await mailService.send({
          to: recipient,
          subject,
          text: `${intro}\n\nFirma: ${revision.listing_name}${changedFieldsText}\n\nPrüfung öffnen:\n${reviewUrl}\n\nListing-ID: ${listingId}`,
          template: {
            name: "listing-review-notification",
            data: {
              intro,
              listingName: revision.listing_name,
              reviewUrl,
              listingId,
              changedFields,
            },
          },
        });

        return res.status(204).send();
      } catch (error) {
        logger.error(error, "Findelio review notification failed");
        return res.status(500).json({ error: "send_failed" });
      }
    });

    router.post("/contact", async (req, res) => {
      const userId = req.accountability?.user;
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const email =
        typeof req.body?.email === "string" ? req.body.email.trim() : "";
      const phone =
        typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
      const subject =
        typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
      const message =
        typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const locale =
        typeof req.body?.locale === "string" ? req.body.locale.trim() : "";

      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }

      if (
        !name ||
        name.length > 120 ||
        !email ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        phone.length > 50 ||
        !contactSubjectLabels[subject] ||
        message.length < 20 ||
        message.length > 5000
      ) {
        return res.status(400).json({ error: "invalid_data" });
      }

      const recipient = String(env.ADMIN_NOTIFICATION_EMAIL ?? "").trim();

      if (!recipient) {
        logger.error("ADMIN_NOTIFICATION_EMAIL is missing");
        return res.status(500).json({ error: "configuration_error" });
      }

      try {
        const subjectLabel = contactSubjectLabels[subject];
        const mailService = new MailService({
          schema: await getSchema(),
          accountability: req.accountability,
          knex: database,
        });

        await mailService.send({
          to: recipient,
          replyTo: email,
          subject: `Kontaktanfrage: ${subjectLabel}`,
          text: `Neue Kontaktanfrage über Findelio\n\nName: ${name}\nE-Mail: ${email}\nTelefon: ${phone || "Nicht angegeben"}\nSprache: ${locale || "Nicht angegeben"}\nThema: ${subjectLabel}\n\nNachricht:\n${message}`,
          template: {
            name: "contact-notification",
            data: {
              name,
              email,
              phone,
              locale,
              subject: subjectLabel,
              message,
            },
          },
        });

        return res.status(204).send();
      } catch (error) {
        logger.error(error, "Findelio contact notification failed");
        return res.status(500).json({ error: "send_failed" });
      }
    });

    router.post("/decision", async (req, res) => {
      const userId = req.accountability?.user;
      const revisionId =
        typeof req.body?.revision_id === "string"
          ? req.body.revision_id.trim()
          : "";
      const action = req.body?.action;

      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }

      if (
        !uuidPattern.test(revisionId) ||
        !["approve", "reject", "suspend"].includes(action)
      ) {
        return res.status(400).json({ error: "invalid_data" });
      }

      const siteUrl = String(env.FINDELIO_SITE_URL ?? "")
        .trim()
        .replace(/\/$/, "");

      if (!siteUrl) {
        logger.error("FINDELIO_SITE_URL is missing");
        return res.status(500).json({ error: "configuration_error" });
      }

      try {
        const revision = await database("listing_revisions as revisions")
          .join("listings", "revisions.listing", "listings.id")
          .leftJoin(
            "directus_users as submitter",
            "revisions.submitted_by",
            "submitter.id",
          )
          .select(
            "revisions.status as revision_status",
            "revisions.reviewed_by",
            "revisions.rejection_reason",
            "listings.id as listing_id",
            "listings.name as listing_name",
            "listings.slug as listing_slug",
            "listings.status as listing_status",
            "submitter.email as recipient",
          )
          .where({
            "revisions.id": revisionId,
            "revisions.reviewed_by": userId,
          })
          .first();

        const hasExpectedState =
          (action === "approve" &&
            revision?.revision_status === "approved" &&
            revision?.listing_status === "published") ||
          (action === "reject" &&
            revision?.revision_status === "rejected" &&
            revision?.listing_status !== "suspended") ||
          (action === "suspend" &&
            revision?.revision_status === "rejected" &&
            revision?.listing_status === "suspended");

        if (!revision || !hasExpectedState) {
          return res.status(403).json({ error: "forbidden" });
        }

        const recipient = String(revision.recipient ?? "").trim();

        if (!recipient) {
          logger.warn(
            { revisionId },
            "Findelio decision notification has no recipient",
          );
          return res.status(422).json({ error: "no_recipient" });
        }

        const decisionContent = {
          approve: {
            heading: "Firmeneintrag bestätigt",
            intro:
              "Gute Nachrichten: Dein Firmeneintrag wurde geprüft und bestätigt.",
            subject: `Dein Firmeneintrag wurde bestätigt: ${revision.listing_name}`,
            buttonLabel: "Firmeneintrag ansehen",
            targetUrl: `${siteUrl}/de-ch/unternehmen/${encodeURIComponent(
              revision.listing_slug,
            )}`,
          },
          reject: {
            heading: "Firmeneintrag abgelehnt",
            intro:
              "Dein Firmeneintrag wurde geprüft, konnte aber noch nicht bestätigt werden.",
            subject: `Dein Firmeneintrag wurde abgelehnt: ${revision.listing_name}`,
            buttonLabel: "Firmeneintrag bearbeiten",
            targetUrl: `${siteUrl}/api/auth/refresh?next=${encodeURIComponent(
              `/de-ch/dashboard/firmenprofile/${revision.listing_id}/bearbeiten`,
            )}&locale=de-ch`,
          },
          suspend: {
            heading: "Firmeneintrag gesperrt",
            intro:
              "Dein Firmeneintrag wurde geprüft und vorläufig gesperrt.",
            subject: `Dein Firmeneintrag wurde gesperrt: ${revision.listing_name}`,
            buttonLabel: "Dashboard öffnen",
            targetUrl: `${siteUrl}/api/auth/refresh?next=${encodeURIComponent(
              "/de-ch/dashboard/firmenprofile",
            )}&locale=de-ch`,
          },
        }[action];
        const reason =
          action === "approve"
            ? ""
            : String(revision.rejection_reason ?? "").trim();
        const reasonText = reason ? `\n\nBegründung:\n${reason}` : "";
        const mailService = new MailService({
          schema: await getSchema(),
          accountability: req.accountability,
          knex: database,
        });

        await mailService.send({
          to: recipient,
          subject: decisionContent.subject,
          text: `${decisionContent.intro}\n\nFirma: ${revision.listing_name}${reasonText}\n\n${decisionContent.buttonLabel}:\n${decisionContent.targetUrl}`,
          template: {
            name: "listing-decision-notification",
            data: {
              heading: decisionContent.heading,
              intro: decisionContent.intro,
              listingName: revision.listing_name,
              reason,
              buttonLabel: decisionContent.buttonLabel,
              targetUrl: decisionContent.targetUrl,
            },
          },
        });

        return res.status(204).send();
      } catch (error) {
        logger.error(error, "Findelio decision notification failed");
        return res.status(500).json({ error: "send_failed" });
      }
    });
  },
};

export default findelioReviewNotificationEndpoint;
