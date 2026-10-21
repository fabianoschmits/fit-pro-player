import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, SectionBody, Loading, MetricCard, SectionTitle } from './ConsoleUI.jsx'

const TABS = [
  { id: 'overview', label: 'Saúde Geral', icon: 'shield' },
  { id: 'queries', label: 'Queries & Processos', icon: 'chart' },
  { id: 'cron', label: 'Cronjobs', icon: 'clock' },
  { id: 'storage', label: 'Tabelas & Espaço', icon: 'server' },
  { id: 'errors', label: 'Logs de Erros', icon: 'bolt' },
]

export default function ConsoleSystem() {
  const { userId, repo, allowed } = useConsoleAccess()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const setTab = tab => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    next.set('tab', tab)
    return next
  })

  const { data, error, busy, refresh } = useConsoleResource({
    userId,
    allowed,
    resourceKey: 'system-health',
    load: () => repo.systemHealth(),
  })

  const [resolvingId, setResolvingId] = useState(null)
  const [resolveMessage, setResolveMessage] = useState('')

  const handleResolve = async errorId => {
    try {
      setResolvingId(errorId)
      setResolveMessage('')
      await repo.resolveSystemError(errorId)
      refresh()
    } catch (err) {
      setResolveMessage('Falha ao resolver erro: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setResolvingId(null)
    }
  }

  const activeQueriesCount = data?.active_queries?.length || 0
  const cronJobsCount = data?.cron_jobs?.length || 0
  const unresolvedErrorsCount = data?.unresolved_error_count || 0
  const totalDbSize = data?.database_size || 'N/A'

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell userId={userId} allowed={allowed}>
        <div className="cx-page-body">
          <div className="cx-page-head">
            <h1 className="cx-page-title">Sistema & Banco de Dados</h1>
            <p className="cx-page-sub">
              Monitoramento em tempo real da infraestrutura PostgreSQL, atividades do cron e registro de exceções.
            </p>
          </div>

          {error && <Alert onRetry={refresh}>{error}</Alert>}
          {resolveMessage && <Alert>{resolveMessage}</Alert>}

          {busy ? (
            <Loading label="Carregando métricas do banco de dados..." />
          ) : (
            <>
              {/* Resumo superior em cards */}
              <div className="console-metrics">
                <MetricCard
                  label="Tamanho do Banco"
                  value={totalDbSize}
                  sub="Dados e índices acumulados"
                />
                <MetricCard
                  label="Queries Não-Ociosas"
                  value={activeQueriesCount}
                  sub={activeQueriesCount > 5 ? 'Atenção: alto volume' : 'Fluxo operacional normal'}
                />
                <MetricCard
                  label="Cronjobs Ativos"
                  value={cronJobsCount}
                  sub="Rotinas automáticas agendadas"
                />
                <MetricCard
                  label="Erros Não Resolvidos"
                  value={unresolvedErrorsCount}
                  sub={unresolvedErrorsCount > 0 ? 'Requer atenção imediata' : 'Nenhum alerta crítico'}
                />
              </div>

              {/* Barra de Sub-abas */}
              <div className="console-system-tabs" role="tablist">
                {TABS.map(tab => {
                  const isActive = activeTab === tab.id
                  const badge = tab.id === 'errors' && unresolvedErrorsCount > 0 ? unresolvedErrorsCount : null
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`console-system-tab${isActive ? ' is-active' : ''}`}
                      onClick={() => setTab(tab.id)}
                    >
                      <Icon name={tab.icon} />
                      <span>{tab.label}</span>
                      {badge && <span className="console-system-tab-badge">{badge}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Aba 1: Saúde Geral */}
              {activeTab === 'overview' && (
                <section aria-label="Saúde Geral">
                  <SectionTitle>Conexões e Sessões</SectionTitle>
                  <SectionBody>
                    <div className="console-table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>Estado da Sessão</th>
                            <th style={{ textAlign: 'right' }}>Total de Conexões</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.connections?.length ? (
                            data.connections.map((c, i) => (
                              <tr key={i}>
                                <td>
                                  <span className={`status-pill ${c.state.includes('aborted') ? 'pill-danger' : c.state === 'active' ? 'pill-success' : 'pill-neutral'}`}>
                                    {c.state}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.count}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="2" className="console-empty-cell">Nenhuma conexão registrada</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionBody>

                  <SectionTitle>Top Queries que mais consumiram CPU</SectionTitle>
                  <SectionBody>
                    <div className="console-table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>Chamadas</th>
                            <th>Tempo Total (ms)</th>
                            <th>Tempo Médio (ms)</th>
                            <th>Comando</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.slow_queries?.length ? (
                            data.slow_queries.slice(0, 8).map((q, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{q.calls?.toLocaleString()}</td>
                                <td>{q.total_time_ms?.toLocaleString()} ms</td>
                                <td>{q.mean_time_ms} ms</td>
                                <td><code className="console-code-snippet">{q.query}</code></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="console-empty-cell">Nenhuma estatística disponível</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionBody>
                </section>
              )}

              {/* Aba 2: Queries & Processos Ativos */}
              {activeTab === 'queries' && (
                <section aria-label="Queries Ativas">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <SectionTitle>Processos Atuais em Execução</SectionTitle>
                    <button type="button" className="console-btn-refresh" onClick={refresh}>
                      <Icon name="clock" /> Atualizar
                    </button>
                  </div>
                  <SectionBody>
                    <div className="console-table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>PID</th>
                            <th>Usuário</th>
                            <th>Estado</th>
                            <th>Duração (s)</th>
                            <th>Query</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.active_queries?.length ? (
                            data.active_queries.map((q, i) => (
                              <tr key={i}>
                                <td><code>{q.pid}</code></td>
                                <td>{q.usename}</td>
                                <td>
                                  <span className={`status-pill ${q.duration_sec > 10 ? 'pill-danger' : 'pill-active'}`}>
                                    {q.state}
                                  </span>
                                </td>
                                <td>{q.duration_sec}s</td>
                                <td><code className="console-code-snippet">{q.query}</code></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="console-empty-cell">Nenhuma query lenta ou travada no momento</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionBody>
                </section>
              )}

              {/* Aba 3: Cronjobs */}
              {activeTab === 'cron' && (
                <section aria-label="Cronjobs">
                  <SectionTitle>Jobs Cadastrados</SectionTitle>
                  <SectionBody>
                    <div className="console-table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Intervalo / Schedule</th>
                            <th>Status</th>
                            <th>Comando Executado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.cron_jobs?.length ? (
                            data.cron_jobs.map((job, i) => (
                              <tr key={i}>
                                <td><code>{job.jobid}</code></td>
                                <td style={{ fontWeight: 600 }}>{job.schedule}</td>
                                <td>
                                  <span className={`status-pill ${job.active ? 'pill-success' : 'pill-neutral'}`}>
                                    {job.active ? 'Ativo' : 'Desativado'}
                                  </span>
                                </td>
                                <td><code className="console-code-snippet">{job.command}</code></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="console-empty-cell">Nenhum cronjob cadastrado atualmente</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionBody>

                  <SectionTitle>Últimas Execuções de Cron</SectionTitle>
                  <SectionBody>
                    <div className="console-table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>Job ID</th>
                            <th>Resultado</th>
                            <th>Início</th>
                            <th>Duração</th>
                            <th>Mensagem de Retorno</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.cron_runs?.length ? (
                            data.cron_runs.map((run, i) => (
                              <tr key={i}>
                                <td><code>{run.jobid}</code></td>
                                <td>
                                  <span className={`status-pill ${run.status === 'succeeded' ? 'pill-success' : 'pill-danger'}`}>
                                    {run.status}
                                  </span>
                                </td>
                                <td>{new Date(run.start_time).toLocaleTimeString()}</td>
                                <td>{run.duration_ms} ms</td>
                                <td><code>{run.return_message || 'N/A'}</code></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="console-empty-cell">Nenhum histórico recente</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionBody>
                </section>
              )}

              {/* Aba 4: Tabelas & Armazenamento */}
              {activeTab === 'storage' && (
                <section aria-label="Tabelas & Espaço">
                  <SectionTitle>Maiores Tabelas do Esquema Público</SectionTitle>
                  <SectionBody>
                    <div className="console-table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>Tabela</th>
                            <th style={{ textAlign: 'right' }}>Espaço Utilizado (Dados + Índices)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.table_sizes?.length ? (
                            data.table_sizes.map((t, i) => (
                              <tr key={i}>
                                <td><strong>{t.table_name}</strong></td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{t.size}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="2" className="console-empty-cell">Nenhuma tabela listada</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionBody>
                </section>
              )}

              {/* Aba 5: Logs de Erro do Sistema */}
              {activeTab === 'errors' && (
                <section aria-label="Erros do Sistema">
                  <SectionTitle>Logs e Incidentes Registrados</SectionTitle>
                  <SectionBody>
                    <div className="console-table-container">
                      <table className="console-table">
                        <thead>
                          <tr>
                            <th>Gravidade</th>
                            <th>Origem</th>
                            <th>Mensagem</th>
                            <th>Data</th>
                            <th>Status / Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.system_errors?.length ? (
                            data.system_errors.map(err => {
                              const isResolved = Boolean(err.resolved_at)
                              return (
                                <tr key={err.id}>
                                  <td>
                                    <span className={`status-pill ${err.severity === 'critical' ? 'pill-danger' : err.severity === 'warning' ? 'pill-warning' : 'pill-danger'}`}>
                                      {err.severity.toUpperCase()}
                                    </span>
                                  </td>
                                  <td><strong>{err.source}</strong></td>
                                  <td>
                                    <div>{err.message}</div>
                                    {err.details && Object.keys(err.details).length > 0 && (
                                      <pre className="console-error-details">{JSON.stringify(err.details, null, 2)}</pre>
                                    )}
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(err.created_at).toLocaleString()}</td>
                                  <td>
                                    {isResolved ? (
                                      <span className="status-pill pill-success">Resolvido</span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="console-btn-resolve"
                                        disabled={resolvingId === err.id}
                                        onClick={() => handleResolve(err.id)}
                                      >
                                        Marcar Resolvido
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          ) : (
                            <tr>
                              <td colSpan="5" className="console-empty-cell">Nenhum log de erro registrado</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionBody>
                </section>
              )}
            </>
          )}
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}
