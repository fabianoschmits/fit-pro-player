import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import AvatarPicker from '../components/AvatarPicker.jsx'
import AvatarImage from '../components/AvatarImage.jsx'
import DateWheelPicker from '../components/DateWheelPicker.jsx'
import Icon from '../components/Icon.jsx'
import { Segmented, TextField } from '../components/ui.jsx'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXPERIENCE_LABELS, EXPERIENCE_LEVELS, PROFILE_GOAL_LABELS, PROFILE_GOALS, defaultBirthDate, formatPersonName, heightText, normalizeProfile, weightText } from '../lib/profile.js'
import { t } from '../lib/i18n.js'

function EditableField({ name, label, value, summary = value, onChange, children, inputProps = {}, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const save = () => { onChange(draft); setEditing(false); onSaved?.() }
  return <section className={`personal-field ${editing ? 'is-editing' : ''}`} data-profile-field={name}>
    <div className="personal-field-head"><span>{label}</span>{editing ? <button type="button" className="personal-save" onClick={save}><Icon name="check" /> Salvar</button> : <button type="button" className="personal-edit" onClick={() => { setDraft(value ?? ''); setEditing(true) }} aria-label={`Editar ${label}`}><Icon name="edit" /><span>Editar</span></button>}</div>
    <div className="personal-field-summary">{summary || 'Não informado'}</div>
    <div className="personal-field-editor" aria-hidden={!editing}>{children ? children({ editing, value: draft, setValue: setDraft }) : <TextField {...inputProps} disabled={!editing} value={draft} onChange={event => setDraft(event.target.value)} />}</div>
  </section>
}

export default function PersonalData() {
  const nav = useNavigate()
  const S = useStore(state => state.S)
  const update = useStore(state => state.update)
  const toast = useUI(state => state.toast)
  const profile = normalizeProfile(S.profile, S.body)
  const [avatarEditing, setAvatarEditing] = useState(false)
  const [avatarDraft, setAvatarDraft] = useState(profile.avatarId)
  const commit = (key, value) => { update(state => { state.profile = { ...normalizeProfile(state.profile, state.body), [key]: value }; if (key === 'sex') state.body = value }); toast('Salvo com sucesso') }
  return <main className="narrow personal-data-page">
    <AppHeader title="Dados pessoais" subtitle="Mantenha seu perfil atualizado" />
    <button type="button" className="personal-back" onClick={() => nav('/more')}><Icon name="chevronLeft" /> Voltar</button>
    <section className={`personal-avatar-card ${avatarEditing ? 'is-editing' : ''}`} data-profile-field="avatarId">
      <div className="personal-field-head"><span>Seu avatar</span>{avatarEditing ? <button type="button" className="personal-save" onClick={() => { commit('avatarId', avatarDraft); setAvatarEditing(false) }}><Icon name="check" /> Salvar</button> : <button type="button" className="personal-edit" onClick={() => { setAvatarDraft(profile.avatarId); setAvatarEditing(true) }}><Icon name="edit" /><span>Editar</span></button>}</div>
      <div className="personal-avatar-summary"><AvatarImage avatarId={profile.avatarId} alt="" /><span>{avatarEditing ? 'Arraste para os lados e escolha seu avatar' : 'Avatar atual'}</span></div>
      <div className="personal-avatar-editor" aria-hidden={!avatarEditing}><AvatarPicker value={avatarEditing ? avatarDraft : profile.avatarId} onChange={setAvatarDraft} t={t} orientation="horizontal" disabled={!avatarEditing} /></div>
    </section>
    <div className="personal-fields">
      <EditableField name="name" label="Nome" value={formatPersonName(profile.name || '')} summary={formatPersonName(profile.name || '')} onChange={value => commit('name', formatPersonName(value))} inputProps={{ autoComplete: 'name' }} />
      <EditableField name="sex" label="Sexo" value={profile.sex} summary={profile.sex === 'female' ? 'Feminino' : 'Masculino'} onChange={value => commit('sex', value)}>{({ editing, value, setValue }) => <Segmented options={[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Feminino' }]} value={value} onChange={setValue} className={editing ? '' : 'personal-disabled-control'} />}</EditableField>
      <EditableField name="birthDate" label="Data de nascimento" value={profile.birthDate || defaultBirthDate()} summary={profile.birthDate || 'Não informado'} onChange={value => commit('birthDate', value)}>{({ editing, value, setValue }) => <DateWheelPicker value={value} max={new Date().toISOString().slice(0, 10)} onChange={setValue} disabled={!editing} />}</EditableField>
      <EditableField name="heightCm" label="Altura" value={heightText(profile.heightCm)} summary={`${heightText(profile.heightCm)} m`} onChange={value => commit('heightCm', Number(String(value).replace(',', '.')) * (String(value).includes('.') ? 100 : 1))} inputProps={{ inputMode: 'decimal', placeholder: '1,76' }} />
      <EditableField name="startWeight" label="Peso inicial" value={weightText(profile.startWeight)} summary={`${weightText(profile.startWeight)} kg`} onChange={value => commit('startWeight', Number(String(value).replace(',', '.')))} inputProps={{ inputMode: 'decimal', placeholder: '71,2' }} />
      <EditableField name="goal" label="Objetivo" value={profile.goal} summary={profile.goal ? t(PROFILE_GOAL_LABELS[profile.goal]) : 'Não informado'} onChange={value => commit('goal', value)}>{({ editing, value, setValue }) => <Segmented options={PROFILE_GOALS.map(goal => ({ value: goal, label: t(PROFILE_GOAL_LABELS[goal]) }))} value={value} onChange={setValue} className={editing ? '' : 'personal-disabled-control'} />}</EditableField>
      <EditableField name="experience" label="Experiência" value={profile.experience} summary={profile.experience ? t(EXPERIENCE_LABELS[profile.experience]) : 'Não informado'} onChange={value => commit('experience', value)}>{({ editing, value, setValue }) => <Segmented options={EXPERIENCE_LEVELS.map(level => ({ value: level, label: t(EXPERIENCE_LABELS[level]) }))} value={value} onChange={setValue} className={editing ? '' : 'personal-disabled-control'} />}</EditableField>
    </div>
  </main>
}
