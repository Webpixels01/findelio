const registerFindelioRegistrationEmail = ({ filter }) => {
  filter("email.send", (payload) => {
    const usesFindelioTemplate = [
      "user-registration",
      "listing-review-notification",
      "listing-decision-notification",
      "listing-post-review-notification",
      "listing-post-decision-notification",
      "contact-notification",
      "premium-performance-report",
    ].includes(payload.template?.name);

    if (
      payload.template?.name === "user-registration" &&
      payload.subject === "Verify your email address"
    ) {
      payload.subject = "E-Mail-Adresse bestätigen";
    }

    if (usesFindelioTemplate) {
      payload.attachments = [
        ...(payload.attachments ?? []),
        {
          filename: "findelio-logo.png",
          path: "/directus/templates/findelio-logo-horizontal.png",
          cid: "findelio-logo",
          contentDisposition: "inline",
        },
      ];
    }

    return payload;
  });
};

export default registerFindelioRegistrationEmail;
