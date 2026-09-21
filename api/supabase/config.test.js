import test from 'node:test';
import assert from 'node:assert/strict';

import { readSupabaseConfig } from './config.js';

test('Supabase configuration is disabled when the environment is empty', () => {
  assert.deepEqual(readSupabaseConfig({}), {
    enabled: false,
    url: null,
    publishableKey: null,
    secretKey: null,
    hasServerCredentials: false,
  });
});

test('Supabase configuration accepts complete public configuration', () => {
  assert.deepEqual(readSupabaseConfig({
    SUPABASE_URL: ' https://example.supabase.co ',
    SUPABASE_PUBLISHABLE_KEY: ' public-key ',
  }), {
    enabled: true,
    url: 'https://example.supabase.co',
    publishableKey: 'public-key',
    secretKey: null,
    hasServerCredentials: false,
  });
});

test('Supabase configuration accepts backend-only secret credentials', () => {
  assert.deepEqual(readSupabaseConfig({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'public-key',
    SUPABASE_SECRET_KEY: ' service-key ',
  }), {
    enabled: true,
    url: 'https://example.supabase.co',
    publishableKey: 'public-key',
    secretKey: 'service-key',
    hasServerCredentials: true,
  });
});

test('Supabase configuration fails closed for malformed URLs', () => {
  assert.deepEqual(readSupabaseConfig({
    SUPABASE_URL: 'not a URL',
    SUPABASE_PUBLISHABLE_KEY: 'public-key',
  }), {
    enabled: false,
    url: null,
    publishableKey: null,
    secretKey: null,
    hasServerCredentials: false,
  });
});

test('Supabase configuration stays disabled when the public key has no URL', () => {
  assert.deepEqual(readSupabaseConfig({ SUPABASE_PUBLISHABLE_KEY: 'public-key' }), {
    enabled: false,
    url: null,
    publishableKey: null,
    secretKey: null,
    hasServerCredentials: false,
  });
});

test('Supabase configuration stays disabled when the URL has no public key', () => {
  assert.deepEqual(readSupabaseConfig({ SUPABASE_URL: 'https://example.supabase.co' }), {
    enabled: false,
    url: null,
    publishableKey: null,
    secretKey: null,
    hasServerCredentials: false,
  });
});
