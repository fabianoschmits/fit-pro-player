import { t } from './i18n-core.js'

// Only known codes and locally authored messages cross the UI boundary. Never
// return an arbitrary backend message, URL, SQL detail or error stack to a user.
export const APP_ERROR_COPY = Object.freeze({
  offline: 'Check your connection and try again.',
  timeout: 'This request took too long. Try again.',
  session: 'Your session has expired. Sign in again to continue.',
  forbidden: 'You do not have permission to do this.',
  conflict: 'Your data changed in another session. Refresh and try again.',
  duplicate: 'This item already exists. Review your data.',
  invalid: 'Review the information and try again.',
  not_found: 'This item is no longer available. Refresh the page.',
  rate_limit: 'Too many attempts. Wait a moment and try again.',
  file_size: 'This file is too large. Choose a smaller file.',
  storage: 'Could not save on this device. Check the available space and try again.',
  unavailable: 'This feature is temporarily unavailable. Try again in a moment.',
  unknown: 'Could not complete this action. Try again.',
})

const localMessages = new Set([
  'Escolha uma imagem de até 20 MB.',
  'Dimensões inválidas ou imagem muito grande. Use uma foto de até 60 megapixels.',
  'Formato inválido. Escolha uma foto JPEG, PNG ou WebP.',
  'Este navegador não abre HEIC/HEIF. Exporte a foto como JPEG na galeria e tente novamente.',
  'Não foi possível abrir a imagem. Escolha outra foto.',
  'Processamento de imagens indisponível neste dispositivo.',
  'Não foi possível comprimir a foto. Tente outra imagem.',
  'Uma foto já está sendo salva.',
  'O envio não foi concluído. Um arquivo pode estar pendente; use “Limpar envios incompletos” antes de tentar novamente.',
  'A mensagem deve ter entre 1 e 3000 caracteres.',
  'Informe um telefone válido com código de área para o país selecionado.',
])

/** Preserve transport metadata for classification; retain the original cause for diagnostics. */
export function serviceError(error, status = undefined) {
  return Object.assign(new Error(error?.message || 'request-failed', { cause: error }), {
    code: error?.code,
    status: error?.status || status,
  })
}

export function classifyAppError(error) {
  const code = String(error?.code || error?.kind || '')
  const message = typeof error === 'string' ? error : String(error?.message || '')
  const status = Number(error?.status || error?.statusCode)
  if (error?.name === 'QuotaExceededError') return 'storage'
  if (['session_expired', 'token_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'PGRST301', 'PGRST302'].includes(code) || status === 401) return 'session'
  if (['request-timeout', 'timeout', 'ETIMEDOUT'].includes(code) || message === 'request-timeout' || error?.name === 'TimeoutError' || status === 408 || status === 504) return 'timeout'
  if (['network_error', 'fetch_failed', 'network_request_failed', 'offline'].includes(code) || /^offline$|^sem conexão\b|failed to fetch|fetch failed|network request failed|networkerror|load failed/i.test(message) || globalThis.navigator?.onLine === false) return 'offline'
  if (code === '42501' || status === 403) return 'forbidden'
  if (code === '23505') return 'duplicate'
  if (code === '40001' || code === 'revision-conflict' || status === 409 || /^(plan selection changed|revision-conflict)$/.test(message)) return 'conflict'
  if (['22023', '23502', '23514'].includes(code) || status === 400 || status === 422) return 'invalid'
  if (status === 404 || code === 'PGRST116') return 'not_found'
  if (status === 429 || /rate_limit|too_many_requests/.test(code)) return 'rate_limit'
  if (status === 413 || code === 'PayloadTooLarge') return 'file_size'
  if (status >= 500 || /^(supabase-unavailable|auth_unavailable|Serviço indisponível\.|Mensagens indisponíveis\. Tente novamente\.)$/.test(message)) return 'unavailable'
  return 'unknown'
}

/**
 * `fallback` must be project-authored copy, never error.message.
 * @param {any} error
 * @param {string} [fallback]
 */
export function appErrorMessage(error, fallback = APP_ERROR_COPY.unknown) {
  const message = typeof error === 'string' ? error : error?.message
  if (localMessages.has(message)) return t(message)
  const kind = classifyAppError(error)
  return t(kind === 'unknown' ? fallback : APP_ERROR_COPY[kind])
}
