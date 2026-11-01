import { readFileSync } from "node:fs";

const logoPath = new URL(
  "../infra/directus/templates/findelio-logo-horizontal.png",
  import.meta.url,
);
const templatePath = new URL(
  "../infra/directus/templates/findelio-base.liquid",
  import.meta.url,
);

const logo = readFileSync(logoPath);
const pngSignature = "89504e470d0a1a0a";

if (logo.subarray(0, 8).toString("hex") !== pngSignature) {
  throw new Error("Das E-Mail-Logo ist keine gültige PNG-Datei.");
}

const sourceWidth = logo.readUInt32BE(16);
const sourceHeight = logo.readUInt32BE(20);
const template = readFileSync(templatePath, "utf8");
const imageTag = template.match(
  /<img\s+[\s\S]*?src="cid:findelio-logo"[\s\S]*?>/,
)?.[0];

if (!imageTag) {
  throw new Error("Das Findelio-Logo fehlt in der E-Mail-Basisvorlage.");
}

function requiredPixelValue(pattern, label) {
  const value = Number(imageTag.match(pattern)?.[1]);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} fehlt oder ist ungültig.`);
  }

  return value;
}

const htmlWidth = requiredPixelValue(/\bwidth="(\d+)"/, "HTML-Breite");
const htmlHeight = requiredPixelValue(/\bheight="(\d+)"/, "HTML-Höhe");
const cssWidth = requiredPixelValue(/\bwidth:\s*(\d+)px/, "CSS-Breite");
const cssMaxWidth = requiredPixelValue(
  /\bmax-width:\s*(\d+)px/,
  "maximale CSS-Breite",
);
const cssHeight = requiredPixelValue(/\bheight:\s*(\d+)px/, "CSS-Höhe");

if (
  htmlWidth !== cssWidth ||
  htmlWidth !== cssMaxWidth ||
  htmlHeight !== cssHeight
) {
  throw new Error(
    "HTML- und CSS-Masse des E-Mail-Logos stimmen nicht überein.",
  );
}

if (sourceWidth * htmlHeight !== sourceHeight * htmlWidth) {
  throw new Error(
    `Das E-Mail-Logo würde verzerrt: Quelle ${sourceWidth} × ${sourceHeight}, Darstellung ${htmlWidth} × ${htmlHeight}.`,
  );
}

console.log(
  `E-Mail-Logo geprüft: ${sourceWidth} × ${sourceHeight} → ${htmlWidth} × ${htmlHeight}, Seitenverhältnis unverändert.`,
);
