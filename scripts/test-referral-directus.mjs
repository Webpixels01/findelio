// Explicitly opt-in: creates only a disposable, externally isolated Docker stack.
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

if (!process.argv.includes('--isolated')) throw new Error('Pass --isolated to start a disposable Docker integration test');
const browserFixture = process.argv.includes('--browser-fixture');
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), 'findelio-referral-integration-'));
const configPath = join(dir, 'compose.json');
const config = { name: 'findelio-test-' + randomBytes(4).toString('hex'), networks: { default: { internal: true } }, services: {
  database: { image: 'postgres:17-alpine', environment: { POSTGRES_DB: 'findelio_test', POSTGRES_HOST_AUTH_METHOD: 'trust' },
    tmpfs: ['/var/lib/postgresql/data'], healthcheck: { test: ['CMD-SHELL', 'pg_isready -U postgres'], interval: '2s', retries: 30 } },
  mail: { image: 'axllent/mailpit@sha256:98b916bd3c8d61f7633a52d3ea2f58d00620cb01ca57ab59edde68c347a95365' },
  directus: { image: 'directus/directus:11.17.4', depends_on: { database: { condition: 'service_healthy' } },
    volumes: [join(root, 'infra/directus/extensions') + ':/directus/extensions:ro', join(root, 'infra/directus/templates') + ':/directus/templates:ro', dir + ':/test:ro'],
    environment: { SECRET: randomBytes(32).toString('hex'), ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: randomBytes(32).toString('base64url'),
      DB_CLIENT: 'pg', DB_HOST: 'database', DB_PORT: '5432', DB_DATABASE: 'findelio_test', DB_USER: 'postgres', DB_PASSWORD: '',
      PUBLIC_URL: 'http://localhost:8055', EMAIL_FROM: 'test@example.com', EMAIL_TRANSPORT: 'smtp', EMAIL_SMTP_HOST: 'mail', EMAIL_SMTP_PORT: '1025', EMAIL_SMTP_SECURE: 'false',
      EMAIL_TEMPLATES_PATH: '/directus/templates', FINDELIO_SITE_URL: 'http://localhost:3000', FINDELIO_REFERRAL_REGISTRATION_ENABLED: 'true',
      USER_REGISTER_URL_ALLOW_LIST: 'http://localhost:3000/de-ch/registrierung-bestaetigen', TELEMETRY: 'false', CACHE_ENABLED: 'false', WEBSOCKETS_ENABLED: 'false' } },
} };
async function run(args, { quiet = false, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', '-f', configPath, ...args], { stdio: ['pipe', quiet ? 'ignore' : 'inherit', quiet ? 'ignore' : 'inherit'] });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('Isolated Docker test command failed: ' + args[0])));
    child.stdin.end(input);
  });
}
async function ready() {
  for (let n = 0; n < 45; n++) {
    try {
      await run(['exec', '-T', 'directus', 'node', '-e', 'fetch("http://127.0.0.1:8055/server/ping").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'], { quiet: true });
      return;
    } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  throw new Error('Isolated Directus did not become ready');
}
try {
  if (browserFixture) config.services.directus.environment.FINDELIO_TEST_ADMIN_TOKEN = randomBytes(32).toString('hex');
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  for (const name of ['referral-directus.integration.mjs', 'referral-directus-disabled.integration.mjs',
    ...(browserFixture ? ['referral-browser-setup.mjs', 'referral-directory-setup.mjs'] : [])]) {
    await writeFile(join(dir, name), await readFile(join(root, 'tests', name)));
  }
  if (browserFixture) {
    await writeFile(join(dir, 'referral-directory.json'), await readFile(join(root, 'tests/fixtures/referral-directory.json')));
  }
  let sql = await readFile(join(root, 'tests/fixtures/referral-directus.sql'), 'utf8');
  for (const migration of ['20260810_premium_grants.sql', '20260910_referral_system.sql']) {
    sql += await readFile(join(root, 'infra/directus/migrations', migration), 'utf8');
  }
  if (browserFixture) sql += await readFile(join(root, 'tests/fixtures/referral-browser.sql'), 'utf8');
  await run(['up', '-d']);
  await ready();
  await run(['exec', '-T', 'database', 'psql', '-U', 'postgres', '-d', 'findelio_test', '-v', 'ON_ERROR_STOP=1'], { input: sql, quiet: true });
  await run(['restart', 'directus']);
  await ready();
  await run(['exec', '-T', 'directus', 'node', '/test/referral-directus.integration.mjs']);
  if (browserFixture) {
    await run(['exec', '-T', 'directus', 'node', '/test/referral-browser-setup.mjs']);
    await run(['exec', '-T', 'directus', 'node', '/test/referral-directory-setup.mjs']);
  }
  config.services.directus.environment.FINDELIO_REFERRAL_REGISTRATION_ENABLED = 'false';
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  await run(['up', '-d']);
  await ready();
  await run(['exec', '-T', 'directus', 'node', '/test/referral-directus-disabled.integration.mjs']);
} finally {
  // Only the uniquely named stack and temporary directory created above.
  await run(['down']).finally(() => rm(dir, { recursive: true, force: true }));
}
