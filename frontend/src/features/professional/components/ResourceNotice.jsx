import { t } from '../../../lib/i18n.js'
export default function ResourceNotice({ resource }) {
  return <>{resource.status === 'refreshing' && <span role="status" className="sr-only">{t('Loading…')}</span>}
    {resource.error && <p role="alert" className="management-error">{t('Não foi possível carregar os programas.')} <button onClick={resource.retry}>{t('Tentar novamente')}</button></p>}</>
}
