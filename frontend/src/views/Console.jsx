import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createConsoleRepository, VERIFICATION_LABELS, verificationTone } from '../lib/console.js'
import { Button, TextArea, TextField } from '../components/ui.jsx'
import LineChart from '../components/LineChart.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel as Section, ManagementAvatar, ManagementStatus, ManagementEmpty } from '../components/ManagementUI.jsx'
import useManagementNavVisibility from '../components/useManagementNavVisibility.js'

const WEEK_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function routineNameById(routines, id) {
  if (!id || id === 'rest') return id === 'rest' ? 'Descanso' : '—'
  const found = (routines || []).find(routine => String(routine.id) === String(id))
  return found?.name || `Rotina ${id}`
}

function weekSchedule(training) {
  const week = training?.week || {}
  const routines = training?.routines || []
  return WEEK_LABELS.map((label, day) => {
    const routineId = week[String(day)] ?? week[day] ?? null
    return {
      day,
      label,
      routineId,
      routineName: routineId == null || routineId === '' ? 'Livre / sem treino' : routineNameById(routines, routineId),
    }
  })
}

function workoutVolumePoints(workouts) {
  return (workouts || [])
    .map(workout => {
      const date = workout?.d
      if (!date) return null
      const entries = workout.entries || []
      const sets = entries.reduce((sum, entry) => sum + (entry.sets || []).filter(set => set.done !== false).length, 0)
      const timestamp = Date.parse(`${date}T12:00:00`)
      if (!Number.isFinite(timestamp)) return null
      return { t: timestamp, y: sets, d: date }
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
}

function bodyweightPoints(rows) {
  return (rows || [])
    .map(row => {
      const date = row?.d
      const weight = Number(row?.w)
      if (!date || !Number.isFinite(weight)) return null
      const timestamp = Date.parse(`${date}T12:00:00`)
      if (!Number.isFinite(timestamp)) return null
      return { t: timestamp, y: weight, d: date }
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
}

function ConsoleNav() {
  const navRef = useManagementNavVisibility()
  const { pathname } = useLocation()
  const overview = pathname === '/console'
  const users = pathname.startsWith('/console/users')
  const pros = pathname.startsWith('/console/professionals')
  return <nav ref={navRef} className="management-nav" aria-label="Navegação da Central">
    <Link to="/console" aria-current={overview ? 'page' : undefined}>Visão geral</Link>
    <Link to="/console/users" aria-current={users ? 'page' : undefined}>Usuarios</Link>
    <Link to="/console/professionals" aria-current={pros ? 'page' : undefined}>Profissionais</Link>
  </nav>
}

function ConsoleShell({ title, subtitle, children, action }) {
  return <ManagementLayout
    className="professional-page console-page"
    title={title}
    subtitle={subtitle}
    backTo="/more"
    action={action}
    nav={<ConsoleNav />}
  >{children}</ManagementLayout>
}

function useConsoleAccess() {
  const auth = useAuth()
  const userId = auth.user?.id
  const repo = useMemo(() => createConsoleRepository({ client: getBrowserSupabaseClient() }), [])
  const [allowed, setAllowed] = useState(null)
  useEffect(() => {
    let current = true
    setAllowed(null)
    if (!userId) { setAllowed(false); return undefined }
    repo.adminRole(userId).then(value => { if (current) setAllowed(value) }).catch(() => { if (current) setAllowed(false) })
    return () => { current = false }
  }, [userId, repo])
  return { userId, repo, allowed }
}

function AccessGate({ allowed, children }) {
  if (allowed === null) return <ConsoleShell title="Central" subtitle="Carregando acesso…"><p role="status">A verificar permissões…</p></ConsoleShell>
  if (!allowed) return <ConsoleShell title="Central" subtitle="Área restrita">
    <ManagementEmpty title="Esta área não está disponível para a sua conta." description="Se acredita que isto é um erro, contacte o suporte da plataforma." />
  </ConsoleShell>
  return children
}

function formatDate(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString('pt-BR') } catch { return String(value) }
}

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

  return <AccessGate allowed={allowed}>
    <ConsoleShell title="Central" subtitle="Operação da plataforma">
      {error && <p role="alert" className="management-error">{error} <button type="button" className="link" onClick={refresh}>Tentar novamente</button></p>}
      {busy || !stats ? <p role="status">A carregar resumo…</p> : <>
        <Section title="Resumo">
          <div className="console-stat-grid">
            <div className="console-stat"><strong>{stats.userCount}</strong><span>Usuarios</span></div>
            <div className="console-stat"><strong>{stats.accountUserCount}</strong><span>Com conta</span></div>
            <div className="console-stat"><strong>{stats.localUserCount}</strong><span>Só local</span></div>
            <div className="console-stat"><strong>{stats.professionalCount}</strong><span>Profissionais</span></div>
            <div className="console-stat"><strong>{stats.pendingVerificationCount}</strong><span>Verificação pendente</span></div>
            <div className="console-stat"><strong>{stats.suspendedCount}</strong><span>Suspensos</span></div>
            <div className="console-stat"><strong>{stats.newUsers7d}</strong><span>Novos (7 dias)</span></div>
          </div>
        </Section>
        <Section title="Atalhos">
          <div className="management-actions">
            <Link className="management-button management-button-primary" to="/console/users">Gerir usuarios</Link>
            <Link className="management-button" to="/console/users?kind=local">Ver só locais ({stats.localUserCount})</Link>
            <Link className="management-button" to="/console/professionals">Gerir profissionais</Link>
            {stats.pendingVerificationCount > 0 && <Link className="management-button" to="/console/professionals?status=pending">Ver pendentes ({stats.pendingVerificationCount})</Link>}
          </div>
        </Section>
      </>}
    </ConsoleShell>
  </AccessGate>
}

export function ConsoleUsers() {
  const { userId, repo, allowed } = useConsoleAccess()
  const [params] = useSearchParams()
  const initialKind = params.get('kind') || ''
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState(initialKind)
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
      if (owner.current === id) setError('Não foi possível carregar os usuarios.')
    } finally {
      if (owner.current === id) setBusy(false)
    }
  }

  useEffect(() => {
    owner.current = userId
    if (userId && allowed) refresh()
    return () => { owner.current = null }
  }, [userId, allowed, query, kind, limit])

  const filters = [
    ['', 'Todos'],
    ['account', 'Com conta'],
    ['local', 'Só local'],
  ]

  return <AccessGate allowed={allowed}>
    <ConsoleShell title="Usuarios" subtitle="Contas registadas e uso local">
      {error && <p role="alert" className="management-error">{error} <button type="button" className="link" onClick={refresh}>Tentar novamente</button></p>}
      <div className="management-list-tools">
        <TextField aria-label="Buscar usuario" placeholder="Email, nome ou id" value={query} onChange={event => { setQuery(event.target.value); setLimit(50) }} />
        <div className="management-filter" role="group" aria-label="Filtro de tipo de conta">
          {filters.map(([value, label]) => <button type="button" key={value || 'all'} aria-pressed={kind === value} className={kind === value ? 'on' : ''} onClick={() => { setKind(value); setLimit(50) }}>{label}</button>)}
        </div>
      </div>
      {busy ? <p role="status">A carregar usuarios…</p> : !rows.length ? <Section title="Nenhum resultado"><p className="muted">Ajuste a busca ou o filtro. Utilizadores só locais aparecem depois de usarem “Continuar sem conta” com esta versão.</p></Section> : <Section title={`${rows.length} usuario(s)`}>
        <div className="management-record-list">
          {rows.map(user => <Link className="management-record management-student-record" to={`/console/users/${user.userId}`} key={user.userId}>
            <ManagementAvatar name={user.displayName || user.email || 'Local'} />
            <div className="management-student-main">
              <strong>{user.displayName || user.email || 'Utilizador local'}</strong>
              <p>{user.email || 'Sem email · dados neste dispositivo'}</p>
              <div className="management-student-flags">
                <ManagementStatus tone={user.accountKind === 'local' ? 'warning' : 'success'}>{user.accountKind === 'local' ? 'Local' : 'Conta'}</ManagementStatus>
                {(user.roles || []).map(role => <ManagementStatus key={role}>{role}</ManagementStatus>)}
                {user.suspendedAt && <ManagementStatus tone="error">Suspenso</ManagementStatus>}
                {user.verificationStatus && <ManagementStatus tone={verificationTone(user.verificationStatus)}>{VERIFICATION_LABELS[user.verificationStatus] || user.verificationStatus}</ManagementStatus>}
              </div>
            </div>
            <div className="management-student-activity">
              <span>{formatDate(user.createdAt)}</span>
            </div>
            <span aria-hidden="true">›</span>
          </Link>)}
        </div>
        {rows.length >= limit && <Button onClick={() => setLimit(value => value + 50)}>Carregar mais</Button>}
      </Section>}
    </ConsoleShell>
  </AccessGate>
}

export function ConsoleProfessionals() {
  const { userId, repo, allowed } = useConsoleAccess()
  const [params] = useSearchParams()
  const initialStatus = params.get('status') || ''
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(initialStatus)
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
    try {
      await repo.setVerification(targetId, nextStatus)
      await refresh()
    } catch {
      setError('Não foi possível atualizar a verificação.')
    } finally {
      setActing('')
    }
  }

  const filters = [
    ['', 'Todos'],
    ['pending', 'Pendentes'],
    ['verified', 'Verificados'],
    ['unverified', 'Não verificados'],
    ['rejected', 'Rejeitados'],
  ]

  return <AccessGate allowed={allowed}>
    <ConsoleShell title="Profissionais" subtitle="Verificação e perfis profissionais">
      {error && <p role="alert" className="management-error">{error} <button type="button" className="link" onClick={refresh}>Tentar novamente</button></p>}
      <div className="management-list-tools">
        <TextField aria-label="Buscar profissional" placeholder="Nome, email ou id" value={query} onChange={event => { setQuery(event.target.value); setLimit(50) }} />
        <div className="management-filter" role="group" aria-label="Filtros de verificação">
          {filters.map(([value, label]) => <button type="button" key={value || 'all'} aria-pressed={status === value} className={status === value ? 'on' : ''} onClick={() => { setStatus(value); setLimit(50) }}>{label}</button>)}
        </div>
      </div>
      {busy ? <p role="status">A carregar profissionais…</p> : !rows.length ? <Section title="Nenhum resultado"><p className="muted">Ajuste a busca ou o filtro.</p></Section> : <Section title={`${rows.length} profissional(is)`}>
        <div className="management-record-list">
          {rows.map(pro => <div className="management-record management-student-record console-pro-record" key={pro.userId}>
            <ManagementAvatar name={pro.professionalName || pro.displayName || pro.email} />
            <div className="management-student-main">
              <strong>{pro.professionalName || pro.displayName || 'Profissional'}</strong>
              <p>{pro.email}{pro.cityRegion ? ` · ${pro.cityRegion}` : ''}</p>
              <div className="management-student-flags">
                <ManagementStatus tone={verificationTone(pro.verificationStatus)}>{VERIFICATION_LABELS[pro.verificationStatus] || pro.verificationStatus}</ManagementStatus>
                <ManagementStatus>{pro.studentLinks} aluno(s)</ManagementStatus>
                {pro.suspendedAt && <ManagementStatus tone="error">Suspenso</ManagementStatus>}
              </div>
              <div className="management-actions console-inline-actions">
                <Link className="management-button" to={`/console/users/${pro.userId}`}>Abrir conta</Link>
                {pro.verificationStatus !== 'verified' && <Button variant="primary" disabled={acting === `${pro.userId}:verified`} onClick={() => setVerification(pro.userId, 'verified')}>Aprovar</Button>}
                {pro.verificationStatus !== 'rejected' && <Button disabled={acting === `${pro.userId}:rejected`} onClick={() => setVerification(pro.userId, 'rejected')}>Rejeitar</Button>}
                {pro.verificationStatus !== 'pending' && <Button disabled={acting === `${pro.userId}:pending`} onClick={() => setVerification(pro.userId, 'pending')}>Marcar pendente</Button>}
              </div>
            </div>
          </div>)}
        </div>
        {rows.length >= limit && <Button onClick={() => setLimit(value => value + 50)}>Carregar mais</Button>}
      </Section>}
    </ConsoleShell>
  </AccessGate>
}

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
        setError(next ? '' : 'Usuario não encontrado.')
      }
    } catch {
      if (owner.current === id) setError('Não foi possível carregar o usuario.')
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
    setActing(key)
    setMessage('')
    try {
      await action()
      setMessage(success)
      await refresh()
    } catch (err) {
      setError(err?.message || 'A operação falhou.')
    } finally {
      setActing('')
    }
  }

  const isPro = (user?.roles || []).includes('professional')
  const isAdmin = (user?.roles || []).includes('admin')
  const profile = training?.profile || {}
  const schedule = weekSchedule(training)
  const volumePoints = workoutVolumePoints(training?.recentWorkouts)
  const weightPoints = bodyweightPoints(training?.bodyweight)
  const pageTitle = user?.displayName || profile.name || user?.email || 'Usuario'

  return <AccessGate allowed={allowed}>
    <ConsoleShell title={pageTitle} subtitle="Perfil, treino e ações operacionais" action={<Link className="management-button" to="/console/users">Voltar à lista</Link>}>
      {error && <p role="alert" className="management-error">{error}</p>}
      {message && <p role="status" className="management-success">{message}</p>}
      {busy || !user ? <p role="status">A carregar…</p> : <>
        <Section title="Conta">
          <div className="management-student-flags" style={{ marginBottom: 12 }}>
            <ManagementStatus tone={user.accountKind === 'local' ? 'warning' : 'success'}>{user.accountKind === 'local' ? 'Local · sem cadastro' : 'Conta registada'}</ManagementStatus>
          </div>
          <dl className="console-meta">
            <div><dt>Nome</dt><dd>{user.displayName || profile.name || '—'}</dd></div>
            <div><dt>Email</dt><dd>{user.email || '—'}</dd></div>
            <div><dt>ID</dt><dd><code>{user.userId}</code></dd></div>
            <div><dt>Criado</dt><dd>{formatDate(user.createdAt)}</dd></div>
            <div><dt>Tipo</dt><dd>{user.accountKind === 'local' ? 'Só dados locais (anónimo)' : 'Conta com email'}</dd></div>
            <div><dt>Roles</dt><dd>{(user.roles || []).join(', ') || '—'}</dd></div>
            <div><dt>Estado</dt><dd>{user.suspendedAt ? `Suspenso desde ${formatDate(user.suspendedAt)}` : 'Ativo'}</dd></div>
            <div><dt>Vínculos</dt><dd>{user.studentLinks} como aluno · {user.professionalLinks} como profissional</dd></div>
          </dl>
        </Section>

        <Section title="Perfil de treino">
          {!training?.hasSnapshot ? <p className="muted">Ainda não há snapshot sincronizado deste utilizador. Assim que usar o app com sessão (conta ou local), os dados aparecem aqui.</p> : <>
            <dl className="console-meta">
              <div><dt>Nome no app</dt><dd>{profile.name || '—'}</dd></div>
              <div><dt>Sexo</dt><dd>{profile.sex || '—'}</dd></div>
              <div><dt>Altura</dt><dd>{profile.heightCm != null ? `${profile.heightCm} cm` : '—'}</dd></div>
              <div><dt>Peso inicial</dt><dd>{profile.startWeight != null ? `${profile.startWeight} kg` : '—'}</dd></div>
              <div><dt>Objetivo</dt><dd>{profile.goal || '—'}</dd></div>
              <div><dt>Experiência</dt><dd>{profile.experience || '—'}</dd></div>
              <div><dt>Modo do plano</dt><dd>{training.planMode === 'daily' ? 'Diário' : training.planMode === 'weekly' ? 'Semanal' : (training.planMode || '—')}</dd></div>
              <div><dt>Treinos registados</dt><dd>{training.workoutCount}</dd></div>
              <div><dt>Última sincronização</dt><dd>{formatDate(training.snapshotUpdatedAt)}</dd></div>
            </dl>
          </>}
        </Section>

        {training?.hasSnapshot && <Section title="Dias da semana">
          <div className="console-week-grid">
            {schedule.map(day => <div className="console-week-day" key={day.day}>
              <strong>{day.label}</strong>
              <span>{day.routineName}</span>
            </div>)}
          </div>
        </Section>}

        {training?.hasSnapshot && <Section title="Evolução de peso">
          {weightPoints.length ? <LineChart points={weightPoints} unit="kg" h={160} label="Peso corporal" /> : <p className="muted">Sem pesagens registadas.</p>}
        </Section>}

        {training?.hasSnapshot && <Section title="Treinos realizados">
          {volumePoints.length ? <LineChart points={volumePoints} unit="séries" h={160} label="Séries por treino" /> : <p className="muted">Sem treinos concluídos no histórico sincronizado.</p>}
          {!!(training.recentWorkouts || []).length && <div className="management-record-list console-workout-list">
            {(training.recentWorkouts || []).slice(0, 12).map((workout, index) => {
              const entries = workout.entries || []
              const sets = entries.reduce((sum, entry) => sum + (entry.sets || []).length, 0)
              return <div className="management-record" key={workout.id || `${workout.d}-${index}`}>
                <div className="management-student-main">
                  <strong>{workout.d || 'Sem data'}</strong>
                  <p>{entries.length} exercício(s) · {sets} série(s)</p>
                </div>
              </div>
            })}
          </div>}
        </Section>}

        <Section title="Nome de exibição">
          <TextField aria-label="Nome de exibição" value={displayName} onChange={event => setDisplayName(event.target.value)} />
          <div className="management-actions">
            <Button variant="primary" disabled={acting === 'name'} onClick={() => run('name', () => repo.setDisplayName(user.userId, displayName), 'Nome atualizado.')}>Guardar nome</Button>
          </div>
        </Section>

        <Section title="Capacidades">
          <div className="management-actions">
            <Button variant="primary" disabled={acting === 'pro' || isAdmin} onClick={() => run('pro', () => repo.setProfessionalRole(user.userId, !isPro), isPro ? 'Role profissional removida.' : 'Role profissional concedida.')}>
              {isPro ? 'Remover role profissional' : 'Conceder role profissional'}
            </Button>
            {!isAdmin && <Button disabled={acting === 'suspend'} onClick={() => run('suspend', () => repo.setSuspended(user.userId, !user.suspendedAt), user.suspendedAt ? 'Conta reativada.' : 'Conta suspensa.')}>
              {user.suspendedAt ? 'Reativar conta' : 'Suspender conta'}
            </Button>}
            {!isAdmin && user.userId !== userId && <Button disabled={acting === 'delete'} onClick={() => {
              if (!window.confirm('Apagar permanentemente esta conta? Esta ação não pode ser desfeita.')) return
              run('delete', async () => { await repo.deleteUser(user.userId); navigate('/console/users') }, 'Conta apagada.')
            }}>Apagar conta</Button>}
          </div>
        </Section>

        {(user.professionalName != null || isPro) && <Section title="Perfil profissional">
          <div className="management-student-flags" style={{ marginBottom: 12 }}>
            {user.verificationStatus && <ManagementStatus tone={verificationTone(user.verificationStatus)}>{VERIFICATION_LABELS[user.verificationStatus] || user.verificationStatus}</ManagementStatus>}
          </div>
          <div className="console-form-grid">
            <label>Nome profissional<TextField value={proName} onChange={event => setProName(event.target.value)} /></label>
            <label>Cidade / região<TextField value={city} onChange={event => setCity(event.target.value)} /></label>
            <label>Tipo de registo<TextField value={regType} onChange={event => setRegType(event.target.value)} /></label>
            <label>Número de registo<TextField value={regNumber} onChange={event => setRegNumber(event.target.value)} /></label>
            <label className="console-span-2">Especialidades (separadas por vírgula)<TextField value={specialtiesText} onChange={event => setSpecialtiesText(event.target.value)} /></label>
            <label className="console-span-2">Bio<TextArea value={bio} onChange={event => setBio(event.target.value)} rows={4} /></label>
          </div>
          <div className="management-actions">
            <Button variant="primary" disabled={acting === 'pro-save'} onClick={() => run('pro-save', () => repo.updateProfessionalProfile(user.userId, {
              professionalName: proName,
              bio,
              cityRegion: city,
              registrationType: regType,
              registrationNumber: regNumber,
              specialties: specialtiesText.split(',').map(part => part.trim().toLowerCase()).filter(Boolean),
            }), 'Perfil profissional atualizado.')}>Guardar perfil profissional</Button>
            {user.verificationStatus !== 'verified' && <Button disabled={acting === 'verify'} onClick={() => run('verify', () => repo.setVerification(user.userId, 'verified'), 'Profissional aprovado.')}>Aprovar verificação</Button>}
            {user.verificationStatus !== 'rejected' && <Button disabled={acting === 'reject'} onClick={() => run('reject', () => repo.setVerification(user.userId, 'rejected'), 'Verificação rejeitada.')}>Rejeitar</Button>}
            {user.verificationStatus !== 'pending' && <Button disabled={acting === 'pending'} onClick={() => run('pending', () => repo.setVerification(user.userId, 'pending'), 'Marcado como pendente.')}>Marcar pendente</Button>}
          </div>
        </Section>}
      </>}
    </ConsoleShell>
  </AccessGate>
}
