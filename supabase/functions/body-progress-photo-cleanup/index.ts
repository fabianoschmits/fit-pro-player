import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { cleanupPhotos } from './cleanup.mjs'
import { removeCommunityPost, removeAccountObjects } from './community-cleanup.mjs'

const bucket = 'body-progress-photos'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  const reply = (status: number, ok = false) => Response.json({ ok }, { status, headers: cors })
  if (request.method !== 'POST') return reply(405)
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return reply(401)
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY')!
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const token = authorization.slice(7)
  const { data: identity, error: authError } = await admin.auth.getUser(token)
  if (authError || !identity.user) return reply(401)
  const owner = identity.user.id
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  if ((await caller.rpc('assert_account_active')).error) return reply(403)
  try {
    const body = await request.json()
    if (!['photo', 'account', 'orphans', 'community-post'].includes(body.action)) return reply(400)
    if (body.action === 'community-post') {
      if (!/^[0-9a-f-]{36}$/.test(body.postId || '')) return reply(400)
      await removeCommunityPost({ db: admin, store: admin.storage.from('community-posts'), owner, postId: body.postId })
    } else {
      await cleanupPhotos({ db: admin, store: admin.storage.from(bucket), owner, action: body.action, photoId: body.photoId })
      if (body.action === 'account') {
        const { data: buckets, error: bucketError } = await admin.storage.listBuckets()
        if (bucketError) throw bucketError
        for (const accountBucket of ['community-posts', 'professional-photos']) {
          if (buckets.some(item => item.id === accountBucket)) {
            await removeAccountObjects({ store: admin.storage.from(accountBucket), owner })
          }
        }
      }
    }
    return reply(200, true)
  } catch {
    // Never log image contents, signed URLs, paths or request bodies.
    return reply(500)
  }
})
