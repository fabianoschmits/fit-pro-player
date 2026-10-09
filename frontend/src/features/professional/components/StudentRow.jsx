import { Link } from 'react-router-dom'
import AvatarImage from '../../../components/AvatarImage.jsx'
import Icon from '../../../components/Icon.jsx'
import { isAvatarId } from '../../../lib/avatars.js'
import { t } from '../../../lib/i18n.js'
import StatusBadge from './StatusBadge.jsx'
export default function StudentRow({ student, to }) {
  const name = student.displayName || t('Aluno')
  const parts = name.trim().split(/\s+/)
  const initials = [parts[0]?.[0], parts.length > 1 ? parts.at(-1)?.[0] : ''].join('').toLocaleUpperCase()
  const program = student.currentProgram?.title || student.programTitle
  return <li className="professional-row"><Link className="professional-row-link" to={to}>
    <span className="professional-avatar" aria-hidden="true">{isAvatarId(student.avatarRef) ? <AvatarImage avatarId={student.avatarRef} /> : initials}</span>
    <span className="professional-row-copy"><strong>{name}</strong><small>{program || t('Sem programa ativo')}</small>
      {student.attentionReasons?.length > 0 && <StatusBadge status="attention" />}
    </span><Icon name="chevronRight" />
  </Link></li>
}
