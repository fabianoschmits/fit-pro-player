// Uses only an identity already verified by the handler. No caller-provided owner/path.
export async function cleanupPhotos({ db, store, owner, action, photoId, now = Date.now() }) {
  const check = result => { if (result.error) throw new Error('operation failed'); return result.data }
  const cutoff = new Date(now - 60 * 60 * 1000).toISOString()
  if (action === 'photo' && !/^[0-9a-f-]{36}$/.test(photoId || '')) throw new Error('invalid photo')
  const rows = []
  for (let offset = 0; ; offset += 500) {
    let query = db.from('body_progress_photos').select('id,storage_path,upload_pending,updated_at').eq('user_id', owner).order('id').range(offset, offset + 499)
    if (action === 'photo') query = query.eq('id', photoId)
    if (action === 'orphans') query = query.eq('upload_pending', true).lt('updated_at', cutoff)
    const page = check(await query)
    rows.push(...page)
    if (page.length < 500) break
  }
  if (rows.some(row => !row.storage_path.startsWith(`${owner}/${row.id}/`))) throw new Error('invalid path')
  let claimed = []
  // Claim only this snapshot. Newly reserved photos are never touched by this cleanup.
  // Conditional claim prevents a completed upload being removed by stale orphan cleanup.
  for (let i = 0; i < rows.length; i += 100) {
    let claim = db.from('body_progress_photos').update({ deleting: true }).eq('user_id', owner).in('id', rows.slice(i, i + 100).map(row => row.id))
    if (action === 'orphans') claim = claim.eq('upload_pending', true).lt('updated_at', cutoff)
    claimed.push(...check(await claim.select('id,storage_path')))
  }
  for (let i = 0; i < claimed.length; i += 100) {
    const batch = claimed.slice(i, i + 100)
    check(await store.remove(batch.map(row => row.storage_path)))
    check(await db.from('body_progress_photos').delete().eq('user_id', owner).eq('deleting', true).in('id', batch.map(row => row.id)))
  }
  if (action === 'photo') return

  // Reservations are required by the Storage INSERT trigger. Only old, unreferenced
  // objects are eligible; a concurrent fresh upload is always excluded.
  const candidates = []
  for (let offset = 0; ; offset += 100) {
    const folders = check(await store.list(owner, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }))
    for (const folder of folders) {
      if (folder.id) {
        if (action === 'account' || folder.created_at < cutoff) candidates.push(`${owner}/${folder.name}`)
        continue
      }
      const files = check(await store.list(`${owner}/${folder.name}`, { limit: 100 }))
      for (const file of files) if (file.id && (action === 'account' || file.created_at < cutoff)) candidates.push(`${owner}/${folder.name}/${file.name}`)
    }
    if (folders.length < 100) break
  }
  for (let i = 0; i < candidates.length; i += 100) {
    const batch = candidates.slice(i, i + 100)
    const references = check(await db.from('body_progress_photos').select('storage_path').eq('user_id', owner).in('storage_path', batch))
    const referenced = new Set(references.map(row => row.storage_path))
    const orphaned = batch.filter(path => !referenced.has(path))
    if (orphaned.length) check(await store.remove(orphaned))
  }
}
