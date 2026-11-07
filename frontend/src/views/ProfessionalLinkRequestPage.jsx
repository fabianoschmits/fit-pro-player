import { appErrorMessage } from '../lib/app-errors.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { professionalDate } from '../lib/professional-ux.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementAvatar, ManagementPanel, ManagementStatus } from '../components/ManagementUI.jsx'
import { Button } from '../components/ui.jsx'
import { useFppAction } from '../components/useFppAction.js'

export default function ProfessionalLinkRequestPage() {
 const { requestId } = useParams(), { user } = useAuth()
 return <RequestProfile key={`${user?.id}:${requestId}`} requestId={requestId} />
}

function RequestProfile({ requestId }) {
 const nav = useNavigate()
 const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
 const [request, setRequest] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
 const decision = useRef(false), [deciding, setDeciding] = useState(false)
 useEffect(() => {
  let alive = true
  repo.linkRequestDetail(requestId).then(value => { if (alive) { setRequest(value); setError('') } }).catch((failure) => { if (alive) setError(appErrorMessage(failure, 'Não foi possível carregar a solicitação.')) })
  return () => { alive = false }
 }, [repo, requestId, retry])
 const resolve = async accept => {
  if (decision.current || request?.status !== 'pending') return false
  decision.current = true; setDeciding(true); setError('')
  try { return await (accept ? repo.acceptLinkRequest(requestId) : repo.rejectLinkRequest(requestId)) }
  catch (cause) { decision.current = false; setDeciding(false); setError(appErrorMessage(cause, 'Não foi possível responder à solicitação. Tente novamente.')); throw cause }
 }
 const onSuccess = () => { window.dispatchEvent(new Event('professional-relationship-changed')); nav('/professional', { replace: true }) }
 const accept = useFppAction({ onAction: () => resolve(true), onSuccess })
 const reject = useFppAction({ onAction: () => resolve(false), onSuccess })
 return <ManagementLayout title="Solicitação de vínculo" backTo="/professional">
  {error && <p role="alert" className="fpp-inline-notice" data-tone="error">{error}{!request && <Button onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button>}</p>}
  {!request && !error && <p role="status">Carregando solicitação…</p>}
  {request && <ManagementPanel title="Perfil da solicitação">
   <div className="management-person-strip"><ManagementAvatar name={request.displayName} avatarRef={request.avatarRef} userId={request.studentUserId} /><div><h2>{request.displayName}</h2><p>Solicitado em {professionalDate(request.createdAt)}</p></div><ManagementStatus>{({ pending: 'Aguardando resposta', accepted: 'Aceito', rejected: 'Recusado', cancelled: 'Cancelado' })[request.status]}</ManagementStatus></div>
   <p>O acompanhamento começa após o aceite do vínculo.</p>
   {request.status === 'pending' && <div className="row-actions fpp-spaced-actions" role="group" aria-label="Responder à solicitação">
    <Button variant="primary" state={accept.state} disabled={deciding || accept.locked || reject.locked} onClick={accept.run} loadingLabel="Aceitando…" successLabel="Aceito" errorLabel="Tentar novamente">Aceitar</Button>
    <Button variant="danger" state={reject.state} disabled={deciding || accept.locked || reject.locked} onClick={reject.run} loadingLabel="Recusando…" successLabel="Recusado" errorLabel="Tentar novamente">Recusar</Button>
   </div>}
  </ManagementPanel>}
 </ManagementLayout>
}
