import { normalizeProfessionalProfile } from './professional-profile.js'
const BUCKET = 'professional-photos'
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
const PATH = new RegExp(`^${UUID}/${UUID}\\.(jpg|jpeg|png|webp)$`, 'i')
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function validateProfessionalPhoto(file) {
  if (!TYPES[file?.type]) throw new Error('professional-photo-type')
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('professional-photo-size')
  return TYPES[file.type]
}
export function professionalPhotoUrl(path, client) {
  if (typeof path !== 'string' || !PATH.test(path) || !client?.storage) return null
  try {
    const url = client.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl
    return /^https?:$/.test(new URL(url).protocol) ? url : null
  } catch { return null }
}
export function createProfessionalPhotoRepository({ client } = {}) {
  const storage = () => {
    if (!client?.storage || !client?.rpc) throw new Error('supabase-unavailable')
    return client.storage.from(BUCKET)
  }
  const check = isCurrent => { if (!isCurrent()) throw new Error('professional-photo-stale') }
  const cleanup = async (path, userId, isCurrent) => {
    if (!isCurrent() || !PATH.test(path || '') || path.split('/')[0] !== userId) return
    try { await storage().remove([path]) } catch { /* The pointer is already safely persisted. */ }
  }
  const save = async (path, isCurrent) => {
    check(isCurrent)
    let response
    try { response = await client.rpc('set_professional_photo', { p_path: path }) }
    catch { throw new Error('professional-photo-save') }
    check(isCurrent)
    if (response?.error || !response?.data) throw new Error('professional-photo-save')
    return normalizeProfessionalProfile(Array.isArray(response.data) ? response.data[0] : response.data)
  }
  const upload = async ({ userId, file, previousPath, isCurrent = () => true }) => {
    const extension = validateProfessionalPhoto(file)
    if (!new RegExp(`^${UUID}$`, 'i').test(userId || '')) throw new Error('professional-photo-owner')
    check(isCurrent)
    const path = `${userId}/${crypto.randomUUID()}.${extension}`
    const response = await storage().upload(path, file, { contentType: file.type, upsert: false })
    check(isCurrent)
    if (response?.error) throw new Error('professional-photo-upload')
    let profile
    try { profile = await save(path, isCurrent) }
    catch (error) { await cleanup(path, userId, isCurrent); throw error }
    await cleanup(previousPath, userId, isCurrent)
    check(isCurrent)
    return profile
  }
  const remove = async ({ userId, previousPath, isCurrent = () => true }) => {
    storage()
    const profile = await save(null, isCurrent)
    await cleanup(previousPath, userId, isCurrent)
    check(isCurrent)
    return profile
  }
  return Object.freeze({ upload, remove })
}
