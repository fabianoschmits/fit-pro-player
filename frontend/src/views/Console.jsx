import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createConsoleRepository, VERIFICATION_LABELS, verificationTone } from '../lib/console.js'
import { Button, TextArea, TextField } from '../components/ui.jsx'
import LineChart from '../components/LineChart.jsx'
import { ManagementAvatar, ManagementStatus, ManagementEmpty } from '../components/ManagementUI.jsx'
import useManagementNavVisibility from '../components/useManagementNavVisibility.js'

/* ─── helpers ─────────────────────────────────────────────── */

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function fmtDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(value) }
}

function fmtDateTime(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString('pt-BR') } catch { return String(value) }
}

function routineNameById(routines, id) {
  if (!id || id === 'rest') return id === 'rest' ? 'Descanso' : '—'
  const found = (routines || []).find(r => String(r.id) === String(id))
  return found?.name || `Rotina ${id}`
}

function weekSchedule(training) {
  const week = training?.week || {}
  const routines = training?.routines || []
  return WEEK_LABELS.map((label, day) => {
    const routineId = week[String(day)] ?? week[day] ?? null
    const name = routineId == null || routineId === '' ? null : routineNameById(routines, routineId)
    return { day, label, name }
  })
}

function workoutVolumePoints(workouts) {
  return (workouts || [])
    .map(w => {
      if (!w?.d) return null
      const sets = (w.entries || []).reduce((s, e) => s + (e.sets || []).filter(x => x.done !== false).length, 0)
      const t = Date.parse(`${w.d}T12:00:00`)
      return Number.isFinite(t) ? { t, y: sets, d: w.d } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
}

function bodyweightPoints(rows) {
  return (rows || [])
    .map(r => {
      const w = Number(r?.w)
      if (!r?.d || !Number.isFinite(w)) return null
      const t = Date.parse(`${r.d}T12:00:00`)
      return Number.isFinite(t) ? { t, y: w, d: r.d } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
}

/* ─── shared UI primitives ────────────────────────────────── */

function Card({ children, className = '' }) {
  return <div className={`cx-card ${className}`}>{children}</div>
}

function CardHead({ title, sub, action }) {
  return (
    <div className="cx-card-head">
      <div>
        <h2 className="cx-card-title">{title}</h2>
        {sub && <p className="cx-card-sub">{sub}</p>}
      </div>
      {action && <div className="cx-card-action">{action}</div>}
    </div>
  )
}

function Kv({ label, value }) {
  return (
    <div className="cx-kv">
      <dt className="cx-kv-label">{label}</dt>
      <dd className="cx-kv-value">{value ?? '—'}</dd>
    </div>
  )
}

function KvGrid({ children }) {
  return <dl className="cx-kv-grid">{children}</dl>
}

function Chip({ children, tone }) {
  return <span className={`cx-chip${tone ? ` cx-chip--${tone}` : ''}`}>{children}</span>
}

function StatRow({ items }) {
  return (
    <div className="cx-stat-row">
      {items.map(({ label, value, accent }) => (
        <div key={label} className={`cx-stat-pill${accent ? ' cx-stat-pill--accent' : ''}`}>
          <span className="cx-stat-num">{value}</span>
          <span className="cx-stat-lbl">{label}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── nav ─────────────────────────────────────────────────── */

function ConsoleNav() {
  const navRef = useManagementNavVisibility()
  const { pathname } = useLocation()
  const overview = pathname === '/console'
  const users = pathname.startsWith('/console/users')
  const pros = pathname.startsWith('/console/professionals')
  return (
    <div className="console-mobile-nav">
      <nav ref={navRef} className="management-nav" aria-label="Navegação da Central">
        <Link to="/console" aria-current={overview ? 'page' : undefined}>Visão geral</Link>
        <Link to="/console/users" aria-current={users ? 'page' : undefined}>Usuários</Link>
        <Link to="/console/professionals" aria-current={pros ? 'page' : undefined}>Profissionais</Link>
      </nav>
    </div>
  )
}

function ConsoleShell({ title, subtitle, children, action, back }) {
  return (
    <div className="narrow cx-page">
      <ConsoleNav />
      <div className="hdr home-titlebar">
        <div>
          <h1>{title}</h1>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
        <div className="cx-title-actions">
          {back && <Link className="cx-btn cx-btn--ghost" to={back}>← Voltar</Link>}
          {action}
        </div>
      </div>
      <div className="cx-content">
        {children}
      </div>
    </div>
  )
}

/* ─── access ──────────────────────────────────────────────── */

function useConsoleAccess() {
  const auth = useAuth()
  const userId = auth.user?.id
  const repo = useMemo(() => createConsoleRepository({ client: getBrowserSupabaseClient() }), [])
  const [allowed, setAllowed] = useState(null)
  useEffect(() => {
    let current = true
    setAllowed(null)
    if (!userId) { setAllowed(false); return undefined }
    repo.adminRole(userId).then(v => { if (current) setAllowed(v) }).catch(() => { if (current) setAllowed(false) })
    return () => { current = false }
  }, [userId, repo])
  return { userId, repo, allowed }
}

function AccessGate({ allowed, children }) {
  if (allowed === null) return (
    <ConsoleShell title="Central" subtitle="Verificando acesso…">
      <p role="status" className="cx-loading">A verificar permissões…</p>
    </ConsoleShell>
  )
  if (!allowed) return (
    <ConsoleShell title="Central" subtitle="Área restrita">
      <Card><ManagementEmpty title="Sem acesso" description="Esta área não está disponível para a sua conta." /></Card>
    </ConsoleShell>
  )
  return children
}

/* ══════════════════════════════════════════════════════════
   HOME — Visão geral
══════════════════════════════════════════════════════════ */

export default function ConsoleHome() {
  const { userId, repo, allowed } = useConsoleAccess()
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const owner = useRef(userId)
  owner.current = userId

  const refresh = async () => {
    const id = userId
    setBusy(true)
    try {
      const next = await repo.overview()
      if (owner.current === id) { setStats(next); setError('') }
    } catch {
      if (owner.current === id) setError('Não foi possível carregar a visão geral.')
    } finally {
      if (owner.current === id) setBusy(false)
    }
  }

  useEffect(() => {
    owner.current = userId
    if (userId && allowed) refresh()
    return () => { owner.current = null }
  }, [userId, allowed])

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell title="Central" subtitle="Operação da plataforma">
        {error && <p role="alert" className="cx-alert">{error} <button type="button" className="link" onClick={refresh}>Tentar novamente</button></p>}

        {busy || !stats ? <p role="status" className="cx-loading">A carregar…</p> : <>

          {/* ── Métricas principais ── */}
          <Card>
            <CardHead title="Usuários" />
            <StatRow items={[
              { label: 'Total', value: stats.userCount, accent: true },
              { label: 'Com conta', value: stats.accountUserCount },
              { label: 'Só local', value: stats.localUserCount },
              { label: 'Novos 7d', value: stats.newUsers7d },
            ]} />
          </Card>

          {/* ── Profissionais e alertas ── */}
          <div className="cx-row-2">
            <Card>
              <CardHead title="Profissionais" />
              <StatRow items={[
                { label: 'Total', value: stats.professionalCount, accent: true },
                { label: 'Pendentes', value: stats.pendingVerificationCount },
              ]} />
              {stats.pendingVerificationCount > 0 && (
                <Link className="cx-btn cx-btn--primary cx-btn--sm cx-mt" to="/console/professionals?status=pending">
                  Ver {stats.pendingVerificationCount} pendente(s) →
                </Link>
              )}
            </Card>

            <Card>
              <CardHead title="Estado da plataforma" />
              <StatRow items={[
                { label: 'Suspensos', value: stats.suspendedCount },
              ]} />
              <div className="cx-link-list cx-mt">
                <Link className="cx-btn cx-btn--ghost cx-btn--sm" to="/console/users">Gerir usuários →</Link>
                <Link className="cx-btn cx-btn--ghost cx-btn--sm" to="/console/users?kind=local">Usuários locais ({stats.localUserCount}) →</Link>
                <Link className="cx-btn cx-btn--ghost cx-btn--sm" to="/console/professionals">Gerir profissionais →</Link>
              </div>
            </Card>
          </div>

        </>}
      </ConsoleShell>
    </AccessGate>
  )
}

/* ══════════════════════════════════════════════════════════
   USERS — Lista
══════════════════════════════════════════════════════════ */

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
    const id = userId
    setBusy(true)
    try {
      const next = await repo.listUsers({ query, accountKind: kind || null, limit })
      if (owner.current === id) { setRows(next); setError('') }
    } catch {
      if (owner.current === id) setError('Não foi possível carregar os usuários.')
    } finally {
      if (owner.current === id) setBusy(false)
    }
  }

  useEffect(() => {
    owner.current = userId
    if (userId && allowed) refresh()
    return () => { owner.current = null }
  }, [userId, allowed, query, kind, limit])

  const filters = [['', 'Todos'], ['account', 'Com conta'], ['local', 'Só local']]

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell title="Usuários" subtitle="Contas registadas e uso local">
        {error && <p role="alert" className="cx-alert">{error} <button type="button" className="link" onClick={refresh}>Tentar novamente</button></p>}

        {/* toolbar */}
        <Card>
          <div className="cx-toolbar">
            <TextField aria-label="Buscar usuário" placeholder="Email, nome ou id…" value={query}
              onChange={e => { setQuery(e.target.value); setLimit(50) }} />
            <div className="cx-pills" role="group" aria-label="Filtro">
              {filters.map(([v, l]) => (
                <button type="button" key={v || 'all'} aria-pressed={kind === v}
                  className={`cx-pill${kind === v ? ' cx-pill--on' : ''}`}
                  onClick={() => { setKind(v); setLimit(50) }}>{l}</button>
              ))}
            </div>
          </div>
        </Card>

        {busy
          ? <p role="status" className="cx-loading">A carregar usuários…</p>
          : !rows.length
            ? <Card><p className="cx-empty-msg">Nenhum resultado. Ajuste a busca ou o filtro.</p></Card>
            : <Card>
              <CardHead title={`${rows.length} usuário${rows.length !== 1 ? 's' : ''}`} />
              <div className="cx-user-list">
                {rows.map(user => (
                  <Link className="cx-user-row" to={`/console/users/${user.userId}`} key={user.userId}>
                    <ManagementAvatar name={user.displayName || user.email || 'Local'} />
                    <div className="cx-user-info">
                      <strong>{user.displayName || user.email || 'Sem nome'}</strong>
                      <span className="cx-user-email">{user.email || 'Sem e-mail'}</span>
                      <div className="cx-chips-row">
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
                    <span className="cx-user-date">{fmtDate(user.createdAt)}</span>
                    <span className="cx-chevron" aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>
              {rows.length >= limit && (
                <Button onClick={() => setLimit(v => v + 50)} className="cx-mt">Carregar mais</Button>
              )}
            </Card>
        }
      </ConsoleShell>
    </AccessGate>
  )
}

/* ══════════════════════════════════════════════════════════
   PROFESSIONALS — Lista
══════════════════════════════════════════════════════════ */

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
    const id = userId
    setBusy(true)
    try {
      const next = await repo.listProfessionals({ query, status: status || null, limit })
      if (owner.current === id) { setRows(next); setError('') }
    } catch {
      if (owner.current === id) setError('Não foi possível carregar os profissionais.')
    } finally {
      if (owner.current === id) setBusy(false)
    }
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
    ['unverified', 'Não verificados'], ['rejected', 'Rejeitados'],
  ]

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell title="Profissionais" subtitle="Verificação e perfis profissionais">
        {error && <p role="alert" className="cx-alert">{error} <button type="button" className="link" onClick={refresh}>Tentar novamente</button></p>}

        <Card>
          <div className="cx-toolbar">
            <TextField aria-label="Buscar profissional" placeholder="Nome, email ou id…" value={query}
              onChange={e => { setQuery(e.target.value); setLimit(50) }} />
            <div className="cx-pills" role="group" aria-label="Filtro">
              {filters.map(([v, l]) => (
                <button type="button" key={v || 'all'} aria-pressed={status === v}
                  className={`cx-pill${status === v ? ' cx-pill--on' : ''}`}
                  onClick={() => { setStatus(v); setLimit(50) }}>{l}</button>
              ))}
            </div>
          </div>
        </Card>

        {busy
          ? <p role="status" className="cx-loading">A carregar profissionais…</p>
          : !rows.length
            ? <Card><p className="cx-empty-msg">Nenhum resultado. Ajuste a busca ou o filtro.</p></Card>
            : <Card>
              <CardHead title={`${rows.length} profissional${rows.length !== 1 ? 'is' : ''}`} />
              <div className="cx-user-list">
                {rows.map(pro => (
                  <div className="cx-user-row cx-user-row--expanded" key={pro.userId}>
                    <ManagementAvatar name={pro.professionalName || pro.displayName || pro.email} />
                    <div className="cx-user-info">
                      <strong>{pro.professionalName || pro.displayName || 'Profissional'}</strong>
                      <span className="cx-user-email">{pro.email}{pro.cityRegion ? ` · ${pro.cityRegion}` : ''}</span>
                      <div className="cx-chips-row">
                        <Chip tone={verificationTone(pro.verificationStatus)}>
                          {VERIFICATION_LABELS[pro.verificationStatus] || pro.verificationStatus}
                        </Chip>
                        <Chip>{pro.studentLinks} aluno(s)</Chip>
                        {pro.suspendedAt && <Chip tone="err">Suspenso</Chip>}
                      </div>
                      <div className="cx-pro-actions">
                        <Link className="cx-btn cx-btn--ghost cx-btn--sm" to={`/console/users/${pro.userId}`}>Ver perfil</Link>
                        {pro.verificationStatus !== 'verified' && (
                          <Button variant="primary" size="sm" disabled={acting === `${pro.userId}:verified`}
                            onClick={() => setVerification(pro.userId, 'verified')}>Aprovar</Button>
                        )}
                        {pro.verificationStatus !== 'rejected' && (
                          <Button size="sm" disabled={acting === `${pro.userId}:rejected`}
                            onClick={() => setVerification(pro.userId, 'rejected')}>Rejeitar</Button>
                        )}
                        {pro.verificationStatus !== 'pending' && (
                          <Button size="sm" disabled={acting === `${pro.userId}:pending`}
                            onClick={() => setVerification(pro.userId, 'pending')}>Marcar pendente</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {rows.length >= limit && <Button onClick={() => setLimit(v => v + 50)} className="cx-mt">Carregar mais</Button>}
            </Card>
        }
      </ConsoleShell>
    </AccessGate>
  )
}

/* ══════════════════════════════════════════════════════════
   USER PAGE — Detalhe
══════════════════════════════════════════════════════════ */

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
    const id = userId
    setBusy(true)
    try {
      const [next, nextTraining] = await Promise.all([
        repo.userDetail(targetId),
        repo.userTraining(targetId),
      ])
      if (owner.current === id) {
        setUser(next)
        setTraining(nextTraining)
        setDisplayName(next?.displayName || nextTraining?.profile?.name || '')
        setProName(next?.professionalName || '')
        setBio(next?.bio || '')
        setCity(next?.cityRegion || '')
        setRegType(next?.registrationType || '')
        setRegNumber(next?.registrationNumber || '')
        setSpecialtiesText((next?.specialties || []).join(', '))
        setError(next ? '' : 'Usuário não encontrado.')
      }
    } catch {
      if (owner.current === id) setError('Não foi possível carregar o usuário.')
    } finally {
      if (owner.current === id) setBusy(false)
    }
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
      <ConsoleShell title={pageTitle} subtitle="Perfil e dados de treino" back="/console/users">
        {error && <p role="alert" className="cx-alert">{error}</p>}
        {message && <p role="status" className="cx-success">{message}</p>}

        {busy || !user
          ? <p role="status" className="cx-loading">A carregar…</p>
          : <>
            {/* ── Cabeçalho com avatar e status ── */}
            <Card className="cx-user-hero">
              <div className="cx-hero-row">
                <ManagementAvatar name={pageTitle} />
                <div className="cx-hero-info">
                  <h2 className="cx-hero-name">{pageTitle}</h2>
                  {user.email && <p className="cx-hero-email">{user.email}</p>}
                  <div className="cx-chips-row">
                    <Chip tone={user.accountKind === 'local' ? 'warn' : 'ok'}>
                      {user.accountKind === 'local' ? 'Local' : 'Conta registada'}
                    </Chip>
                    {(user.roles || []).map(r => <Chip key={r}>{r}</Chip>)}
                    {user.suspendedAt && <Chip tone="err">Suspenso</Chip>}
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Conta + Perfil: lado a lado ── */}
            <div className="cx-row-2">
              <Card>
                <CardHead title="Conta" />
                <KvGrid>
                  <Kv label="ID" value={<code className="cx-code">{user.userId}</code>} />
                  <Kv label="Criado" value={fmtDate(user.createdAt)} />
                  <Kv label="Tipo" value={user.accountKind === 'local' ? 'Anónimo / local' : 'Email'} />
                  <Kv label="Vínculos" value={`${user.studentLinks} aluno · ${user.professionalLinks} prof.`} />
                  <Kv label="Estado" value={user.suspendedAt ? `Suspenso desde ${fmtDate(user.suspendedAt)}` : 'Ativo'} />
                </KvGrid>
              </Card>

              <Card>
                <CardHead title="Perfil de treino" />
                {!hasSnapshot
                  ? <p className="cx-empty-msg">Sem dados sincronizados ainda.</p>
                  : <KvGrid>
                    <Kv label="Sexo" value={profile.sex} />
                    <Kv label="Altura" value={profile.heightCm != null ? `${profile.heightCm} cm` : null} />
                    <Kv label="Peso inicial" value={profile.startWeight != null ? `${profile.startWeight} kg` : null} />
                    <Kv label="Objetivo" value={profile.goal} />
                    <Kv label="Experiência" value={profile.experience} />
                    <Kv label="Modo do plano" value={
                      training.planMode === 'daily' ? 'Diário' :
                      training.planMode === 'weekly' ? 'Semanal' :
                      training.planMode || null
                    } />
                    <Kv label="Treinos registados" value={training.workoutCount} />
                    <Kv label="Último sync" value={fmtDateTime(training.snapshotUpdatedAt)} />
                  </KvGrid>
                }
              </Card>
            </div>

            {/* ── Gráficos: lado a lado ── */}
            {hasSnapshot && (
              <div className="cx-row-2">
                <Card>
                  <CardHead title="Peso corporal"
                    sub={weightPoints.length ? `${weightPoints.length} registos` : undefined} />
                  {weightPoints.length
                    ? <LineChart points={weightPoints} unit="kg" h={120} label="Peso" />
                    : <p className="cx-empty-msg">Sem pesagens registadas.</p>}
                </Card>

                <Card>
                  <CardHead title="Séries por treino"
                    sub={volumePoints.length ? `${volumePoints.length} treinos` : undefined} />
                  {volumePoints.length
                    ? <LineChart points={volumePoints} unit="séries" h={120} label="Séries" />
                    : <p className="cx-empty-msg">Sem treinos no histórico.</p>}
                </Card>
              </div>
            )}

            {/* ── Dias da semana ── */}
            {hasSnapshot && (
              <Card>
                <CardHead title="Rotina semanal" />
                <div className="cx-week-row">
                  {schedule.map(day => (
                    <div key={day.day} className={`cx-week-day${day.name ? ' cx-week-day--active' : ''}`}>
                      <span className="cx-week-lbl">{day.label}</span>
                      <span className="cx-week-name">{day.name || 'Livre'}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Histórico de treinos ── */}
            {hasSnapshot && !!(training.recentWorkouts || []).length && (
              <Card>
                <CardHead title="Últimos treinos" sub={`${training.workoutCount} total`} />
                <div className="cx-workout-list">
                  {(training.recentWorkouts || []).slice(0, 10).map((w, i) => {
                    const entries = w.entries || []
                    const sets = entries.reduce((s, e) => s + (e.sets || []).length, 0)
                    return (
                      <div key={w.id || `${w.d}-${i}`} className="cx-workout-row">
                        <span className="cx-workout-date">{fmtDate(w.d)}</span>
                        <span className="cx-workout-meta">{entries.length} ex · {sets} séries</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* ── Ações: nome de exibição ── */}
            <Card>
              <CardHead title="Nome de exibição" />
              <div className="cx-form-row">
                <TextField aria-label="Nome de exibição" value={displayName}
                  onChange={e => setDisplayName(e.target.value)} />
                <Button variant="primary" disabled={acting === 'name'}
                  onClick={() => run('name', () => repo.setDisplayName(user.userId, displayName), 'Nome atualizado.')}>
                  Guardar
                </Button>
              </div>
            </Card>

            {/* ── Ações: capacidades ── */}
            <Card>
              <CardHead title="Ações" sub="Gestão da conta" />
              <div className="cx-action-row">
                <Button variant="primary" disabled={acting === 'pro' || isAdmin}
                  onClick={() => run('pro', () => repo.setProfessionalRole(user.userId, !isPro),
                    isPro ? 'Role profissional removida.' : 'Role profissional concedida.')}>
                  {isPro ? 'Remover role profissional' : 'Conceder role profissional'}
                </Button>
                {!isAdmin && (
                  <Button disabled={acting === 'suspend'}
                    onClick={() => run('suspend', () => repo.setSuspended(user.userId, !user.suspendedAt),
                      user.suspendedAt ? 'Conta reativada.' : 'Conta suspensa.')}>
                    {user.suspendedAt ? 'Reativar conta' : 'Suspender conta'}
                  </Button>
                )}
                {!isAdmin && user.userId !== userId && (
                  <Button disabled={acting === 'delete'}
                    onClick={() => {
                      if (!window.confirm('Apagar permanentemente esta conta? Esta ação não pode ser desfeita.')) return
                      run('delete', async () => { await repo.deleteUser(user.userId); navigate('/console/users') }, 'Conta apagada.')
                    }}>
                    Apagar conta
                  </Button>
                )}
              </div>
            </Card>

            {/* ── Perfil profissional (se aplicável) ── */}
            {(user.professionalName != null || isPro) && (
              <Card>
                <CardHead title="Perfil profissional" sub={
                  user.verificationStatus ? VERIFICATION_LABELS[user.verificationStatus] : undefined
                } />
                {user.verificationStatus && (
                  <div className="cx-chips-row cx-mb">
                    <Chip tone={verificationTone(user.verificationStatus)}>
                      {VERIFICATION_LABELS[user.verificationStatus] || user.verificationStatus}
                    </Chip>
                  </div>
                )}
                <div className="cx-form-grid">
                  <label className="cx-label">Nome profissional<TextField value={proName} onChange={e => setProName(e.target.value)} /></label>
                  <label className="cx-label">Cidade / região<TextField value={city} onChange={e => setCity(e.target.value)} /></label>
                  <label className="cx-label">Tipo de registo<TextField value={regType} onChange={e => setRegType(e.target.value)} /></label>
                  <label className="cx-label">Número de registo<TextField value={regNumber} onChange={e => setRegNumber(e.target.value)} /></label>
                  <label className="cx-label cx-span-2">Especialidades (vírgula)<TextField value={specialtiesText} onChange={e => setSpecialtiesText(e.target.value)} /></label>
                  <label className="cx-label cx-span-2">Bio<TextArea value={bio} onChange={e => setBio(e.target.value)} rows={3} /></label>
                </div>
                <div className="cx-action-row cx-mt">
                  <Button variant="primary" disabled={acting === 'pro-save'}
                    onClick={() => run('pro-save', () => repo.updateProfessionalProfile(user.userId, {
                      professionalName: proName, bio, cityRegion: city,
                      registrationType: regType, registrationNumber: regNumber,
                      specialties: specialtiesText.split(',').map(p => p.trim().toLowerCase()).filter(Boolean),
                    }), 'Perfil profissional atualizado.')}>
                    Guardar perfil profissional
                  </Button>
                  {user.verificationStatus !== 'verified' && (
                    <Button disabled={acting === 'verify'}
                      onClick={() => run('verify', () => repo.setVerification(user.userId, 'verified'), 'Profissional aprovado.')}>
                      Aprovar verificação
                    </Button>
                  )}
                  {user.verificationStatus !== 'rejected' && (
                    <Button disabled={acting === 'reject'}
                      onClick={() => run('reject', () => repo.setVerification(user.userId, 'rejected'), 'Verificação rejeitada.')}>
                      Rejeitar
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </>
        }
      </ConsoleShell>
    </AccessGate>
  )
}
