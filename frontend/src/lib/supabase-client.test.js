import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBrowserSupabaseClient,
  getBrowserSupabaseClient,
  resetBrowserSupabaseClientForTest,
} from './supabase-client.js';

const completeConfig = {
  enabled: true,
  url: 'https://bgqavxoxwgheloeubbpf.supabase.co',
  origin: 'https://bgqavxoxwgheloeubbpf.supabase.co',
  publishableKey: 'publishable-key',
};

afterEach(() => {
  resetBrowserSupabaseClientForTest();
});

describe('browser Supabase client', () => {
  it('creates a client with the SDK-owned persistence settings', () => {
    const client = { auth: {} };
    const createClient = vi.fn(() => client);

    expect(createBrowserSupabaseClient(completeConfig, createClient)).toBe(client);
    expect(createClient).toHaveBeenCalledWith('https://bgqavxoxwgheloeubbpf.supabase.co', 'publishable-key', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  });

  it('returns null without invoking the SDK for disabled or malformed configuration', () => {
    const createClient = vi.fn();

    expect(createBrowserSupabaseClient({ enabled: false }, createClient)).toBeNull();
    expect(createBrowserSupabaseClient({ ...completeConfig, url: 'not a URL' }, createClient)).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('caches one client for complete public environment configuration', () => {
    const first = getBrowserSupabaseClient({
      VITE_SUPABASE_URL: 'https://bgqavxoxwgheloeubbpf.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    });
    const second = getBrowserSupabaseClient({
      VITE_SUPABASE_URL: 'https://bgqavxoxwgheloeubbpf.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    });

    expect(second).toBe(first);
  });
});
