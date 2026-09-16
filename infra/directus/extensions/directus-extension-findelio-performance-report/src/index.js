const copy = {
  de: { subject: "Dein Findelio-Erfolgsbericht", heading: "Dein monatlicher Erfolgsbericht", intro: "So wurde dein Premium-Firmeneintrag im letzten Monat genutzt.", button: "Statistik öffnen", period: "Zeitraum", metrics: ["Einblendungen in der Suche", "Profilaufrufe", "Website-Klicks", "Telefon-Klicks", "E-Mail-Klicks", "Social-Media-Klicks", "Klicks auf deinen Button", "Beitragsaufrufe", "Klicks auf Beitragsbuttons"] },
  en: { subject: "Your Findelio performance report", heading: "Your monthly performance report", intro: "Here is how visitors used your Premium business listing last month.", button: "Open statistics", period: "Period", metrics: ["Search impressions", "Profile views", "Website clicks", "Phone clicks", "Email clicks", "Social media clicks", "Custom button clicks", "Post views", "Post button clicks"] },
  sk: { subject: "Váš prehľad výsledkov Findelio", heading: "Váš mesačný prehľad výsledkov", intro: "Takto návštevníci používali váš prémiový firemný záznam minulý mesiac.", button: "Otvoriť štatistiky", period: "Obdobie", metrics: ["Zobrazenia vo vyhľadávaní", "Zobrazenia profilu", "Kliknutia na web", "Kliknutia na telefón", "Kliknutia na e-mail", "Kliknutia na sociálne siete", "Kliknutia na vlastné tlačidlo", "Zobrazenia príspevkov", "Kliknutia na tlačidlá príspevkov"] },
  cs: { subject: "Váš přehled výsledků Findelio", heading: "Váš měsíční přehled výsledků", intro: "Takto návštěvníci používali váš prémiový firemní záznam minulý měsíc.", button: "Otevřít statistiky", period: "Období", metrics: ["Zobrazení ve vyhledávání", "Zobrazení profilu", "Kliknutí na web", "Kliknutí na telefon", "Kliknutí na e-mail", "Kliknutí na sociální sítě", "Kliknutí na vlastní tlačítko", "Zobrazení příspěvků", "Kliknutí na tlačítka příspěvků"] },
  hu: { subject: "Findelio teljesítményjelentés", heading: "Havi teljesítményjelentés", intro: "Így használták a látogatók a prémium cégbejegyzést az elmúlt hónapban.", button: "Statisztika megnyitása", period: "Időszak", metrics: ["Keresési megjelenések", "Profilmegtekintések", "Weboldalkattintások", "Telefonkattintások", "E-mail-kattintások", "Közösségimédia-kattintások", "Egyéni gomb kattintásai", "Bejegyzésmegtekintések", "Bejegyzésgomb-kattintások"] },
  pl: { subject: "Raport wyników Findelio", heading: "Miesięczny raport wyników", intro: "Tak odwiedzający korzystali z Twojego wpisu Premium w ostatnim miesiącu.", button: "Otwórz statystyki", period: "Okres", metrics: ["Wyświetlenia w wyszukiwarce", "Wyświetlenia profilu", "Kliknięcia strony", "Kliknięcia telefonu", "Kliknięcia e-mail", "Kliknięcia social media", "Kliknięcia własnego przycisku", "Wyświetlenia wpisów", "Kliknięcia przycisków wpisów"] },
  ru: { subject: "Отчёт Findelio", heading: "Ежемесячный отчёт", intro: "Так посетители использовали вашу премиум-карточку компании в прошлом месяце.", button: "Открыть статистику", period: "Период", metrics: ["Показы в поиске", "Просмотры профиля", "Переходы на сайт", "Нажатия на телефон", "Нажатия на e-mail", "Переходы в соцсети", "Нажатия своей кнопки", "Просмотры публикаций", "Нажатия кнопок публикаций"] },
  pt: { subject: "Relatório de desempenho Findelio", heading: "Relatório mensal de desempenho", intro: "Veja como os visitantes utilizaram o seu anúncio Premium no mês passado.", button: "Abrir estatísticas", period: "Período", metrics: ["Impressões na pesquisa", "Visualizações do perfil", "Cliques no site", "Cliques no telefone", "Cliques no e-mail", "Cliques nas redes sociais", "Cliques no botão personalizado", "Visualizações de publicações", "Cliques nos botões das publicações"] },
  ro: { subject: "Raportul de performanţă Findelio", heading: "Raportul lunar de performanţă", intro: "Iată cum au folosit vizitatorii profilul Premium al companiei în ultima lună.", button: "Deschide statisticile", period: "Perioadă", metrics: ["Afişări în căutare", "Vizualizări profil", "Clicuri pe site", "Clicuri pe telefon", "Clicuri pe e-mail", "Clicuri social media", "Clicuri pe butonul personalizat", "Vizualizări articole", "Clicuri pe butoanele articolelor"] },
};

const metricKeys = ["search_impressions", "profile_views", "website_clicks", "phone_clicks", "email_clicks", "social_clicks", "custom_cta_clicks", "post_views", "post_cta_clicks"];

const performanceReportHook = ({ schedule }, { database, env, getSchema, logger, services }) => {
  const { MailService } = services;
  schedule("5 8 1 * *", async () => {
    const now = new Date();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));
    const start = periodStart.toISOString().slice(0, 10);
    const end = periodEnd.toISOString().slice(0, 10);
    const siteUrl = String(env.FINDELIO_SITE_URL ?? "").replace(/\/$/, "");
    if (!siteUrl) return logger.error("FINDELIO_SITE_URL is missing for performance reports");

    try {
      const recipients = await database("subscriptions as subscriptions")
        .join("listings", "subscriptions.listing", "listings.id")
        .join("organization_members as members", "listings.organization", "members.organization")
        .join("directus_users as users", "members.user", "users.id")
        .where("subscriptions.plan", "premium")
        .whereIn("subscriptions.status", ["active", "past_due"])
        .where("members.status", "active")
        .where("members.role", "owner")
        .where("users.status", "active")
        .whereNotNull("users.email")
        .select("listings.id as listing_id", "listings.name as listing_name", "users.email", "users.language");
      const mailService = new MailService({ schema: await getSchema(), accountability: { admin: true }, knex: database });

      for (const recipient of recipients) {
        const alreadySent = await database("listing_metric_reports").where({ listing: recipient.listing_id, period_start: start, period_end: end, recipient: recipient.email }).first();
        if (alreadySent) continue;
        const totals = await database("listing_metrics_daily").where("listing", recipient.listing_id).whereBetween("metric_date", [start, end]).sum(Object.fromEntries(metricKeys.map((key) => [key, key]))).first();
        const language = String(recipient.language ?? "de").slice(0, 2).toLowerCase();
        const localized = copy[language] ?? copy.de;
        const metrics = metricKeys.map((key, index) => ({ label: localized.metrics[index], value: Number(totals?.[key] ?? 0) }));
        const statisticsUrl = `${siteUrl}/de-ch/dashboard/firmenprofile/${recipient.listing_id}/statistik`;
        await mailService.send({
          to: recipient.email,
          subject: `${localized.subject}: ${recipient.listing_name}`,
          text: `${localized.heading}\n\n${recipient.listing_name}\n${localized.period}: ${start} – ${end}\n\n${metrics.map((item) => `${item.label}: ${item.value}`).join("\n")}\n\n${statisticsUrl}`,
          template: { name: "premium-performance-report", data: { heading: localized.heading, intro: localized.intro, listingName: recipient.listing_name, periodLabel: localized.period, period: `${start} – ${end}`, metrics, buttonLabel: localized.button, statisticsUrl } },
        });
        await database("listing_metric_reports").insert({ listing: recipient.listing_id, period_start: start, period_end: end, recipient: recipient.email });
      }
    } catch (error) {
      logger.error(error, "Findelio performance report failed");
    }
  });
};

export default performanceReportHook;
