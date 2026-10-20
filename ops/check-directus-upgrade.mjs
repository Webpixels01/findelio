import { pathToFileURL } from "node:url";

// Run in the app container. Use its service token; never print API bodies.
export async function checkDirectusUpgrade({ env = process.env, request = fetch } = {}) {
  if (!env.DIRECTUS_URL || !env.DIRECTUS_TOKEN) throw new Error("Directus-Konfiguration fehlt.");
  async function read(path) {
    let response;
    try {
      response = await request(new URL(path, env.DIRECTUS_URL), {
        headers: { Authorization: `Bearer ${env.DIRECTUS_TOKEN}` },
        redirect: "manual", signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new Error("CMS-Upgrade-Prüfung: Dienst nicht erreichbar."); }
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new Error(`CMS-Upgrade-Prüfung ${path.split("?")[0]}: HTTP ${response.status}.`);
    }
    try { return (await response.json()).data; }
    catch { throw new Error("CMS-Upgrade-Prüfung: ungültige Antwort."); }
  }
  const info = await read("/server/info");
  if (info?.version !== "12.5.0" || info?.license?.source !== "env") {
    throw new Error("Directus 12.5.0 mit Lizenz aus der Umgebung ist nicht aktiv.");
  }
  // These existing filtered permissions were lost in the unlicensed upgrade.
  // Real API reads avoid a false pass from the frontend's cached homepage.
  for (const collection of ["cantons", "industries", "spoken_languages"]) {
    const rows = await read(`/items/${collection}?fields=id&limit=1`);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`CMS-Upgrade-Prüfung: ${collection} liefert keine freigegebenen Daten.`);
    }
  }
}

if (process.argv[1] === "-" || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) {
  try {
    await checkDirectusUpgrade();
    console.log("Directus 12.5.0, Lizenzkonfiguration und bestehende Lesezugriffe erfolgreich geprüft.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
