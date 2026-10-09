import { Link } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import Icon from '../../../components/Icon.jsx'
const DAYS = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' }
export default function WorkoutRow({ day, title, count, to, state }) {
  return <li className="professional-row"><Link className="professional-row-link" to={to} state={state}><span className="professional-workout-day">{t(DAYS[day] || day)}</span><span className="professional-row-copy"><strong>{title || t(DAYS[day] || day)}</strong><small>{count === 0 ? t('Rest') : t('{0} exercises', count)}</small></span><Icon name="chevronRight" /></Link></li>
}
