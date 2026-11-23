const registrationCopy = {
  vi: {
    subject: "Xác nhận địa chỉ email",
    registrationHeading: "Xác nhận địa chỉ email",
    registrationThanks: "Cảm ơn bạn đã đăng ký Findelio.",
    registrationInstructions:
      "Vui lòng xác nhận địa chỉ email để kích hoạt tài khoản doanh nghiệp. Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.",
    registrationButton: "Xác nhận địa chỉ email",
    registrationLinkHint: "Nếu nút không hoạt động, hãy mở liên kết này:",
  },
  it: {
    subject: "Conferma l’indirizzo e-mail",
    registrationHeading: "Conferma l’indirizzo e-mail",
    registrationThanks: "Grazie per esserti registrato su Findelio.",
    registrationInstructions:
      "Conferma l’indirizzo e-mail per attivare l’account aziendale. Se non hai effettuato questa registrazione, ignora questa e-mail.",
    registrationButton: "Conferma l’indirizzo e-mail",
    registrationLinkHint: "Se il pulsante non funziona, apri questo link:",
  },
  fr: {
    subject: "Confirme ton adresse e-mail",
    registrationHeading: "Confirme ton adresse e-mail",
    registrationThanks: "Merci de t’être inscrit·e sur Findelio.",
    registrationInstructions:
      "Confirme ton adresse e-mail pour activer le compte entreprise. Si tu n’as pas effectué cette inscription, ignore cet e-mail.",
    registrationButton: "Confirmer l’adresse e-mail",
    registrationLinkHint: "Si le bouton ne fonctionne pas, ouvre ce lien :",
  },
  uk: {
    subject: "Підтвердіть адресу електронної пошти",
    registrationHeading: "Підтвердіть адресу електронної пошти",
    registrationThanks: "Дякуємо за реєстрацію на Findelio.",
    registrationInstructions:
      "Підтвердіть адресу електронної пошти, щоб активувати бізнес-акаунт. Якщо ви не виконували цю реєстрацію, проігноруйте цей лист.",
    registrationButton: "Підтвердити адресу електронної пошти",
    registrationLinkHint: "Якщо кнопка не працює, відкрийте це посилання:",
  },
  bs: {
    subject: "Potvrdite e-mail adresu",
    registrationHeading: "Potvrdite e-mail adresu",
    registrationThanks: "Hvala što ste se registrirali na Findelio.",
    registrationInstructions:
      "Potvrdite e-mail adresu kako biste aktivirali poslovni račun. Ako niste izvršili ovu registraciju, zanemarite ovaj e-mail.",
    registrationButton: "Potvrdi e-mail adresu",
    registrationLinkHint: "Ako dugme ne radi, otvorite ovaj link:",
  },
  sr: {
    subject: "Potvrdite e-mail adresu",
    registrationHeading: "Potvrdite e-mail adresu",
    registrationThanks: "Hvala što ste se registrovali na Findelio.",
    registrationInstructions:
      "Potvrdite e-mail adresu da biste aktivirali poslovni nalog. Ako niste izvršili ovu registraciju, zanemarite ovaj e-mail.",
    registrationButton: "Potvrdi e-mail adresu",
    registrationLinkHint: "Ako dugme ne radi, otvorite ovaj link:",
  },
  sl: {
    subject: "Potrdite e-poštni naslov",
    registrationHeading: "Potrdite e-poštni naslov",
    registrationThanks: "Hvala za registracijo na Findelio.",
    registrationInstructions:
      "Potrdite e-poštni naslov, da aktivirate poslovni račun. Če te registracije niste opravili, e-pošto prezrite.",
    registrationButton: "Potrdi e-poštni naslov",
    registrationLinkHint: "Če gumb ne deluje, odprite to povezavo:",
  },
};

function localeFromRegistrationUrl(url) {
  try {
    const match = new URL(url).pathname.match(
      /^\/([^/]+)\/registrierung-bestaetigen$/,
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

const registerFindelioRegistrationEmail = ({ filter }) => {
  filter("email.send", (payload) => {
    // Directus supplies the validated verification URL. Preserve the existing
    // German template for other locales and for missing or malformed URLs.
    if (payload.template?.name === "user-registration") {
      const locale = localeFromRegistrationUrl(payload.template.data?.url);
      const localized = locale ? registrationCopy[locale] : null;
      if (localized) {
        payload.subject = localized.subject;
        payload.template.data = {
          ...payload.template.data,
          registrationHeading: localized.registrationHeading,
          registrationThanks: localized.registrationThanks,
          registrationInstructions: localized.registrationInstructions,
          registrationButton: localized.registrationButton,
          registrationLinkHint: localized.registrationLinkHint,
        };
      }
    }

    const usesFindelioTemplate = [
      "user-registration",
      "visitor-registration",
      "listing-review-notification",
      "customer-review-notification",
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
