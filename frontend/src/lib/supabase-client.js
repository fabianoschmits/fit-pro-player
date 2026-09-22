import { createClient } from '@supabase/supabase-js'
import { clearSupabaseAccessToken, getSupabaseAccessToken } from './api.js'
import { getPublicSupabaseConfig } from './supabase-config.js'

let client = null

const configured = ({ url, publishableKey, accessToken }) => (
  typeof url === 'string' && url.trim()
  && typeof publishableKey === 'string' && publishableKey.trim()
  && typeof accessToken === 'function'
)

export function createFppSupabaseClient({ url, publishableKey, accessToken }) {
  if (!configured({ url, publishableKey, accessToken })) return null

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken,
  })
}

export function getFppSupabaseClient() {
  if (client) return client

  const config = getPublicSupabaseConfig(import.meta.env || {})
  if (!config.enabled) return null

  client = createFppSupabaseClient({
    ...config,
    accessToken: async () => getSupabaseAccessToken(),
  })
  return client
}

export function clearFppSupabaseAuth() {
  clearSupabaseAccessToken()
}
