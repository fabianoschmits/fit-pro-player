const DEFAULT_CONTROLLER = 'CONFILAR TECNOLOGIA INOVA SIMPLES (I.S.) — CNPJ 65.169.675/0001-04'

export const PRIVACY_DOCUMENT_VERSION = '2026-10-13'

export function getPrivacyConfig(env = import.meta.env || {}) {
  return {
    controllerName: env.VITE_PRIVACY_CONTROLLER_NAME || DEFAULT_CONTROLLER,
    dpoEmail: env.VITE_PRIVACY_DPO_EMAIL || 'privacidade@appconfilar.com.br',
    controllerAddress: env.VITE_PRIVACY_CONTROLLER_ADDRESS || 'Venâncio Aires, Rio Grande do Sul, Brasil',
    retentionSummary: env.VITE_PRIVACY_RETENTION || 'Os dados da conta serão excluídos imediatamente após a solicitação, ressalvadas obrigações legais de conservação.',
    operators: env.VITE_PRIVACY_OPERATORS || 'Supabase (infraestrutura e armazenamento).',
    transferSummary: env.VITE_PRIVACY_TRANSFERS || 'Os dados principais são armazenados na região South America (São Paulo), sa-east-1, Brasil, utilizando o Supabase. Alguns serviços auxiliares do fornecedor podem envolver processamento internacional, conforme os termos e documentos de privacidade do Supabase.',
  }
}

export function isPrivacyConfigComplete(config) {
  return Boolean(config?.controllerName && !config.controllerName.startsWith('PREENCHER') && config.dpoEmail && !config.dpoEmail.startsWith('PREENCHER'))
}
