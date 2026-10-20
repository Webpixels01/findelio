// Real production frontend + licensed, disposable Directus. No production secrets.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { adminCredentials, totp } from "./directus-test-auth.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const site = "http://127.0.0.1:3317";
const cms = "http://127.0.0.1:3318";
const screenshots = "/tmp/findelio-two-factor-browser";
await mkdir(screenshots, { recursive: true });
async function api(path, body, token) {
  const response = await fetch(cms + path, { method: body ? "POST" : "GET", headers: {
    "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(response.status, 200, path);
  return (await response.json()).data;
}
const admin = (await api("/auth/login", adminCredentials())).access_token;
const adminUser = await api("/users/me", null, admin);
const serviceRoles = await api("/roles?filter[name][_eq]=Findelio%20Server", null, admin);
const serviceRole = serviceRoles[0] ?? await api("/roles", { name: "Findelio Server" }, admin);
await api("/users", { email: `browser-service-${randomUUID()}@example.com`, role: serviceRole.id,
  token: process.env.FINDELIO_TEST_WEBSITE_TOKEN, status: "active" }, admin);
const role = await api("/roles", { name: "Browser TFA customer" }, admin);
const password = randomUUID() + "Aa9!";
const email = `browser-customer-${randomUUID()}@example.com`;
await api("/users", { email, password, role: role.id, status: "active" }, admin);
const adminEmail = `browser-admin-${randomUUID()}@example.com`;
await api("/users", { email: adminEmail, password, role: adminUser.role, status: "active" }, admin);
const studioEmail = `studio-admin-${randomUUID()}@example.com`;
await api("/users", { email: studioEmail, password, role: adminUser.role, status: "active" }, admin);

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const securityUrl = site + "/de-ch/konto/sicherheit";
  async function fillCode(input, secret) {
    await input.waitFor({ state: "visible" });
    const remaining = 30_000 - Date.now() % 30_000;
    if (remaining < 4_000) await setTimeout(remaining + 50);
    await input.fill(totp(secret));
  }
  async function signIn(userEmail, secret) {
    await page.goto(site + "/de-ch/login?next=%2Fde-ch%2Fkonto%2Fsicherheit");
    await page.getByLabel("E-Mail", { exact: true }).fill(userEmail);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    if (secret) {
      await fillCode(page.getByLabel("Sechsstelliger Authenticator-Code"), secret);
      await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    }
    await page.waitForURL(securityUrl);
  }
  await signIn(email);
  await page.getByRole("button", { name: "Nur notwendige", exact: true }).click();
  await page.getByText("Für Kunden ist 2FA freiwillig.", { exact: false }).waitFor();
  await page.getByLabel("Aktuelles Passwort").fill(password);
  await page.getByRole("button", { name: "2FA einrichten", exact: true }).click();
  await page.locator("svg title").filter({ hasText: "QR-Code zur Einrichtung" }).waitFor({ state: "attached" });
  const secret = (await page.locator("code").innerText()).trim();
  assert.match(secret, /^[A-Z2-7]+$/);
  assert.equal(await page.getByRole("button", { name: "2FA aktivieren", exact: true }).isDisabled(), true);
  await page.getByLabel("Ich habe den Schlüssel sicher aufbewahrt.").check();
  await page.getByLabel("Sechsstelliger Authenticator-Code").fill(totp(secret, Date.now() - 300_000));
  await page.getByRole("button", { name: "2FA aktivieren", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Der Code ist ungültig" }).waitFor();
  await page.screenshot({ path: screenshots + "/customer-setup-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: screenshots + "/customer-setup-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await fillCode(page.getByLabel("Sechsstelliger Authenticator-Code"), secret);
  await page.getByRole("button", { name: "2FA aktivieren", exact: true }).click();
  await page.getByText("Gespeichert. Bitte melde dich erneut an.").waitFor();
  assert.equal((await context.cookies()).some(cookie => cookie.name === "findelio_access_token"), false);
  await signIn(email, secret);
  await page.getByText("Zwei-Faktor-Authentifizierung ist aktiv.", { exact: true }).waitFor();
  await page.getByLabel("Aktuelles Passwort").fill(password);
  await fillCode(page.getByLabel("Sechsstelliger Authenticator-Code"), secret);
  await page.getByRole("button", { name: "2FA deaktivieren", exact: true }).click();
  await page.getByText("Gespeichert. Bitte melde dich erneut an.").waitFor();
  await signIn(email);
  console.log("PASS browser: customer QR setup, backup acknowledgement, wrong OTP, activation, cookie clearing, OTP login and optional disable");

  await context.clearCookies();
  await signIn(adminEmail);
  await page.getByText("Für dieses Konto ist 2FA Pflicht.", { exact: false }).waitFor();
  await page.goto(site + "/de-ch/dashboard");
  await page.waitForURL(securityUrl);
  await page.getByLabel("Aktuelles Passwort").fill(password);
  await page.getByRole("button", { name: "2FA einrichten", exact: true }).click();
  await page.locator("code").waitFor();
  const adminSecret = (await page.locator("code").innerText()).trim();
  await page.getByLabel("Ich habe den Schlüssel sicher aufbewahrt.").check();
  await fillCode(page.getByLabel("Sechsstelliger Authenticator-Code"), adminSecret);
  await page.getByRole("button", { name: "2FA aktivieren", exact: true }).click();
  await page.getByText("Gespeichert. Bitte melde dich erneut an.").waitFor();
  await signIn(adminEmail, adminSecret);
  assert.equal(await page.getByRole("button", { name: "2FA deaktivieren", exact: true }).count(), 0);
  await page.screenshot({ path: screenshots + "/admin-enabled-mobile.png", fullPage: true });
  assert.deepEqual(pageErrors, []);
  console.log("PASS browser: administrator redirected to enrollment; successful OTP login; disabling is unavailable");

  const studio = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const studioResponses = [];
  studio.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === cms && !url.pathname.startsWith("/admin")) studioResponses.push({ path: url.pathname, status: response.status() });
  });
  await studio.goto(cms + "/admin/login");
  await studio.locator('input[type="email"]').fill(studioEmail);
  await studio.locator('input[type="password"]').fill(password);
  await studio.locator('button[type="submit"]').click();
  try { await studio.waitForURL(/two-factor|tfa/, { timeout: 20_000 }); }
  finally { await writeFile(screenshots + "/studio-responses.json", JSON.stringify(studioResponses)); }
  await studio.locator('input[type="password"]').fill(password);
  await studio.getByRole("button", { name: "Next", exact: true }).click();
  await studio.locator("output.secret").waitFor({ state: "visible" });
  const studioSecret = (await studio.locator("output.secret").innerText()).trim();
  await fillCode(studio.locator('input[type="text"]:visible'), studioSecret);
  const nativeEnabled = studio.waitForResponse(response => new URL(response.url()).pathname === "/users/me/tfa/enable");
  await studio.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal((await nativeEnabled).status(), 204);
  assert.ok((await api("/auth/login", { email: studioEmail, password, otp: totp(studioSecret) })).access_token);
  await studio.screenshot({ path: screenshots + "/directus-required-setup.png", fullPage: true });
  console.log("PASS browser: native Directus Studio enrollment completes and accepts the new OTP");
} catch (error) {
  for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    await page.screenshot({ path: `${screenshots}/failure-${index}.png`, fullPage: true }).catch(() => {});
    await writeFile(`${screenshots}/failure-${index}.txt`, await page.locator("body").innerText().catch(() => "Unavailable"));
  }
  throw error;
} finally { await browser.close(); }
