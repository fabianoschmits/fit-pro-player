import { describe, expect, it } from 'vitest';

import { toAuthError } from './auth-errors.js';

describe('toAuthError', () => {
  it('maps documented Supabase failures to stable UI codes without exposing a message', () => {
    expect(toAuthError({ code: 'invalid_credentials', message: 'do not expose' }, 'signing_in')).toBe('invalid_credentials');
    expect(toAuthError({ code: 'user_already_exists' }, 'signing_up')).toBe('email_already_registered');
    expect(toAuthError({ status: 422 }, 'signing_up')).toBe('password_too_weak');
    expect(toAuthError({ code: 'over_request_rate_limit' }, 'sending_recovery')).toBe('auth_unavailable');
    expect(toAuthError({ code: 'otp_expired' }, 'recovery')).toBe('recovery_link_expired');
    expect(toAuthError(new TypeError('network failed'), 'signing_in')).toBe('network_unavailable');
  });
});
