import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { VERIFICATION_LABELS, verificationTone } from '../../lib/console.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import { Avatar, Chip, SectionBody, Loading, Empty, Alert, SPRING, fmtDate } from './ConsoleUI.jsx'

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
      <ConsoleShell userId={userId} allowed={allowed}>
        <div className="cx-page-body">
          <div className="cx-page-head">
            <h1 className="cx-page-title">Usuários</h1>
            <p className="cx-page-sub">Contas cadastradas, perfis e permissões de acesso.</p>
          </div>

          {/* search bar */}
          <div className="cx-search-wrap">
            <div className="cx-search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
            </div>
            <input
              className="cx-search"
              type="search"
              placeholder="E-mail, nome ou ID…"
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

          {busy ? <Loading label="Carregando usuários…" />
            : !rows.length
              ? <Empty title="Nenhum resultado" sub="Ajuste a busca ou o filtro." />
              : (
                <>
                  <div className="cx-count-label">{rows.length} usuário{rows.length !== 1 ? 's' : ''}</div>
                  <SectionBody>
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
                              {(user.roles || []).map(r => <Chip key={r}>{({ student: 'Aluno', professional: 'Profissional', admin: 'Administrador' })[r] || r}</Chip>)}
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
                  </SectionBody>
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
