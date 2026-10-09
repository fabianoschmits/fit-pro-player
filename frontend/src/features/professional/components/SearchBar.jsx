import { useId } from 'react'
import { t } from '../../../lib/i18n.js'
import Icon from '../../../components/Icon.jsx'
export default function SearchBar({ value, onChange, label }) {
  const id = useId()
  return <div className="professional-search"><label htmlFor={id} className="sr-only">{label}</label><Icon name="magnifier" /><input id={id} type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={label} enterKeyHint="search" autoComplete="off" />{value && <button type="button" aria-label={t('Limpar busca')} onClick={() => onChange('')}>×</button>}</div>
}
