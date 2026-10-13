const PLACEHOLDER = 'PREENCHER — identidade jurídica do controlador'

export const PRIVACY_DOCUMENT_VERSION = '2026-10-13'

export function getPrivacyConfig(env = import.meta.env || {}) {
  return {
    controllerName: env.VITE_PRIVACY_CONTROLLER_NAME || PLACEHOLDER,
    dpoEmail: env.VITE_PRIVACY_DPO_EMAIL || 'PREENCHER — canal LGPD',
    controllerAddress: env.VITE_PRIVACY_CONTROLLER_ADDRESS || 'PREENCHER — endereço do controlador',
    retentionSummary: env.VITE_PRIVACY_RETENTION || 'Os prazos devem ser definidos pelo controlador conforme a finalidade e as obrigações legais aplicáveis.',
    operators: env.VITE_PRIVACY_OPERATORS || 'Supabase, Vercel e outros operadores devem ser confirmados pelo controlador.',
    transferSummary: env.VITE_PRIVACY_TRANSFERS || 'Transferências internacionais e respectivas salvaguardas devem ser confirmadas pelo controlador.',
  }
}

export function isPrivacyConfigComplete(config) {
  return Boolean(config?.controllerName && !config.controllerName.startsWith('PREENCHER') && config.dpoEmail && !config.dpoEmail.startsWith('PREENCHER'))
}
