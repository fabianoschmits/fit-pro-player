import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { VERIFICATION_LABELS, verificationTone } from '../../lib/console.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import { Avatar, Chip, Loading, Empty, Alert, SPRING, CxButton } from './ConsoleUI.jsx'
import { useFppAction } from '../../components/useFppAction.js'

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

  const operation = useFppAction({ onAction: async ({ targetId, nextStatus }) => {
    setActing(`${targetId}:${nextStatus}`); setError('')
    try {
      await repo.setVerification(targetId, nextStatus)
      if (owner.current !== userId) return false
      await refresh()
      return true
    } catch (err) {
      if (owner.current === userId) setError('Não foi possível atualizar a verificação.')
      throw err
    }
  } })
  const setVerification = (targetId, nextStatus) => operation.run({ targetId, nextStatus })
  const actionState = (targetId, nextStatus) => acting === `${targetId}:${nextStatus}` ? operation.state : 'idle'

  const filters = [
    ['', 'Todos'], ['pending', 'Pendentes'], ['verified', 'Verificados'],
    ['unverified', 'Não verif.'], ['rejected', 'Rejeitados'],
  ]

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell userId={userId} allowed={allowed}>
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
              placeholder="Nome, e-mail ou ID…"
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

          {busy ? <Loading label="Carregando profissionais…" />
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
                          <CxButton type="button" className="cx-pill-btn cx-pill-btn--accent"
                            state={actionState(pro.userId, 'verified')} disabled={operation.locked}
                            onClick={() => setVerification(pro.userId, 'verified')}
                          >Aprovar</CxButton>
                        )}
                        {pro.verificationStatus !== 'rejected' && (
                          <CxButton type="button" className="cx-pill-btn cx-pill-btn--danger"
                            state={actionState(pro.userId, 'rejected')} disabled={operation.locked}
                            onClick={() => setVerification(pro.userId, 'rejected')}
                          >Rejeitar</CxButton>
                        )}
                        {pro.verificationStatus !== 'pending' && (
                          <CxButton type="button" className="cx-pill-btn"
                            state={actionState(pro.userId, 'pending')} disabled={operation.locked}
                            onClick={() => setVerification(pro.userId, 'pending')}
                          >Pendente</CxButton>
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
