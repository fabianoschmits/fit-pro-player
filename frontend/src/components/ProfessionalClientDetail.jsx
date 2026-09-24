import { useState } from 'react'
import { Button, Section } from './ui.jsx'

export default function ProfessionalClientDetail({ client, detail = {}, versions = [], onAssign, onClose }) {
  const [versionId, setVersionId] = useState('')
  if (!client) return null
  const executions = detail.executions || []
  return <div className="professional-client-detail">
    <div className="row between"><div><h3>{client.displayName}</h3><p className="muted small">Cliente vinculado · {client.programTitle || 'sem programa ativo'}</p></div><Button onClick={onClose}>Fechar</Button></div>
    <Section title="Programa atual"><p>{client.programTitle || 'Nenhum programa enviado'}</p>{client.versionNumber && <p className="muted small">Versão {client.versionNumber}</p>}</Section>
    <Section title="Enviar programa">
      <label>Versão<select aria-label="Versão do programa" value={versionId} onChange={event => setVersionId(event.target.value)}><option value="">Selecione uma versão</option>{versions.map(version => <option key={version.id} value={version.id}>Versão {version.version_number}</option>)}</select></label>
      <Button disabled={!versionId} onClick={() => onAssign(versionId)}>Enviar versão</Button>
    </Section>
    <Section title="Histórico de treinos">{executions.length ? executions.map(execution => <div className="card" key={execution.id}><strong>{execution.day_key}</strong><span className="muted small">{execution.status} · {execution.started_at || 'sem data'}</span></div>) : <p className="muted">Nenhuma execução registrada.</p>}</Section>
  </div>
}
