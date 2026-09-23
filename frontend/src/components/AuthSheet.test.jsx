// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: null,
  openSheet: vi.fn(),
}));

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }));
vi.mock('../lib/i18n.js', () => ({ t: value => value }));
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.openSheet }) } }));

import { AuthSheet, openAuthSheet } from './AuthSheet.jsx';

let dom;
let root;
let container;
let close;

const input = label => [...container.querySelectorAll('input')].find(element => element.getAttribute('aria-label') === label);
const button = label => [...container.querySelectorAll('button')].find(element => element.textContent.trim() === label);

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
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.close();
  vi.clearAllMocks();
});

describe('AuthSheet', () => {
  it('provides accessible email/password sign-in controls', async () => {
    await render();

    expect(input('Email').getAttribute('autocomplete')).toBe('email');
    expect(input('Password').getAttribute('autocomplete')).toBe('current-password');
    expect(button('Sign in')).toBeTruthy();
  });

  it('collects display name, email, and a new password for account creation', async () => {
    await render('sign_up');

    expect(input('Name')).toBeTruthy();
    expect(input('Email').getAttribute('autocomplete')).toBe('email');
    expect(input('New password').getAttribute('autocomplete')).toBe('new-password');
    expect(input('Confirm password')).toBeTruthy();
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
    await click(button('Create account'));

    expect(mocks.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ accountType: 'professional' }));
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
