import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { status: 'initializing', suppressLegacyResume: false, user: null },
  boot: vi.fn(),
  enterApp: vi.fn(),
  openAuthSheet: vi.fn(),
  ready: false,
  onboardingDone: true,
}));

vi.mock('./auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }));
vi.mock('./components/AuthSheet.jsx', () => ({ openAuthSheet: mocks.openAuthSheet }));
vi.mock('./views/Landing.jsx', () => ({ default: ({ invitePath }) => <main className="landing-page" data-invite={String(invitePath)} /> }));
vi.mock('./store/useStore.js', () => ({
  useStore: Object.assign(selector => {
    const state = {
    S: { theme: 'dark', accent: 'lime', lang: 'pt', onboardingDone: mocks.onboardingDone, active: null, keepAwake: false },
    user: null,
    ready: mocks.ready,
    boot: mocks.boot,
    isGuest: () => false,
    }
    return selector ? selector(state) : state
  }, { getState: () => ({ enterApp: mocks.enterApp }) }),
  }));

import App from './App.jsx';

let dom;
let root;
let container;

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/home' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.history = dom.history;
  globalThis.location = dom.location;
  globalThis.sessionStorage = dom.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  mocks.auth = { status: 'initializing', suppressLegacyResume: false, user: null };
  mocks.boot.mockReset();
  mocks.enterApp.mockReset();
  mocks.openAuthSheet.mockReset();
  mocks.ready = false;
  mocks.onboardingDone = true;
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.close();
});

describe('App Auth boot coordination', () => {
  it.each(['/connect', '/student/professionals/add', '/connect?code=A1B2C3D4E5', '/student/professionals?code=A1B2C3D4E5', '/student/professionals/add?code=A1B2C3D4E5', '/invite/A1B2C3D4E5'])('retains anonymous invitation context through boot for %s', async route => {
    window.location.hash = `#${route}`;
    mocks.ready = true;
    mocks.auth = { status: 'anonymous', user: null };
    await act(async () => root.render(<App />));
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(container.querySelector('.landing-page')?.dataset.invite).toBe('true');
    expect(sessionStorage.getItem('fpp-pending-invite')).toBe(route.includes('A1B2C3D4E5') ? 'A1B2C3D4E5' : null);
    expect(window.location.hash).toBe(`#${route}`);
    if (!route.includes('A1B2C3D4E5')) {
      mocks.auth = { status:'authenticated', user:{id:'supabase-user'} };
      mocks.onboardingDone = false;
      await act(async () => root.render(<App />));
      await act(async () => { await vi.dynamicImportSettled(); });
      expect(window.location.hash).toBe('#/student/professionals/add');
      expect(container.querySelector('#student-invite-code')?.value).toBe('');
      expect(container.textContent).not.toContain('Confira antes de vincular');
    }
  });
  it('waits for Auth and then disables legacy boot for a Supabase session', async () => {
    await act(async () => root.render(<App />));
    expect(mocks.boot).not.toHaveBeenCalled();

    mocks.auth = { status: 'authenticated', suppressLegacyResume: false, user: { id: 'supabase-user' } };
    await act(async () => root.render(<App />));
    expect(mocks.boot).toHaveBeenCalledWith({ supabaseUserId: 'supabase-user' });
    await act(async () => { await Promise.resolve() });
    expect(mocks.enterApp).toHaveBeenCalledTimes(1);
  });

  it('boots the anonymous local scope after Supabase reports no session', async () => {
    mocks.auth = { status: 'anonymous', suppressLegacyResume: false, user: null };
    await act(async () => root.render(<App />));
    expect(mocks.boot).toHaveBeenCalledWith({ supabaseUserId: null });
  });

  it('opens one reset sheet for duplicate recovery events without changing the URL', async () => {
    mocks.auth = { status: 'authenticated', suppressLegacyResume: false, user: { id: 'supabase-user' }, recovery: 'required' };
    const startUrl = window.location.href;

    await act(async () => root.render(<App />));
    await act(async () => root.render(<App />));

    expect(mocks.openAuthSheet).toHaveBeenCalledTimes(1);
    expect(mocks.openAuthSheet).toHaveBeenCalledWith('reset_password');
    expect(window.location.href).toBe(startUrl);
  });

  it.each(['recovery_link_invalid', 'recovery_link_expired'])('keeps the anonymous landing reachable after a %s callback reload', async error => {
    mocks.ready = true;
    mocks.auth = { status: 'anonymous', suppressLegacyResume: false, user: null, recovery: 'idle', error };

    await act(async () => root.render(<App />));
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(container.querySelector('.landing-page')).toBeTruthy();
  });

  it('keeps the anonymous landing outside the lazy route boundary', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

    expect(source).toContain("import Landing from './views/Landing.jsx'");
    expect(source).not.toContain('const Landing = lazy(loadLanding)');
  });
});
