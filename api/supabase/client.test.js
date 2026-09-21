import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSupabaseAdminClient,
  createSupabasePublicClient,
} from './client.js';

const publicEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-key',
};

const serverEnv = {
  ...publicEnv,
  SUPABASE_SECRET_KEY: 'server-secret',
};

test('factories fail closed when Supabase configuration is absent', () => {
  assert.equal(createSupabasePublicClient({}), null);
  assert.equal(createSupabaseAdminClient({}), null);
});

test('public factory creates a server client from public-only configuration', () => {
  const client = createSupabasePublicClient(publicEnv);

  assert.ok(client);
  assert.equal(client.auth.persistSession, false);
  assert.equal(client.auth.autoRefreshToken, false);
  assert.equal(client.auth.detectSessionInUrl, false);
  assert.equal(createSupabaseAdminClient(publicEnv), null);
  assert.doesNotMatch(JSON.stringify(client), /public-key/);
});

test('admin factory creates a privileged client only with complete server configuration', () => {
  const client = createSupabaseAdminClient(serverEnv);

  assert.ok(client);
  assert.equal(client.auth.persistSession, false);
  assert.equal(client.auth.autoRefreshToken, false);
  assert.equal(client.auth.detectSessionInUrl, false);
  assert.doesNotMatch(JSON.stringify(client), /server-secret/);
  assert.doesNotMatch(String(client), /server-secret/);
});

test('factories fail closed for malformed or incomplete configuration', () => {
  const malformedEnv = {
    ...serverEnv,
    SUPABASE_URL: 'not a URL',
  };

  assert.equal(createSupabasePublicClient(malformedEnv), null);
  assert.equal(createSupabaseAdminClient(malformedEnv), null);
  assert.equal(createSupabaseAdminClient({
    ...publicEnv,
    SUPABASE_SECRET_KEY: '   ',
  }), null);
});

test('admin factory refuses browser-like runtimes without revealing the service key', () => {
  assert.throws(
    () => createSupabaseAdminClient(serverEnv, { runtime: { window: {} } }),
    error => {
      assert.match(error.message, /server-only/i);
      assert.doesNotMatch(error.message, /server-secret/);
      return true;
    },
  );
});
