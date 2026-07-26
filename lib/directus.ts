import "server-only";
import type { AppLocale } from "@/i18n/routing";

const directusUrl = process.env.DIRECTUS_URL;
const directusToken = process.env.DIRECTUS_TOKEN;

if (!directusUrl) {
  throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
}

if (!directusToken) {
  throw new Error("DIRECTUS_TOKEN fehlt in der Datei .env.local");
}

const directusHeaders = {
  Authorization: `Bearer ${directusToken}`,
};

const PUBLIC_LISTING_STATUS = "published" as const;

export type Listing = {
  id: string;
  name: string;
  slug: string;
  status: string;
  short_description: string | null;
  postal_code: string | null;
  city: string;
  logo: string | null;
  canton: {
    code: string;
    name: string;
  };
  verification_status: string;
  spoken_languages: {
    spoken_languages_id: {
      id: string;
      code: string;
      name: string;
    };
  }[];
  industries: {
    industries_id: {
      id: string;
      code: string;
      name: string;
    };
  }[];
};

export type SocialLink = {
  platform: string;
  url: string;
};

export type GalleryItem = {
  id: number;
  directus_files_id: string;
};

export type ListingDetail = Listing & {
  description: string | null;
  street: string | null;
  public_email: string | null;
  phone: string | null;
  website_url: string | null;
  location: Record<string, unknown> | null;
  published_at: string | null;
  social_links: SocialLink[] | null;
  address_visibility: "full" | "city" | "hidden";
  gallery: GalleryItem[];
};

export type ListingOpeningHour = {
  id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
};

export type DirectoryOption = {
  id: string | number;
  code: string;
  name: string;
};

export type ListingFilters = {
  language?: string;
  industry?: string;
  canton?: string;
  location?: string;
};

type DirectusResponse<T> = {
  data: T;
};

type DirectoryCollection =
  | "cantons"
  | "industries"
  | "spoken_languages";

type TranslatableDirectoryCollection =
  | "industries"
  | "spoken_languages";

const directusLanguageCodes: Record<AppLocale, string> = {
  "de-ch": "de-CH",
  en: "en-US",
  sk: "sk-SK",
  cs: "cs-CZ",
  hu: "hu-HU",
  pl: "pl-PL",
  ru: "ru-RU",
  "pt-pt": "pt-PT",
  ro: "ro-RO",
};

type DirectoryTranslationRow = {
  languages_code: unknown;
  name: string | null;
};

type TranslatableDirectoryRow = DirectoryOption & {
  translations?: DirectoryTranslationRow[] | null;
};

function getRelationCode(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object" && "code" in value) {
    const code = value.code;

    if (typeof code === "string" || typeof code === "number") {
      return String(code);
    }
  }

  return null;
}

async function getDirectoryTranslationMap(
  collection: TranslatableDirectoryCollection,
  locale: AppLocale,
): Promise<Map<string, string>> {
  const url = new URL(`/items/${collection}`, directusUrl);

  url.searchParams.set(
    "fields",
    "id,translations.languages_code,translations.name",
  );
  url.searchParams.set("limit", "-1");

  const response = await fetch(url, {
    headers: directusHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `${collection}-Übersetzungen konnten nicht geladen werden: ${response.status} ${response.statusText} | ${errorBody}`,
    );
  }

  const result = (await response.json()) as DirectusResponse<
    TranslatableDirectoryRow[]
  >;
  const languageCode = directusLanguageCodes[locale];
  const translations = new Map<string, string>();

  for (const row of result.data) {
    const translation = row.translations?.find(
      (item) => getRelationCode(item.languages_code) === languageCode,
    );
    const name = translation?.name?.trim();

    if (name) {
      translations.set(String(row.id), name);
    }
  }

  return translations;
}

function localizeListing<T extends Listing>(
  listing: T,
  industryNames: Map<string, string>,
  spokenLanguageNames: Map<string, string>,
): T {
  return {
    ...listing,
    industries: listing.industries.map((item) => ({
      ...item,
      industries_id: {
        ...item.industries_id,
        name:
          industryNames.get(item.industries_id.id) ??
          item.industries_id.name,
      },
    })),
    spoken_languages: listing.spoken_languages.map((item) => ({
      ...item,
      spoken_languages_id: {
        ...item.spoken_languages_id,
        name:
          spokenLanguageNames.get(item.spoken_languages_id.id) ??
          item.spoken_languages_id.name,
      },
    })),
  } as T;
}

function cleanValue(value?: string): string | undefined {
  const cleaned = value?.trim();

  return cleaned || undefined;
}

export async function getListings(
  locale: AppLocale,
  filters: ListingFilters = {},
): Promise<Listing[]> {
  const fields = [
    "id",
    "name",
    "slug",
    "status",
    "short_description",
    "postal_code",
    "city",
    "logo",
    "canton.code",
    "canton.name",
    "verification_status",
    "spoken_languages.spoken_languages_id.id",
    "spoken_languages.spoken_languages_id.code",
    "spoken_languages.spoken_languages_id.name",
    "industries.industries_id.id",
    "industries.industries_id.code",
    "industries.industries_id.name",
  ].join(",");

  const language = cleanValue(filters.language);
  const industry = cleanValue(filters.industry);
  const canton = cleanValue(filters.canton);
  const location = cleanValue(filters.location);

  const conditions: Record<string, unknown>[] = [
    {
      status: {
        _eq: PUBLIC_LISTING_STATUS,
      },
    },
  ];

  if (language) {
    conditions.push({
      spoken_languages: {
        spoken_languages_id: {
          code: {
            _eq: language,
          },
        },
      },
    });
  }

  if (industry) {
    conditions.push({
      industries: {
        industries_id: {
          code: {
            _eq: industry,
          },
        },
      },
    });
  }

  if (canton) {
    conditions.push({
      canton: {
        code: {
          _eq: canton,
        },
      },
    });
  }

  if (location) {
    conditions.push({
      _or: [
        {
          city: {
            _icontains: location,
          },
        },
        {
          postal_code: {
            _icontains: location,
          },
        },
      ],
    });
  }

  const url = new URL("/items/listings", directusUrl);

  url.searchParams.set("fields", fields);
  url.searchParams.set("sort", "name");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      _and: conditions,
    }),
  );

  const [response, industryNames, spokenLanguageNames] =
    await Promise.all([
      fetch(url, {
        headers: directusHeaders,
        cache: "no-store",
      }),
      getDirectoryTranslationMap("industries", locale),
      getDirectoryTranslationMap("spoken_languages", locale),
    ]);

  if (!response.ok) {
    throw new Error(
      `Directus konnte nicht geladen werden: ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as DirectusResponse<Listing[]>;

  return result.data.map((listing) =>
    localizeListing(listing, industryNames, spokenLanguageNames),
  );
}

export async function getListingBySlug(
  slug: string,
  locale: AppLocale,
): Promise<ListingDetail | null> {
  const fields = [
    "id",
    "name",
    "slug",
    "status",
    "short_description",
    "description",
    "street",
    "postal_code",
    "city",
    "canton.code",
    "canton.name",
    "public_email",
    "phone",
    "website_url",
    "logo",
    "gallery.id",
    "gallery.directus_files_id",
    "location",
    "verification_status",
    "published_at",
    "social_links",
    "address_visibility",
    "spoken_languages.spoken_languages_id.id",
    "spoken_languages.spoken_languages_id.code",
    "spoken_languages.spoken_languages_id.name",
    "industries.industries_id.id",
    "industries.industries_id.code",
    "industries.industries_id.name",
  ].join(",");

  const url = new URL("/items/listings", directusUrl);

  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      _and: [
        {
          slug: {
            _eq: slug,
          },
        },
        {
          status: {
            _eq: PUBLIC_LISTING_STATUS,
          },
        },
      ],
    }),
  );

  const [response, industryNames, spokenLanguageNames] =
    await Promise.all([
      fetch(url, {
        headers: directusHeaders,
        cache: "no-store",
      }),
      getDirectoryTranslationMap("industries", locale),
      getDirectoryTranslationMap("spoken_languages", locale),
    ]);

  if (!response.ok) {
    throw new Error(
      `Firmeneintrag konnte nicht geladen werden: ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as DirectusResponse<ListingDetail[]>;
  const listing = result.data[0];

  return listing
    ? localizeListing(listing, industryNames, spokenLanguageNames)
    : null;
}


export async function getPublishedListingSlugs(): Promise<string[]> {
  const url = new URL("/items/listings", directusUrl);

  url.searchParams.set("fields", "slug");
  url.searchParams.set("sort", "slug");
  url.searchParams.set("limit", "-1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      status: {
        _eq: PUBLIC_LISTING_STATUS,
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Veröffentlichte Firmenprofile konnten nicht geladen werden: ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as DirectusResponse<
    Array<{ slug: string }>
  >;

  return result.data
    .map((listing) => listing.slug?.trim())
    .filter((slug): slug is string => Boolean(slug));
}

export async function getListingOpeningHours(
  listingId: string,
): Promise<ListingOpeningHour[]> {
  const url = new URL("/items/listing_opening_hours", directusUrl);

  url.searchParams.set(
    "fields",
    "id,day_of_week,opens_at,closes_at",
  );
  url.searchParams.set("sort", "day_of_week,opens_at");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      listing: {
        _eq: listingId,
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Öffnungszeiten konnten nicht geladen werden: ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as DirectusResponse<
    ListingOpeningHour[]
  >;

  return result.data;
}

async function getDirectoryOptions(
  collection: DirectoryCollection,
): Promise<DirectoryOption[]> {
  const url = new URL(`/items/${collection}`, directusUrl);

  url.searchParams.set("fields", "id,code,name");
  url.searchParams.set("sort", "name");

  const response = await fetch(url, {
    headers: directusHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `${collection} konnten nicht geladen werden: ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as DirectusResponse<
    DirectoryOption[]
  >;

  return result.data;
}

export function getCantons(): Promise<DirectoryOption[]> {
  return getDirectoryOptions("cantons");
}

export async function getCantonIdByCode(
  code: string,
): Promise<string | null> {
  const url = new URL("/items/cantons", directusUrl);

  url.searchParams.set("fields", "id");
  url.searchParams.set("limit", "1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      code: {
        _eq: code,
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Kanton konnte nicht aufgelöst werden: ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as DirectusResponse<
    Array<{ id: string }>
  >;

  return result.data[0]?.id ?? null;
}

async function getTranslatedDirectoryOptions(
  collection: TranslatableDirectoryCollection,
  locale: AppLocale,
): Promise<DirectoryOption[]> {
  const [options, translations] = await Promise.all([
    getDirectoryOptions(collection),
    getDirectoryTranslationMap(collection, locale),
  ]);

  return options
    .map((option) => ({
      ...option,
      name: translations.get(String(option.id)) ?? option.name,
    }))
    .sort((first, second) =>
      first.name.localeCompare(
        second.name,
        directusLanguageCodes[locale],
        { sensitivity: "base" },
      ),
    );
}

export function getIndustries(
  locale: AppLocale,
): Promise<DirectoryOption[]> {
  return getTranslatedDirectoryOptions("industries", locale);
}

export function getSpokenLanguages(
  locale: AppLocale,
): Promise<DirectoryOption[]> {
  return getTranslatedDirectoryOptions("spoken_languages", locale);
}
