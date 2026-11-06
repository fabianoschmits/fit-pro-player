import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLifecycleBrowserDatabase } from './lifecycle-browser-database.mjs'

test('real migrations block orphaning post/account deletes and decode legacy image URLs', async () => {
  const context = await createLifecycleBrowserDatabase()
  const { db } = context
  const owner = '11111111-1111-4111-8111-111111111111'
  const post = '22222222-2222-4222-8222-222222222222'
  const path = `${owner}/${post}.jpg`
  try {
    await db.query(`insert into auth.users(id,email) values($1,'photo-test@example.invalid')`, [owner])
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [owner])
    await db.query(`insert into storage.objects(bucket_id,name) values('community-posts',$1)`, [path])
    const legacy = `https://example.invalid/storage/v1/object/public/community-posts/${encodeURIComponent(path)}`
    await db.query(`insert into public.community_posts(id,author_id,image_path) values($1,$2,$3)`, [post, owner, legacy])
    assert.equal((await db.query(`select public.community_photo_object_path($1) as path`, [legacy])).rows[0].path, path)
    await assert.rejects(db.query(`delete from public.community_posts where id=$1`, [post]), /Storage API/)
    await assert.rejects(db.query(`delete from auth.users where id=$1`, [owner]), /Storage API/)
    await assert.rejects(db.query(`update public.community_posts set image_path='replacement.jpg' where id=$1`, [post]), /identity cannot change/)
    // SQL fixture simulates successful Storage API removal. Production uses .remove().
    await db.query(`delete from storage.objects where bucket_id='community-posts' and name=$1`, [path])
    await db.query(`delete from public.community_posts where id=$1`, [post])
    assert.equal((await db.query(`select count(*)::int as count from public.community_posts where id=$1`, [post])).rows[0].count, 0)
    await db.query(`delete from auth.users where id=$1`, [owner])
  } finally { await context.close() }
})
