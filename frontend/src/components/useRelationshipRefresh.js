import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'

/** Same account-scoped invalidation for cards, requests, history and availability. */
export default function useRelationshipRefresh(refresh) {
 const { user } = useAuth()
 const callback = useRef(refresh); callback.current = refresh
 useEffect(() => {
  if (!user?.id) return undefined
  let alive = true
  const update = () => { if (alive) void callback.current?.() }
  const client = getBrowserSupabaseClient()
  let channel = null
  if (typeof client?.channel === 'function') {
   channel = client.channel(`relationships:${user.id}:${Math.random().toString(36).slice(2)}`)
   for (const table of ['professional_student_relationships', 'professional_link_requests']) {
    for (const column of ['professional_user_id', 'student_user_id']) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `${column}=eq.${user.id}` }, update)
   }
   channel.subscribe()
  }
  window.addEventListener('focus', update)
  window.addEventListener('professional-relationship-changed', update)
  return () => { alive = false; window.removeEventListener('focus', update); window.removeEventListener('professional-relationship-changed', update); if (channel) void client.removeChannel(channel) }
 }, [user?.id])
}
