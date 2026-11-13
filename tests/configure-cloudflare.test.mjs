import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('deployment configuration accepts the shipped template and rejects placeholder D1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'litric-config-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'standalone'));
    fs.mkdirSync(path.join(dir, 'scripts'));
    for (const file of ['standalone/wrangler.jsonc', 'scripts/configure-cloudflare.mjs'])
      fs.copyFileSync(file, path.join(dir, file));
    const run = (id, pilot = false) => spawnSync(process.execPath, ['scripts/configure-cloudflare.mjs'], {
      cwd: dir, encoding: 'utf8',
      env: { ...process.env, CLOUDFLARE_D1_ID: id, LITRIC_WORKER_NAME: 'litric-pilot', LITRIC_PILOT_MODE: String(pilot) },
    });
    assert.notEqual(run('00000000-0000-4000-8000-000000000000').status, 0);
    assert.equal(fs.existsSync(path.join(dir, 'standalone/wrangler.generated.jsonc')), false);
    assert.equal(run('11111111-2222-4333-8444-555555555555').status, 0);
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'standalone/wrangler.generated.jsonc'), 'utf8'));
    assert.equal(config.name, 'litric-pilot');
    assert.equal(config.d1_databases[0].database_id, '11111111-2222-4333-8444-555555555555');
    assert.equal(config.d1_databases[0].binding, 'DB');
    assert.equal(config.assets.binding, 'ASSETS');
    assert.equal(config.vars.LITRIC_AUTH_MODE, 'standalone');
    assert.equal(config.limits, undefined);
    assert.equal(config.durable_objects.bindings[0].class_name, 'LitricSchoolService');
    assert.deepEqual(config.migrations[0].new_sqlite_classes, ['LitricSchoolService']);
    assert.notEqual(config.vars.LITRIC_LOGIN_ENABLED, 'false');
    assert.equal(run('11111111-2222-4333-8444-555555555555', true).status, 0);
    const pilot = JSON.parse(fs.readFileSync(path.join(dir, 'standalone/wrangler.generated.jsonc'), 'utf8'));
    assert.equal(pilot.vars.LITRIC_LOGIN_ENABLED, 'false');
    assert.equal(pilot.limits, undefined);
  } finally {
    assert.equal(fs.realpathSync(path.dirname(dir)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
