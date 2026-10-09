import { t } from '../../../lib/i18n.js'
export default function FilterChips({ options, value, onChange }) {
  return <div className="professional-filter-chips" role="group" aria-label={t('Filtros')}>{options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
}
