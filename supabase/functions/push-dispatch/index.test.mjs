import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import webPush from 'web-push';
import { generateKeyPairSync } from 'node:crypto';
import { createDispatchHandler } from './handler.mjs';

const vapid = webPush.generateVAPIDKeys();
const environment = {
  SUPABASE_URL: 'https://server.example.com', SUPABASE_SECRET_KEY: 'server-secret-key',
  SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-key', VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:push@example.com',
  PUSH_DISPATCH_SECRET: 'dedicated-dispatch-secret',
};

async function startEdge(env) {
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8').catch(() => null);
  assert.equal(typeof source, 'string', 'Edge entrypoint must exist');
  const creations = [];
  const calls = [];
  let handle;
  // Adapt npm specifiers to Node fixtures; execute the actual Edge wiring below them.
  const executable = source
    .replace(/import \{ createClient \} from ['"]npm:@supabase\/supabase-js@[^'"]+['"];?/u, 'const { createClient } = fixture;')
    .replace(/import webPush from ['"]npm:web-push@[^'"]+['"];?/u, 'const { webPush } = fixture;')
    .replace(/import \{ createDispatchHandler \} from ['"]\.\/handler\.mjs['"];?/u, 'const { createDispatchHandler } = fixture;');
  const fixture = {
    webPush, createDispatchHandler,
    createClient(url, key, options) {
      creations.push({ url, key, options });
      return { async rpc(name, args) { calls.push({ name, args }); return { data: [], error: null }; } };
    },
  };
  vm.runInNewContext(executable, { fixture, Deno: {
    env: { get: (key) => env[key] }, serve: (callback) => { handle = callback; },
  } });
  assert.equal(typeof handle, 'function');
  return { handle, creations, calls };
}

test('Edge wiring uses server secret credentials and disables session persistence', async () => {
  const edge = await startEdge(environment);
  assert.deepEqual(edge.creations[0].url, 'https://server.example.com');
  assert.deepEqual(edge.creations[0].key, 'server-secret-key');
  assert.equal(edge.creations[0].options.auth.persistSession, false);
  assert.equal(edge.creations[0].options.auth.autoRefreshToken, false);
  const response = await edge.handle(new Request('https://server.test/push-dispatch', {
    method: 'POST', headers: { 'x-push-dispatch-secret': 'dedicated-dispatch-secret' },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(edge.calls, [{ name: 'claim_notification_jobs', args: { p_limit: 25, p_native_ready: false } }]);
});

test('malformed optional Firebase environment fails closed for native claims while preserving configured web dispatch', async () => {
  const edge = await startEdge({ ...environment, FIREBASE_SERVICE_ACCOUNT: 'INVALID PRIVATE JSON' });
  const response = await edge.handle(new Request('https://server.test/push-dispatch', {
    method: 'POST', headers: { 'x-push-dispatch-secret': 'dedicated-dispatch-secret' },
  }));
  assert.equal(response.status, 200);
  assert.equal(edge.calls[0].args.p_native_ready, false);
  assert.doesNotMatch(await response.text(), /INVALID|PRIVATE|JSON/u);
});

test('server Firebase JSON credentials enable native claim transport only after a real RSA key import', async () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = { project_id: 'fitpro-player-123', client_email: 'dispatcher@fitpro-player-123.iam.gserviceaccount.com',
    private_key: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
  const edge = await startEdge({ ...environment, FIREBASE_SERVICE_ACCOUNT: JSON.stringify(credentials) });
  const response = await edge.handle(new Request('https://server.test/push-dispatch', {
    method: 'POST', headers: { 'x-push-dispatch-secret': 'dedicated-dispatch-secret' },
  }));
  assert.equal(response.status, 200);
  assert.equal(edge.calls[0].args.p_native_ready, true);
  assert.doesNotMatch(await response.text(), /PRIVATE KEY|dispatcher@|fitpro-player-123/u);
});

test('Edge wiring falls back to the default service role key and fails closed without database credentials', async () => {
  const legacy = await startEdge({ ...environment, SUPABASE_SECRET_KEY: undefined });
  assert.equal(legacy.creations[0].key, 'legacy-service-role-key');
  for (const missing of [{ SUPABASE_URL: undefined }, { SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }]) {
    const edge = await startEdge({ ...environment, ...missing });
    const response = await edge.handle(new Request('https://server.test/push-dispatch', {
      method: 'POST', headers: { 'x-push-dispatch-secret': 'dedicated-dispatch-secret' },
    }));
    assert.equal(response.status, 503);
    assert.equal(edge.creations.length, 0);
    assert.equal(edge.calls.length, 0);
    assert.doesNotMatch(await response.text(), /server-secret|legacy-service|dedicated-dispatch/u);
  }
});
