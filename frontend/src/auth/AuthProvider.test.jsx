// @vitest-environment happy-dom
import  { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const notificationMocks=vi.hoisted(()=>({disable:vi.fn().mockResolvedValue(true)}));
vi.mock('../lib/notification-client.js',()=>({disableBackgroundNotifications:notificationMocks.disable}));

import { AuthProvider, buildAuthRedirectUrl, useAuth } from './AuthProvider.jsx';
import { useUI } from '../store/useUI.js';

const user = { id: '72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2', email: 'ana@example.com', email_confirmed_at: '2026-09-22T00:00:00.000Z' };

function createFakeClient({ session = null, getSession } = {}) {
  let listener;
  const auth = {
    getSession: getSession || vi.fn().mockResolvedValue({ data: { session: session ? { access_token: 'test-token', ...session } : null }, error: null }),
    onAuthStateChange: vi.fn(callback => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ data: { session: { user: { ...user, email: null, is_anonymous: true } } }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    rpc: vi.fn().mockResolvedValue({ data: { verification_status: 'unverified' }, error: null }),
  };
  return { auth, rpc: auth.rpc, functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) }, emit: (event, nextSession) => listener(event, nextSession) };
}

let dom;
let root;
let container;

function Probe({ onValue }) {
  const auth = useAuth();
  useEffect(() => onValue(auth), [auth, onValue]);
  return null;
}

async function renderProvider(client, location = window.location) {
  await act(async () => {
    root.render(<AuthProvider client={client} location={location}><Probe onValue={value => { latest = value; }} /></AuthProvider>);
  });
}

let latest;

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.history = dom.history;
  globalThis.location = dom.location;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  latest = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.close();
  vi.clearAllMocks();
});

describe('AuthProvider', () => {
  it('detaches background delivery before signing out the current authenticated account',async()=>{
    const client=createFakeClient({session:{user}});await renderProvider(client)
    await act(async()=>{await latest.signOut()})
    expect(notificationMocks.disable).toHaveBeenCalledOnce()
    expect(notificationMocks.disable.mock.invocationCallOrder[0]).toBeLessThan(client.auth.signOut.mock.invocationCallOrder[0])
  });
  it('closes open sheets when sign-out clears the authenticated session', async () => {
    const client = createFakeClient({ session: { user } });
    await renderProvider(client);
    useUI.setState({ sheets: [{ id: 'sign-out-confirmation', render: () => null, kind: 'center', locked: false }] });

    await act(async () => { await latest.signOut(); });

    expect(useUI.getState().sheets).toEqual([]);
  });
  it('restores a minimal authenticated user and never exposes token fields', async () => {
    const client = createFakeClient({ session: { user, access_token: 'secret' } });
    await renderProvider(client);
    await act(async () => Promise.resolve());

    expect(latest.status).toBe('authenticated');
    expect(latest.user).toEqual({ id: user.id, email: user.email, displayName: '', accountType: 'student', emailConfirmedAt: user.email_confirmed_at, isAnonymous: false });
    expect(latest.user).not.toHaveProperty('access_token');
  });

  it('exposes the signup display name for onboarding', async () => {
    const client = createFakeClient({ session: { user: { ...user, user_metadata: { display_name: 'João da Silva' } } } });
    await renderProvider(client);
    expect(latest.user.displayName).toBe('João da Silva');
    expect(latest.user).not.toHaveProperty('user_metadata');
  });

  it.each([['professional', 'professional'], ['student', 'student'], ['admin', 'student']])('exposes only a supported onboarding account type from %s metadata', async (accountType, expected) => {
    const client = createFakeClient({ session: { user: { ...user, user_metadata: { account_type: accountType } } } });
    await renderProvider(client);
    expect(latest.user.accountType).toBe(expected);
  });

  it('resends signup confirmation to the hash-free confirmation callback', async () => {
    const client = createFakeClient();
    await renderProvider(client, new URL('https://app.example/#/invite/keep-this'));
    let result;
    await act(async () => { result = await latest.resendConfirmation('ana@example.com'); });
    expect(result.kind).toBe('success');
    expect(client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@example.com', options: { emailRedirectTo: 'https://app.example/?auth_flow=confirm' } });
  });

  it('maps confirmation resend failures without changing the session', async () => {
    const client = createFakeClient();
    client.auth.resend.mockResolvedValue({ data: null, error: { code: 'network_error' } });
    await renderProvider(client);
    await act(async () => { await expect(latest.resendConfirmation('ana@example.com')).resolves.toEqual({ kind: 'error', error: 'network_unavailable' }); });
    expect(latest.status).toBe('anonymous');
    expect(latest.operation).toBeNull();
  });

  it.each([
    { email: 'ana@example.com', email_confirmed_at: null },
    { email: null, new_email: 'ana@example.com', email_confirmed_at: null },
    { email: 'old@example.com', new_email: 'ana@example.com', email_confirmed_at: user.email_confirmed_at },
  ])('resends the email change when upgrading a local session with pending address $new_email', async pending => {
    const anonymous = { ...user, email: null, email_confirmed_at: null, is_anonymous: true };
    const client = createFakeClient({ session: { user: anonymous } });
    client.auth.updateUser.mockResolvedValue({ data: { user: { ...anonymous, ...pending } }, error: null });
    await renderProvider(client);
    let result;
    await act(async () => { result = await latest.signUp({ email: 'ana@example.com', password: 'long-enough-password', displayName: 'Ana' }); });
    expect(result).toEqual({ kind: 'confirmation_required', confirmationType: 'email_change' });
    expect(client.auth.signUp).not.toHaveBeenCalled();
    await act(async () => { await latest.resendConfirmation('ana@example.com', result.confirmationType); });
    expect(client.auth.resend).toHaveBeenCalledWith({ type: 'email_change', email: 'ana@example.com', options: { emailRedirectTo: 'https://app.example/?auth_flow=confirm' } });
    expect(latest.user.id).toBe(anonymous.id);
  });

  it('rejects an unsupported confirmation resend type without contacting Auth', async () => {
    const client = createFakeClient();
    await renderProvider(client);
    await act(async () => { await expect(latest.resendConfirmation('ana@example.com', 'recovery')).resolves.toEqual({ kind: 'error', error: 'auth_unavailable' }); });
    expect(client.auth.resend).not.toHaveBeenCalled();
  });

  it('creates an anonymous session for continue-without-account', async () => {
    const client = createFakeClient();
    await renderProvider(client);
    await act(async () => Promise.resolve());
    await act(async () => { await latest.signInAnonymously(); });
    expect(client.auth.signInAnonymously).toHaveBeenCalledWith({
      options: { data: { display_name: 'Utilizador local', account_type: 'student' } },
    });
  });

  it('boots offline using the cached session when getSession() times out (has network but no internet)', async () => {
    // Simulate: device has a network interface (navigator.onLine = true) but no actual
    // internet — getSession() hangs forever and never resolves within the timeout.
    vi.useFakeTimers();
    const cachedUser = { ...user, id: 'cached-user-id' };
    const neverResolving = new Promise(() => {}); // simulates a hanging HTTP request
    const client = createFakeClient({ getSession: vi.fn(() => neverResolving) });

    // Pre-seed localStorage with the Supabase-format cached session.
    // The key lookup uses client.auth.storageKey or the hostname-based fallback.
    const storageKey = 'sb-test-auth-token';
    client.auth.storageKey = storageKey;
    localStorage.setItem(storageKey, JSON.stringify({ currentSession: { user: cachedUser, access_token: 'cached-token' } }));

    await act(async () => { root.render(<AuthProvider client={client} location={window.location}><Probe onValue={value => { latest = value; }} /></AuthProvider>); });

    // Before the timeout fires the app is still initializing.
    expect(latest.status).toBe('initializing');

    // Advance past the 4 500 ms bootstrap deadline.
    await act(async () => { vi.advanceTimersByTime(5000); });
    await act(async () => Promise.resolve());

    // The app must have booted using the locally cached session.
    expect(latest).not.toBeNull();
    expect(latest.status).toBe('authenticated');
    expect(latest.user.id).toBe(cachedUser.id);

    localStorage.removeItem(storageKey);
    vi.useRealTimers();
  });

  it('lets a newer SIGNED_IN event beat a stale bootstrap result', async () => {
    let resolveBootstrap;
    const staleUser = { ...user, id: '11111111-1111-4111-8111-111111111111' };
    const client = createFakeClient({ getSession: vi.fn(() => new Promise(resolve => { resolveBootstrap = resolve; })) });
    await renderProvider(client);
    await act(async () => client.emit('SIGNED_IN', { user }));
    await act(async () => resolveBootstrap({ data: { session: { user: staleUser } }, error: null }));

    expect(latest.status).toBe('authenticated');
    expect(latest.user.id).toBe(user.id);
  });

  it('handles PKCE recovery at the hash-free root and clears callback parameters', async () => {
    const client = createFakeClient();
    const replaceState = vi.spyOn(history, 'replaceState');
    await renderProvider(client, new URL('https://app.example/?auth_flow=recovery&code=abc#/settings'));
    await act(async () => Promise.resolve());

    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(latest.recovery).toBe('required');
    expect(replaceState).toHaveBeenCalledWith(null, '', 'https://app.example/');
  });

  it('maps a failed recovery callback to a recoverable anonymous state', async () => {
    const client = createFakeClient();
    client.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
    await renderProvider(client, new URL('https://app.example/?auth_flow=recovery&code=abc'));
    await act(async () => Promise.resolve());

    expect(latest.status).toBe('anonymous');
    expect(latest.error).toBe('recovery_link_expired');
  });

  it('clears recovery only after a successful password update', async () => {
    const client = createFakeClient();
    await renderProvider(client, new URL('https://app.example/?auth_flow=recovery&code=abc'));
    await act(async () => Promise.resolve());

    await act(async () => { await latest.updatePassword('new-secure-password'); });

    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'new-secure-password' });
    expect(latest.recovery).toBe('idle');
  });

  it('keeps recovery available when the password update fails', async () => {
    const client = createFakeClient();
    client.auth.updateUser.mockResolvedValue({ data: {}, error: { code: 'weak_password' } });
    await renderProvider(client, new URL('https://app.example/?auth_flow=recovery&code=abc'));
    await act(async () => Promise.resolve());

    await act(async () => { await latest.updatePassword('new-secure-password'); });

    expect(latest.recovery).toBe('required');
  });

  it('keeps an unconfigured app anonymous without calling an Auth method', async () => {
    await renderProvider(null);
    expect(latest).toMatchObject({ status: 'anonymous', configured: false, user: null });
  });

  it('keeps the authenticated scope eligible when Supabase sign-out fails', async () => {
    const client = createFakeClient({ session: { user } });
    client.auth.signOut.mockResolvedValue({ error: { code: 'network_error' } });
    await renderProvider(client);
    await act(async () => Promise.resolve());
    await act(async () => { await latest.signOut(); });
    expect(latest.status).toBe('authenticated');
    expect(latest.user.id).toBe(user.id);
  });

  it('deletes the authenticated account through the protected RPC before clearing the local session', async () => {
    const client = createFakeClient({ session: { user } });
    client.rpc.mockImplementation(name => Object.assign(Promise.resolve(name === 'delete_my_account' ? { data: null, error: null } : { data: {}, error: null }), { setHeader: vi.fn().mockReturnThis() }));
    await renderProvider(client);
    await act(async () => Promise.resolve());

    await act(async () => { await expect(latest.deleteAccount()).resolves.toEqual({ kind: 'success' }); });

    expect(client.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(client.functions.invoke).toHaveBeenCalledWith('body-progress-photo-cleanup', { body: { action: 'account' }, headers: { Authorization: 'Bearer test-token' } });
    expect(client.functions.invoke.mock.invocationCallOrder[0]).toBeLessThan(client.rpc.mock.invocationCallOrder.find(order => order > client.functions.invoke.mock.invocationCallOrder[0]));
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(latest.status).toBe('anonymous');
    expect(latest.user).toBeNull();
  });

  it('keeps the account session when remote deletion fails', async () => {
    const client = createFakeClient({ session: { user } });
    client.rpc.mockImplementation(name => Object.assign(Promise.resolve(name === 'delete_my_account'
      ? { data: null, error: { code: 'network_error' } }
      : { data: {}, error: null }), { setHeader: vi.fn().mockReturnThis() }));
    await renderProvider(client);
    await act(async () => Promise.resolve());

    await act(async () => { await expect(latest.deleteAccount()).resolves.toMatchObject({ kind: 'error' }); });

    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(latest.status).toBe('authenticated');
  });

  it('never deletes a newly signed in account after pending photo cleanup', async () => {
    const client = createFakeClient({ session: { user } });
    let finishCleanup;
    client.functions.invoke.mockImplementation(() => new Promise(resolve => { finishCleanup = resolve; }));
    await renderProvider(client);
    let deletion;
    await act(async () => { deletion = latest.deleteAccount(); });
    expect(finishCleanup).toBeTypeOf('function');
    const other = { ...user, id: '22222222-2222-4222-8222-222222222222' };
    await act(async () => { client.emit('SIGNED_IN', { user: other }); });
    await act(async () => { finishCleanup({ data: { ok: true }, error: null }); await deletion; });
    expect(client.rpc).not.toHaveBeenCalledWith('delete_my_account');
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(latest.user.id).toBe(other.id);
  });

  it('keeps account when photo cleanup fails', async () => {
    const client = createFakeClient({ session: { user } });
    client.functions.invoke.mockResolvedValue({ data: null, error: { code: 'network_error' } });
    await renderProvider(client);
    await act(async () => { await latest.deleteAccount(); });
    expect(client.rpc).not.toHaveBeenCalledWith('delete_my_account');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it('passes the selected account type as public signup metadata', async () => {
    const client = createFakeClient();
    await renderProvider(client);

    await act(async () => {
      await latest.signUp({ email: 'pro@example.com', password: 'long-enough-password', displayName: 'Ana', accountType: 'professional' });
    });

    expect(client.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'pro@example.com',
      password: 'long-enough-password',
      options: expect.objectContaining({ data: expect.objectContaining({ display_name: 'Ana', account_type: 'professional' }) }),
    }));
  });

  it('passes a normalized optional phone to the private signup capture trigger', async () => {
    const client = createFakeClient();
    await renderProvider(client);
    await act(async () => { await latest.signUp({ email: 'student@example.com', password: 'long-enough-password', displayName: 'Ana', phone: '+5511912345678' }); });
    expect(client.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: expect.objectContaining({ phone_e164: '+5511912345678' }) }) }));
  });

  it('does not finish an immediate professional signup before the protected RPC succeeds', async () => {
    const professionalUser = { ...user, user_metadata: { display_name: 'Ana', account_type: 'professional' } };
    const client = createFakeClient();
    client.auth.signUp.mockResolvedValue({ data: { session: { user: professionalUser } }, error: null });
    await renderProvider(client);

    await act(async () => {
      await expect(latest.signUp({ email: user.email, password: 'long-enough-password', displayName: 'Ana', accountType: 'professional' }))
        .resolves.toEqual({ kind: 'authenticated' });
    });

    expect(client.rpc).toHaveBeenCalledWith('provision_professional_profile', expect.objectContaining({ p_professional_name: 'Ana' }));
  });

  it('provisions professional metadata through the protected Supabase RPC after session bootstrap', async () => {
    const professionalUser = { ...user, user_metadata: { display_name: 'Ana', account_type: 'professional' } };
    const client = createFakeClient({ session: { user: professionalUser } });
    await renderProvider(client);
    await act(async () => Promise.resolve());

    expect(client.rpc).toHaveBeenCalledWith('provision_professional_profile', expect.objectContaining({ p_professional_name: 'Ana' }));
  });

  it('keeps professional intent through an email-confirmation reload', async () => {
    const professionalUser = { ...user, user_metadata: { display_name: 'Ana', account_type: 'professional' } };
    const client = createFakeClient();
    client.auth.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: professionalUser } }, error: null });

    await renderProvider(client, new URL('https://app.example/?auth_flow=confirm&code=abc'));
    await act(async () => Promise.resolve());

    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    await vi.waitFor(() => expect(client.rpc).toHaveBeenCalledWith('provision_professional_profile', expect.objectContaining({ p_professional_name: 'Ana' })));
    expect(latest.status).toBe('authenticated');
  });
});

describe('buildAuthRedirectUrl', () => {
  it('uses the hash-free root without carrying a token or route', () => {
    expect(buildAuthRedirectUrl('https://app.example/#/settings?x=1', 'confirm')).toBe('https://app.example/?auth_flow=confirm');
    expect(buildAuthRedirectUrl('https://app.example/#/settings', 'recovery')).toBe('https://app.example/?auth_flow=recovery');
  });
});
