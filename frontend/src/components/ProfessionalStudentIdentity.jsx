import { Button } from './ui.jsx'
import { ManagementAvatar } from './ManagementUI.jsx'
import { useUI } from '../store/useUI.js'
import { ageFromBirthDate, heightText, weightText, currentProfileWeight } from '../lib/profile.js'
import { BODY_MEASUREMENT_BY_ID } from '../lib/body-measurements.js'
import { professionalDate } from '../lib/professional-ux.js'

const missing = 'Não informado'
const goals = {lose_weight:'Perder peso',build_muscle:'Ganhar massa muscular',improve_fitness:'Melhorar condicionamento',maintain_weight:'Manter peso'}
const levels = {beginner:'Iniciante',intermediate:'Intermediário',advanced:'Avançado'}
const date = value => value ? professionalDate(value.length === 10 ? `${value}T12:00:00` : value) : missing

export default function ProfessionalStudentIdentity({data}) {
 const profile = data.profile || {}
 const weights = [...(data.weightHistory || [])].sort((a,b)=>b.measured_on.localeCompare(a.measured_on) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
 const weight = currentProfileWeight({profile,bodyweight:weights.map(row=>({w:Number(row.weight_kg),d:row.measured_on,t:Date.parse(row.created_at)||0}))})
 const age = ageFromBirthDate(profile.birthDate)
 const fields = [['Altura',profile.heightCm > 0 ? `${heightText(profile.heightCm)} m` : missing],['Peso atual',weight ? `${weightText(weight)} kg` : missing],['Idade',age == null ? missing : `${age} anos`]]
 const allFields = [...fields,['Nascimento',date(profile.birthDate)],['Sexo',{male:'Masculino',female:'Feminino'}[profile.sex] || missing],['Objetivo',goals[profile.goal] || missing],['Experiência',levels[profile.experience] || missing],['Aluno desde',date(data.relationshipCreatedAt)]]
 const details = entries => <dl className="professional-student-facts">{entries.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 const open = () => useUI.getState().openSheet(close=><section className="professional-student-details">
  <div className="professional-student-details-heading"><h2>Perfil de {data.displayName}</h2><Button size="sm" variant="tinted" onClick={close}>Fechar</Button></div>
  {details(allFields)}
  <h3>Histórico de peso</h3>
  {weights.length ? <table><thead><tr><th>Data</th><th>Peso</th></tr></thead><tbody>{weights.map(row=><tr key={row.id}><td>{date(row.measured_on)}</td><td>{weightText(Number(row.weight_kg))} kg</td></tr>)}</tbody></table> : <p>Nenhum peso registrado.</p>}
  <h3>Medidas corporais</h3>
  {data.measurements?.length ? data.measurements.map(row=><section key={row.id}><h4>{date(row.measured_on)}</h4>{details(Object.entries(row.measurements_cm || {}).map(([part,value])=>[BODY_MEASUREMENT_BY_ID[part]?.label || part,`${weightText(Number(value))} cm`]))}{row.note && <p>{row.note}</p>}</section>) : <p>Nenhuma medida registrada.</p>}
 </section>)
 return <section className="card professional-student-identity" aria-label={`Resumo de ${data.displayName}`}>
  <div className="professional-student-heading">
   <ManagementAvatar name={data.displayName} avatarRef={data.avatarRef} userId={data.studentUserId}/>
   <div><h2>{data.displayName}</h2><p>Aluno desde {professionalDate(data.relationshipCreatedAt)}</p></div>
  </div>
  {details(fields)}
  <button type="button" className="professional-student-expand" aria-label={`Ver perfil completo de ${data.displayName}`} aria-haspopup="dialog" onClick={open}>Expandir<span aria-hidden="true">＋</span></button>
 </section>
}
