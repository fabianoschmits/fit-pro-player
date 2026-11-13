import { useStore } from '../store/useStore.js'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getBrowserSupabaseClient } from '../lib/supabase-client.js';
import { MOBILE } from '../lib/mobile.js';
import { parseCapacitorAuthUrl } from '../lib/capacitor-auth.js';
import { normalizeProfessionalProfile, professionalProfileMetadata } from '../lib/professional-profile.js';
import { toAuthError } from './auth-errors.js';
import { disableBackgroundNotifications } from '../lib/notification-client.js';
import { useUI } from '../store/useUI.js';

const AuthContext = createContext(null);

function publicUser(user) {
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email || null,
    displayName: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '',
    accountType: user.user_metadata?.account_type === 'professional' ? 'professional' : 'student',
    emailConfirmedAt: user.email_confirmed_at || null,
    isAnonymous: Boolean(user.is_anonymous),
  };
}

function withSignupMetadata(sessionUser, metadata) {
  return {
    ...(sessionUser || {}),
    user_metadata: { ...(sessionUser?.user_metadata || {}), ...metadata },
  }
}

async function provisionProfessional(client, sessionUser) {
  if (sessionUser?.user_metadata?.account_type !== 'professional' || typeof client?.rpc !== 'function') return;
  const draft = sessionUser.user_metadata?.professional_profile || {};
  const professionalName = String(draft.professional_name || sessionUser.user_metadata?.display_name || sessionUser.email?.split('@')[0] || '').trim();
  const profile = normalizeProfessionalProfile({ ...draft, professional_name: professionalName });
  const { error } = await client.rpc('provision_professional_profile', {
    p_professional_name: profile.professionalName,
    p_bio: profile.bio,
    p_specialties: profile.specialties,
    p_city_region: profile.cityRegion,
    p_registration_type: profile.registrationType,
    p_registration_number: profile.registrationNumber,
    p_state_uf: profile.stateUf,
    p_city_name: profile.cityName,
    p_neighborhood: profile.neighborhood,
  });
  if (error) throw error;
}

async function recordPrivacyConsents(client, sessionUser) {
  const version = sessionUser?.user_metadata?.privacy_notice_version;
  if (!version || typeof client?.rpc !== 'function') return;
  for (const purpose of ['privacy', 'terms']) {
    const { error } = await client.rpc('record_privacy_consent', {
      p_version: version,
      p_purpose: purpose,
      p_granted: true,
    });
    if (error) throw error;
  }
}

function callbackUrl(locationLike) {
  if (locationLike instanceof URL) return new URL(locationLike.href);
  if (typeof locationLike === 'string') return new URL(locationLike);
  return new URL(locationLike?.href || window.location.href);
}

export function buildAuthRedirectUrl(locationLike, flow) {
  const url = callbackUrl(locationLike);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('auth_flow', flow);
  return url.toString();
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

export function AuthProvider({ children = undefined, client: injectedClient = undefined, location: injectedLocation = undefined }) {
  const client = injectedClient === undefined ? getBrowserSupabaseClient() : injectedClient;
  const configured = Boolean(client);
  const location = injectedLocation || window.location;
  const [state, setState] = useState(() => ({
    status: configured ? 'initializing' : 'anonymous',
    user: null,
    operation: null,
    recovery: 'idle',
    error: null,
    suppressLegacyResume: false,
  }));
  const revision = useRef(0);
  const fingerprint = useRef(null);
  const previousAccount = useRef(null);
  const professionalProvisioning = useRef(new Set());

  useEffect(() => {
    if (!client) {
      setState(current => ({ ...current, status: 'anonymous', user: null, operation: null }));
      return undefined;
    }

    let disposed = false;
    const provisionOnce = async sessionUser => {
      if (sessionUser?.user_metadata?.account_type !== 'professional' || typeof client.rpc !== 'function') return;
      const userId = sessionUser.id;
      if (!userId || professionalProvisioning.current.has(userId)) return;
      professionalProvisioning.current.add(userId);
      try {
        await provisionProfessional(client, sessionUser);
      } catch (error) {
        professionalProvisioning.current.delete(userId);
        throw error;
      }
    };
    const enforceActiveAccount = async sessionUser => {
      if (!sessionUser?.id || typeof client?.from !== 'function') return;
      const { data, error } = await client.rpc('is_current_user_suspended');
      if (error || !data) return;
      await client.auth.signOut();
      if (!disposed) {
        setState(current => ({
          ...current,
          status: 'anonymous',
          user: null,
          error: { code: 'account_suspended', message: 'Esta conta está suspensa.' },
        }));
      }
    };
    const applySession = (event, session, { recovery = false } = {}) => {
      const user = publicUser(session?.user);
      if (previousAccount.current && previousAccount.current !== user?.id) useStore.getState().clearLocalScope(previousAccount.current);
      previousAccount.current = user?.id || null;
      const nextRecovery = recovery || event === 'PASSWORD_RECOVERY' ? 'required' : undefined;
      const nextFingerprint = `${event}:${user?.id || ''}:${nextRecovery || ''}`;
      if (fingerprint.current === nextFingerprint) return;
      fingerprint.current = nextFingerprint;
      setState(current => ({
        ...current,
        status: user ? 'authenticated' : 'anonymous',
        user,
        error: null,
        ...(nextRecovery ? { recovery: nextRecovery } : {}),
      }));
      void provisionOnce(session?.user).catch(error => {
        if (!disposed) setState(current => ({ ...current, error: toAuthError(error, 'professional_onboarding') }));
      });
      void recordPrivacyConsents(client, session?.user).catch(error => {
        if (!disposed) setState(current => ({ ...current, error: toAuthError(error, 'privacy_consent') }));
      });
      if (user) void enforceActiveAccount(session?.user);
    };
    const applyError = (error, operation) => {
      setState(current => ({ ...current, status: 'anonymous', user: null, error: toAuthError(error, operation) }));
    };
    const { data } = client.auth.onAuthStateChange((event, session) => {
      revision.current += 1;
      applySession(event, session);
    });

    const bootstrap = async () => {
      const url = callbackUrl(location);
      const flow = url.searchParams.get('auth_flow');
      const code = url.searchParams.get('code');
      if (code && flow) {
        const callbackRevision = ++revision.current;
        try {
          const { data: result, error } = await client.auth.exchangeCodeForSession(code);
          if (disposed || callbackRevision !== revision.current) return;
          if (error) throw error;
          applySession(flow === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN', result?.session, { recovery: flow === 'recovery' });
        } catch (error) {
          if (!disposed && callbackRevision === revision.current) applyError(error, flow === 'recovery' ? 'recovery' : 'confirmation');
        } finally {
          url.searchParams.delete('code');
          url.searchParams.delete('auth_flow');
          url.hash = '';
          window.history.replaceState(null, '', url.toString());
        }
        return;
      }

      const bootstrapRevision = ++revision.current;

      // Guard against the "has network adapter but no actual internet" scenario.
      // navigator.onLine returns true whenever any network interface is connected,
      // even when the interface has no route to the internet (e.g. mobile data plan
      // exhausted, captive portal, etc.).  In that case client.auth.getSession()
      // will block on the token-refresh HTTP request until the OS TCP timeout fires
      // (~30 s), keeping the app on a white/loading screen the whole time.
      //
      // Fix: race the getSession() call against a short deadline.  If the deadline
      // fires first we reject with a TypeError, which toAuthError() already maps to
      // 'network_unavailable', triggering the existing offline fallback path below.
      // The cached session is read from localStorage synchronously before the race
      // so we can restore it even if getSession() never resolves.
      const BOOTSTRAP_TIMEOUT_MS = 4500;
      const cachedSession = (() => {
        try {
          const storageKey = client.auth.storageKey ?? `sb-${new URL(client.supabaseUrl).hostname.split('.')[0]}-auth-token`;
          const raw = localStorage.getItem(storageKey);
          return raw ? (JSON.parse(raw)?.currentSession ?? null) : null;
        } catch {
          return null;
        }
      })();

      try {
        const { data: result, error } = await Promise.race([
          client.auth.getSession(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(Object.assign(new TypeError('bootstrap: network request timed out'), { code: 'fetch_failed' })),
              BOOTSTRAP_TIMEOUT_MS,
            ),
          ),
        ]);

        if (disposed || bootstrapRevision !== revision.current) return;
        if (error) {
          // A network error during bootstrap must not sign out a user who has a valid local session.
          // Supabase reads from localStorage first, so if the access token is still fresh the call
          // succeeds without the network.  When it fails (expired token + offline), result?.session
          // may still hold the stored session object — use it as a best-effort fallback so the app
          // can boot with local data instead of showing an anonymous/error state.
          const mapped = toAuthError(error, 'bootstrap');
          if (mapped === 'network_unavailable' || !navigator.onLine) {
            applySession('INITIAL_SESSION', result?.session ?? cachedSession);
            return;
          }
          throw error;
        }
        applySession('INITIAL_SESSION', result?.session);
      } catch (error) {
        if (disposed || bootstrapRevision !== revision.current) return;
        // Timeout or true network failure: fall back to the locally cached session so
        // the user stays signed in and can use offline data instead of seeing an error.
        const mapped = toAuthError(error, 'bootstrap');
        if (mapped === 'network_unavailable') {
          applySession('INITIAL_SESSION', cachedSession);
          return;
        }
        applyError(error, 'bootstrap');
      }
    };

    bootstrap();
    return () => {
      disposed = true;
      data?.subscription?.unsubscribe?.();
    };
  }, [client, location]);

  useEffect(() => {
    if (!client || !MOBILE) return undefined;
    let disposed = false;
    let listener = null;
    import('@capacitor/app').then(({ App }) => App.addListener('appUrlOpen', async ({ url }) => {
      const callback = parseCapacitorAuthUrl(url);
      if (disposed || !callback) return;
      const callbackRevision = ++revision.current;
      try {
        const { data: result, error } = await client.auth.exchangeCodeForSession(callback.code);
        if (disposed || callbackRevision !== revision.current) return;
        if (error) throw error;
        await provisionProfessional(client, result?.session?.user);
        await recordPrivacyConsents(client, result?.session?.user);
        const user = publicUser(result?.session?.user);
        setState(current => ({
          ...current,
          status: user ? 'authenticated' : 'anonymous',
          user,
          recovery: callback.flow === 'recovery' ? 'required' : current.recovery,
          error: null,
        }));
      } catch (error) {
        if (!disposed && callbackRevision === revision.current) setState(current => ({ ...current, error: toAuthError(error, callback.flow) }));
      }
    })).then(handle => { listener = handle; }).catch(() => {});
    return () => { disposed = true; listener?.remove?.(); };
  }, [client]);

  const value = useMemo(() => {
    const unavailable = () => ({ kind: 'error', error: 'auth_unavailable' });
    const execute = async (operation, work) => {
      if (!client) return unavailable();
      setState(current => ({ ...current, operation, error: null }));
      try {
        const { data, error } = await work();
        if (error) {
          const mapped = toAuthError(error, operation);
          setState(current => ({ ...current, error: mapped }));
          return { kind: 'error', error: mapped };
        }
        return { kind: 'success', data };
      } catch (error) {
        const mapped = toAuthError(error, operation);
        setState(current => ({ ...current, error: mapped }));
        return { kind: 'error', error: mapped };
      } finally {
        setState(current => ({ ...current, operation: null }));
      }
    };
    return {
      ...state,
      configured,
      signInAnonymously: async () => {
        const result = await execute('signing_in_anonymously', () => client.auth.signInAnonymously({
          options: { data: { display_name: 'Utilizador local', account_type: 'student' } },
        }));
        if (result.kind !== 'success') return result;
        return { kind: 'authenticated', data: result.data };
      },
      signUp: async (/** @type {{ email?: string, password?: string, displayName?: string, phone?: string, accountType?: string, privacyVersion?: string, professionalProfile?: Partial<ReturnType<typeof normalizeProfessionalProfile>> }} */ { email, password, displayName, phone, accountType = 'student', privacyVersion, professionalProfile } = {}) => {
        const metadata = {
          display_name: displayName,
          ...(phone ? { phone_e164: phone } : {}),
          account_type: accountType === 'professional' ? 'professional' : 'student',
          ...(privacyVersion ? { privacy_notice_version: privacyVersion, terms_version: privacyVersion } : {}),
          ...(accountType === 'professional' && professionalProfile ? { professional_profile: professionalProfileMetadata({ ...professionalProfile, professionalName: professionalProfile.professionalName || displayName }) } : {}),
        };
        const current = state.user;
        if (current?.isAnonymous) {
          const result = await execute('signing_up', () => client.auth.updateUser({
            email,
            password,
            data: metadata,
          }));
          if (result.kind !== 'success') return result;
          try {
            await provisionProfessional(client, withSignupMetadata(result.data?.user || current, metadata));
          } catch (error) {
            const mapped = toAuthError(error, 'professional_onboarding');
            setState(next => ({ ...next, error: mapped }));
            return { kind: 'error', error: mapped };
          }
          if (result.data?.user?.new_email || (!result.data?.user?.email_confirmed_at && result.data?.user?.email)) {
            return { kind: 'confirmation_required', confirmationType: 'email_change' };
          }
          return { kind: 'authenticated' };
        }
        const result = await execute('signing_up', () => client.auth.signUp({
          email,
          password,
          options: { data: metadata, emailRedirectTo: buildAuthRedirectUrl(location, 'confirm') },
        }));
        if (result.kind !== 'success') return result;
        if (result.data?.session) {
          try {
            await provisionProfessional(client, withSignupMetadata(result.data.session.user, metadata));
          } catch (error) {
            const mapped = toAuthError(error, 'professional_onboarding');
            setState(currentState => ({ ...currentState, error: mapped }));
            return { kind: 'error', error: mapped };
          }
          return { kind: 'authenticated' };
        }
        return { kind: 'confirmation_required' };
      },
      signIn: ({ email, password }) => execute('signing_in', () => client.auth.signInWithPassword({ email, password })),
      resendConfirmation: async (email, type = 'signup') => {
        if (type !== 'signup' && type !== 'email_change') return unavailable();
        return execute('resending_confirmation', () => client.auth.resend({
          type, email,
          options: { emailRedirectTo: buildAuthRedirectUrl(location, 'confirm') },
        }));
      },
      sendPasswordRecovery: email => execute('sending_recovery', () => client.auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthRedirectUrl(location, 'recovery'),
      })),
      updatePassword: async password => {
        const result = await execute('resetting_password', () => client.auth.updateUser({ password }))
        if (result.kind === 'success') setState(current => ({ ...current, recovery: 'idle' }))
        return result
      },
      signOut: async () => {
        // Detach this device while its authenticated RPC still has the current owner.
        await disableBackgroundNotifications();
        const result = await execute('signing_out', () => client.auth.signOut());
        if (result.kind === 'success') {
          if (state.user?.id) useStore.getState().clearLocalScope(state.user.id);
          useUI.getState().closeAll();
          setState(current => ({ ...current, suppressLegacyResume: true, user: null, status: 'anonymous' }));
        }
        return result;
      },
      deleteAccount: async () => {
        if (globalThis.navigator?.onLine === false) return { kind: 'error', error: 'network_unavailable' };
        const owner = state.user?.id;
        const deletingRevision = revision.current;
        const sameAccount = () => revision.current === deletingRevision;
        const result = await execute('deleting_account', async () => {
          const { data: sessionData, error: sessionError } = await client.auth.getSession();
          if (sessionError) return { data: null, error: sessionError };
          const token = sessionData?.session?.access_token;
          if (!sameAccount() || !owner || sessionData?.session?.user?.id !== owner || !token) throw new Error('account changed');
          const { error } = await client.functions.invoke('body-progress-photo-cleanup', { body: { action: 'account' }, headers: { Authorization: `Bearer ${token}` } });
          if (error) return { data: null, error };
          if (!sameAccount()) throw new Error('account changed');
          // Pin the authorization header: cross-tab session changes can never target another user.
          return client.rpc('delete_my_account').setHeader('Authorization', `Bearer ${token}`);
        });
        if (result.kind !== 'success') return result;
        if (!sameAccount()) return result;
        await disableBackgroundNotifications();
        if (!sameAccount()) return result;
        await client.auth.signOut({ scope: 'local' });
        setState(current => ({ ...current, suppressLegacyResume: true, user: null, status: 'anonymous' }));
        // The server-side delete already succeeded. Clear the local Auth session even if
        // Supabase reports a best-effort sign-out transport error afterward.
        return { kind: 'success' };
      },
    };
  }, [client, configured, location, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
