import Link from '../components/ManagementLink.jsx'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementAvatar, ManagementStatus } from '../components/ManagementUI.jsx'
import { Button, SearchField } from '../components/ui.jsx'
export default function ProfessionalStudents() {
 const {user}=useAuth(), [params]=useSearchParams(),repo=useMemo(()=>createProfessionalWorkflowRepository({client:getBrowserSupabaseClient()}),[])
 const [query,setQuery]=useState(''),[status,setStatus]=useState(params.get('status')==='attention'?'attention':'all'),[offset,setOffset]=useState(0),[page,setPage]=useState({items:[]}),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{let alive=true;setLoading(true);const timer=setTimeout(()=>repo.studentPage({search:query,status,offset}).then(result=>{if(alive){setPage(old=>({...result,items:offset?[...old.items,...result.items]:result.items}));setError('')}}).catch(()=>{if(alive)setError('Não foi possível carregar os alunos.')}).finally(()=>{if(alive)setLoading(false)}),200);return()=>{alive=false;clearTimeout(timer)}},[repo,user?.id,query,status,offset,retry])
 return <ManagementLayout title="Meus alunos" backTo="/professional" action={<Link className="management-button" to="/professional/invites">Convidar aluno</Link>}>
 <SearchField onClear={() => { setQuery(''); setOffset(0) }} aria-label="Buscar aluno" placeholder="Buscar aluno" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0)}}/><div className="management-filter">{[['all','Todos'],['attention','Atenção'],['without_program','Sem plano']].map(([value,label])=><Button appearance="custom" intent="quick" key={value} aria-pressed={status===value} onClick={()=>{setStatus(value);setOffset(0)}}>{label}</Button>)}</div>
 {error&&<p role="alert">{error}<Button onClick={()=>setRetry(x=>x+1)}>Tentar novamente</Button></p>}
 {page.items.map(student=><Link className="management-record card" key={student.studentUserId} to={`/professional/students/${student.studentUserId}`}><ManagementAvatar name={student.displayName} avatarRef={student.avatarRef} userId={student.studentUserId}/><div><strong>{student.displayName}</strong><p>{student.currentProgram?.title || 'Sem plano'}</p><ManagementStatus tone={student.attentionReasons.includes('draft') ? 'warning' : student.attentionReasons.length ? 'error' : student.currentProgram ? 'success' : 'neutral'}>{!student.currentProgram ? 'Sem plano de treino' : student.attentionReasons.includes('draft')?'Alterações não enviadas':student.attentionReasons.length?'Precisa de atenção':'Plano atualizado'}</ManagementStatus></div><span>›</span></Link>)}
 {!loading&&!page.items.length&&<p>Nenhum aluno encontrado.</p>}{loading&&<p role="status">Carregando…</p>}{page.hasMore&&<Button disabled={loading} onClick={()=>setOffset(page.items.length)}>Carregar mais</Button>}
 </ManagementLayout>
}
