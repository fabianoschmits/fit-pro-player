import { describe, expect, it } from 'vitest';

import { getPublicSupabaseConfig } from './supabase-config.js';

describe('Supabase configuration', () => {
  it('is disabled when public environment variables are absent', () => {
    expect(getPublicSupabaseConfig({})).toEqual({
      enabled: false,
      url: null,
      anonKey: null,
    });
  });

  it('returns trimmed public configuration when both values are valid', () => {
    expect(getPublicSupabaseConfig({
      VITE_SUPABASE_URL: ' https://example.supabase.co ',
      VITE_SUPABASE_ANON_KEY: ' public-key ',
    })).toEqual({
      enabled: true,
      url: 'https://example.supabase.co',
      anonKey: 'public-key',
    });
  });

  it('fails closed for malformed URLs and incomplete public configuration', () => {
    expect(getPublicSupabaseConfig({
      VITE_SUPABASE_URL: 'not a URL',
      VITE_SUPABASE_ANON_KEY: 'public-key',
    })).toEqual({ enabled: false, url: null, anonKey: null });

    expect(getPublicSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' }))
      .toEqual({ enabled: false, url: null, anonKey: null });
  });

  it('ignores service-role variables at the public boundary', () => {
    const config = getPublicSupabaseConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-key',
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-read',
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-read-either',
    });

    expect(config).toEqual({
      enabled: true,
      url: 'https://example.supabase.co',
      anonKey: 'public-key',
    });
    expect('serviceRoleKey' in config).toBe(false);
  });
});
