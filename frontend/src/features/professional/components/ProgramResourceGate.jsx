import { Link } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import ProfessionalLayout from './ProfessionalLayout.jsx'
import Skeleton from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'
export default function ProgramResourceGate({ resource, children }) {
  if (resource.data?.program && !resource.data.missing) return children
  return <ProfessionalLayout title={t('Programa')} backTo="/professional/programs">
    {resource.authExpired ? <EmptyState title={t('Não foi possível confirmar sua sessão. Tente novamente.')} />
      : resource.authInitializing || resource.status === 'loading' ? <Skeleton variant="detail" />
      : !resource.accountId ? <EmptyState title={t('Entre na sua conta para continuar.')} />
      : resource.error ? <EmptyState title={t('Não foi possível carregar os programas.')} action={<button onClick={resource.retry}>{t('Tentar novamente')}</button>} />
      : <EmptyState title={t(resource.data?.missing === 'version' ? 'Versão não encontrada.' : 'Programa não encontrado.')} action={<Link to="/professional/programs">{t('Voltar para programas')}</Link>} />}
  </ProfessionalLayout>
}
