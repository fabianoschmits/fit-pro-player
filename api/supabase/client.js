import { createClient } from '@supabase/supabase-js';

import { readSupabaseConfig } from './config.js';

const SERVER_AUTH_OPTIONS = Object.freeze({
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
});

function factoryInputs(envOrOptions, options) {
  const looksLikeOptions = envOrOptions
    && typeof envOrOptions === 'object'
    && ('env' in envOrOptions || 'runtime' in envOrOptions)
    && !('SUPABASE_URL' in envOrOptions);

  if (looksLikeOptions) {
    return {
      env: envOrOptions.env ?? process.env,
      runtime: envOrOptions.runtime ?? globalThis,
    };
  }

  return {
    env: envOrOptions ?? process.env,
    runtime: options?.runtime ?? globalThis,
  };
}

function serverOnlyError() {
  return new Error('supabase-admin-server-only');
}

function createSafeClient(config) {
  let rawClient;

  try {
    rawClient = createClient(config.url, config.key, {
      auth: SERVER_AUTH_OPTIONS,
    });
  } catch {
    throw new Error('supabase-client-unavailable');
  }

  const auth = {
    ...SERVER_AUTH_OPTIONS,
    getUser: (...args) => rawClient.auth.getUser(...args),
    getSession: (...args) => rawClient.auth.getSession(...args),
  };

  return {
    auth,
    from: (...args) => rawClient.from(...args),
    rpc: (...args) => rawClient.rpc(...args),
    channel: (...args) => rawClient.channel(...args),
    removeChannel: (...args) => rawClient.removeChannel(...args),
    toJSON: () => ({ type: 'supabase-server-client' }),
  };
}

export function createSupabasePublicClient(envOrOptions = process.env, options) {
  const { env } = factoryInputs(envOrOptions, options);
  const config = readSupabaseConfig(env);

  if (!config.enabled) return null;

  return createSafeClient({ url: config.url, key: config.publishableKey });
}

export function createSupabaseAdminClient(envOrOptions = process.env, options) {
  const { env, runtime } = factoryInputs(envOrOptions, options);

  if (runtime?.window || runtime?.document) throw serverOnlyError();

  const config = readSupabaseConfig(env);

  if (!config.hasServerCredentials) return null;

  return createSafeClient({ url: config.url, key: config.secretKey });
}
