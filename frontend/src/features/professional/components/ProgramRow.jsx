import { Link } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import Icon from '../../../components/Icon.jsx'
import { professionalDate } from '../../../lib/professional-ux.js'
import StatusBadge from './StatusBadge.jsx'
export default function ProgramRow({ program, to, onAction, state, onOpen }) {
  return <li className="professional-row"><Link className="professional-row-link" to={to} state={state} onClick={onOpen}><span className="professional-row-copy">
    <strong>{program.title}</strong>{program.objective && <small>{program.objective}</small>}
    <small>{[program.workoutCount != null ? t('{0} treinos', program.workoutCount) : null, program.studentCount != null ? t('{0} alunos', program.studentCount) : null].filter(Boolean).join(' · ')}</small>
    {program.lastChangedAt && <small>{t('Última alteração')}: <time dateTime={program.lastChangedAt}>{professionalDate(program.lastChangedAt)}</time></small>}
    {program.archived && <StatusBadge status="archived" />}
  </span><Icon name="chevronRight" /></Link>{onAction && <button type="button" className="iconbtn" aria-label={t('Ações de {0}', program.title)} onClick={() => onAction(program)}><Icon name="more" /></button>}</li>
}
