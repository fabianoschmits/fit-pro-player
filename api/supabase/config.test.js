import test from 'node:test';
import assert from 'node:assert/strict';

import { readSupabaseConfig } from './config.js';

test('Supabase configuration is disabled when the environment is empty', () => {
  assert.deepEqual(readSupabaseConfig({}), {
    enabled: false,
    url: null,
    anonKey: null,
    serviceRoleKey: null,
    hasServerCredentials: false,
  });
});

test('Supabase configuration accepts complete public configuration', () => {
  assert.deepEqual(readSupabaseConfig({
    SUPABASE_URL: ' https://example.supabase.co ',
    SUPABASE_ANON_KEY: ' public-key ',
  }), {
    enabled: true,
    url: 'https://example.supabase.co',
    anonKey: 'public-key',
    serviceRoleKey: null,
    hasServerCredentials: false,
  });
});

test('Supabase configuration accepts optional server credentials', () => {
  assert.deepEqual(readSupabaseConfig({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'public-key',
    SUPABASE_SERVICE_ROLE_KEY: ' service-key ',
  }), {
    enabled: true,
    url: 'https://example.supabase.co',
    anonKey: 'public-key',
    serviceRoleKey: 'service-key',
    hasServerCredentials: true,
  });
});

test('Supabase configuration fails closed for malformed URLs', () => {
  assert.deepEqual(readSupabaseConfig({
    SUPABASE_URL: 'not a URL',
    SUPABASE_ANON_KEY: 'public-key',
  }), {
    enabled: false,
    url: null,
    anonKey: null,
    serviceRoleKey: null,
    hasServerCredentials: false,
  });
});

test('Supabase configuration stays disabled when the public key has no URL', () => {
  assert.deepEqual(readSupabaseConfig({ SUPABASE_ANON_KEY: 'public-key' }), {
    enabled: false,
    url: null,
    anonKey: null,
    serviceRoleKey: null,
    hasServerCredentials: false,
  });
});
