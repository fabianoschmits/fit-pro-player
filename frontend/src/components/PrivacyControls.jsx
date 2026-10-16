import { useState } from 'react'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { useStore } from '../store/useStore.js'
import { Button } from './ui.jsx'

const REQUESTS = [['access', 'Acessar meus dados'], ['correction', 'Corrigir meus dados'], ['portability', 'Exportar meus dados'], ['sharing_information', 'Saber com quem meus dados são compartilhados'], ['consent_revocation', 'Revogar um consentimento'], ['deletion', 'Solicitar exclusão da conta']]

export default function PrivacyControls({ toast }) {
  const [type, setType] = useState('access'); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false); const [protocol, setProtocol] = useState(''); const [error, setError] = useState('')
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); setProtocol(''); try { const client = getBrowserSupabaseClient(); if (!client) throw new Error('auth_unavailable'); const { data, error: rpcError } = await client.rpc('create_privacy_request', { p_request_type: type, p_details: details }); if (rpcError) throw rpcError; setProtocol(data?.protocol || 'recebido'); setDetails(''); toast?.('Solicitação LGPD registrada') } catch { setError('Não foi possível registrar a solicitação. Tente novamente ou use o canal LGPD.') } finally { setBusy(false) } }
  const exportLocal = () => { const state = useStore.getState().S; const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fitproplayer-dados-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href) }
  return <div className="privacy-controls">
    <p className="muted privacy-controls-intro">Gerencie seus documentos, seus dados e seus direitos em áreas separadas.</p>
    <section className="privacy-control-section" aria-labelledby="privacy-documents-title">
      <h2 id="privacy-documents-title">Documentos e direitos</h2>
      <p className="muted">Consulte as informações sobre o tratamento dos seus dados e como exercer seus direitos.</p>
      <div className="btn-row"><a className="btn" href="#/privacy">Aviso de Privacidade</a><a className="btn" href="#/data-rights">Direitos dos titulares</a></div>
    </section>
    <section className="privacy-control-section" aria-labelledby="privacy-export-title">
      <h2 id="privacy-export-title">Cópia dos seus dados</h2>
      <p className="muted">Baixe uma cópia dos dados salvos neste dispositivo para guardar ou consultar.</p>
      <button className="btn ghost" type="button" onClick={exportLocal}>Exportar cópia local</button>
    </section>
    <section className="privacy-control-section" aria-labelledby="privacy-request-title">
      <h2 id="privacy-request-title">Solicitar atendimento LGPD</h2>
      <p className="muted">Escolha um direito e descreva o que precisa ser analisado. O atendimento autenticado gera um protocolo.</p>
      <form onSubmit={submit}><label>Tipo de solicitação<select className="input" value={type} onChange={event => setType(event.target.value)}>{REQUESTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Detalhes<textarea className="input" value={details} maxLength={4000} onChange={event => setDetails(event.target.value)} placeholder="Explique o que precisa ser analisado." /></label><Button variant="primary" type="submit" state={busy ? 'loading' : 'idle'} loadingLabel="Registrando…">Registrar solicitação</Button></form>
      {protocol && <p role="status">Solicitação registrada. Protocolo: <strong>{protocol}</strong></p>}{error && <p role="alert" className="error">{error}</p>}
    </section>
  </div>
}
