import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { VERIFICATION_LABELS, verificationTone } from '../../lib/console.js'
import LineChart from '../../components/LineChart.jsx'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import { Avatar, Chip, SectionBody, Kv, Loading, Empty, Alert, SPRING, fmtDate, weekSchedule, workoutVolumePoints, bodyweightPoints } from './ConsoleUI.jsx'

export function ConsoleUserPage() {
  const { userId: targetId } = useParams()
  const { key: navigationKey } = useLocation()
  const [params] = useSearchParams()
  const section = ['account', 'training', 'professional'].includes(params.get('section')) ? params.get('section') : 'account'
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
  const identity = `${userId}:${targetId}:${navigationKey}`
  const owner = useRef(identity)
  owner.current = identity

  const refresh = async () => {
    const id = identity; setBusy(true)
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
    owner.current = identity
    if (userId && allowed && targetId) refresh()
    return () => { owner.current = null }
  }, [userId, allowed, targetId, navigationKey])

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
      <ConsoleShell userId={userId} allowed={allowed} back="/console/users" backLabel="Usuários">
        <div className="cx-page-body">

          {error && <Alert>{error}</Alert>}
          {message && <div className="cx-success" role="status">{message}</div>}

          {busy ? <Loading /> : !user ? <Empty title="Usuário não encontrado" sub="Volte à lista ou tente carregar novamente." /> : (
            <>
              {/* ── hero ── */}
              <div className="cx-hero">
                <Avatar name={pageTitle} size={64} />
                <div className="cx-hero-body">
                  <h1 className="cx-hero-name">{pageTitle}</h1>
                  {user.email && <div className="cx-hero-email">{user.email}</div>}
                  <div className="cx-user-badges cx-mt-4">
                    <Chip tone={user.accountKind === 'local' ? 'warn' : 'ok'}>
                      {user.accountKind === 'local' ? 'Local' : 'Conta'}
                    </Chip>
                    {(user.roles || []).map(r => <Chip key={r}>{({ student: 'Aluno', professional: 'Profissional', admin: 'Administrador' })[r] || r}</Chip>)}
                    {user.suspendedAt && <Chip tone="err">Suspenso</Chip>}
                  </div>
                </div>
              </div>

              <nav className="console-detail-tabs" aria-label="Seções do usuário">
                <Link to={`?section=account`} aria-current={section === 'account' ? 'page' : undefined}>Conta e acesso</Link>
                <Link to={`?section=training`} aria-current={section === 'training' ? 'page' : undefined}>Treinos e evolução</Link>
                {isPro && <Link to={`?section=professional`} aria-current={section === 'professional' ? 'page' : undefined}>Perfil profissional</Link>}
              </nav>

              {/* ── resumo da seção selecionada ── */}
              <div className="cx-grid-2">
                {section === 'account' && <SectionBody>
                  <div className="cx-section-label">Conta</div>
                  <dl className="cx-kv-list">
                    <Kv label="Criado" value={fmtDate(user.createdAt)} />
                    <Kv label="Tipo" value={user.accountKind === 'local' ? 'Local' : 'E-mail'} />
                    <Kv label="Vínculos" value={`${user.studentLinks} aluno · ${user.professionalLinks} prof.`} />
                    <Kv label="ID" value={<code className="cx-code">{user.userId?.slice(0, 12)}…</code>} />
                  </dl>
                </SectionBody>}

                {section === 'training' && <SectionBody>
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
                </SectionBody>}
              </div>

              {/* ── gráficos ── */}
              {section === 'training' && hasSnapshot && (
                <div className="cx-grid-2">
                  <SectionBody>
                    <div className="cx-section-label">
                      Peso corporal
                      {weightPoints.length > 0 && <span className="cx-count">{weightPoints.length}</span>}
                    </div>
                    {weightPoints.length
                      ? <div className="cx-chart-wrap"><LineChart points={weightPoints} unit="kg" h={100} label="Peso" /></div>
                      : <p className="cx-muted">Sem pesagens.</p>}
                  </SectionBody>

                  <SectionBody>
                    <div className="cx-section-label">
                      Séries / treino
                      {volumePoints.length > 0 && <span className="cx-count">{volumePoints.length}</span>}
                    </div>
                    {volumePoints.length
                      ? <div className="cx-chart-wrap"><LineChart points={volumePoints} unit="séries" h={100} label="Séries" /></div>
                      : <p className="cx-muted">Sem treinos.</p>}
                  </SectionBody>
                </div>
              )}

              {/* ── rotina semanal ── */}
              {section === 'training' && hasSnapshot && (
                <SectionBody>
                  <div className="cx-section-label">Rotina semanal</div>
                  <div className="cx-week-strip">
                    {schedule.map(day => (
                      <div key={day.day} className={`cx-week-day${day.name ? ' cx-week-day--on' : ''}`}>
                        <span className="cx-week-abbr">{day.label}</span>
                        <span className="cx-week-name">{day.name || '·'}</span>
                      </div>
                    ))}
                  </div>
                </SectionBody>
              )}

              {/* ── últimos treinos ── */}
              {section === 'training' && hasSnapshot && !!(training.recentWorkouts || []).length && (
                <SectionBody>
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
                </SectionBody>
              )}

              {/* ── editar nome ── */}
              {section === 'account' && <SectionBody>
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
                  >Salvar nome</motion.button>
                </div>
              </SectionBody>}

              {/* ── ações da conta ── */}
              {section === 'account' && <SectionBody>
                <div className="cx-section-label">Ações</div>
                <div className="cx-action-list">
                  <motion.button type="button" className="cx-action-item cx-action-item--primary"
                    disabled={acting === 'pro' || isAdmin}
                    onClick={() => run('pro', () => repo.setProfessionalRole(user.userId, !isPro),
                      isPro ? 'Acesso profissional removido.' : 'Acesso profissional concedido.')}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isPro ? 'Remover acesso profissional' : 'Conceder acesso profissional'}
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
              </SectionBody>}

              {/* ── perfil profissional ── */}
              {section === 'professional' && (user.professionalName != null || isPro) && (
                <SectionBody>
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
                    <label className="cx-label">Tipo de registro
                      <input className="cx-field" type="text" value={regType} onChange={e => setRegType(e.target.value)} />
                    </label>
                    <label className="cx-label">Número de registro
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
                    >Salvar perfil</motion.button>
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
                </SectionBody>
              )}
            </>
          )}
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}
