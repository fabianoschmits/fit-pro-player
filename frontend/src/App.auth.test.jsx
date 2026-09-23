import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { status: 'initializing', suppressLegacyResume: false, user: null },
  boot: vi.fn(),
}));

vi.mock('./auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }));
vi.mock('./store/useStore.js', () => ({
  useStore: selector => {
    const state = {
    S: { theme: 'dark', accent: 'lime', lang: 'pt', onboardingDone: true, active: null, keepAwake: false },
    user: null,
    ready: false,
    boot: mocks.boot,
    isGuest: () => false,
    }
    return selector ? selector(state) : state
  },
}));

import App from './App.jsx';

let dom;
let root;
let container;

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
  mocks.auth = { status: 'initializing', suppressLegacyResume: false, user: null };
  mocks.boot.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.close();
});

describe('App Auth boot coordination', () => {
  it('waits for Auth and then disables legacy boot for a Supabase session', async () => {
    await act(async () => root.render(<App />));
    expect(mocks.boot).not.toHaveBeenCalled();

    mocks.auth = { status: 'authenticated', suppressLegacyResume: false, user: { id: 'supabase-user' } };
    await act(async () => root.render(<App />));
    expect(mocks.boot).toHaveBeenCalledWith({ legacySessionEnabled: false });
  });

  it('retains the legacy path only for an anonymous non-suppressed session', async () => {
    mocks.auth = { status: 'anonymous', suppressLegacyResume: false, user: null };
    await act(async () => root.render(<App />));
    expect(mocks.boot).toHaveBeenCalledWith({ legacySessionEnabled: true });
  });
});
