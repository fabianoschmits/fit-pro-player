import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { todayISO } from '../lib/format.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementAvatar } from '../components/ManagementUI.jsx'
import { Button } from '../components/ui.jsx'
export default function ProfessionalDashboard() {
 const { user } = useAuth(), repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
 const name = useStore(s => s.S.profile?.name)
 const [data,setData]=useState(null), [attention,setAttention]=useState([]), [error,setError]=useState(''), [retry,setRetry]=useState(0)
 useEffect(() => { let alive=true; Promise.all([repo.dashboardSummary({ localDate: todayISO(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),repo.studentPage({ status:'attention',limit:10 })]).then(([summary,page])=>{if(alive){setData(summary);setAttention(page.items);setError('')}}).catch(()=>{if(alive)setError('Não foi possível carregar a área profissional.')});return()=>{alive=false}},[repo,user?.id,retry])
 const cards = items => items.map(student=><Link key={student.studentUserId} className="management-record card" to={`/professional/students/${student.studentUserId}`}><ManagementAvatar name={student.displayName}/><div><strong>{student.displayName}</strong><p>{student.workoutTitle || student.currentProgram?.title || 'Sem plano'}</p></div><span>›</span></Link>)
 return <ManagementLayout title="Área profissional" subtitle={`Olá, ${name || 'profissional'}`}>
 {error&&<p role="alert">{error}<Button onClick={()=>setRetry(x=>x+1)}>Tentar novamente</Button></p>}
 {data&&<><div className="management-overview"><Link to="/professional/students"><strong>{data.activeStudents}</strong>alunos</Link><div><strong>{data.todayWorkouts}</strong>treinos hoje</div><Link to="/professional/students?status=attention"><strong>{data.attentionStudents}</strong>precisam de atenção</Link></div><section><h2>Hoje</h2>{cards(data.today)}{!data.today.length&&<p>Nenhum treino previsto hoje.</p>}</section><section><h2>Precisam de atenção</h2>{cards(attention)}{!attention.length&&<p>Nenhuma pendência identificada.</p>}</section></>}
 <div className="management-action-stack">{[['Alunos','students'],['Modelos','templates'],['Convidar aluno','invites'],['Perfil','profile']].map(([label,path])=><Link className="management-shortcut" key={path} to={`/professional/${path}`}>{label}<span>›</span></Link>)}</div>
 </ManagementLayout>
}
