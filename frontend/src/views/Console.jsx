import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createConsoleRepository, VERIFICATION_LABELS, verificationTone } from '../lib/console.js'
import { Button, TextArea, TextField } from '../components/ui.jsx'
import LineChart from '../components/LineChart.jsx'
import { ManagementAvatar, ManagementEmpty } from '../components/ManagementUI.jsx'
import useManagementNavVisibility from '../components/useManagementNavVisibility.js'

/* ── motion presets ──────────────────────────────────────── */
const EASE = [0.32, 0.72, 0, 1]
const SPRING = { type: 'spring', stiffness: 380, damping: 36 }
const FADE = { duration: 0.22, ease: EASE }

const pageVariants = {
  enter: dir => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: dir => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
}

/* ── data helpers ────────────────────────────────────────── */
const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function fmtDate(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(v) }
}
function fmtDateTime(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleString('pt-BR') } catch { return String(v) }
}

function routineNameById(routines, id) {
  if (!id || id === 'rest') return id === 'rest' ? 'Descanso' : '—'
  return (routines || []).find(r => String(r.id) === String(id))?.name || `Rotina ${id}`
}
function weekSchedule(training) {
  const week = training?.week || {}
  const routines = training?.routines || []
  return WEEK_LABELS.map((label, day) => {
    const id = week[String(day)] ?? week[day] ?? null
    return { day, label, name: id == null || id === '' ? null : routineNameById(routines, id) }
  })
}
function workoutVolumePoints(workouts) {
  return (workouts || []).map(w => {
    if (!w?.d) return null
    const sets = (w.entries || []).reduce((s, e) => s + (e.sets || []).filter(x => x.done !== false).length, 0)
    const t = Date.parse(`${w.d}T12:00:00`)
    return Number.isFinite(t) ? { t, y: sets, d: w.d } : null
  }).filter(Boolean).sort((a, b) => a.t - b.t)
}
function bodyweightPoints(rows) {
  return (rows || []).map(r => {
    const w = Number(r?.w)
    if (!r?.d || !Number.isFinite(w)) return null
    const t = Date.parse(`${r.d}T12:00:00`)
    return Number.isFinite(t) ? { t, y: w, d: r.d } : null
  }).filter(Boolean).sort((a, b) => a.t - b.t)
}

/* ── avatar initials ─────────────────────────────────────── */
function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function Avatar({ name, size = 44 }) {
  return (
    <motion.div
      className="cx-avatar"
      style={{ '--sz': `${size}px` }}
      whileTap={{ scale: 0.95 }}
    >
      {initials(name)}
    </motion.div>
  )
}

/* ── chip ────────────────────────────────────────────────── */
const TONE_CLASS = { ok: 'ok', success: 'ok', warn: 'warn', warning: 'warn', err: 'err', error: 'err', neutral: '' }

function Chip({ children, tone }) {
  const cls = TONE_CLASS[tone] || ''
  return <span className={`cx-chip${cls ? ` cx-chip--${cls}` : ''}`}>{children}</span>
}

/* ── kv pair ─────────────────────────────────────────────── */
function Kv({ label, value }) {
  return (
    <div className="cx-kv">
      <dt className="cx-kv-label">{label}</dt>
      <dd className="cx-kv-value">{value ?? '—'}</dd>
    </div>
  )
}

/* ── metric card ─────────────────────────────────────────── */
function MetricCard({ label, value, sub, accent, action, children }) {
  return (
    <motion.div className={`cx-metric-card${accent ? ' cx-metric-card--accent' : ''}`}
      whileTap={{ scale: 0.985 }} transition={SPRING}>
      <div className="cx-metric-top">
        <div>
          <div className="cx-metric-value">{value}</div>
          <div className="cx-metric-label">{label}</div>
          {sub && <div className="cx-metric-sub">{sub}</div>}
        </div>
        {action && <div className="cx-metric-action">{action}</div>}
      </div>
      {children}
    </motion.div>
  )
}

/* ── section title ───────────────────────────────────────── */
function SectionTitle({ children, action }) {
  return (
    <div className="cx-section-title">
      <span>{children}</span>
      {action}
    </div>
  )
}

/* ── surface card ────────────────────────────────────────── */
function Card({ children, className = '' }) {
  return <div className={`cx-card ${className}`.trim()}>{children}</div>
}

/* ── inline alert ─────────────────────────────────────────── */
function Alert({ children, onRetry }) {
  return (
    <div className="cx-alert" role="alert">
      <span>{children}</span>
      {onRetry && <button type="button" className="cx-alert-retry" onClick={onRetry}>Tentar novamente</button>}
    </div>
  )
}

/* ── empty state ─────────────────────────────────────────── */
function Empty({ title, sub }) {
  return (
    <div className="cx-empty">
      <div className="cx-empty-icon">—</div>
      <div className="cx-empty-title">{title}</div>
      {sub && <div className="cx-empty-sub">{sub}</div>}
    </div>
  )
}

/* ── loading dots ────────────────────────────────────────── */
function Loading({ label = 'A carregar…' }) {
  return <div className="cx-loading" role="status">{label}</div>
}

/* ═══════════════════════════════════════════════════════════
   NAV — animated pill indicator
═══════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { key: 'overview', label: 'Visão geral', to: '/console', exact: true },
  { key: 'users', label: 'Usuários', to: '/console/users' },
  { key: 'professionals', label: 'Profissionais', to: '/console/professionals' },
]

function activeKey(pathname) {
  if (pathname.startsWith('/console/professionals')) return 'professionals'
  if (pathname.startsWith('/console/users')) return 'users'
  return 'overview'
}

function ConsoleNav() {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  const cur = activeKey(pathname)

  return (
    <div className="cx-nav-wrap">
      <LayoutGroup id="cx-nav">
        <nav className="cx-nav" aria-label="Navegação da Central">
          {NAV_ITEMS.map(item => {
            const isActive = cur === item.key
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`cx-nav-item${isActive ? ' cx-nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.span
                    className="cx-nav-pill"
                    layoutId="cx-nav-indicator"
                    transition={reduced ? { duration: 0 } : SPRING}
                  />
                )}
                <span className="cx-nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </LayoutGroup>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SHELL
═══════════════════════════════════════════════════════════ */

function ConsoleShell({ children, back, backLabel = '← Voltar' }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  const isDetail = pathname.includes('/console/users/') || pathname.includes('/console/professionals/')

  return (
    <div className="cx-shell">
      {/* sticky header strip */}
      <div className="cx-header">
        {back
          ? (
            <Link to={back} className="cx-back-btn">
              <span aria-hidden="true">‹</span> {backLabel}
            </Link>
          )
          : <ConsoleNav />
        }
      </div>

      {/* page content with transition */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          className="cx-page-inner"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? false : { opacity: 0, y: -8 }}
          transition={FADE}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ACCESS
═══════════════════════════════════════════════════════════ */

function useConsoleAccess() {
  const auth = useAuth()
  const userId = auth.user?.id
  const repo = useMemo(() => createConsoleRepository({ client: getBrowserSupabaseClient() }), [])
  const [allowed, setAllowed] = useState(null)
  useEffect(() => {
    let live = true
    setAllowed(null)
    if (!userId) { setAllowed(false); return }
    repo.adminRole(userId).then(v => { if (live) setAllowed(v) }).catch(() => { if (live) setAllowed(false) })
    return () => { live = false }
  }, [userId, repo])
  return { userId, repo, allowed }
}

function AccessGate({ allowed, children }) {
  if (allowed === null) return (
    <ConsoleShell>
      <div className="cx-page-body"><Loading label="Verificando acesso…" /></div>
    </ConsoleShell>
  )
  if (!allowed) return (
    <ConsoleShell>
      <div className="cx-page-body">
        <Empty title="Sem acesso" sub="Esta área não está disponível para a sua conta." />
      </div>
    </ConsoleShell>
  )
  return children
}

/* ═══════════════════════════════════════════════════════════
   HOME — Visão geral
═══════════════════════════════════════════════════════════ */

export default function ConsoleHome() {
  const { userId, repo, allowed } = useConsoleAccess()
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const owner = useRef(userId)
  owner.current = userId

  const refresh = async () => {
    const id = userId; setBusy(true)
    try {
      const next = await repo.overview()
      if (owner.current === id) { setStats(next); setError('') }
    } catch { if (owner.current === id) setError('Não foi possível carregar o resumo.') }
    finally { if (owner.current === id) setBusy(false) }
  }

  useEffect(() => {
    owner.current = userId
    if (userId && allowed) refresh()
    return () => { owner.current = null }
  }, [userId, allowed])

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell>
        <div className="cx-page-body">
          <div className="cx-page-head">
            <h1 className="cx-page-title">Central</h1>
            <p className="cx-page-sub">Operação da plataforma</p>
          </div>

          {error && <Alert onRetry={refresh}>{error}</Alert>}
          {busy || !stats ? <Loading /> : (
            <>
              {/* hero metric */}
              <MetricCard
                label="Usuários totais"
                value={stats.userCount}
                accent
                sub={`+${stats.newUsers7d} nos últimos 7 dias`}
              />

              {/* 2-col grid */}
              <div className="cx-grid-2">
                <MetricCard label="Com conta" value={stats.accountUserCount} />
                <MetricCard label="Só local" value={stats.localUserCount} />
              </div>

              {/* professionals card */}
              <MetricCard
                label="Profissionais"
                value={stats.professionalCount}
                sub={stats.pendingVerificationCount > 0
                  ? `${stats.pendingVerificationCount} aguardando verificação`
                  : 'Nenhuma verificação pendente'}
                action={stats.pendingVerificationCount > 0 && (
                  <Link className="cx-pill-btn cx-pill-btn--accent" to="/console/professionals?status=pending">
                    Ver pendentes
                  </Link>
                )}
              />

              {/* danger */}
              {stats.suspendedCount > 0 && (
                <MetricCard label="Suspensos" value={stats.suspendedCount} />
              )}

              {/* quick links */}
              <SectionTitle>Atalhos</SectionTitle>
              <Card>
                <Link className="cx-list-action" to="/console/users">
                  <span>Gerir usuários</span>
                  <span className="cx-chevron">›</span>
                </Link>
                <Link className="cx-list-action" to="/console/users?kind=local">
                  <span>Somente locais <span className="cx-count">{stats.localUserCount}</span></span>
                  <span className="cx-chevron">›</span>
                </Link>
                <Link className="cx-list-action cx-list-action--last" to="/console/professionals">
                  <span>Gerir profissionais</span>
                  <span className="cx-chevron">›</span>
                </Link>
              </Card>
            </>
          )}
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}

/* ═══════════════════════════════════════════════════════════
   USERS — Lista
═══════════════════════════════════════════════════════════ */

export function ConsoleUsers() {
  const { userId, repo, allowed } = useConsoleAccess()
  const [params] = useSearchParams()
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState(params.get('kind') || '')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(50)
  const owner = useRef(userId)
  owner.current = userId

  const refresh = async () => {
    const id = userId; setBusy(true)
    try {
      const next = await repo.listUsers({ query, accountKind: kind || null, limit })
      if (owner.current === id) { setRows(next); setError('') }
    } catch { if (owner.current === id) setError('Não foi possível carregar os usuários.') }
    finally { if (owner.current === id) setBusy(false) }
  }

  useEffect(() => {
    owner.current = userId
    if (userId && allowed) refresh()
    return () => { owner.current = null }
  }, [userId, allowed, query, kind, limit])

  const filters = [['', 'Todos'], ['account', 'Com conta'], ['local', 'Só local']]

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell>
        <div className="cx-page-body">
          <div className="cx-page-head">
            <h1 className="cx-page-title">Usuários</h1>
            <p className="cx-page-sub">Contas registadas e uso local</p>
          </div>

          {/* search bar */}
          <div className="cx-search-wrap">
            <div className="cx-search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
            </div>
            <input
              className="cx-search"
              type="search"
              placeholder="Email, nome ou id…"
              value={query}
              onChange={e => { setQuery(e.target.value); setLimit(50) }}
              aria-label="Buscar usuário"
            />
          </div>

          {/* filter pills */}
          <div className="cx-filter-pills" role="group" aria-label="Filtro">
            {filters.map(([v, l]) => (
              <motion.button
                key={v || 'all'}
                type="button"
                aria-pressed={kind === v}
                className={`cx-filter-pill${kind === v ? ' cx-filter-pill--on' : ''}`}
                onClick={() => { setKind(v); setLimit(50) }}
                whileTap={{ scale: 0.95 }}
                transition={SPRING}
              >
                {l}
              </motion.button>
            ))}
          </div>

          {error && <Alert onRetry={refresh}>{error}</Alert>}

          {busy ? <Loading label="A carregar usuários…" />
            : !rows.length
              ? <Empty title="Nenhum resultado" sub="Ajuste a busca ou o filtro." />
              : (
                <>
                  <div className="cx-count-label">{rows.length} usuário{rows.length !== 1 ? 's' : ''}</div>
                  <Card>
                    {rows.map((user, i) => (
                      <motion.div key={user.userId} whileTap={{ scale: 0.985 }} transition={SPRING}>
                        <Link
                          className={`cx-user-row${i === rows.length - 1 ? ' cx-user-row--last' : ''}`}
                          to={`/console/users/${user.userId}`}
                        >
                          <Avatar name={user.displayName || user.email || 'Local'} />
                          <div className="cx-user-info">
                            <div className="cx-user-name">{user.displayName || user.email || 'Sem nome'}</div>
                            <div className="cx-user-meta">{user.email || 'Sem e-mail'}</div>
                            <div className="cx-user-badges">
                              <Chip tone={user.accountKind === 'local' ? 'warn' : 'ok'}>
                                {user.accountKind === 'local' ? 'Local' : 'Conta'}
                              </Chip>
                              {(user.roles || []).map(r => <Chip key={r}>{r}</Chip>)}
                              {user.suspendedAt && <Chip tone="err">Suspenso</Chip>}
                              {user.verificationStatus && (
                                <Chip tone={verificationTone(user.verificationStatus)}>
                                  {VERIFICATION_LABELS[user.verificationStatus] || user.verificationStatus}
                                </Chip>
                              )}
                            </div>
                          </div>
                          <div className="cx-user-right">
                            <div className="cx-user-date">{fmtDate(user.createdAt)}</div>
                            <div className="cx-chevron-lg" aria-hidden="true">›</div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </Card>
                  {rows.length >= limit && (
                    <button type="button" className="cx-load-more" onClick={() => setLimit(v => v + 50)}>
                      Carregar mais
                    </button>
                  )}
                </>
              )
          }
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}

/* ═══════════════════════════════════════════════════════════
   PROFESSIONALS — Lista
═══════════════════════════════════════════════════════════ */

export function ConsoleProfessionals() {
  const { userId, repo, allowed } = useConsoleAccess()
  const [params] = useSearchParams()
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(params.get('status') || '')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(50)
  const [acting, setActing] = useState('')
  const owner = useRef(userId)
  owner.current = userId

  const refresh = async () => {
    const id = userId; setBusy(true)
    try {
      const next = await repo.listProfessionals({ query, status: status || null, limit })
      if (owner.current === id) { setRows(next); setError('') }
    } catch { if (owner.current === id) setError('Não foi possível carregar os profissionais.') }
    finally { if (owner.current === id) setBusy(false) }
  }

  useEffect(() => {
    owner.current = userId
    if (userId && allowed) refresh()
    return () => { owner.current = null }
  }, [userId, allowed, query, status, limit])

  const setVerification = async (targetId, nextStatus) => {
    setActing(`${targetId}:${nextStatus}`)
    try { await repo.setVerification(targetId, nextStatus); await refresh() }
    catch { setError('Não foi possível atualizar a verificação.') }
    finally { setActing('') }
  }

  const filters = [
    ['', 'Todos'], ['pending', 'Pendentes'], ['verified', 'Verificados'],
    ['unverified', 'Não verif.'], ['rejected', 'Rejeitados'],
  ]

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell>
        <div className="cx-page-body">
          <div className="cx-page-head">
            <h1 className="cx-page-title">Profissionais</h1>
            <p className="cx-page-sub">Verificação e perfis profissionais</p>
          </div>

          {/* search */}
          <div className="cx-search-wrap">
            <div className="cx-search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
            </div>
            <input
              className="cx-search"
              type="search"
              placeholder="Nome, email ou id…"
              value={query}
              onChange={e => { setQuery(e.target.value); setLimit(50) }}
              aria-label="Buscar profissional"
            />
          </div>

          {/* filter pills */}
          <div className="cx-filter-pills" role="group" aria-label="Filtro">
            {filters.map(([v, l]) => (
              <motion.button key={v || 'all'} type="button" aria-pressed={status === v}
                className={`cx-filter-pill${status === v ? ' cx-filter-pill--on' : ''}`}
                onClick={() => { setStatus(v); setLimit(50) }}
                whileTap={{ scale: 0.95 }} transition={SPRING}
              >{l}</motion.button>
            ))}
          </div>

          {error && <Alert onRetry={refresh}>{error}</Alert>}

          {busy ? <Loading label="A carregar profissionais…" />
            : !rows.length
              ? <Empty title="Nenhum resultado" sub="Ajuste a busca ou o filtro." />
              : (
                <>
                  <div className="cx-count-label">{rows.length} profissional{rows.length !== 1 ? 'is' : ''}</div>
                  {rows.map((pro, i) => (
                    <motion.div
                      key={pro.userId}
                      className={`cx-pro-card${i < rows.length - 1 ? '' : ''}`}
                      whileTap={{ scale: 0.985 }}
                      transition={SPRING}
                    >
                      <div className="cx-pro-top">
                        <Avatar name={pro.professionalName || pro.displayName || pro.email} size={46} />
                        <div className="cx-user-info">
                          <div className="cx-user-name">{pro.professionalName || pro.displayName || 'Profissional'}</div>
                          <div className="cx-user-meta">{pro.email}{pro.cityRegion ? ` · ${pro.cityRegion}` : ''}</div>
                          <div className="cx-user-badges">
                            <Chip tone={verificationTone(pro.verificationStatus)}>
                              {VERIFICATION_LABELS[pro.verificationStatus] || pro.verificationStatus}
                            </Chip>
                            <Chip>{pro.studentLinks} aluno{pro.studentLinks !== 1 ? 's' : ''}</Chip>
                            {pro.suspendedAt && <Chip tone="err">Suspenso</Chip>}
                          </div>
                        </div>
                      </div>
                      <div className="cx-pro-actions">
                        <Link className="cx-pill-btn" to={`/console/users/${pro.userId}`}>Ver perfil</Link>
                        {pro.verificationStatus !== 'verified' && (
                          <motion.button type="button" className="cx-pill-btn cx-pill-btn--accent"
                            disabled={acting === `${pro.userId}:verified`}
                            onClick={() => setVerification(pro.userId, 'verified')}
                            whileTap={{ scale: 0.95 }}
                          >Aprovar</motion.button>
                        )}
                        {pro.verificationStatus !== 'rejected' && (
                          <motion.button type="button" className="cx-pill-btn cx-pill-btn--danger"
                            disabled={acting === `${pro.userId}:rejected`}
                            onClick={() => setVerification(pro.userId, 'rejected')}
                            whileTap={{ scale: 0.95 }}
                          >Rejeitar</motion.button>
                        )}
                        {pro.verificationStatus !== 'pending' && (
                          <motion.button type="button" className="cx-pill-btn"
                            disabled={acting === `${pro.userId}:pending`}
                            onClick={() => setVerification(pro.userId, 'pending')}
                            whileTap={{ scale: 0.95 }}
                          >Pendente</motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {rows.length >= limit && (
                    <button type="button" className="cx-load-more" onClick={() => setLimit(v => v + 50)}>
                      Carregar mais
                    </button>
                  )}
                </>
              )
          }
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}

/* ═══════════════════════════════════════════════════════════
   USER DETAIL PAGE
═══════════════════════════════════════════════════════════ */

export function ConsoleUserPage() {
  const { userId: targetId } = useParams()
  const navigate = useNavigate()
  const { userId, repo, allowed } = useConsoleAccess()
  const [user, setUser] = useState(null)
  const [training, setTraining] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [proName, setProName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [regType, setRegType] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [specialtiesText, setSpecialtiesText] = useState('')
  const [acting, setActing] = useState('')
  const owner = useRef(userId)
  owner.current = userId

  const refresh = async () => {
    const id = userId; setBusy(true)
    try {
      const [next, nextT] = await Promise.all([repo.userDetail(targetId), repo.userTraining(targetId)])
      if (owner.current === id) {
        setUser(next); setTraining(nextT)
        setDisplayName(next?.displayName || nextT?.profile?.name || '')
        setProName(next?.professionalName || '')
        setBio(next?.bio || ''); setCity(next?.cityRegion || '')
        setRegType(next?.registrationType || ''); setRegNumber(next?.registrationNumber || '')
        setSpecialtiesText((next?.specialties || []).join(', '))
        setError(next ? '' : 'Usuário não encontrado.')
      }
    } catch { if (owner.current === id) setError('Não foi possível carregar o usuário.') }
    finally { if (owner.current === id) setBusy(false) }
  }

  useEffect(() => {
    owner.current = userId
    if (userId && allowed && targetId) refresh()
    return () => { owner.current = null }
  }, [userId, allowed, targetId])

  const run = async (key, action, success) => {
    setActing(key); setMessage('')
    try { await action(); setMessage(success); await refresh() }
    catch (err) { setError(err?.message || 'A operação falhou.') }
    finally { setActing('') }
  }

  const isPro = (user?.roles || []).includes('professional')
  const isAdmin = (user?.roles || []).includes('admin')
  const profile = training?.profile || {}
  const schedule = weekSchedule(training)
  const volumePoints = workoutVolumePoints(training?.recentWorkouts)
  const weightPoints = bodyweightPoints(training?.bodyweight)
  const pageTitle = user?.displayName || profile.name || user?.email || 'Usuário'
  const hasSnapshot = training?.hasSnapshot

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell back="/console/users" backLabel="Usuários">
        <div className="cx-page-body">

          {error && <Alert>{error}</Alert>}
          {message && <div className="cx-success" role="status">{message}</div>}

          {busy || !user ? <Loading /> : (
            <>
              {/* ── hero ── */}
              <div className="cx-hero">
                <Avatar name={pageTitle} size={64} />
                <div className="cx-hero-body">
                  <div className="cx-hero-name">{pageTitle}</div>
                  {user.email && <div className="cx-hero-email">{user.email}</div>}
                  <div className="cx-user-badges cx-mt-4">
                    <Chip tone={user.accountKind === 'local' ? 'warn' : 'ok'}>
                      {user.accountKind === 'local' ? 'Local' : 'Conta'}
                    </Chip>
                    {(user.roles || []).map(r => <Chip key={r}>{r}</Chip>)}
                    {user.suspendedAt && <Chip tone="err">Suspenso</Chip>}
                  </div>
                </div>
              </div>

              {/* ── conta + perfil lado a lado ── */}
              <div className="cx-grid-2">
                <Card>
                  <div className="cx-section-label">Conta</div>
                  <dl className="cx-kv-list">
                    <Kv label="Criado" value={fmtDate(user.createdAt)} />
                    <Kv label="Tipo" value={user.accountKind === 'local' ? 'Anónimo' : 'Email'} />
                    <Kv label="Vínculos" value={`${user.studentLinks} aluno · ${user.professionalLinks} prof.`} />
                    <Kv label="ID" value={<code className="cx-code">{user.userId?.slice(0, 12)}…</code>} />
                  </dl>
                </Card>

                <Card>
                  <div className="cx-section-label">Treino</div>
                  {!hasSnapshot
                    ? <p className="cx-muted">Sem dados ainda.</p>
                    : <dl className="cx-kv-list">
                      <Kv label="Sexo" value={profile.sex} />
                      <Kv label="Altura" value={profile.heightCm != null ? `${profile.heightCm} cm` : null} />
                      <Kv label="Peso inicial" value={profile.startWeight != null ? `${profile.startWeight} kg` : null} />
                      <Kv label="Objetivo" value={profile.goal} />
                      <Kv label="Treinos" value={training.workoutCount} />
                      <Kv label="Sync" value={fmtDate(training.snapshotUpdatedAt)} />
                    </dl>
                  }
                </Card>
              </div>

              {/* ── gráficos ── */}
              {hasSnapshot && (
                <div className="cx-grid-2">
                  <Card>
                    <div className="cx-section-label">
                      Peso corporal
                      {weightPoints.length > 0 && <span className="cx-count">{weightPoints.length}</span>}
                    </div>
                    {weightPoints.length
                      ? <div className="cx-chart-wrap"><LineChart points={weightPoints} unit="kg" h={100} label="Peso" /></div>
                      : <p className="cx-muted">Sem pesagens.</p>}
                  </Card>

                  <Card>
                    <div className="cx-section-label">
                      Séries / treino
                      {volumePoints.length > 0 && <span className="cx-count">{volumePoints.length}</span>}
                    </div>
                    {volumePoints.length
                      ? <div className="cx-chart-wrap"><LineChart points={volumePoints} unit="séries" h={100} label="Séries" /></div>
                      : <p className="cx-muted">Sem treinos.</p>}
                  </Card>
                </div>
              )}

              {/* ── rotina semanal ── */}
              {hasSnapshot && (
                <Card>
                  <div className="cx-section-label">Rotina semanal</div>
                  <div className="cx-week-strip">
                    {schedule.map(day => (
                      <div key={day.day} className={`cx-week-day${day.name ? ' cx-week-day--on' : ''}`}>
                        <span className="cx-week-abbr">{day.label}</span>
                        <span className="cx-week-name">{day.name || '·'}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── últimos treinos ── */}
              {hasSnapshot && !!(training.recentWorkouts || []).length && (
                <Card>
                  <div className="cx-section-label">
                    Últimos treinos
                    <span className="cx-count">{training.workoutCount} total</span>
                  </div>
                  {(training.recentWorkouts || []).slice(0, 10).map((w, i) => {
                    const entries = w.entries || []
                    const sets = entries.reduce((s, e) => s + (e.sets || []).length, 0)
                    return (
                      <div key={w.id || `${w.d}-${i}`} className={`cx-list-row${i === Math.min(9, (training.recentWorkouts || []).length - 1) ? ' cx-list-row--last' : ''}`}>
                        <span className="cx-list-main">{fmtDate(w.d)}</span>
                        <span className="cx-list-meta">{entries.length} ex · {sets} séries</span>
                      </div>
                    )
                  })}
                </Card>
              )}

              {/* ── editar nome ── */}
              <Card>
                <div className="cx-section-label">Nome de exibição</div>
                <div className="cx-inline-form">
                  <input
                    className="cx-field"
                    type="text"
                    aria-label="Nome de exibição"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                  <motion.button
                    type="button"
                    className="cx-pill-btn cx-pill-btn--accent"
                    disabled={acting === 'name'}
                    onClick={() => run('name', () => repo.setDisplayName(user.userId, displayName), 'Nome atualizado.')}
                    whileTap={{ scale: 0.95 }}
                  >Guardar</motion.button>
                </div>
              </Card>

              {/* ── ações da conta ── */}
              <Card>
                <div className="cx-section-label">Ações</div>
                <div className="cx-action-list">
                  <motion.button type="button" className="cx-action-item cx-action-item--primary"
                    disabled={acting === 'pro' || isAdmin}
                    onClick={() => run('pro', () => repo.setProfessionalRole(user.userId, !isPro),
                      isPro ? 'Role profissional removida.' : 'Role profissional concedida.')}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isPro ? 'Remover role profissional' : 'Conceder role profissional'}
                  </motion.button>

                  {!isAdmin && (
                    <motion.button type="button" className="cx-action-item"
                      disabled={acting === 'suspend'}
                      onClick={() => run('suspend', () => repo.setSuspended(user.userId, !user.suspendedAt),
                        user.suspendedAt ? 'Conta reativada.' : 'Conta suspensa.')}
                      whileTap={{ scale: 0.98 }}
                    >
                      {user.suspendedAt ? 'Reativar conta' : 'Suspender conta'}
                    </motion.button>
                  )}

                  {!isAdmin && user.userId !== userId && (
                    <motion.button type="button" className="cx-action-item cx-action-item--danger"
                      disabled={acting === 'delete'}
                      onClick={() => {
                        if (!window.confirm('Apagar permanentemente esta conta? Esta ação não pode ser desfeita.')) return
                        run('delete', async () => { await repo.deleteUser(user.userId); navigate('/console/users') }, 'Conta apagada.')
                      }}
                      whileTap={{ scale: 0.98 }}
                    >Apagar conta</motion.button>
                  )}
                </div>
              </Card>

              {/* ── perfil profissional ── */}
              {(user.professionalName != null || isPro) && (
                <Card>
                  <div className="cx-section-label">
                    Perfil profissional
                    {user.verificationStatus && (
                      <Chip tone={verificationTone(user.verificationStatus)}>
                        {VERIFICATION_LABELS[user.verificationStatus] || user.verificationStatus}
                      </Chip>
                    )}
                  </div>
                  <div className="cx-form-grid">
                    <label className="cx-label">Nome profissional
                      <input className="cx-field" type="text" value={proName} onChange={e => setProName(e.target.value)} />
                    </label>
                    <label className="cx-label">Cidade / região
                      <input className="cx-field" type="text" value={city} onChange={e => setCity(e.target.value)} />
                    </label>
                    <label className="cx-label">Tipo de registo
                      <input className="cx-field" type="text" value={regType} onChange={e => setRegType(e.target.value)} />
                    </label>
                    <label className="cx-label">Número de registo
                      <input className="cx-field" type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)} />
                    </label>
                    <label className="cx-label cx-span-2">Especialidades (vírgula)
                      <input className="cx-field" type="text" value={specialtiesText} onChange={e => setSpecialtiesText(e.target.value)} />
                    </label>
                    <label className="cx-label cx-span-2">Bio
                      <textarea className="cx-field cx-field--ta" rows={3} value={bio} onChange={e => setBio(e.target.value)} />
                    </label>
                  </div>
                  <div className="cx-action-list cx-action-list--row cx-mt-12">
                    <motion.button type="button" className="cx-pill-btn cx-pill-btn--accent"
                      disabled={acting === 'pro-save'}
                      onClick={() => run('pro-save', () => repo.updateProfessionalProfile(user.userId, {
                        professionalName: proName, bio, cityRegion: city,
                        registrationType: regType, registrationNumber: regNumber,
                        specialties: specialtiesText.split(',').map(p => p.trim().toLowerCase()).filter(Boolean),
                      }), 'Perfil atualizado.')}
                      whileTap={{ scale: 0.95 }}
                    >Guardar</motion.button>
                    {user.verificationStatus !== 'verified' && (
                      <motion.button type="button" className="cx-pill-btn"
                        disabled={acting === 'verify'}
                        onClick={() => run('verify', () => repo.setVerification(user.userId, 'verified'), 'Aprovado.')}
                        whileTap={{ scale: 0.95 }}
                      >Aprovar</motion.button>
                    )}
                    {user.verificationStatus !== 'rejected' && (
                      <motion.button type="button" className="cx-pill-btn cx-pill-btn--danger"
                        disabled={acting === 'reject'}
                        onClick={() => run('reject', () => repo.setVerification(user.userId, 'rejected'), 'Rejeitado.')}
                        whileTap={{ scale: 0.95 }}
                      >Rejeitar</motion.button>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}
