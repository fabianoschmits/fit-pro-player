export const FILTERS = Object.freeze({ ALL: 'all', WITH_PROGRAM: 'with-program', WITHOUT_PROGRAM: 'without-program' })

export function normalizeInviteCode(value) {
  return String(value || '').trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase()
}

export function inviteLink(origin, code) {
  const normalized = normalizeInviteCode(code)
  return `${String(origin || '').replace(/\/$/, '')}/#/invite/${encodeURIComponent(normalized)}`
}

export function filterStudents(students = [], query = '', filter = FILTERS.ALL) {
  const search = String(query || '').trim().toLocaleLowerCase()
  return students.filter(student => {
    const matchesQuery = !search || String(student.displayName || '').toLocaleLowerCase().includes(search)
    const hasProgram = Boolean(student.programId || student.programTitle)
    const matchesFilter = filter === FILTERS.WITH_PROGRAM ? hasProgram : filter === FILTERS.WITHOUT_PROGRAM ? !hasProgram : true
    return matchesQuery && matchesFilter
  })
}

export function studentStats(student = {}) {
  return { hasProgram: Boolean(student.programId || student.programTitle), lastStatus: student.lastExecutionStatus || null, lastExecutionAt: student.lastExecutionAt || null }
}

export function statusLabel(status) {
  return ({ pending: 'Pendente', active: 'Ativo', revoked: 'Revogado', completed: 'Concluído', in_progress: 'Em andamento', abandoned: 'Abandonado' })[status] || 'Desconhecido'
}

export function withTimeout(promise, milliseconds = 10000) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('request-timeout')), milliseconds) }),
  ]).finally(() => clearTimeout(timer))
}
