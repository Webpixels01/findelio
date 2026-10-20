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
