import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { formatPersonName } from '../lib/profile.js';
import { t } from '../lib/i18n.js';
import { useUI } from '../store/useUI.js';
import { useStore } from '../store/useStore.js';
import { Button } from './ui.jsx';
import Icon from './Icon.jsx';
import JourneyLayout from './JourneyLayout.jsx';
import PhoneField from './PhoneField.jsx';
import { phoneDraft, normalizePhone } from '../lib/phone.js';
import { PRIVACY_DOCUMENT_VERSION } from '../lib/privacy-config.js';
import { clearSignUpRateLimit, getSignUpRateLimitState, recordSignUpAttempt } from '../auth/rate-limit.js';
import { waitForFppConfirmation } from './fpp-action-timing.js';
import { getBrowserSupabaseClient } from '../lib/supabase-client.js';

const ERROR_COPY = {
  invalid_credentials: 'Email or password is incorrect.',
  email_already_registered: 'An account already uses this email.',
  password_too_weak: 'Choose a stronger password.',
  network_unavailable: 'Check your connection and try again.',
  auth_unavailable: 'Account sign-in is unavailable right now.',
  email_confirmation_required: 'Confirm your email before signing in.',
  recovery_link_expired: 'This recovery link has expired. Request a new one.',
  recovery_link_invalid: 'This recovery link is invalid. Request a new one.',
  session_expired: 'Your session has expired. Sign in again to continue.',
};
const operationFor = { sign_in: 'signing_in', sign_up: 'signing_up', forgot_password: 'sending_recovery', reset_password: 'resetting_password', confirmation: 'resending_confirmation' };
const initial = mode => ['entry', 'sign_in', 'sign_up', 'forgot_password', 'reset_password'].includes(mode) ? mode : 'entry';
const RESEND_DELAY = 30;

export function openAuthSheet(initialMode = 'entry') {
  return useUI.getState().openSheet(close => <AuthSheet close={close} initialMode={initialMode} />, { className: 'auth-fullscreen' });
}
export function AuthSheet({ close, initialMode = 'entry' }) {
  const auth = useAuth();
  const offlineName = useStore(s => s.S?.profile?.name || '');
  const [mode, setMode] = useState(() => initial(initialMode));
  const [values, setValues] = useState(() => ({ name: formatPersonName(offlineName), email: '', password: '', confirmation: '', accountType: 'student' }));
  const [phone, setPhone] = useState(() => phoneDraft(null));
  const [phoneValidationAttempted, setPhoneValidationAttempted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [, setRateLimitRevision] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [confirmationType, setConfirmationType] = useState('signup');
  const [clock, setClock] = useState(() => Date.now());
  const [emailStatus, setEmailStatus] = useState('idle');
  const [submitState, setSubmitState] = useState('idle');
  const alertRef = useRef(null);
  const submitLock = useRef(false);
  const mounted = useRef(true);
  const confirmation = useRef(null);
  const resetOwner = useRef(null);
  const emailCheckRef = useRef(null);
  const latestAuth = useRef(auth);
  latestAuth.current = auth;
  const busy = submitState === 'loading' || auth.operation === operationFor[mode];
  const signUpLimit = mode === 'sign_up' ? getSignUpRateLimitState(values.email) : null;
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; confirmation.current?.abort(); emailCheckRef.current?.abort(); };
  }, []);
  useEffect(() => {
    setMode(initial(initialMode)); setError(''); setNotice(''); setPrivacyAccepted(false); setEmailStatus('idle');
  }, [initialMode]);
  useEffect(() => {
    if (offlineName && !values.name) setValues(current => ({ ...current, name: formatPersonName(offlineName) }));
  }, [offlineName, values.name]);
  useEffect(() => { if (error) alertRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (mode !== 'confirmation' || resendAvailableAt <= Date.now()) return undefined;
    const timer = setInterval(() => { const now = Date.now(); setClock(now); if (now >= resendAvailableAt) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [mode, resendAvailableAt]);

  const clearPasswords = () => setValues(current => ({ ...current, password: '', confirmation: '' }));
  const change = key => event => {
    const value = key === 'name' ? formatPersonName(event.target.value) : event.target.value;
    setValues(current => ({ ...current, [key]: value }));
    if (key === 'email') { emailCheckRef.current?.abort(); setEmailStatus('idle'); }
  };
  const checkEmail = async email => {
    emailCheckRef.current?.abort();
    if (!email) { setEmailStatus('idle'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailStatus('invalid'); return; }
    const controller = new AbortController(); emailCheckRef.current = controller; setEmailStatus('idle');
    try {
      const client = getBrowserSupabaseClient();
      if (!client) return;
      const { data, error: lookupError } = await client.rpc('check_email_registered', { p_email: email.trim() });
      if (mounted.current && !controller.signal.aborted && !lookupError && data) setEmailStatus('taken');
    } catch { /* An optional email precheck must never block account creation. */ }
  };
  const showMode = next => {
    if (submitLock.current) return;
    emailCheckRef.current?.abort();
    setMode(next); setSubmitState('idle'); setError(''); setNotice(''); setEmailStatus('idle');
    setShowPassword(false); setShowConfirmation(false); clearPasswords();
  };
  const showError = code => setError(t(ERROR_COPY[code] || ERROR_COPY.auth_unavailable));
  const startCooldown = () => { const now = Date.now(); setClock(now); setResendAvailableAt(now + RESEND_DELAY * 1000); };

  const resend = async () => {
    if (submitLock.current || busy || Date.now() < resendAvailableAt) return;
    submitLock.current = true; setSubmitState('loading'); setError(''); setNotice('');
    try {
      const result = confirmationType === 'email_change'
        ? await auth.resendConfirmation(values.email.trim(), 'email_change')
        : await auth.resendConfirmation(values.email.trim());
      if (!mounted.current) return;
      if (result?.kind === 'error') { showError(result.error); setSubmitState('error'); return; }
      setNotice(t('Email de confirmação reenviado. Confira também a pasta de spam.'));
      setSubmitState('idle'); startCooldown();
    } catch { if (mounted.current) { showError('network_unavailable'); setSubmitState('error'); } }
    finally { submitLock.current = false; }
  };

  const submit = async event => {
    event.preventDefault();
    if (submitLock.current || busy) return;
    setError(''); setNotice('');
    if ((mode === 'sign_up' || mode === 'reset_password') && values.password !== values.confirmation) { setError(t('Passwords do not match.')); return; }
    if (mode === 'sign_up') { setPhoneValidationAttempted(true); try { normalizePhone(phone.number, phone.country); } catch { return; } }
    if (mode === 'sign_up' && !privacyAccepted) { setError(t('Aceite o Aviso de Privacidade e os Termos para criar a conta.')); return; }
    if (mode === 'sign_up' && signUpLimit?.blocked) { setError(t('Muitas tentativas de cadastro. Aguarde alguns minutos antes de tentar novamente.')); return; }

    submitLock.current = true; setSubmitState('loading');
    const initialUserId = auth.user?.id;
    try {
      let result;
      if (mode === 'sign_in') result = await auth.signIn({ email: values.email.trim(), password: values.password });
      if (mode === 'sign_up') result = await auth.signUp({ phone: normalizePhone(phone.number, phone.country), displayName: values.name, email: values.email.trim(), password: values.password, accountType: values.accountType, privacyVersion: PRIVACY_DOCUMENT_VERSION });
      if (mode === 'forgot_password') result = await auth.sendPasswordRecovery(values.email.trim());
      if (mode === 'reset_password') result = await auth.updatePassword(values.password);
      if (!mounted.current) return;
      if (result?.kind === 'error') {
        setSubmitState('error');
        if (mode === 'sign_up') { recordSignUpAttempt(values.email); setRateLimitRevision(value => value + 1); }
        if (mode === 'sign_in' && result.error === 'email_confirmation_required') { setConfirmationType('signup'); clearPasswords(); setMode('confirmation'); setSubmitState('idle'); return; }
        showError(result.error); return;
      }
      setSubmitState('success');
      if (mode === 'sign_up') clearSignUpRateLimit(values.email);
      if (mode === 'sign_up' && result?.kind === 'confirmation_required') {
        setConfirmationType(result.confirmationType === 'email_change' ? 'email_change' : 'signup');
        clearPasswords(); setMode('confirmation'); setSubmitState('idle'); startCooldown(); return;
      }
      if (mode === 'forgot_password') { clearPasswords(); setMode('recovery_sent'); setSubmitState('idle'); return; }
      if (mode === 'reset_password' || mode === 'sign_in' || mode === 'sign_up') {
        const knownAccountId = latestAuth.current.user?.id || initialUserId;
        const accountId = result?.data?.user?.id || result?.data?.session?.user?.id || knownAccountId;
        confirmation.current = new AbortController();
        const confirmed = await waitForFppConfirmation(event, { signal: confirmation.current.signal });
        confirmation.current = null;
        if (!confirmed) return;
        const currentAccountId = latestAuth.current.user?.id;
        if (!mounted.current || (knownAccountId && !currentAccountId) || (accountId && currentAccountId && currentAccountId !== accountId)) return;
        clearPasswords();
        if (mode === 'reset_password') { resetOwner.current = currentAccountId || accountId; setMode('reset_success'); setSubmitState('idle'); return; }
        useStore.getState?.().enterApp?.(); close();
      }
    } catch { if (mounted.current) { showError('network_unavailable'); setSubmitState('error'); } }
    finally { submitLock.current = false; }
  };

  const errorMessage = <p id="auth-error" ref={alertRef} role="alert" tabIndex={-1}>{error}</p>;
  if (mode === 'entry') return <JourneyLayout variant="auth" title={t('Seu treino começa com você.')} description={t('Entre para continuar seu plano ou crie sua conta para treinar e acompanhar sua evolução.')}>
    <div className="auth-form auth-entry"><div className="journey-actions"><Button variant="primary" onClick={() => showMode('sign_in')}>{t('Sign in')}</Button><Button onClick={() => showMode('sign_up')}>{t('Create account')}</Button></div><button type="button" className="link" onClick={() => { useStore.getState().enterApp(); close(); }}>{t('Continuar sem conta')}</button><p className="journey-note">{t('Uma conta para treinar e acompanhar alunos.')}</p></div>
  </JourneyLayout>;

  if (mode === 'confirmation' || mode === 'recovery_sent') {
    const confirming = mode === 'confirmation';
    return <JourneyLayout variant="auth" title={t(confirming ? 'Confirme seu email' : 'Confira seu email')} description={t(confirming ? 'Check your email to confirm your account.' : 'If an account exists for this email, we sent recovery instructions.')}>
      <div className="auth-form auth-result"><div className="auth-result__icon" aria-hidden="true"><Icon name="envelope" /></div><p className="auth-result__email">{values.email.trim()}</p><p className="journey-note">{t(confirming ? 'Abra o link no email para ativar sua conta e continuar a configuração.' : 'Abra o link de recuperação para escolher uma nova senha. Confira também a pasta de spam.')}</p>{errorMessage}{notice && <p role="status">{notice}</p>}
        {confirming && <Button data-resend-confirmation variant="primary" disabled={resendSeconds > 0 || busy} state={busy ? 'loading' : 'idle'} onClick={resend}>{resendSeconds > 0 ? t('Reenviar em') + ' ' + resendSeconds + 's' : t('Reenviar email')}</Button>}
        <button type="button" className="link" disabled={busy} onClick={() => showMode(confirming ? 'sign_up' : 'forgot_password')}>{t('Alterar email')}</button><button type="button" className="link" disabled={busy} onClick={() => showMode('sign_in')}>{t('Voltar para entrar')}</button>
      </div>
    </JourneyLayout>;
  }
  if (mode === 'reset_success') return <JourneyLayout variant="auth" title={t('Senha atualizada')} description={t('Seu acesso está pronto. Continue para voltar ao FPP.')}><div className="auth-form auth-result"><Button variant="primary" onClick={() => { if (resetOwner.current && latestAuth.current.user?.id !== resetOwner.current) return; close(); }}>{t('Continuar no FPP')}</Button></div></JourneyLayout>;

  const isSignUp = mode === 'sign_up', isRecovery = mode === 'forgot_password', isReset = mode === 'reset_password';
  const title = isSignUp ? 'Create account' : isRecovery ? 'Recover your password' : isReset ? 'Reset password' : 'Sign in';
  const submitLabel = isSignUp ? 'Create account' : isRecovery ? 'Send recovery email' : isReset ? 'Reset password' : 'Sign in';
  const passwordScore = values.password.length < 8 ? 0 : [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(values.password)).length + 1;
  const passwordLabel = passwordScore < 2 ? 'Fraca' : passwordScore < 4 ? 'Boa' : 'Forte';

  return <JourneyLayout variant="auth" onBack={busy ? undefined : () => showMode(isRecovery ? 'sign_in' : 'entry')} title={t(title)} description={t(isSignUp ? 'Escolha como quer começar. Sua conta pode treinar e acompanhar alunos.' : isRecovery ? 'Enviaremos um link para recuperar seu acesso.' : isReset ? 'Escolha uma senha nova para proteger sua conta.' : 'Seu treino continua no ponto em que você deixou.')}>
    <form className="auth-form" onSubmit={submit}>
      {isSignUp && <>
        <fieldset className="auth-account-type" disabled={busy}><legend>{t('Account type')}</legend><div className="journey-choice-grid">
          <label className={'journey-choice' + (values.accountType === 'student' ? ' is-selected' : '')}><input type="radio" name="accountType" value="student" aria-label={t('Training account')} checked={values.accountType === 'student'} onChange={change('accountType')} /><Icon name="dumbbell" /><span><strong>{t('Quero treinar')}</strong><small>{t('Meu plano e minha evolução.')}</small></span></label>
          <label className={'journey-choice' + (values.accountType === 'professional' ? ' is-selected' : '')}><input type="radio" name="accountType" value="professional" aria-label={t('Professional account')} checked={values.accountType === 'professional'} onChange={change('accountType')} /><Icon name="person" /><span><strong>{t('Quero acompanhar alunos')}</strong><small>{t('Treinos e acompanhamento profissional.')}</small></span></label>
        </div></fieldset>
        <label>{t('Name')}<input className="input" aria-label={t('Name')} autoComplete="name" required disabled={busy} value={values.name} onChange={change('name')} /></label>
      </>}
      {!isReset && <label>{t('Email')}<input className="input" type="email" inputMode="email" aria-label={t('Email')} autoComplete="email" required disabled={busy} aria-describedby={emailStatus === 'invalid' ? 'auth-email-hint' : 'auth-error'} value={values.email} onChange={change('email')} onBlur={isSignUp ? () => checkEmail(values.email) : undefined} /></label>}
      {isSignUp && emailStatus === 'invalid' && <p id="auth-email-hint" className="auth-email-status" role="alert">{t('Digite um email válido (ex: nome@email.com).')}</p>}
      {isSignUp && emailStatus === 'taken' && <p className="auth-email-status" role="alert">{t('Este email já tem uma conta.')} <button type="button" className="link" onClick={() => showMode('sign_in')}>{t('Sign in')}</button></p>}
      {isSignUp && <PhoneField label="Telefone" value={phone} onChange={setPhone} disabled={busy} showErrors={phoneValidationAttempted} />}
      {!isRecovery && <>
        <label>{t(isSignUp || isReset ? 'New password' : 'Password')}<span className="auth-password-field"><input className="input" type={showPassword ? 'text' : 'password'} aria-label={t(isSignUp || isReset ? 'New password' : 'Password')} autoComplete={isSignUp || isReset ? 'new-password' : 'current-password'} required minLength={8} disabled={busy} aria-describedby="auth-error" value={values.password} onChange={change('password')} /><button type="button" aria-label={t(showPassword ? 'Ocultar senha' : 'Mostrar senha')} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><Icon name={showPassword ? 'eyeSlash' : 'eye'} /></button></span></label>
        {(isSignUp || isReset) && values.password && <div className="auth-password-strength" aria-live="polite"><span><i style={{ width: Math.min(100, passwordScore * 20) + '%' }} /></span><b>{t(passwordLabel)}</b></div>}
        {(isSignUp || isReset) && <label>{t('Confirm password')}<span className="auth-password-field"><input className="input" type={showConfirmation ? 'text' : 'password'} aria-label={t('Confirm password')} autoComplete="new-password" required minLength={8} disabled={busy} aria-describedby="auth-error" value={values.confirmation} onChange={change('confirmation')} /><button type="button" aria-label={t(showConfirmation ? 'Ocultar confirmação' : 'Mostrar confirmação')} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)}><Icon name={showConfirmation ? 'eyeSlash' : 'eye'} /></button></span></label>}
      </>}
      {isSignUp && <label className="auth-consent"><input type="checkbox" checked={privacyAccepted} disabled={busy} onChange={event => setPrivacyAccepted(event.target.checked)} /><span>{t('Aceito o')} <a href="#/privacy" target="_blank" rel="noreferrer">{t('Aviso de Privacidade')}</a> {t('e os')} <a href="#/terms" target="_blank" rel="noreferrer">{t('Termos de Uso')}</a>.</span></label>}
      {errorMessage}{notice && <p role="status">{notice}</p>}
      <div className="auth-submit"><Button variant="primary" type="submit" state={busy ? 'loading' : submitState} loadingLabel={t('Loading…')} successLabel={t('Done')}>{t(submitLabel)}</Button></div>
      {mode === 'sign_in' && <button type="button" className="link" disabled={busy} onClick={() => showMode('forgot_password')}>{t('Forgot password?')}</button>}
      {(mode === 'sign_in' || mode === 'sign_up' || mode === 'forgot_password') && <button type="button" className="link" disabled={busy} onClick={() => showMode(mode === 'sign_up' ? 'sign_in' : 'sign_up')}>{t(mode === 'sign_up' ? 'Already have an account? Sign in' : 'Need an account? Create one')}</button>}
    </form>
  </JourneyLayout>;
}
