// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authSignOut: vi.fn().mockResolvedValue({ kind: 'success' }), storeSignOut: vi.fn(), confirm: null, navigate: vi.fn() }));

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 'supabase-user', email: 'ana@example.com' }, signOut: mocks.authSignOut }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../store/useStore.js', async () => {
  const actual = await vi.importActual('../store/useStore.js');
  const state = { S: actual.DEF, user: { id: 'legacy-user', name: 'Legacy' }, syncConflict: false, update: vi.fn(), replaceState: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(), signOut: mocks.storeSignOut, signOutAll: vi.fn(), resolveSyncConflict: vi.fn(), resetDemo: vi.fn() };
  return { ...actual, useStore: selector => selector(state) };
});
vi.mock('../store/useUI.js', () => ({ useUI: selector => selector({ toast: vi.fn() }) }));
vi.mock('../sheets.jsx', async () => ({ ...(await vi.importActual('../sheets.jsx')), confirmSheet: options => { mocks.confirm = options } }));

import Settings from './Settings.jsx';

let dom;
let root;
let container;

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/settings' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  mocks.authSignOut.mockClear(); mocks.storeSignOut.mockClear(); mocks.navigate.mockClear(); mocks.confirm = null;
});
afterEach(async () => { await act(async () => root.unmount()); dom.close(); });

describe('Settings Supabase logout', () => {
  it('routes an authenticated Supabase account through Auth only and keeps the local-data guarantee visible', async () => {
    await act(async () => root.render(<Settings />));
    expect(container.textContent).toContain('ana@example.com');
    expect(container.textContent).toContain('dados de convidado ficam neste dispositivo')
    const signOut = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Terminar sessão'));
    await act(async () => signOut.click());
    await act(async () => mocks.confirm.onConfirm());
    expect(mocks.authSignOut).toHaveBeenCalledTimes(1);
    expect(mocks.storeSignOut).not.toHaveBeenCalled();
  });
});
