const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
  Auml: "Ä",
  auml: "ä",
  Ouml: "Ö",
  ouml: "ö",
  Uuml: "Ü",
  uuml: "ü",
  szlig: "ß",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isNaN(codePoint)
          ? match
          : String.fromCodePoint(codePoint);
      }

      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isNaN(codePoint)
          ? match
          : String.fromCodePoint(codePoint);
      }

      return namedEntities[entity] ?? match;
    },
  );
}

export function htmlToPlainText(value: string | null | undefined): string {
  if (!value) return "";

  const plainText = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decodeHtmlEntities(plainText);
}
