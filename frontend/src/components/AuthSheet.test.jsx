// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: null,
  openSheet: vi.fn(),
  enterApp: vi.fn(),
}));

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }));
vi.mock('../lib/i18n.js', () => ({ t: value => value }));
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.openSheet }) } }));
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector({ S: { profile: { name: 'Offline Ana' } } });
  useStore.getState = () => ({ enterApp: mocks.enterApp });
  return { useStore };
});

import { AuthSheet, openAuthSheet } from './AuthSheet.jsx';

let dom;
let root;
let container;
let close;

const input = label => [...container.querySelectorAll('input')].find(element => element.getAttribute('aria-label') === label);
const button = label => [...container.querySelectorAll('button')].find(element => element.textContent.trim() === label);
const acceptPrivacy = async () => click(container.querySelector('.auth-consent input'));

async function setValue(element, value) {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set;
    set.call(element, value);
    element.dispatchEvent(new dom.Event('input', { bubbles: true }));
  });
}

async function click(element) {
  await act(async () => element.dispatchEvent(new dom.MouseEvent('click', { bubbles: true })));
}

function auth(overrides = {}) {
  return {
    operation: null,
    signIn: vi.fn().mockResolvedValue({ kind: 'authenticated' }),
    signUp: vi.fn().mockResolvedValue({ kind: 'authenticated' }),
    sendPasswordRecovery: vi.fn().mockResolvedValue({ kind: 'success' }),
    updatePassword: vi.fn().mockResolvedValue({ kind: 'success' }),
    ...overrides,
  };
}

async function render(initialMode = 'sign_in') {
  await act(async () => root.render(<AuthSheet close={close} initialMode={initialMode} />));
}

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  close = vi.fn();
  mocks.auth = auth();
  mocks.openSheet.mockReset();
  mocks.enterApp.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.close();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('AuthSheet', () => {
  it('capitalizes signup names using the onboarding rules', async () => {
    await render('sign_up');
    await setValue(input('Name'), 'joÃO da SILVA');
    expect(input('Name').value).toBe('João da Silva');
  });
  it('keeps pointer sign-in open through activation and success confirmation', async () => {
    vi.useFakeTimers();
    await render();
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('Password'), 'long-enough-password');
    const submit = container.querySelector('[type="submit"]');
    await act(async () => {
      submit.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
      submit.dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    });
    expect(mocks.auth.signIn).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(319));
    expect(mocks.auth.signIn).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.auth.signIn).toHaveBeenCalledTimes(1);
    expect(submit.dataset.state).toBe('success');
    expect(close).not.toHaveBeenCalled();
    expect(mocks.enterApp).not.toHaveBeenCalled();
    await act(async () => container.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.auth.signIn).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(519));
    expect(close).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.enterApp).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not enter or close after unmount during pointer success confirmation', async () => {
    vi.useFakeTimers();
    await render();
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('Password'), 'long-enough-password');
    await act(async () => container.querySelector('[type="submit"]').dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
    await act(async () => vi.advanceTimersByTimeAsync(320));
    expect(mocks.auth.signIn).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null));
    await act(async () => vi.advanceTimersByTimeAsync(520));
    expect(mocks.enterApp).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps reduced-motion pointer sign-in immediate', async () => {
    vi.useFakeTimers();
    vi.spyOn(dom, 'matchMedia').mockReturnValue({ matches: true });
    await render();
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('Password'), 'long-enough-password');
    await act(async () => container.querySelector('[type="submit"]').dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
    expect(mocks.auth.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.enterApp).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not close a different account after pointer success confirmation', async () => {
    vi.useFakeTimers();
    mocks.auth = auth({ user: { id: 'account-a' }, signIn: vi.fn().mockResolvedValue({ kind: 'success', data: { user: { id: 'account-a' } } }) });
    await render();
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('Password'), 'long-enough-password');
    await act(async () => container.querySelector('[type="submit"]').dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
    await act(async () => vi.advanceTimersByTimeAsync(320));
    mocks.auth = auth({ user: { id: 'account-b' } });
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(520));
    expect(mocks.enterApp).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('locks native form submissions immediately and exposes pending feedback before auth state updates', async () => {
    let resolve;
    mocks.auth.signIn.mockReturnValue(new Promise(done => { resolve = done }));
    await render();
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('Password'), 'long-enough-password');
    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(mocks.auth.signIn).toHaveBeenCalledTimes(1);
    expect(form.querySelector('[type="submit"]').getAttribute('aria-busy')).toBe('true');
    await act(async () => resolve({ kind: 'error', error: 'network_unavailable' }));
    expect(form.querySelector('[type="submit"]').disabled).toBe(false);
    await act(async () => form.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.auth.signIn).toHaveBeenCalledTimes(2);
  });

  it('provides accessible email/password sign-in controls', async () => {
    await render();

    expect(input('Email').getAttribute('autocomplete')).toBe('email');
    expect(input('Password').getAttribute('autocomplete')).toBe('current-password');
    expect(button('Sign in')).toBeTruthy();
  });

  it('collects display name, email, and a new password for account creation', async () => {
    await render('sign_up');

    expect(input('Name')).toBeTruthy();
    expect(input('Name').value).toBe('Offline Ana');
    expect(input('Email').getAttribute('autocomplete')).toBe('email');
    expect(input('New password').getAttribute('autocomplete')).toBe('new-password');
    expect(input('Confirm password')).toBeTruthy();
    expect(container.querySelector('.auth-security-status')).toBeNull();
    const logo = container.querySelector('.auth-brand-logo');
    expect(logo).toBeTruthy();
    expect(logo.getAttribute('src')).toBe('/brand-logo.svg');
  });

  it('shows password strength and toggles password visibility', async () => {
    await render('sign_up');
    await setValue(input('New password'), 'Short1!');
    expect(container.querySelector('.auth-password-strength')).toBeTruthy();
    expect(container.textContent).toContain('Fraca');
    await setValue(input('New password'), 'MuchStronger1!');
    expect(container.textContent).toContain('Forte');
    const toggle = container.querySelector('button[aria-label="Mostrar senha"]');
    expect(input('New password').type).toBe('password');
    await click(toggle);
    expect(input('New password').type).toBe('text');
  });

  it('lets signup choose a professional account without assigning roles in the browser', async () => {
    await render('sign_up');
    const accountType = container.querySelector('select[aria-label="Account type"]');
    expect(accountType).toBeTruthy();
    await act(async () => {
      accountType.value = 'professional';
      accountType.dispatchEvent(new dom.Event('change', { bubbles: true }));
    });
    await setValue(input('Name'), 'Ana');
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('New password'), 'long-enough-password');
    await setValue(input('Confirm password'), 'long-enough-password');
    await acceptPrivacy();
    await click(button('Create account'));

    expect(mocks.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ accountType: 'professional' }));
  });

  it('enters the app immediately after sign-in', async () => {
    await render('sign_in');
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('Password'), 'long-enough-password');
    await click(button('Sign in'));
    expect(mocks.enterApp).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('enters after immediate sign-in while the new account context is still rendering', async () => {
    mocks.auth = auth({ user: null, signIn: vi.fn().mockResolvedValue({ kind: 'success', data: { user: { id: 'new-account' } } }) });
    await render();
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('Password'), 'long-enough-password');
    await click(button('Sign in'));
    expect(mocks.enterApp).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('disables the active submit while the matching Auth operation is pending', async () => {
    mocks.auth = auth({ operation: 'signing_up' });
    await render('sign_up');

    expect(button('Create account').disabled).toBe(true);
  });

  it('shows confirmation guidance when sign-up requires email confirmation', async () => {
    mocks.auth = auth({ signUp: vi.fn().mockResolvedValue({ kind: 'confirmation_required' }) });
    await render('sign_up');
    await setValue(input('Name'), 'Ana');
    await setValue(input('Email'), 'ana@example.com');
    await setValue(input('New password'), 'long-enough-password');
    await setValue(input('Confirm password'), 'long-enough-password');
    await acceptPrivacy();

    await click(button('Create account'));

    expect(container.textContent).toContain('Check your email to confirm your account.');
  });

  it.each([
    ['sign_in', 'invalid_credentials', 'Email or password is incorrect.'],
    ['sign_up', 'email_already_registered', 'An account already uses this email.'],
    ['sign_up', 'password_too_weak', 'Choose a stronger password.'],
    ['sign_in', 'network_unavailable', 'Check your connection and try again.'],
    ['sign_in', 'auth_unavailable', 'Account sign-in is unavailable right now.'],
  ])('announces and focuses the translated %s %s error', async (mode, error, message) => {
    const operation = vi.fn().mockResolvedValue({ kind: 'error', error });
    mocks.auth = auth(mode === 'sign_up' ? { signUp: operation } : { signIn: operation });
    await render(mode);
    if (mode === 'sign_up') {
      await setValue(input('Name'), 'Ana');
      await setValue(input('New password'), 'long-enough-password');
      await setValue(input('Confirm password'), 'long-enough-password');
      await acceptPrivacy();
    }
    await setValue(input('Email'), 'ana@example.com');
    if (mode === 'sign_in') await setValue(input('Password'), 'long-enough-password');

    await click(button(mode === 'sign_up' ? 'Create account' : 'Sign in'));

    const alert = container.querySelector('[role="alert"]');
    expect(alert.textContent).toBe(message);
    expect(document.activeElement).toBe(alert);
  });

  it('does not reveal whether password recovery found an account', async () => {
    await render('forgot_password');
    await setValue(input('Email'), 'ana@example.com');

    await click(button('Send recovery email'));

    expect(container.textContent).toContain('If an account exists for this email, we sent recovery instructions.');
    expect(mocks.auth.sendPasswordRecovery).toHaveBeenCalledWith('ana@example.com');
  });

  it('keeps reset open until matching new passwords update successfully', async () => {
    await render('reset_password');
    await setValue(input('New password'), 'long-enough-password');
    await setValue(input('Confirm password'), 'different-password');

    await click(button('Reset password'));

    expect(container.querySelector('[role="alert"]').textContent).toBe('Passwords do not match.');
    expect(document.activeElement).toBe(container.querySelector('[role="alert"]'));
    expect(mocks.auth.updatePassword).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    await setValue(input('Confirm password'), 'long-enough-password');
    await click(button('Reset password'));

    expect(mocks.auth.updatePassword).toHaveBeenCalledWith('long-enough-password');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['recovery_link_invalid', 'This recovery link is invalid. Request a new one.'],
    ['recovery_link_expired', 'This recovery link has expired. Request a new one.'],
  ])('keeps reset open and focuses the mapped %s error', async (error, message) => {
    mocks.auth = auth({ updatePassword: vi.fn().mockResolvedValue({ kind: 'error', error }) });
    await render('reset_password');
    await setValue(input('New password'), 'long-enough-password');
    await setValue(input('Confirm password'), 'long-enough-password');

    await click(button('Reset password'));

    const alert = container.querySelector('[role="alert"]');
    expect(alert.textContent).toBe(message);
    expect(document.activeElement).toBe(alert);
    expect(close).not.toHaveBeenCalled();
  });

  it('opens the shared sheet in the requested mode', () => {
    openAuthSheet('forgot_password');

    expect(mocks.openSheet).toHaveBeenCalledTimes(1);
    const renderSheet = mocks.openSheet.mock.calls[0][0];
    expect(renderSheet(close).props.initialMode).toBe('forgot_password');
  });
});
