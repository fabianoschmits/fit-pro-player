import { createClient } from '@supabase/supabase-js'
import { clearSupabaseAccessToken, getSupabaseAccessToken } from './api.js'
import { getPublicSupabaseConfig } from './supabase-config.js'

let client = null
let clientGeneration = 0

const configured = ({ url, publishableKey, accessToken }) => (
  typeof url === 'string' && url.trim()
  && typeof publishableKey === 'string' && publishableKey.trim()
  && typeof accessToken === 'function'
)

export function createFppSupabaseClient({ url, publishableKey, accessToken }) {
  if (!configured({ url, publishableKey, accessToken })) return null

  const generation = clientGeneration

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    detectSessionInUrl: false,
    },
    accessToken: async () => {
      if (generation !== clientGeneration) return null
      const token = await accessToken()
      return generation === clientGeneration ? token : null
    },
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

export async function clearFppSupabaseAuth() {
  clientGeneration += 1
  clearSupabaseAccessToken()

  const activeClient = client
  client = null
  if (!activeClient) return

  // Supabase Realtime retains the last callback result independently of the
  // broker. Dispose channels and clear the socket auth as part of logout.
  await Promise.all([
    activeClient.removeAllChannels?.(),
    activeClient.realtime?.setAuth?.(null),
  ])
  if (activeClient.realtime && 'accessTokenValue' in activeClient.realtime) {
    activeClient.realtime.accessTokenValue = null
  }
}
