import type { AppLocale } from "@/i18n/routing";

export const languages = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "sk", label: "Slovenčina" },
  { code: "cs", label: "Čeština" },
  { code: "hu", label: "Magyar" },
  { code: "pl", label: "Polski" },
  { code: "ru", label: "Русский" },
  { code: "pt-pt", label: "Português" },
  { code: "ro", label: "Română" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "it", label: "Italiano" },
  { code: "fr", label: "Français" },
  { code: "uk", label: "Українська" },
  { code: "bs", label: "Bosanski" },
  { code: "sr", label: "Srpski" },
  { code: "sl", label: "Slovenščina" },
] as const;

export type LanguageCode = (typeof languages)[number]["code"];

export const categories = [
  {
    code: "bau-handwerk",
    labels: {
      "de-ch": "Bau und Handwerk",
      en: "Construction and trades",
      sk: "Stavebníctvo a remeslá",
      cs: "Stavebnictví a řemesla",
      hu: "Építőipar és szakmunkák",
      pl: "Budownictwo i rzemiosło",
      ru: "Строительство и ремёсла",
      "pt-pt": "Construção e ofícios",
      ro: "Construcții și meserii",
      vi: "Xây dựng và nghề thủ công",
      it: "Edilizia e artigianato",
      fr: "Construction et artisanat",
      uk: "Будівництво та ремесла",
      bs: "Građevinarstvo i zanati",
      sr: "Građevinarstvo i zanati",
      sl: "Gradbeništvo in obrt",
    },
  },
  {
    code: "gesundheit",
    labels: {
      "de-ch": "Gesundheit",
      en: "Health",
      sk: "Zdravie",
      cs: "Zdraví",
      hu: "Egészségügy",
      pl: "Zdrowie",
      ru: "Здоровье",
      "pt-pt": "Saúde",
      ro: "Sănătate",
      vi: "Sức khỏe",
      it: "Salute",
      fr: "Santé",
      uk: "Здоров’я",
      bs: "Zdravlje",
      sr: "Zdravlje",
      sl: "Zdravje",
    },
  },
  {
    code: "gastronomie",
    labels: {
      "de-ch": "Gastronomie",
      en: "Food and hospitality",
      sk: "Gastronómia",
      cs: "Gastronomie",
      hu: "Vendéglátás",
      pl: "Gastronomia",
      ru: "Гастрономия",
      "pt-pt": "Restauração",
      ro: "Gastronomie",
      vi: "Ẩm thực",
      it: "Gastronomia",
      fr: "Gastronomie",
      uk: "Гастрономія",
      bs: "Gastronomija",
      sr: "Gastronomija",
      sl: "Gastronomija",
    },
  },
  {
    code: "finanzen-beratung",
    labels: {
      "de-ch": "Finanzen und Beratung",
      en: "Finance and consulting",
      sk: "Financie a poradenstvo",
      cs: "Finance a poradenství",
      hu: "Pénzügy és tanácsadás",
      pl: "Finanse i doradztwo",
      ru: "Финансы и консалтинг",
      "pt-pt": "Finanças e consultoria",
      ro: "Finanțe și consultanță",
      vi: "Tài chính và tư vấn",
      it: "Finanze e consulenza",
      fr: "Finances et conseil",
      uk: "Фінанси та консалтинг",
      bs: "Finansije i savjetovanje",
      sr: "Finansije i savetovanje",
      sl: "Finance in svetovanje",
    },
  },
  {
    code: "fahrzeuge",
    labels: {
      "de-ch": "Fahrzeuge",
      en: "Vehicles",
      sk: "Vozidlá",
      cs: "Vozidla",
      hu: "Járművek",
      pl: "Pojazdy",
      ru: "Автомобили",
      "pt-pt": "Veículos",
      ro: "Vehicule",
      vi: "Xe cộ",
      it: "Veicoli",
      fr: "Véhicules",
      uk: "Транспортні засоби",
      bs: "Vozila",
      sr: "Vozila",
      sl: "Vozila",
    },
  },
  {
    code: "beauty-wellness",
    labels: {
      "de-ch": "Beauty und Wellness",
      en: "Beauty and wellness",
      sk: "Krása a wellness",
      cs: "Krása a wellness",
      hu: "Szépség és wellness",
      pl: "Uroda i wellness",
      ru: "Красота и велнес",
      "pt-pt": "Beleza e bem-estar",
      ro: "Frumusețe și wellness",
      vi: "Làm đẹp và chăm sóc sức khỏe",
      it: "Bellezza e benessere",
      fr: "Beauté et bien-être",
      uk: "Краса та велнес",
      bs: "Ljepota i wellness",
      sr: "Lepota i wellness",
      sl: "Lepota in wellness",
    },
  },
  {
    code: "it-digital",
    labels: {
      "de-ch": "IT und Digital",
      en: "IT and digital",
      sk: "IT a digitálne služby",
      cs: "IT a digitální služby",
      hu: "IT és digitális szolgáltatások",
      pl: "IT i usługi cyfrowe",
      ru: "IT и цифровые услуги",
      "pt-pt": "TI e serviços digitais",
      ro: "IT și servicii digitale",
      vi: "Công nghệ thông tin và dịch vụ số",
      it: "IT e digitale",
      fr: "IT et numérique",
      uk: "ІТ та цифрові послуги",
      bs: "IT i digitalne usluge",
      sr: "IT i digitalne usluge",
      sl: "IT in digitalne storitve",
    },
  },
  {
    code: "reinigung",
    labels: {
      "de-ch": "Reinigung",
      en: "Cleaning",
      sk: "Upratovanie",
      cs: "Úklid",
      hu: "Takarítás",
      pl: "Sprzątanie",
      ru: "Уборка",
      "pt-pt": "Limpeza",
      ro: "Curățenie",
      vi: "Vệ sinh",
      it: "Pulizie",
      fr: "Nettoyage",
      uk: "Прибирання",
      bs: "Čišćenje",
      sr: "Čišćenje",
      sl: "Čiščenje",
    },
  },
] as const;

export type CategoryCode = (typeof categories)[number]["code"];

export const cantons = [
  ["AG", "Aargau"], ["AI", "Appenzell Innerrhoden"],
  ["AR", "Appenzell Ausserrhoden"], ["BE", "Bern"],
  ["BL", "Basel-Landschaft"], ["BS", "Basel-Stadt"],
  ["FR", "Freiburg"], ["GE", "Genf"], ["GL", "Glarus"],
  ["GR", "Graubünden"], ["JU", "Jura"], ["LU", "Luzern"],
  ["NE", "Neuenburg"], ["NW", "Nidwalden"], ["OW", "Obwalden"],
  ["SG", "St. Gallen"], ["SH", "Schaffhausen"], ["SO", "Solothurn"],
  ["SZ", "Schwyz"], ["TG", "Thurgau"], ["TI", "Tessin"],
  ["UR", "Uri"], ["VD", "Waadt"], ["VS", "Wallis"],
  ["ZG", "Zug"], ["ZH", "Zürich"],
] as const;

export type CantonCode = (typeof cantons)[number][0];

export function getCategoryLabel(code: string, locale: AppLocale) {
  const category = categories.find((item) => item.code === code);
  return category?.labels[locale] ?? category?.labels["de-ch"] ?? code;
}

export function getLanguageLabel(code: string) {
  return languages.find((item) => item.code === code)?.label ?? code;
}

export function getCantonLabel(code: string) {
  return cantons.find(([itemCode]) => itemCode === code)?.[1] ?? code;
}
