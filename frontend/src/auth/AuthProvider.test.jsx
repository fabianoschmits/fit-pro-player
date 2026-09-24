import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, buildAuthRedirectUrl, useAuth } from './AuthProvider.jsx';

const user = { id: '72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2', email: 'ana@example.com', email_confirmed_at: '2026-09-22T00:00:00.000Z' };

function createFakeClient({ session = null, getSession } = {}) {
  let listener;
  const auth = {
    getSession: getSession || vi.fn().mockResolvedValue({ data: { session }, error: null }),
    onAuthStateChange: vi.fn(callback => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    rpc: vi.fn().mockResolvedValue({ data: { verification_status: 'unverified' }, error: null }),
  };
  return { auth, rpc: auth.rpc, emit: (event, nextSession) => listener(event, nextSession) };
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
  it('restores a minimal authenticated user and never exposes token fields', async () => {
    const client = createFakeClient({ session: { user, access_token: 'secret' } });
    await renderProvider(client);
    await act(async () => Promise.resolve());

    expect(latest.status).toBe('authenticated');
    expect(latest.user).toEqual({ id: user.id, email: user.email, emailConfirmedAt: user.email_confirmed_at });
    expect(latest.user).not.toHaveProperty('access_token');
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
    client.rpc.mockImplementation(async name => name === 'delete_my_account' ? { data: null, error: null } : { data: {}, error: null });
    await renderProvider(client);
    await act(async () => Promise.resolve());

    await act(async () => { await expect(latest.deleteAccount()).resolves.toEqual({ kind: 'success' }); });

    expect(client.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(latest.status).toBe('anonymous');
    expect(latest.user).toBeNull();
  });

  it('keeps the account session when remote deletion fails', async () => {
    const client = createFakeClient({ session: { user } });
    client.rpc.mockImplementation(async name => name === 'delete_my_account'
      ? { data: null, error: { code: 'network_error' } }
      : { data: {}, error: null });
    await renderProvider(client);
    await act(async () => Promise.resolve());

    await act(async () => { await expect(latest.deleteAccount()).resolves.toMatchObject({ kind: 'error' }); });

    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(latest.status).toBe('authenticated');
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
      options: expect.objectContaining({ data: { display_name: 'Ana', account_type: 'professional' } }),
    }));
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

    expect(client.rpc).toHaveBeenCalledWith('provision_professional_profile', { p_professional_name: 'Ana' });
  });

  it('provisions professional metadata through the protected Supabase RPC after session bootstrap', async () => {
    const professionalUser = { ...user, user_metadata: { display_name: 'Ana', account_type: 'professional' } };
    const client = createFakeClient({ session: { user: professionalUser } });
    await renderProvider(client);
    await act(async () => Promise.resolve());

    expect(client.rpc).toHaveBeenCalledWith('provision_professional_profile', { p_professional_name: 'Ana' });
  });

  it('keeps professional intent through an email-confirmation reload', async () => {
    const professionalUser = { ...user, user_metadata: { display_name: 'Ana', account_type: 'professional' } };
    const client = createFakeClient();
    client.auth.exchangeCodeForSession.mockResolvedValue({ data: { session: { user: professionalUser } }, error: null });

    await renderProvider(client, new URL('https://app.example/?auth_flow=confirm&code=abc'));
    await act(async () => Promise.resolve());

    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    await vi.waitFor(() => expect(client.rpc).toHaveBeenCalledWith('provision_professional_profile', { p_professional_name: 'Ana' }));
    expect(latest.status).toBe('authenticated');
  });
});

describe('buildAuthRedirectUrl', () => {
  it('uses the hash-free root without carrying a token or route', () => {
    expect(buildAuthRedirectUrl('https://app.example/#/settings?x=1', 'confirm')).toBe('https://app.example/?auth_flow=confirm');
    expect(buildAuthRedirectUrl('https://app.example/#/settings', 'recovery')).toBe('https://app.example/?auth_flow=recovery');
  });
});
