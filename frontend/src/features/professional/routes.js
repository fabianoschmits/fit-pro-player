const ROOT = '/professional'
const DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
export const isProfessionalRoute = pathname => pathname === '/professional-profile' || pathname === ROOT || pathname.startsWith(`${ROOT}/`)
const segment = value => {
  if (value == null || String(value).trim() === '') throw new Error('A route identity is required')
  return encodeURIComponent(value)
}
/** Builds destinations only; it never selects, publishes or assigns a program. */
export function professionalPath({ kind, id, day, versionId, studentId }) {
  const simple = { home: ROOT, students: `${ROOT}/students`, programs: `${ROOT}/programs`, programNew: `${ROOT}/programs/new`, invites: `${ROOT}/invites`, profile: `${ROOT}/profile`, profileEdit: `${ROOT}/profile/edit`, exercises: `${ROOT}/exercises` }
  if (simple[kind]) return simple[kind]
  if (kind.startsWith('program')) {
    const base = `${ROOT}/programs/${segment(id)}`
    if (kind === 'program') return base
    if (kind === 'programEdit') return `${base}/edit`
    if (kind === 'programVersions') return `${base}/versions`
    if (kind === 'programVersion') return `${base}/versions/${segment(versionId)}`
    if (kind === 'programCompare') return `${base}/versions/compare`
    if (kind === 'programAssign') {
      const query = new URLSearchParams()
      if (versionId) query.set('version', versionId)
      if (studentId) query.set('student', studentId)
      return `${base}/assign${query.size ? `?${query}` : ''}`
    }
    if (kind === 'programWorkout' || kind === 'programWorkoutEdit') {
      if (!DAYS.has(day)) throw new Error('A valid workout day is required')
      return `${base}/${kind === 'programWorkout' ? 'workouts' : 'edit'}/${day}`
    }
  }
  if (kind.startsWith('student')) {
    const base = `${ROOT}/students/${segment(studentId || id)}`
    const suffix = { student: '', studentTraining: '/training', studentAssign: '/assign', studentHistory: '/history', studentProgress: '/progress' }
    if (Object.hasOwn(suffix, kind)) return base + suffix[kind]
    if (kind === 'studentExecution') return `${base}/history/${segment(id)}`
  }
  throw new Error(`Unknown professional route: ${kind}`)
}
/** Preserve exact legacy handoff identities, including section and invitation code. */
export function preserveProfessionalIdentity(destination, search = '') {
  const [path, existing = ''] = destination.split('?')
  if (!existing) return path + (search ? `?${search.replace(/^\?/, '')}` : '')
  const query = new URLSearchParams(existing)
  for (const [key, value] of new URLSearchParams(search)) if (!query.has(key)) query.append(key, value)
  return `${path}${query.size ? `?${query}` : ''}`
}
