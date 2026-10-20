import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider.jsx';
import { t } from '../lib/i18n.js';
import { useUI } from '../store/useUI.js';
import { useStore } from '../store/useStore.js';
import { Button } from './ui.jsx';
import Icon from './Icon.jsx';
import { PRIVACY_DOCUMENT_VERSION } from '../lib/privacy-config.js'
import { clearSignUpRateLimit, getSignUpRateLimitState, recordSignUpAttempt, signUpRateLimitConfig } from '../auth/rate-limit.js'
import { waitForFppConfirmation } from './fpp-action-timing.js'

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
  return useUI.getState().openSheet(close => <AuthSheet close={close} initialMode={initialMode} />, { className: 'auth-fullscreen' });
}

export function AuthSheet({ close, initialMode = 'entry' }) {
  const auth = useAuth();
  const offlineName = useStore(s => s.S?.profile?.name || '');
  const [mode, setMode] = useState(() => initial(initialMode));
  const [values, setValues] = useState(() => ({ name: offlineName, email: '', password: '', confirmation: '', accountType: 'student' }));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [rateLimitRevision, setRateLimitRevision] = useState(0)
  const alertRef = useRef(null);
  const submitLock = useRef(false);
  const mounted = useRef(true);
  const confirmation = useRef(null)
  const latestAuth = useRef(auth);
  latestAuth.current = auth;
  const [submitState, setSubmitState] = useState('idle');
  const busy = submitState === 'loading' || auth.operation === operationFor[mode];
  const signUpLimit = mode === 'sign_up' ? getSignUpRateLimitState(values.email) : null

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; confirmation.current?.abort() } }, []);

  useEffect(() => {
    setMode(initial(initialMode));
    setError('');
    setNotice('');
    setPrivacyAccepted(false)
  }, [initialMode]);

  useEffect(() => {
    if (offlineName && !values.name) setValues(current => ({ ...current, name: offlineName }));
  }, [offlineName, values.name]);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const change = key => event => setValues(current => ({ ...current, [key]: event.target.value }));
  const showMode = next => {
    if (submitLock.current) return;
    setMode(next);
    setSubmitState('idle');
    setError('');
    setNotice('');
    setShowPassword(false);
    setShowConfirmation(false);
  };
  const showError = code => setError(t(ERROR_COPY[code] || ERROR_COPY.auth_unavailable));

  const submit = async event => {
    event.preventDefault();
    if (submitLock.current || busy) return;
    setError('');
    setNotice('');

    if ((mode === 'sign_up' || mode === 'reset_password') && values.password !== values.confirmation) {
      setError(t('Passwords do not match.'));
      return;
    }
    if (mode === 'sign_up' && !privacyAccepted) { setError('Aceite o Aviso de Privacidade e os Termos para criar a conta.'); return }
    if (mode === 'sign_up' && signUpLimit?.blocked) {
      setError('Muitas tentativas de cadastro. Aguarde alguns minutos antes de tentar novamente.');
      return
    }

    submitLock.current = true;
    setSubmitState('loading');
    const initialUserId = auth.user?.id;
    try {
      let result;
      if (mode === 'sign_in') result = await auth.signIn({ email: values.email, password: values.password });
      if (mode === 'sign_up') result = await auth.signUp({ displayName: values.name, email: values.email, password: values.password, accountType: values.accountType, privacyVersion: PRIVACY_DOCUMENT_VERSION });
      if (mode === 'forgot_password') result = await auth.sendPasswordRecovery(values.email);
      if (mode === 'reset_password') result = await auth.updatePassword(values.password);
      if (!mounted.current) return;

      if (result?.kind === 'error') {
        setSubmitState('error');
        if (mode === 'sign_up') {
          recordSignUpAttempt(values.email)
          setRateLimitRevision(value => value + 1)
        }
        showError(result.error);
        return;
      }
      setSubmitState('success');
      if (mode === 'sign_up') clearSignUpRateLimit(values.email)
      if (mode === 'sign_up' && result?.kind === 'confirmation_required') {
        setNotice(t('Check your email to confirm your account.'));
        return;
      }
      if (mode === 'forgot_password') {
        setNotice(t('If an account exists for this email, we sent recovery instructions.'));
        return;
      }
      if (mode === 'reset_password' || mode === 'sign_in' || mode === 'sign_up') {
        const knownAccountId = latestAuth.current.user?.id || initialUserId;
        const accountId = result?.data?.user?.id || result?.data?.session?.user?.id || knownAccountId;
        confirmation.current = new AbortController()
        const confirmed = await waitForFppConfirmation(event, { signal: confirmation.current.signal })
        confirmation.current = null
        if (!confirmed) return
        const currentAccountId = latestAuth.current.user?.id;
        if (!mounted.current || (knownAccountId && !currentAccountId) || (accountId && currentAccountId && currentAccountId !== accountId)) return;
        if (mode === 'sign_in' || mode === 'sign_up') useStore.getState?.().enterApp?.();
        close();
      }
    } catch {
      if (mounted.current) { showError('network_unavailable'); setSubmitState('error') }
    } finally { submitLock.current = false }
  };

  if (mode === 'entry') {
    return <div className="auth-form auth-entry">
      <div className="auth-form-head"><span className="auth-kicker">FIT PRO PLAYER · SEU TREINO</span><h3>{t('Protect your training')}</h3><p>Seu histórico merece continuar com você. Entre para sincronizar seus treinos ou crie uma conta em menos de um minuto.</p></div>
      <Button variant="primary" onClick={() => showMode('sign_in')}>{t('Sign in')}</Button>
      <Button onClick={() => showMode('sign_up')}>{t('Create account')}</Button>
      <button type="button" className="link" onClick={close}>Continuar sem conta</button>
    </div>;
  }

  const isSignUp = mode === 'sign_up';
  const isRecovery = mode === 'forgot_password';
  const isReset = mode === 'reset_password';
  const title = isSignUp ? 'Create account' : isRecovery ? 'Recover your password' : isReset ? 'Reset password' : 'Sign in';
  const submitLabel = isSignUp ? 'Create account' : isRecovery ? 'Send recovery email' : isReset ? 'Reset password' : 'Sign in';

  const passwordScore = values.password.length < 8 ? 0 : [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(values.password)).length + 1
  const passwordLabel = passwordScore < 2 ? 'Fraca' : passwordScore < 4 ? 'Boa' : 'Forte'

  return <form className="auth-form" onSubmit={submit}>
    <div className="auth-form-head">
      <span className="auth-kicker">FIT PRO PLAYER · CONTA</span>
      <h3>{t(title)}</h3>
      <p>{isSignUp ? 'Salve seu histórico e leve seu treino para onde você estiver.' : isRecovery ? 'Enviaremos um link para recuperar seu acesso.' : 'Seu treino continua no ponto em que você deixou.'}</p>
    </div>
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
      <label>{t(isSignUp || isReset ? 'New password' : 'Password')}<span className="auth-password-field"><input className="input" type={showPassword ? 'text' : 'password'} aria-label={t(isSignUp || isReset ? 'New password' : 'Password')} autoComplete={isSignUp || isReset ? 'new-password' : 'current-password'} required minLength={8} aria-describedby="auth-error" value={values.password} onChange={change('password')} /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(value => !value)}><Icon name={showPassword ? 'eyeSlash' : 'eye'} /></button></span></label>
      {(isSignUp || isReset) && values.password && <div className="auth-password-strength" aria-live="polite"><span><i style={{ width: `${Math.min(100, passwordScore * 20)}%` }} /></span><b>{passwordLabel}</b></div>}
      {(isSignUp || isReset) && <>
        <div style={{ height: 10 }} />
        <label>{t('Confirm password')}<span className="auth-password-field"><input className="input" type={showConfirmation ? 'text' : 'password'} aria-label={t('Confirm password')} autoComplete="new-password" required minLength={8} aria-describedby="auth-error" value={values.confirmation} onChange={change('confirmation')} /><button type="button" aria-label={showConfirmation ? 'Ocultar confirmação' : 'Mostrar confirmação'} onClick={() => setShowConfirmation(value => !value)}><Icon name={showConfirmation ? 'eyeSlash' : 'eye'} /></button></span></label>
      </>}
    </>}
    {isSignUp && <>
      <label className="auth-consent"><input type="checkbox" checked={privacyAccepted} onChange={event => setPrivacyAccepted(event.target.checked)} /> <span>Aceito o <a href="#/privacy" target="_blank" rel="noreferrer">Aviso de Privacidade</a> e os <a href="#/terms" target="_blank" rel="noreferrer">Termos de Uso</a>.</span></label>
      <div className="auth-brand-logo-wrap">
        <img src="/brand-logo.svg" alt="Fit Pro Player" className="auth-brand-logo" />
      </div>
    </>}
    <p id="auth-error" ref={alertRef} role="alert" tabIndex="-1">{error}</p>
    {notice && <p role="status">{notice}</p>}
    <Button variant="primary" type="submit" state={busy ? 'loading' : submitState} loadingLabel={t('Loading…')} successLabel={t('Done')}>{t(submitLabel)}</Button>
    {mode === 'sign_in' && <button type="button" className="link" onClick={() => showMode('forgot_password')}>{t('Forgot password?')}</button>}
    {(mode === 'sign_in' || mode === 'sign_up' || mode === 'forgot_password') && <button type="button" className="link" onClick={() => showMode(mode === 'sign_up' ? 'sign_in' : 'sign_up')}>{t(mode === 'sign_up' ? 'Already have an account? Sign in' : 'Need an account? Create one')}</button>}
  </form>;
}
