import { useState } from 'react'
import InsightsPanel from './InsightsPanel.jsx'
import InsightsEmptyState from './InsightsEmptyState.jsx'
function AlertItem({ row, repo, refresh }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const update = async state => { setBusy(true); setError(''); try { await repo.setAlertState(row.id,state); refresh() } catch { setError('Não foi possível alterar o alerta. Tente novamente.') } finally { setBusy(false) } }
  return <details className="fi-alert"><summary><strong>{row.title}</strong><span>{row.affected_users} usuários · {row.state === 'resolved' ? 'Resolvido' : row.state === 'investigating' ? 'Em análise' : 'Aberto'}</span></summary><p>{row.description}</p><p>{row.platform} · v{row.app_version} · {row.occurrences} ocorrências · impacto alto</p><p>{new Date(row.first_seen).toLocaleString('pt-BR')} — {new Date(row.last_seen).toLocaleString('pt-BR')}</p><div className="fi-actions"><button disabled={busy} onClick={() => update('investigating')}>Em análise</button><button disabled={busy} onClick={() => update('resolved')}>Resolver</button><button disabled={busy} onClick={() => update('open')}>Reabrir</button></div>{error && <p role="alert">{error}</p>}</details>
}
export default function InsightsAlerts(props) {
  return <InsightsPanel {...props} title="Precisa de atenção" method="getInsightsAlerts">{(data,refresh) => data.rows?.length ? data.rows.map(row => <AlertItem key={row.id} row={row} repo={props.repo} refresh={refresh} />) : <><p className="fi-note">Nenhum alerta elegível para os filtros atuais. Alertas exigem ao menos cinco usuários e dez falhas observadas.</p><InsightsEmptyState /></>}</InsightsPanel>
}
