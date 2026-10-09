import { Link } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import ProfessionalLayout from './ProfessionalLayout.jsx'
import Skeleton from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'
export default function ProgramEditorGate({ resource, children }) {
  const { data, status, authInitializing, authExpired, accountId, error, retry } = resource
  if (data?.program && !data.program.archived) return children
  return <ProfessionalLayout title={t('Programa')} backTo="/professional/programs">
    {authExpired ? <EmptyState title={t('Não foi possível confirmar sua sessão. Tente novamente.')} /> : authInitializing || (status === 'loading' && !data) ? <Skeleton variant="detail" /> : !accountId ? <EmptyState title={t('Entre na sua conta para continuar.')} /> : error ? <EmptyState title={t('Não foi possível carregar os programas.')} action={<button onClick={retry}>{t('Tentar novamente')}</button>} /> : <EmptyState title={t(data?.missing === 'version' ? 'Versão não encontrada.' : data?.program?.archived ? 'Arquivado' : 'Programa não encontrado.')} action={<Link to="/professional/programs">{t('Voltar para programas')}</Link>} />}
  </ProfessionalLayout>
}
