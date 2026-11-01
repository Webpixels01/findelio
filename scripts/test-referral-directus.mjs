// Explicitly opt-in: disposable stack; licensed mode permits CMS licensing egress.
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';

if (!process.argv.includes('--isolated')) throw new Error('Pass --isolated to start a disposable Docker integration test');
const browserFixture = process.argv.includes('--browser-fixture');
const twoFactorBrowser = process.argv.includes('--two-factor-browser');
const browserOnly = process.argv.includes('--browser-only');
if (browserOnly && !twoFactorBrowser) throw new Error('--browser-only requires --two-factor-browser');
const upgradeFrom125 = process.argv.includes('--upgrade-from-12-5');
const upgradeFrom11 = process.argv.includes('--upgrade-from-11');
const recoverFrom12 = process.argv.includes('--recover-from-12');
const licensedUpgrade = process.argv.includes('--licensed-upgrade') || upgradeFrom11 || upgradeFrom125;
if (licensedUpgrade && (recoverFrom12 || browserFixture)) throw new Error('Licensed upgrade must run separately');
if (twoFactorBrowser && !licensedUpgrade) throw new Error('2FA browser tests require --licensed-upgrade');
const root = fileURLToPath(new URL('../', import.meta.url));
let licenseKey;
if (licensedUpgrade) {
  const values = parseEnv(await readFile(join(root, '.env.local'), 'utf8'));
  licenseKey = values.LICENSE_KEY?.trim();
  if (!licenseKey || licenseKey.includes('DEIN_')) throw new Error('LICENSE_KEY in .env.local fehlt');
}
const dir = await mkdtemp(join(tmpdir(), 'findelio-referral-integration-'));
const configPath = join(dir, 'compose.json');
const config = { name: 'findelio-test-' + randomBytes(4).toString('hex'), networks: { default: { internal: true } }, services: {
  database: { image: 'postgres:17-alpine', environment: { POSTGRES_DB: 'findelio_test', POSTGRES_HOST_AUTH_METHOD: 'trust' },
    volumes: [dir + ':/test:ro'],
    tmpfs: ['/var/lib/postgresql/data'], healthcheck: { test: ['CMD-SHELL', 'pg_isready -U postgres'], interval: '2s', retries: 30 } },
  mail: { image: 'axllent/mailpit@sha256:98b916bd3c8d61f7633a52d3ea2f58d00620cb01ca57ab59edde68c347a95365' },
  cache: { image: 'redis:7-alpine', healthcheck: { test: ['CMD', 'redis-cli', 'ping'], interval: '2s', retries: 30 } },
  directus: { image: 'directus/directus:11.17.4', depends_on: { database: { condition: 'service_healthy' }, cache: { condition: 'service_healthy' } },
    volumes: [join(root, 'infra/directus/extensions') + ':/directus/extensions:ro', join(root, 'infra/directus/templates') + ':/directus/templates:ro', dir + ':/test:ro'],
    environment: { SECRET: randomBytes(32).toString('hex'), ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: randomBytes(32).toString('base64url'), FINDELIO_TEST_TFA_SECRET: 'JBSWY3DPEHPK3PXP',
      DB_CLIENT: 'pg', DB_HOST: 'database', DB_PORT: '5432', DB_DATABASE: 'findelio_test', DB_USER: 'postgres', DB_PASSWORD: '',
      PUBLIC_URL: 'http://localhost:8055', EMAIL_FROM: 'test@example.com', EMAIL_TRANSPORT: 'smtp', EMAIL_SMTP_HOST: 'mail', EMAIL_SMTP_PORT: '1025', EMAIL_SMTP_SECURE: 'false',
      EMAIL_TEMPLATES_PATH: '/directus/templates', ADMIN_NOTIFICATION_EMAIL: 'notifications@example.com', FINDELIO_SITE_URL: 'http://localhost:3000', FINDELIO_REFERRAL_REGISTRATION_ENABLED: 'true',
      USER_REGISTER_URL_ALLOW_LIST: 'http://localhost:3000/de-ch/registrierung-bestaetigen,http://localhost:3000/vi/registrierung-bestaetigen', TELEMETRY: 'false',
      CACHE_ENABLED: 'true', CACHE_AUTO_PURGE: 'true', CACHE_STORE: 'redis', REDIS: 'redis://cache:6379',
      RATE_LIMITER_ENABLED: 'true', RATE_LIMITER_STORE: 'redis', RATE_LIMITER_POINTS: '200', RATE_LIMITER_DURATION: '1',
      RATE_LIMITER_KEY_PREFIX: 'findelio-ip', RATE_LIMITER_REGISTRATION_KEY_PREFIX: 'findelio-registration',
      RATE_LIMITER_GLOBAL_KEY_PREFIX: 'findelio-global', RATE_LIMITER_EMAIL_KEY_PREFIX: 'findelio-email',
      IP_TRUST_PROXY: 'number:1', WEBSOCKETS_ENABLED: 'true' } },
} };
// Only the disposable CMS gets outbound access, for Directus license validation.
// Production URLs, credentials and SMTP settings are never copied into this stack.
if (licensedUpgrade) {
  config.networks.licensing = {};
  config.services.directus.networks = ['default', 'licensing'];
}
if (twoFactorBrowser) {
  // Docker Desktop needs a non-internal network for published browser ports.
  config.networks.browser = {};
  config.services.directus.ports = ['127.0.0.1:3318:8055'];
  config.services.directus.environment.PUBLIC_URL = 'http://127.0.0.1:3318';
  config.services.app = { image: 'findelio-two-factor-test:20261020', profiles: ['browser'],
    networks: ['default', 'browser'],
    ports: ['127.0.0.1:3317:3000'], environment: {
      HOSTNAME: '0.0.0.0',
      DIRECTUS_URL: 'http://directus:8055', DIRECTUS_PUBLIC_URL: 'http://127.0.0.1:3318',
      DIRECTUS_TOKEN: randomBytes(32).toString('hex'), NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3317',
    } };
}
let licenseAttempted = false;
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
  if (licensedUpgrade) await writeFile(join(dir, 'check-directus-upgrade.mjs'), await readFile(join(root, 'ops/check-directus-upgrade.mjs')));
  for (const name of ['directus-test-auth.mjs', 'two-factor-directus.integration.mjs', 'referral-directus.integration.mjs', 'referral-directus-disabled.integration.mjs', 'security-directus.integration.mjs', 'directus-permissions-recovery.mjs', 'directus-license.integration.mjs', 'directus-ownership-upgrade.mjs',
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
  sql += "\nUPDATE directus_users SET tfa_secret = 'JBSWY3DPEHPK3PXP' WHERE email = 'admin@example.com';\n";
  await mkdir(join(dir, 'migrations'));
  await writeFile(join(dir, 'migrations/20261021_two_factor_auth.sql'), await readFile(join(root, 'infra/directus/migrations/20261021_two_factor_auth.sql')));
  await writeFile(join(dir, 'migrations/20261020_request_limits.sql'), await readFile(join(root, 'infra/directus/migrations/20261020_request_limits.sql')));
  await writeFile(join(dir, 'apply-migrations.sh'), await readFile(join(root, 'ops/apply-migrations.sh')));
  if (browserFixture) sql += await readFile(join(root, 'tests/fixtures/referral-browser.sql'), 'utf8');
  else sql += "\nCREATE TABLE listing_posts (id uuid PRIMARY KEY, status text);\nINSERT INTO directus_collections (collection,accountability) VALUES ('listing_posts','all');\n";
  if (recoverFrom12 || licensedUpgrade) sql += await readFile(join(root, 'tests/fixtures/directus-permissions-recovery.sql'), 'utf8');
  if (licensedUpgrade) sql += await readFile(join(root, 'tests/fixtures/directus-ownership-upgrade.sql'), 'utf8');
  for (const migration of ['20261024_moderation_snapshot_binding.sql', '20261024_notification_delivery.sql', '20261024_premium_grants_admin_only.sql']) {
    await writeFile(join(dir, 'migrations', migration), await readFile(join(root, 'infra/directus/migrations', migration)));
  }
  await run(['up', '-d']);
  await ready();
  await run(['exec', '-T', 'database', 'psql', '-U', 'postgres', '-d', 'findelio_test', '-v', 'ON_ERROR_STOP=1'], { input: sql, quiet: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    await run(['exec', '-T', '-e', 'PGUSER=postgres', '-e', 'PGDATABASE=findelio_test', '-e', 'MIGRATIONS_DIR=/test/migrations',
      'database', 'sh', '/test/apply-migrations.sh']);
  }
  await run(['restart', 'directus']);
  await ready();
  if (recoverFrom12 || licensedUpgrade) await run(['exec', '-T', 'directus', 'node', '/test/directus-permissions-recovery.mjs', '200']);
  if (licensedUpgrade) await run(['exec', '-T', 'directus', 'node', '/test/directus-ownership-upgrade.mjs']);
  if (upgradeFrom11 || recoverFrom12 || licensedUpgrade) {
    config.services.directus.image = 'directus/directus:12.5.0';
    if (licensedUpgrade) {
      config.services.directus.environment.LICENSE_KEY = licenseKey;
      licenseAttempted = true;
    }
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    await run(['up', '-d', '--no-deps', 'directus']);
  }
  await ready();
  if (upgradeFrom125) {
    console.log('BASELINE 12.5.0: license, filtered permissions and ownership');
    await run(['exec', '-T', 'directus', 'node', '/test/directus-license.integration.mjs', 'check']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-permissions-recovery.mjs', '200']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-ownership-upgrade.mjs']);
    console.log('UPGRADE: same disposable database from 12.5.0 to 12.6.0');
    config.services.directus.image = 'directus/directus:12.6.0';
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    await run(['up', '-d', '--no-deps', 'directus']);
    await ready();
  }
  if (licensedUpgrade) {
    await run(['exec', '-T', 'directus', 'node', '/test/directus-license.integration.mjs', 'check']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-permissions-recovery.mjs', '200']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-ownership-upgrade.mjs']);
    await run(['exec', '-T', '-e', `FINDELIO_EXPECTED_DIRECTUS_VERSION=${upgradeFrom125 ? '12.6.0' : '12.5.0'}`, '-e', 'DIRECTUS_URL=http://127.0.0.1:8055', '-e', 'DIRECTUS_TOKEN=isolated-recovery-fixture-token',
      'directus', 'node', '/test/check-directus-upgrade.mjs']);
  }
  if (recoverFrom12) {
    await run(['exec', '-T', 'directus', 'node', '/test/directus-permissions-recovery.mjs', '403']);
    config.services.directus.image = 'directus/directus:11.17.4';
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    await run(['up', '-d', '--no-deps', 'directus']);
    await ready();
    await run(['exec', '-T', 'directus', 'node', 'cli.js', 'cache', 'clear']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-permissions-recovery.mjs', '200']);
  }
  if (!browserOnly) {
    await run(['exec', '-T', 'directus', 'node', '/test/referral-directus.integration.mjs']);
    await run(['exec', '-T', 'directus', 'node', '/test/security-directus.integration.mjs']);
    await run(['exec', '-T', 'directus', 'node', '/test/two-factor-directus.integration.mjs']);
    if (browserFixture) {
      await run(['exec', '-T', 'directus', 'node', '/test/referral-browser-setup.mjs']);
      await run(['exec', '-T', 'directus', 'node', '/test/referral-directory-setup.mjs']);
    }
    config.services.directus.environment.FINDELIO_REFERRAL_REGISTRATION_ENABLED = 'false';
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    await run(['up', '-d', '--no-deps', 'directus']);
    await ready();
    await run(['exec', '-T', 'directus', 'node', '/test/referral-directus-disabled.integration.mjs']);
  }
  if (twoFactorBrowser) {
    await run(['exec', '-T', 'database', 'psql', '-U', 'postgres', '-d', 'findelio_test', '-c', 'TRUNCATE findelio_request_limits'], { quiet: true });
    await run(['up', '-d', '--wait', 'app']);
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(root, 'tests/two-factor-browser.mjs')], {
        stdio: 'inherit', env: { ...process.env, DB_DATABASE: 'findelio_test',
          ADMIN_EMAIL: config.services.directus.environment.ADMIN_EMAIL,
          ADMIN_PASSWORD: config.services.directus.environment.ADMIN_PASSWORD,
          FINDELIO_TEST_TFA_SECRET: config.services.directus.environment.FINDELIO_TEST_TFA_SECRET,
          FINDELIO_TEST_WEBSITE_TOKEN: config.services.app.environment.DIRECTUS_TOKEN },
      });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error('Two-factor browser test failed')));
    });
  }
  if (upgradeFrom125) {
    console.log('ROLLBACK: verify 12.5.0 with the database migrated by 12.6.0');
    config.services.directus.image = 'directus/directus:12.5.0';
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    await run(['up', '-d', '--no-deps', 'directus']);
    await ready();
    await run(['exec', '-T', 'directus', 'node', 'cli.js', 'cache', 'clear']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-license.integration.mjs', 'check']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-permissions-recovery.mjs', '200']);
    await run(['exec', '-T', 'directus', 'node', '/test/directus-ownership-upgrade.mjs']);
    await run(['exec', '-T', '-e', 'FINDELIO_EXPECTED_DIRECTUS_VERSION=12.5.0',
      '-e', 'DIRECTUS_URL=http://127.0.0.1:8055', '-e', 'DIRECTUS_TOKEN=isolated-recovery-fixture-token',
      'directus', 'node', '/test/check-directus-upgrade.mjs']);
  }
} finally {
  // A throwaway DB must never strand a license activation. Remove the env key,
  // restart and use Directus' official DELETE /license endpoint before cleanup.
  if (licenseAttempted) {
    try {
      delete config.services.directus.environment.LICENSE_KEY;
      await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
      await run(['up', '-d', '--no-deps', 'directus']);
      await ready();
      await run(['exec', '-T', 'directus', 'node', '/test/directus-license.integration.mjs', 'deactivate']);
    } catch {
      // Preserve this exact instance and its activation binding for recovery.
      throw new Error(`Testlizenz konnte nicht freigegeben werden. Testinstanz zur Wiederherstellung erhalten: ${configPath}`);
    }
  }
  // Only the uniquely named stack and temporary directory created above.
  await run(['--profile', 'browser', 'down']).finally(() => rm(dir, { recursive: true, force: true }));
}
