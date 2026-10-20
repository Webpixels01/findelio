import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function fakeDocker() {
  const fs = await import('node:fs');
  const args = process.argv.slice(2);
  const root = process.env.FINDELIO_FAKE_ROOT;
  const failure = process.env.FINDELIO_FAKE_FAILURE;
  fs.appendFileSync(root + '/calls', JSON.stringify(args) + '\n');
  const state = () => fs.readFileSync(root + '/state', 'utf8');
  if (args[0] === 'inspect') console.log('directus/directus:' + state());
  else if (args.includes('ps') && args.includes('-q')) console.log('synthetic-' + args.at(-1));
  else if (args.includes('build') && failure === 'build') process.exit(72);
  else if (args.includes('up') && args.at(-1) === 'directus') {
    const paths = args.flatMap((a, i) => a === '-f' ? [args[i + 1]] : []);
    const rollback = paths.some(p => fs.readFileSync(p, 'utf8').includes('image: directus/directus:11.17.4'));
    fs.writeFileSync(root + '/state', rollback ? '11.17.4' : '12.5.0');
    if (!rollback && failure === 'start') process.exit(73);
  } else if (args.includes('exec') && args.includes('app')) {
    const script = fs.readFileSync(0, 'utf8');
    const upgrade = script.includes('export async function checkDirectusUpgrade');
    fs.appendFileSync(root + '/checks', (upgrade ? 'upgrade' : 'website') + ':' + state() + '\n');
    if (upgrade && failure === 'permissions') process.exit(74);
  }
}

// Real shell scripts with a fake Docker executable. Each case owns all of its
// temporary files, backup outputs and simulated container states.
async function deployment({ key = 'synthetic-license', failure = '', previous = '11.17.4' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'findelio-deploy-test-'));
  try {
    await mkdir(join(dir, 'ops'));
    await mkdir(join(dir, 'bin'));
    for (const name of ['deploy.sh', 'backup.sh', 'validate-production-env.sh', 'check-deployment.mjs', 'check-directus-upgrade.mjs']) {
      await copyFile(new URL('../ops/' + name, import.meta.url), join(dir, 'ops', name));
    }
    const sample = await readFile(new URL('../.env.production.example', import.meta.url), 'utf8');
    await writeFile(join(dir, '.env.production'), sample.split('\n').map(line => {
      if (line.startsWith('LICENSE_KEY=')) return 'LICENSE_KEY=' + key;
      if (/^[A-Z_]+=.*/.test(line) && /change-me|admin@example/.test(line)) return line.split('=')[0] + '=synthetic-value';
      return line;
    }).join('\n'));
    await writeFile(join(dir, 'compose.production.yaml'), 'services: {}\n');
    await writeFile(join(dir, 'compose.production.external-proxy.yaml'), 'services: {}\n');
    await writeFile(join(dir, 'state'), previous);
    await writeFile(join(dir, 'bin/docker'), '#!' + process.execPath + '\n(' + fakeDocker.toString() + ')();\n');
    await chmod(join(dir, 'bin/docker'), 0o700);
    const result = spawnSync('bash', [join(dir, 'ops/deploy.sh')], {
      encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, ENV_FILE: join(dir, '.env.production'), BACKUP_DIR: join(dir, 'backups'),
        PATH: join(dir, 'bin') + ':' + process.env.PATH, FINDELIO_FAKE_ROOT: dir, FINDELIO_FAKE_FAILURE: failure },
    });
    assert.equal(result.error, undefined);
    const calls = (await readFile(join(dir, 'calls'), 'utf8')).trim().split('\n').map(JSON.parse);
    const checks = await readFile(join(dir, 'checks'), 'utf8').catch(() => '');
    return { status: result.status, output: result.stdout + result.stderr, calls, checks,
      version: await readFile(join(dir, 'state'), 'utf8') };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('missing or empty quoted license stops before changing the running services', async () => {
  for (const key of ['', '""', "''", '"  "']) {
    const result = await deployment({ key });
    assert.equal(result.status, 1);
    assert.match(result.output, /LICENSE_KEY fehlt/);
    assert.equal(result.version, '11.17.4');
    assert.ok(result.calls.every(args => !args.includes('up') && !args.includes('build')));
  }
});

test('successful upgrade checks actual permissions before and after updating the frontend', async () => {
  const result = await deployment();
  assert.equal(result.status, 0, result.output);
  assert.equal(result.version, '12.5.0');
  assert.equal(result.checks, 'upgrade:12.5.0\nupgrade:12.5.0\nwebsite:12.5.0\n');
  assert.match(result.output, /Deployment abgeschlossen/);
});

test('failed CMS startup or filtered reads restores 11.17.4 and verifies the website', async () => {
  for (const [failure, status] of [['start', 73], ['permissions', 74]]) {
    const result = await deployment({ failure });
    assert.equal(result.status, status, result.output);
    assert.equal(result.version, '11.17.4');
    assert.match(result.checks, /website:11\.17\.4/);
    assert.match(result.output, /Vorherige CMS-Version und Website wiederhergestellt/);
    assert.ok(!result.calls.some(args => args.includes('up') && args.at(-1) === 'app'));
  }
});

test('build failures leave CMS intact; an existing v12 does not trigger an untested downgrade', async () => {
  const build = await deployment({ failure: 'build' });
  assert.equal(build.status, 72);
  assert.equal(build.version, '11.17.4');
  assert.ok(!build.calls.some(args => args.includes('up')));
  const existing = await deployment({ previous: '12.5.0', failure: 'permissions' });
  assert.equal(existing.status, 74);
  assert.equal(existing.version, '12.5.0');
  assert.doesNotMatch(existing.output, /Stelle Directus 11/);
});
