import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

// Run inside the app container, using its existing environment. Never log tokens
// or response bodies. The only write is a random, expiring rate-limit counter.
export async function checkDeployment({ env = process.env, request = fetch } = {}) {
  if (!env.DIRECTUS_URL || !env.DIRECTUS_TOKEN) {
    throw new Error("Directus-Konfiguration im App-Container fehlt.");
  }
  const app = "http://127.0.0.1:3000";
  const endpoint = new URL("/findelio-review-notification/", env.DIRECTUS_URL);
  const clientKey = randomBytes(32).toString("hex");
  const checks = [
    ["Website-Status", new URL("/api/health", app), 200],
    ["Startseite", new URL("/de-ch", app), 200],
    ["CMS-Status", new URL("/server/ping", env.DIRECTUS_URL), 200],
    ["Kontakt-Zugriffsschutz", new URL("contact", endpoint), 401, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }],
    ["Upload-Zugriffsschutz", new URL("/api/account/listings/00000000-0000-4000-8000-000000000000/media", app), 401, {
      method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=deploy-check" },
    }],
    ["Server-Token, Erweiterung und Zählertabelle", new URL("rate-limit", endpoint), 204, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "login-ip", client_key: clientKey }),
    }],
  ];
  for (const [label, url, expected, options] of checks) {
    let response;
    try {
      response = await request(url, { ...options, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new Error(`${label}: Dienst nicht erreichbar.`);
    }
    await response.body?.cancel();
    if (response.status !== expected) {
      throw new Error(`${label}: HTTP ${response.status}, erwartet ${expected}.`);
    }
  }
}

if (process.argv[1] === "-" || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  try {
    await checkDeployment();
    console.log("Website, CMS und Sicherheitsprüfungen erfolgreich.");
  } catch (error) {
    console.error(`Deployment-Prüfung fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  }
}
