import { Button } from '../../ui.jsx'
import { t } from '../../../lib/i18n.js'
export default function WeeklyProgressEmptyState({ current, onStart }) {
  return <section className="card weekly-section weekly-empty" role="status"><h2>{t('No workout recorded this week.')}</h2><p>{t('Your summary updates as you complete workouts.')}</p>{current && <Button variant="primary" onClick={onStart}>{t('Começar treino')}</Button>}</section>
}
