import useRelationshipRefresh from '../components/useRelationshipRefresh.js'
import Link from '../components/ManagementLink.jsx'
import { useEffect, useMemo, useState } from 'react'

import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { todayISO } from '../lib/format.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { professionalDate } from '../lib/professional-ux.js'
import { ManagementAvatar, ManagementStatus } from '../components/ManagementUI.jsx'
import { Button } from '../components/ui.jsx'
export default function ProfessionalDashboard() {
 const { user } = useAuth(), repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
 const name = useStore(s => s.S.profile?.name)
 const avatarId = useStore(s => s.S.profile?.avatarId)
 const [data,setData]=useState(null), [attention,setAttention]=useState([]), [requests,setRequests]=useState({items:[],total:0}), [error,setError]=useState(''), [retry,setRetry]=useState(0)
 useRelationshipRefresh(() => setRetry(value => value + 1))
 useEffect(() => { let alive=true; Promise.all([repo.dashboardSummary({ localDate: todayISO(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),repo.studentPage({ status:'attention',limit:10 }),repo.linkRequests()]).then(([summary,page,pending])=>{if(alive){setData(summary);setAttention(page.items);setRequests(pending);setError('')}}).catch(()=>{if(alive)setError('Não foi possível carregar a área profissional.')});return()=>{alive=false}},[repo,user?.id,retry])
 const cards = items => items.map(student=><Link key={student.studentUserId} className="management-record card" to={`/professional/students/${student.studentUserId}`}><ManagementAvatar name={student.displayName} avatarRef={student.avatarRef} userId={student.studentUserId}/><div><strong>{student.displayName}</strong><p>{student.workoutTitle || student.currentProgram?.title || 'Sem plano'}</p></div><span>›</span></Link>)
 return <ManagementLayout title="Área profissional" subtitle={`Olá, ${name || 'profissional'}`} action={<Link to="/professional/profile" aria-label="Perfil"><ManagementAvatar name={name} avatarRef={avatarId}/></Link>}>
 {error&&<p role="alert" className="fpp-inline-notice" data-tone="error">{error}<Button onClick={()=>setRetry(x=>x+1)}>Tentar novamente</Button></p>}
 <details className="management-requests-details fpp-details-flow">
  <summary>
   <span className="requests-summary-label">
    <span>Solicitações de vínculo · {requests.total}</span>
   </span>
   <span className="requests-expand-icon">▼</span>
  </summary>
  <div className="management-requests-content">
   {requests.items.map(request=><Link key={request.id} className="management-record card" to={`/professional/requests/${request.id}`}><ManagementAvatar name={request.displayName} avatarRef={request.avatarRef} userId={request.studentUserId}/><div><strong>{request.displayName}</strong><p>{professionalDate(request.createdAt)}</p><ManagementStatus>Aguardando resposta</ManagementStatus></div><span>›</span></Link>)}
   {!requests.total&&<p className="management-requests-empty">Nenhuma solicitação pendente.</p>}
  </div>
 </details>
 {data&&<><div className="management-overview fpp-screen-management-overview"><Link to="/professional/students"><strong>{data.activeStudents}</strong><span>alunos</span></Link><div><strong>{data.todayWorkouts}</strong><span>treinos hoje</span></div><Link to="/professional/students?status=attention"><strong>{data.attentionStudents}</strong><span>precisam de atenção</span></Link></div><section><h2>Hoje</h2>{cards(data.today)}{!data.today.length&&<p>Nenhum treino previsto hoje.</p>}</section><section><h2>Precisam de atenção</h2>{cards(attention)}{!attention.length&&<p>Nenhuma pendência identificada.</p>}</section></>}
 </ManagementLayout>
}
