// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authSignOut: vi.fn().mockResolvedValue({ kind: 'success' }), authDeleteAccount: vi.fn().mockResolvedValue({ kind: 'success' }), confirm: null, navigate: vi.fn(), toast: vi.fn(), auth: null }));

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../store/useStore.js', async () => {
  const actual = await vi.importActual('../store/useStore.js');
  const state = { S: actual.DEF, update: vi.fn(), replaceState: vi.fn(), leaveApp: vi.fn(), clearAnonymousState: vi.fn(), clearLocalScope: vi.fn(), resetDemo: vi.fn() };
  return { ...actual, useStore: selector => selector(state) };
});
vi.mock('../store/useUI.js', () => ({ useUI: selector => selector({ toast: mocks.toast }) }));
vi.mock('../sheets.jsx', async () => ({ ...(await vi.importActual('../sheets.jsx')), confirmSheet: options => { mocks.confirm = options } }));

import Settings from './Settings.jsx';
import More from './More.jsx';

let dom;
let root;
let container;

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/settings' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  mocks.authSignOut.mockReset(); mocks.authSignOut.mockResolvedValue({ kind: 'success' }); mocks.navigate.mockClear(); mocks.toast.mockClear(); mocks.confirm = null;
  mocks.authDeleteAccount.mockReset(); mocks.authDeleteAccount.mockResolvedValue({ kind: 'success' });
  mocks.auth = { status: 'authenticated', configured: true, user: { id: 'supabase-user', email: 'ana@example.com' }, signOut: mocks.authSignOut, deleteAccount: mocks.authDeleteAccount };
});
afterEach(async () => { await act(async () => root.unmount()); dom.close(); });

describe('Settings Supabase logout', () => {
  it('returns to the public landing after resetting all local account data', async () => {
    await act(async () => root.render(<Settings />));
    const reset = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Restaurar tudo'));
    await act(async () => reset.click());
    await act(async () => mocks.confirm.onConfirm());

    expect(mocks.navigate).toHaveBeenCalledWith('/');
  });

  it('deletes the authenticated account before clearing local data', async () => {
    await act(async () => root.render(<Settings />));
    const reset = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Restaurar tudo'));
    await act(async () => reset.click());
    await act(async () => mocks.confirm.onConfirm());

    expect(mocks.authDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/');
  });

  it('keeps authenticated data when account deletion fails', async () => {
    mocks.authDeleteAccount.mockResolvedValue({ kind: 'error', error: 'network_unavailable' });
    await act(async () => root.render(<Settings />));
    const reset = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Restaurar tudo'));
    await act(async () => reset.click());
    await act(async () => mocks.confirm.onConfirm());

    expect(mocks.navigate).not.toHaveBeenCalledWith('/');
    expect(mocks.toast).toHaveBeenCalled();
  });

  it('routes an authenticated Supabase account through Auth only and keeps the local-data guarantee visible', async () => {
    await act(async () => root.render(<Settings />));
    expect(container.textContent).toContain('ana@example.com');
    expect(container.textContent).toContain('dados de convidado ficam neste dispositivo')
    const signOut = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Terminar sessão'));
    await act(async () => signOut.click());
    await act(async () => mocks.confirm.onConfirm());
    expect(mocks.authSignOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the user on the account when Supabase sign-out fails', async () => {
    mocks.authSignOut.mockResolvedValue({ kind: 'error' });
    await act(async () => root.render(<Settings />));
    const signOut = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Terminar sessão'));
    await act(async () => signOut.click());
    await act(async () => mocks.confirm.onConfirm());

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalled();
  });

  it('uses the Supabase email as the account identity without exposing legacy admin UI', async () => {
    await act(async () => root.render(<More />));

    expect(container.textContent).toContain('ana@example.com');
    expect(container.textContent).toContain('Conectado à sua conta');
    expect(container.textContent).not.toContain('Signed in with passkey');
    expect(container.textContent).not.toContain('Admin dashboard');
  });

  it('offers Supabase account entry to an anonymous visitor', async () => {
    mocks.auth = { status: 'anonymous', configured: false, user: null, signOut: mocks.authSignOut };
    await act(async () => root.render(<Settings />));

    expect(container.textContent).toContain('Modo convidado — os dados ficam somente neste navegador.');
    expect(container.textContent).not.toContain('Create passkey profile');
    expect(container.textContent).not.toContain('Create new profile');
  });
});
