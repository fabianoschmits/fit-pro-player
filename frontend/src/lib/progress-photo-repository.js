import { getInsightsAccount, trackInsight } from './insights-client.js'
import { getBrowserSupabaseClient } from './supabase-client.js'

export const PHOTO_ANGLES = [
  { value: 'front', label: 'Frente' }, { value: 'back', label: 'Costas' },
  { value: 'left', label: 'Lateral esquerda' }, { value: 'right', label: 'Lateral direita' },
]
export const PHOTO_BUCKET = 'body-progress-photos'
const failure = () => new Error(globalThis.navigator?.onLine === false
  ? 'Sem conexão. Conecte-se à internet e tente novamente.'
  : 'Não foi possível acessar suas fotos. Tente novamente.')

// A repository belongs to one mounted account. No global URLs, image JSON or caches.
export function createProgressPhotoRepository(userId, client = getBrowserSupabaseClient()) {
  let disposed = false
  let listing
  const signed = new Map()
  const pendingURLs = new Map()
  const operations = new Set()
  const assertOwner = async () => {
    if (disposed || !client || !userId) throw failure()
    const { data, error } = await client.auth.getSession()
    if (error || disposed || data?.session?.user?.id !== userId || data?.session?.user?.is_anonymous) throw failure()
    return data.session.access_token
  }
  const check = result => { if (result.error) throw failure(); return result.data }
  const cleanup = async body => {
    const token = await assertOwner()
    return check(await client.functions.invoke('body-progress-photo-cleanup', { body, headers: { Authorization: `Bearer ${token}` } }))
  }
  const owned = photo => {
    if (photo.user_id !== userId || !photo.storage_path.startsWith(`${userId}/${photo.id}/`)) throw failure()
  }
  return {
    dispose() { disposed = true; signed.clear(); pendingURLs.clear() },
    list() {
      if (!listing) listing = (async () => {
        await assertOwner()
        const rows = []
        for (let offset = 0; ; offset += 200) {
          const page = check(await client.from('body_progress_photos').select('*').eq('user_id', userId).order('photo_date', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199))
          await assertOwner()
          rows.push(...page)
          if (page.length < 200) break
        }
        return rows
      })().finally(() => { listing = null })
      return listing
    },
    async url(photo) {
      owned(photo)
      await assertOwner()
      const hit = signed.get(photo.id)
      if (hit?.expires > Date.now() + 60_000) return hit.url
      if (!pendingURLs.has(photo.id)) pendingURLs.set(photo.id, (async () => {
        const data = check(await client.storage.from(PHOTO_BUCKET).createSignedUrl(photo.storage_path, 900))
        await assertOwner()
        signed.set(photo.id, { url: data.signedUrl, expires: Date.now() + 900_000 })
        return data.signedUrl
      })().finally(() => pendingURLs.delete(photo.id)))
      return pendingURLs.get(photo.id)
    },
    async upload(processed, { date, angle, automatic }) {
      if (operations.has('upload')) throw new Error('Uma foto já está sendo salva.')
      operations.add('upload')
      const id = crypto.randomUUID()
      const path = `${userId}/${id}/original.${processed.mime_type === 'image/webp' ? 'webp' : 'jpg'}`
      let reserved = false
      let committed = false
      try {
        await assertOwner()
        const row = { id, user_id: userId, photo_date: date, angle, storage_path: path,
          width: processed.width, height: processed.height, file_size: processed.file_size, mime_type: processed.mime_type,
          auto_transform: automatic, manual_transform: null }
        check(await client.from('body_progress_photos').insert(row))
        reserved = true
        await assertOwner()
        check(await client.storage.from(PHOTO_BUCKET).upload(path, processed.blob, { contentType: processed.mime_type, cacheControl: '0', upsert: false }))
        await assertOwner()
        check(await client.from('body_progress_photos').update({ upload_pending: false }).eq('user_id', userId).eq('id', id).eq('deleting', false).select('id').single())
        committed = true
        await assertOwner()
        return row
      } catch (error) {
        if (globalThis.navigator?.onLine !== false && getInsightsAccount() === userId) trackInsight('photo_upload_failed',{flow:'photos',action:'upload',error_category:'request_failed'})
        // Same-owner cleanup only; a switched account can never remove the old owner's objects.
        if (reserved && !committed) {
          try { await cleanup({ action: 'photo', photoId: id }) } catch {
            throw new Error('O envio não foi concluído. Um arquivo pode estar pendente; use “Limpar envios incompletos” antes de tentar novamente.')
          }
        }
        throw error
      } finally { operations.delete('upload') }
    },
    async saveTransform(photo, transform) {
      owned(photo)
      await assertOwner()
      check(await client.from('body_progress_photos').update({ manual_transform: transform }).eq('user_id', userId).eq('id', photo.id).eq('deleting', false).eq('upload_pending', false).select('id').single())
      await assertOwner()
    },
    async remove(photo) {
      owned(photo)
      if (operations.has(photo.id)) return
      operations.add(photo.id)
      try {
        await cleanup({ action: 'photo', photoId: photo.id })
        signed.delete(photo.id)
        await assertOwner()
      } finally { operations.delete(photo.id) }
    },
    async cleanIncomplete() {
      await cleanup({ action: 'orphans' })
      await assertOwner()
    },
  }
}
