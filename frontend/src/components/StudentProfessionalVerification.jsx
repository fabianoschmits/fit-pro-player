import { t } from '../lib/i18n.js'

export function studentVerificationLabel(status) {
  if (status === 'verified') return t('Verificado')
  if (status === 'pending') return t('Em análise')
  if (status === 'rejected') return t('Não aprovado')
  return t('Não verificado')
}
