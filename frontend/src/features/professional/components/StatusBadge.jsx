import { t } from '../../../lib/i18n.js'
const LABELS = { active: 'Ativo', archived: 'Arquivado', attention: 'Atenção', pending: 'Pendente', completed: 'Concluído', in_progress: 'Em andamento', abandoned: 'Abandonado', without_program: 'Sem programa ativo', verified: 'Verificado' }
export default function StatusBadge({ status, children }) {
  return <span className="professional-status-badge" data-status={status}>{children || t(LABELS[status] || status || '')}</span>
}
