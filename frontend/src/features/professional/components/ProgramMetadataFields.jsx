import { TextField, TextArea } from '../../../components/ui.jsx'
import { t } from '../../../lib/i18n.js'
export default function ProgramMetadataFields({ value, onChange, disabled }) {
  return <div className="professional-metadata-fields">
    {[['title', 'Nome do programa', 160], ['objective', 'Objetivo', 160]].map(([key, label, max]) => <label key={key}>{t(label)}
      <TextField aria-label={t(label)} required={key === 'title'} maxLength={max} value={value[key]} disabled={disabled} onChange={event => onChange({ ...value, [key]: event.target.value })} />
    </label>)}
    <label>{t('Descrição do programa')}<TextArea aria-label={t('Descrição do programa')} maxLength={2000} value={value.description} disabled={disabled} onChange={event => onChange({ ...value, description: event.target.value })} /></label>
  </div>
}
