import type { CantonCode, CategoryCode, LanguageCode } from "./directory-options";

export type Company = {
  slug: string;
  name: string;
  category: CategoryCode;
  languages: LanguageCode[];
  canton: CantonCode;
  city: string;
  postalCode: string;
  address: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  verified: boolean;
};

export const companies: Company[] = [
  {
    slug: "webpixels-digital",
    name: "Webpixels Digital",
    category: "it-digital",
    languages: ["de", "sk", "en"],
    canton: "TG",
    city: "Warth",
    postalCode: "8532",
    address: "Kirchgasse 13, 8532 Warth",
    description: "Webdesign, WordPress, Shopify und digitale Lösungen für Schweizer KMU.",
    phone: "+41 00 000 00 00",
    email: "info@example.ch",
    website: "https://example.ch",
    verified: true,
  },
  {
    slug: "vltava-garage",
    name: "Vltava Garage GmbH",
    category: "fahrzeuge",
    languages: ["de", "cs", "sk"],
    canton: "SG",
    city: "St. Gallen",
    postalCode: "9000",
    address: "Musterstrasse 18, 9000 St. Gallen",
    description: "Service, Reparaturen und Fahrzeugdiagnose für Personenwagen aller Marken.",
    phone: "+41 71 000 00 00",
    email: "kontakt@vltava-garage.example",
    website: "https://vltava-garage.example",
    verified: true,
  },
  {
    slug: "lusitania-treuhand",
    name: "Lusitania Treuhand",
    category: "finanzen-beratung",
    languages: ["de", "pt-pt", "en"],
    canton: "BS",
    city: "Basel",
    postalCode: "4051",
    address: "Marktplatz 7, 4051 Basel",
    description: "Treuhand, Steuerberatung und Unterstützung bei Firmengründungen in der Schweiz.",
    phone: "+41 61 000 00 00",
    email: "office@lusitania.example",
    website: "https://lusitania.example",
    verified: false,
  },
  {
    slug: "carpathia-pflege",
    name: "Carpathia Pflege",
    category: "gesundheit",
    languages: ["de", "ro", "hu"],
    canton: "BE",
    city: "Bern",
    postalCode: "3011",
    address: "Bundesgasse 24, 3011 Bern",
    description: "Persönliche Pflegeberatung und Unterstützung für Familien und ältere Menschen.",
    phone: "+41 31 000 00 00",
    email: "hallo@carpathia-pflege.example",
    website: "https://carpathia-pflege.example",
    verified: true,
  },
  {
    slug: "alpin-bau-team",
    name: "Alpin Bau Team",
    category: "bau-handwerk",
    languages: ["de", "pl", "ru"],
    canton: "ZH",
    city: "Zürich",
    postalCode: "8004",
    address: "Badenerstrasse 110, 8004 Zürich",
    description: "Renovationen, Innenausbau und zuverlässige Handwerksarbeiten für Privatkunden.",
    phone: "+41 44 000 00 00",
    email: "info@alpin-bau.example",
    website: "https://alpin-bau.example",
    verified: false,
  },
  {
    slug: "danubia-clean",
    name: "Danubia Clean GmbH",
    category: "reinigung",
    languages: ["de", "hu", "ro", "en"],
    canton: "ZG",
    city: "Zug",
    postalCode: "6300",
    address: "Industriestrasse 9, 6300 Zug",
    description: "Unterhalts-, Umzugs- und Büroreinigung mit transparenten Angeboten.",
    phone: "+41 41 000 00 00",
    email: "kontakt@danubia-clean.example",
    website: "https://danubia-clean.example",
    verified: true,
  },
];
