import { companies } from "@/data/companies";

export type DirectoryFilters = {
  sprache?: string;
  branche?: string;
  kanton?: string;
  ort?: string;
};

export function filterCompanies(filters: DirectoryFilters) {
  const location = filters.ort?.trim().toLocaleLowerCase("de-CH");

  return companies.filter((company) => {
    const matchesLanguage =
      !filters.sprache || company.languages.includes(filters.sprache as never);
    const matchesCategory =
      !filters.branche || company.category === filters.branche;
    const matchesCanton = !filters.kanton || company.canton === filters.kanton;
    const matchesLocation =
      !location ||
      company.city.toLocaleLowerCase("de-CH").includes(location) ||
      company.postalCode.includes(location) ||
      company.address.toLocaleLowerCase("de-CH").includes(location);

    return matchesLanguage && matchesCategory && matchesCanton && matchesLocation;
  });
}
