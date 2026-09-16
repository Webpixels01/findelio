// New referral paragraphs only; the existing decision mail remains unchanged.
// Directus users.language is optional. Match Findelio locale aliases explicitly.
const messages = {
  "de-ch": {
    granted: "Deine dreimonatige Premium-Testphase ist aktiviert und endet am {date}. Es entsteht kein kostenpflichtiges Abo.",
    pending: "Dein Firmenprofil ist freigegeben. Die Aktivierung deiner Premium-Testphase steht noch aus.",
    skipped: "Es wurde keine zusätzliche Premium-Testphase aktiviert, weil bei der Prüfung bereits Premium bestand. Bestehende Abos und Freischaltungen bleiben unverändert.",
    expired: "Der vorgesehene Zeitraum deiner Premium-Testphase ist abgelaufen. Es wurde keine neue Testphase aktiviert.",
    inactive: "Die über deinen Empfehlungscode gewährte Premium-Testphase ist nicht mehr aktiv.",
  },
  en: {
    granted: "Your three-month Premium trial is active and ends on {date}. No paid subscription will be created.",
    pending: "Your company profile is approved. Activation of your Premium trial is still pending.",
    skipped: "No additional Premium trial was activated because Premium was already present when eligibility was checked. Existing subscriptions and grants remain unchanged.",
    expired: "The scheduled period for your Premium trial has expired. No new trial was activated.",
    inactive: "The Premium trial granted through your referral code is no longer active.",
  },
  sk: {
    granted: "Tvoja trojmesačná skúšobná verzia Premium je aktívna a končí {date}. Nevznikne žiadne platené predplatné.",
    pending: "Profil tvojej firmy bol schválený. Aktivácia skúšobnej verzie Premium ešte čaká na dokončenie.",
    skipped: "Ďalšia skúšobná verzia Premium nebola aktivovaná, pretože pri kontrole už bolo Premium dostupné. Existujúce predplatné a oprávnenia zostávajú nezmenené.",
    expired: "Plánované obdobie skúšobnej verzie Premium uplynulo. Nová skúšobná verzia nebola aktivovaná.",
    inactive: "Skúšobná verzia Premium získaná cez odporúčací kód už nie je aktívna.",
  },
  cs: {
    granted: "Tvoje tříměsíční zkušební verze Premium je aktivní a končí {date}. Nevznikne žádné placené předplatné.",
    pending: "Profil tvé firmy byl schválen. Aktivace zkušební verze Premium ještě čeká na dokončení.",
    skipped: "Další zkušební verze Premium nebyla aktivována, protože při kontrole již bylo Premium dostupné. Existující předplatné a oprávnění zůstávají beze změny.",
    expired: "Plánované období zkušební verze Premium uplynulo. Nová zkušební verze nebyla aktivována.",
    inactive: "Zkušební verze Premium získaná přes doporučovací kód již není aktivní.",
  },
  hu: {
    granted: "A három hónapos Premium próbaidőszakod aktív, és {date} időpontban ér véget. Nem jön létre fizetős előfizetés.",
    pending: "Céges profilodat jóváhagytuk. A Premium próbaidőszak aktiválása még folyamatban van.",
    skipped: "Nem aktiváltunk további Premium próbaidőszakot, mert az ellenőrzéskor már volt Premium hozzáférés. A meglévő előfizetések és hozzáférések változatlanok maradnak.",
    expired: "A Premium próbaidőszak tervezett időtartama lejárt. Új próbaidőszak nem indult.",
    inactive: "Az ajánlókódoddal kapott Premium próbaidőszak már nem aktív.",
  },
  pl: {
    granted: "Twój trzymiesięczny okres próbny Premium jest aktywny i kończy się {date}. Nie powstanie płatna subskrypcja.",
    pending: "Profil Twojej firmy został zatwierdzony. Aktywacja okresu próbnego Premium nadal oczekuje na realizację.",
    skipped: "Nie aktywowano dodatkowego okresu próbnego Premium, ponieważ podczas sprawdzania dostęp Premium już istniał. Obecne subskrypcje i uprawnienia pozostają bez zmian.",
    expired: "Planowany okres próbny Premium dobiegł końca. Nie aktywowano nowego okresu próbnego.",
    inactive: "Okres próbny Premium przyznany za pomocą kodu polecającego nie jest już aktywny.",
  },
  ru: {
    granted: "Твой трёхмесячный пробный период Premium активирован и заканчивается {date}. Платная подписка не оформляется.",
    pending: "Профиль твоей компании одобрен. Активация пробного периода Premium ещё ожидается.",
    skipped: "Дополнительный пробный период Premium не активирован, поскольку на момент проверки доступ Premium уже имелся. Существующие подписки и права доступа остаются без изменений.",
    expired: "Запланированный пробный период Premium истёк. Новый пробный период не активирован.",
    inactive: "Пробный период Premium, предоставленный по твоему рекомендательному коду, больше не активен.",
  },
  "pt-pt": {
    granted: "O teu período experimental Premium de três meses está ativo e termina em {date}. Não será criada uma subscrição paga.",
    pending: "O perfil da tua empresa foi aprovado. A ativação do período experimental Premium ainda está pendente.",
    skipped: "Não foi ativado um período experimental Premium adicional porque já existia acesso Premium no momento da verificação. As subscrições e os acessos existentes permanecem inalterados.",
    expired: "O período experimental Premium previsto terminou. Não foi ativado um novo período experimental.",
    inactive: "O período experimental Premium atribuído através do teu código de recomendação já não está ativo.",
  },
  ro: {
    granted: "Perioada ta de probă Premium de trei luni este activă și se încheie la {date}. Nu se va crea un abonament cu plată.",
    pending: "Profilul firmei tale a fost aprobat. Activarea perioadei de probă Premium este încă în așteptare.",
    skipped: "Nu a fost activată o perioadă de probă Premium suplimentară, deoarece accesul Premium exista deja la verificare. Abonamentele și drepturile existente rămân neschimbate.",
    expired: "Perioada de probă Premium planificată a expirat. Nu a fost activată o nouă perioadă de probă.",
    inactive: "Perioada de probă Premium acordată prin codul tău de recomandare nu mai este activă.",
  },
};

export function referralMailContent(redemption, locale, now = new Date()) {
  const language = String(locale ?? "de-ch").toLowerCase();
  const key = messages[language] ? language : language.startsWith("de") ? "de-ch"
    : language.startsWith("pt") ? "pt-pt" : language.split("-")[0];
  const copy = messages[key] ?? messages["de-ch"];
  if (!redemption) return { text: "", suppressCheckout: false };
  if (redemption.status === "pending_activation") return { text: copy.pending, suppressCheckout: true };
  if (redemption.status === "skipped_existing_premium") return { text: copy.skipped, suppressCheckout: true };
  if (redemption.status === "expired_unactivated") return { text: copy.expired, suppressCheckout: true };
  if (redemption.status !== "granted") return { text: "", suppressCheckout: false };
  const end = new Date(redemption.grant_ends_at).getTime();
  const start = new Date(redemption.grant_starts_at).getTime();
  if (!redemption.premium_grant || redemption.grant_revoked_at || !Number.isFinite(end)
    || !Number.isFinite(start) || start > now.getTime() || end <= now.getTime()) {
    return { text: copy.inactive, suppressCheckout: true };
  }
  const date = new Intl.DateTimeFormat(messages[key] ? key : "de-CH", {
    timeZone: "Europe/Zurich", dateStyle: "long", timeStyle: "short",
  }).format(new Date(end));
  return { text: copy.granted.replace("{date}", date), suppressCheckout: true };
}
