const NETWORK_CODES = new Set(['fetch_failed', 'network_error', 'network_request_failed']);
const EXPIRED_CODES = new Set(['otp_expired', 'token_expired', 'flow_state_expired']);

export function toAuthError(error, operation) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const status = Number(error?.status);

  if (error instanceof TypeError || NETWORK_CODES.has(code)) return 'network_unavailable';
  if (EXPIRED_CODES.has(code)) return operation === 'recovery' ? 'recovery_link_expired' : 'session_expired';
  if (operation === 'recovery') return 'recovery_link_invalid';
  if (code === 'invalid_credentials') return 'invalid_credentials';
  if (code === 'user_already_exists' || code === 'email_exists') return 'email_already_registered';
  if (code === 'email_not_confirmed') return 'email_confirmation_required';
  if (code === 'weak_password' || status === 422) return 'password_too_weak';
  return 'auth_unavailable';
}
