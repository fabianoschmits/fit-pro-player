import { createClient } from '@supabase/supabase-js';

import { getPublicSupabaseConfig } from './supabase-config.js';

let browserSupabaseClient = null;

function isCompletePublicConfig(config) {
  if (!config?.enabled || typeof config.publishableKey !== 'string' || !config.publishableKey.trim()) {
    return false;
  }

  try {
    const url = new URL(config.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createBrowserSupabaseClient(config, createClientImpl = createClient) {
  if (!isCompletePublicConfig(config)) return null;

  return createClientImpl(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export function getBrowserSupabaseClient(env = import.meta.env) {
  const config = getPublicSupabaseConfig(env);
  if (!config.enabled) return null;

  browserSupabaseClient ??= createBrowserSupabaseClient(config);
  return browserSupabaseClient;
}

export function resetBrowserSupabaseClientForTest() {
  browserSupabaseClient = null;
}
