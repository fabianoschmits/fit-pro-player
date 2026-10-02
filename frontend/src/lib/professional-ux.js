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
  return t(({ pending: 'Pendente', active: 'Ativo', revoked: 'Revogado', completed: 'Concluído', in_progress: 'Em andamento', abandoned: 'Abandonado', replaced: 'Substituído', archived: 'Arquivado', unverified: 'não verificado' })[status] || 'Desconhecido')
}

export function attentionReasons(student = {}, now = new Date()) {
  if (!student.programId && !student.programTitle) return ['Sem programa ativo']
  const reasons = []
  const elapsed = now.getTime() - new Date(student.lastExecutionAt || student.relationshipCreatedAt || now).getTime()
  if (student.lastExecutionStatus === 'abandoned') reasons.push('Último treino abandonado')
  if (student.lastExecutionStatus === 'in_progress' && elapsed > 24 * 3600000) reasons.push('Treino em andamento há mais de 24 horas')
  if (elapsed >= 7 * 86400000) reasons.push(student.lastExecutionAt ? 'Sem treino há 7 dias' : 'Nenhum treino desde o vínculo há 7 dias')
  return reasons
}

export function professionalDate(value, time = false) {
  if (!value) return '—'
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(dateLocale(), { dateStyle: 'medium', ...(time ? { timeStyle: 'short' } : {}) }).format(date) : '—'
}

export function withTimeout(promise, milliseconds = 10000) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('request-timeout')), milliseconds) }),
  ]).finally(() => clearTimeout(timer))
}
import { t, dateLocale } from './i18n-core.js'
