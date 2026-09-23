import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider.jsx';
import { t } from '../lib/i18n.js';
import { useUI } from '../store/useUI.js';
import { Button } from './ui.jsx';

const ERROR_COPY = {
  invalid_credentials: 'Email or password is incorrect.',
  email_already_registered: 'An account already uses this email.',
  password_too_weak: 'Choose a stronger password.',
  network_unavailable: 'Check your connection and try again.',
  auth_unavailable: 'Account sign-in is unavailable right now.',
  email_confirmation_required: 'Confirm your email before signing in.',
  recovery_link_expired: 'This recovery link has expired. Request a new one.',
  recovery_link_invalid: 'This recovery link is invalid. Request a new one.',
};

const operationFor = {
  sign_in: 'signing_in',
  sign_up: 'signing_up',
  forgot_password: 'sending_recovery',
  reset_password: 'resetting_password',
};

const initial = mode => ['entry', 'sign_in', 'sign_up', 'forgot_password', 'reset_password'].includes(mode) ? mode : 'entry';

export function openAuthSheet(initialMode = 'entry') {
  return useUI.getState().openSheet(close => <AuthSheet close={close} initialMode={initialMode} />);
}

export function AuthSheet({ close, initialMode = 'entry' }) {
  const auth = useAuth();
  const [mode, setMode] = useState(() => initial(initialMode));
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmation: '', accountType: 'student' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alertRef = useRef(null);
  const busy = auth.operation === operationFor[mode];

  useEffect(() => {
    setMode(initial(initialMode));
    setError('');
    setNotice('');
  }, [initialMode]);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const change = key => event => setValues(current => ({ ...current, [key]: event.target.value }));
  const showMode = next => {
    setMode(next);
    setError('');
    setNotice('');
  };
  const showError = code => setError(t(ERROR_COPY[code] || ERROR_COPY.auth_unavailable));

  const submit = async event => {
    event.preventDefault();
    setError('');
    setNotice('');

    if ((mode === 'sign_up' || mode === 'reset_password') && values.password !== values.confirmation) {
      setError(t('Passwords do not match.'));
      return;
    }

    let result;
    if (mode === 'sign_in') result = await auth.signIn({ email: values.email, password: values.password });
    if (mode === 'sign_up') result = await auth.signUp({ displayName: values.name, email: values.email, password: values.password, accountType: values.accountType });
    if (mode === 'forgot_password') result = await auth.sendPasswordRecovery(values.email);
    if (mode === 'reset_password') result = await auth.updatePassword(values.password);

    if (result?.kind === 'error') {
      showError(result.error);
      return;
    }
    if (mode === 'sign_up' && result?.kind === 'confirmation_required') {
      setNotice(t('Check your email to confirm your account.'));
      return;
    }
    if (mode === 'forgot_password') {
      setNotice(t('If an account exists for this email, we sent recovery instructions.'));
      return;
    }
    if (mode === 'reset_password' || mode === 'sign_in' || mode === 'sign_up') close();
  };

  if (mode === 'entry') {
    return <>
      <h3>{t('Protect your training')}</h3>
      <p className="muted small">{t('Create an account to sign in on another device. Your training stays on this device.')}</p>
      <Button variant="primary" onClick={() => showMode('sign_in')}>{t('Sign in')}</Button>
      <div style={{ height: 10 }} />
      <Button onClick={() => showMode('sign_up')}>{t('Create account')}</Button>
    </>;
  }

  const isSignUp = mode === 'sign_up';
  const isRecovery = mode === 'forgot_password';
  const isReset = mode === 'reset_password';
  const title = isSignUp ? 'Create account' : isRecovery ? 'Recover your password' : isReset ? 'Reset password' : 'Sign in';
  const submitLabel = isSignUp ? 'Create account' : isRecovery ? 'Send recovery email' : isReset ? 'Reset password' : 'Sign in';

  return <form onSubmit={submit}>
    <h3>{t(title)}</h3>
    {isSignUp && <>
      <label>{t('Name')}<input className="input" aria-label={t('Name')} autoComplete="name" required value={values.name} onChange={change('name')} /></label>
      <div style={{ height: 10 }} />
      <label>{t('Account type')}<select className="input" aria-label={t('Account type')} value={values.accountType} onChange={change('accountType')}>
        <option value="student">{t('Training account')}</option>
        <option value="professional">{t('Professional account')}</option>
      </select></label>
      <div style={{ height: 10 }} />
    </>}
    {!isReset && <>
      <label>{t('Email')}<input className="input" type="email" inputMode="email" aria-label={t('Email')} autoComplete="email" required aria-describedby="auth-error" value={values.email} onChange={change('email')} /></label>
      <div style={{ height: 10 }} />
    </>}
    {!isRecovery && <>
      <label>{t(isSignUp || isReset ? 'New password' : 'Password')}<input className="input" type="password" aria-label={t(isSignUp || isReset ? 'New password' : 'Password')} autoComplete={isSignUp || isReset ? 'new-password' : 'current-password'} required minLength={8} aria-describedby="auth-error" value={values.password} onChange={change('password')} /></label>
      {(isSignUp || isReset) && <>
        <div style={{ height: 10 }} />
        <label>{t('Confirm password')}<input className="input" type="password" aria-label={t('Confirm password')} autoComplete="new-password" required minLength={8} aria-describedby="auth-error" value={values.confirmation} onChange={change('confirmation')} /></label>
      </>}
    </>}
    <p id="auth-error" ref={alertRef} role="alert" tabIndex="-1">{error}</p>
    {notice && <p role="status">{notice}</p>}
    <Button variant="primary" type="submit" disabled={busy}>{t(submitLabel)}</Button>
    {mode === 'sign_in' && <button type="button" className="link" onClick={() => showMode('forgot_password')}>{t('Forgot password?')}</button>}
    {(mode === 'sign_in' || mode === 'sign_up' || mode === 'forgot_password') && <button type="button" className="link" onClick={() => showMode(mode === 'sign_up' ? 'sign_in' : 'sign_up')}>{t(mode === 'sign_up' ? 'Already have an account? Sign in' : 'Need an account? Create one')}</button>}
  </form>;
}
