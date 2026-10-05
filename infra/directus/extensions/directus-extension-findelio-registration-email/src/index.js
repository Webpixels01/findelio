const registerFindelioRegistrationEmail = ({ filter }) => {
  filter("email.send", (payload) => {
    // Directus supplies the validated verification URL. Preserve the existing
    // German template for other locales and for missing or malformed URLs.
    if (payload.template?.name === "user-registration") {
      let vietnamese = false;
      try {
        vietnamese = new URL(payload.template.data?.url).pathname
          === "/vi/registrierung-bestaetigen";
      } catch {
        // A missing URL must not break unrelated email delivery.
      }
      if (vietnamese) {
        payload.subject = "Xác nhận địa chỉ email";
        payload.template.data = {
          ...payload.template.data,
          registrationHeading: "Xác nhận địa chỉ email",
          registrationThanks: "Cảm ơn bạn đã đăng ký Findelio.",
          registrationInstructions: "Vui lòng xác nhận địa chỉ email để kích hoạt tài khoản doanh nghiệp. Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.",
          registrationButton: "Xác nhận địa chỉ email",
          registrationLinkHint: "Nếu nút không hoạt động, hãy mở liên kết này:",
        };
      }
    }

    const usesFindelioTemplate = [
      "user-registration",
      "listing-review-notification",
      "listing-decision-notification",
      "listing-post-review-notification",
      "listing-post-decision-notification",
      "contact-notification",
      "deletion-request-notification",
      "premium-performance-report",
      "team-invitation",
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
