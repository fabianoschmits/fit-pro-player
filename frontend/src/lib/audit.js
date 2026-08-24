// Rendering for the admin activity log (GET /api/admin/audit).
//
// The server stores reason codes, not sentences — `{ ev: 'auth.login.fail', msg: 'unknown-credential' }`
// rather than "someone tried a passkey we don't know". Turning those into English
// belongs here and not in Admin.jsx: it is the only part of the feature that can be wrong in a way
// a person sees, and as a plain module it is testable without mounting the dashboard.
//
// Like the rest of the admin screen this is English-only — the operator surface deliberately
// stays out of the per-language string packs (see the header of views/Admin.jsx). Times still
// follow the UI language, the way numbers and dates already do.
import { dateLocale, getLang } from './i18n-core.js'

const local = (english, portuguese) => getLang() === 'pt' ? portuguese : english

// The first segment of an event name is also the filter chip it belongs to.
export const auditCat = ev => String(ev || '').split('.')[0]

const LABELS = {
  'auth.login.ok': ['Signed in', 'Entrou'],
  'auth.login.fail': ['Sign-in failed', 'Falha ao entrar'],
  'auth.register.ok': ['Created a profile', 'Criou um perfil'],
  'auth.register.fail': ['Profile creation failed', 'Falha ao criar perfil'],
  'auth.register.denied': ['Signup refused', 'Cadastro recusado'],
  'auth.logout': ['Signed out', 'Saiu'],
  'auth.logout.all': ['Signed out everywhere', 'Saiu de todos os dispositivos'],
  'admin.user.disable': ['Disabled an account', 'Desativou uma conta'],
  'admin.user.enable': ['Re-enabled an account', 'Reativou uma conta'],
  'admin.invite.create': ['Created an invite code', 'Criou um código de convite'],
  'admin.invite.revoke': ['Revoked an invite code', 'Revogou um código de convite'],
  'admin.audit.clear': ['Cleared the activity log', 'Limpou o registro de atividades'],
  'admin.denied': ['Blocked from the admin dashboard', 'Acesso ao painel administrativo bloqueado']
}
// An unknown event is shown raw rather than dropped or rendered as "undefined": a dashboard
// that is one version behind the server should still say *something* truthful.
export const auditLabel = ev => LABELS[ev]
  ? local(LABELS[ev][0], LABELS[ev][1])
  : String(ev || local('Unknown event', 'Evento desconhecido'))

const REASONS = {
  'challenge-expired': ['the sign-in took too long and expired', 'a autenticação demorou demais e expirou'],
  'unknown-credential': ['unknown passkey', 'chave de acesso desconhecida'],
  'verify-error': ['the passkey could not be verified', 'não foi possível verificar a chave de acesso'],
  'not-verified': ['the passkey was rejected', 'a chave de acesso foi rejeitada'],
  'user-missing': ['the passkey points at a profile that no longer exists', 'a chave de acesso aponta para um perfil que não existe mais'],
  'account-disabled': ['the account is disabled', 'a conta está desativada'],
  'credential-exists': ['that passkey already belongs to a profile', 'essa chave de acesso já pertence a um perfil'],
  'invite-invalid': ['the invite code was used or revoked in the meantime', 'o código de convite foi utilizado ou revogado'],
  'invite-rejected': ['wrong or already-used invite code', 'código de convite incorreto ou já utilizado']
}
export const auditReason = msg => REASONS[msg]
  ? local(REASONS[msg][0], REASONS[msg][1])
  : (msg ? String(msg) : '')

// → { title, sub }. `sub` is the house "a · b · c" metadata line used by every list row.
export function auditLine(e) {
  if (!e) return { title: '', sub: '' }
  const parts = []
  if (e.name) parts.push(e.name)
  else if (e.uid) parts.push(e.uid)
  else if (!e.ok) parts.push(local('unknown caller', 'origem desconhecida'))
  if (e.tname) parts.push('→ ' + e.tname)
  // The reason codes and the invite codes share the msg field; only failures read as a reason.
  if (e.msg) parts.push(e.ok ? e.msg : auditReason(e.msg))
  if (e.ip) parts.push(e.ip)
  return { title: auditLabel(e.ev), sub: parts.join(' · ') }
}

// The activity log is the one place in the app that needs a clock, and fmtDate() renders none —
// it is used by every other view and is not worth changing for this.
export function fmtWhen(ts, now = Date.now()) {
  if (!ts) return ''
  const d = new Date(ts)
  const time = d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
  const n = new Date(now)
  const sameDay = d.toDateString() === n.toDateString()
  if (sameDay) return local('today ', 'hoje ') + time
  if (now - ts < 6 * 86400000 && ts <= now) return d.toLocaleDateString(dateLocale(), { weekday: 'short' }) + ' ' + time
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) + ' ' + time
}
