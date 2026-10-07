import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getBrowserSupabaseClient } from '../lib/supabase-client.js';
import { MOBILE } from '../lib/mobile.js';
import { parseCapacitorAuthUrl } from '../lib/capacitor-auth.js';
import { toAuthError } from './auth-errors.js';
import { disableBackgroundNotifications } from '../lib/notification-client.js';

const AuthContext = createContext(null);

function publicUser(user) {
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email || null,
    emailConfirmedAt: user.email_confirmed_at || null,
    isAnonymous: Boolean(user.is_anonymous),
  };
}

async function provisionProfessional(client, sessionUser) {
  if (sessionUser?.user_metadata?.account_type !== 'professional' || typeof client?.rpc !== 'function') return;
  const professionalName = String(sessionUser.user_metadata?.display_name || sessionUser.email?.split('@')[0] || '').trim();
  const { error } = await client.rpc('provision_professional_profile', {
    p_professional_name: professionalName,
  });
  if (error) throw error;
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

export function AuthProvider({ children, client: injectedClient, location: injectedLocation }) {
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
      const { data, error } = await client.from('profiles').select('suspended_at').eq('id', sessionUser.id).limit(1);
      if (error || !data?.[0]?.suspended_at) return;
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
      try {
        const { data: result, error } = await client.auth.getSession();
        if (disposed || bootstrapRevision !== revision.current) return;
        if (error) throw error;
        applySession('INITIAL_SESSION', result?.session);
      } catch (error) {
        if (!disposed && bootstrapRevision === revision.current) applyError(error, 'bootstrap');
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
      signUp: async ({ email, password, displayName, accountType = 'student' }) => {
        const metadata = { display_name: displayName, account_type: accountType === 'professional' ? 'professional' : 'student' };
        const current = state.user;
        if (current?.isAnonymous) {
          const result = await execute('signing_up', () => client.auth.updateUser({
            email,
            password,
            data: metadata,
          }));
          if (result.kind !== 'success') return result;
          try {
            await provisionProfessional(client, result.data?.user || { ...current, user_metadata: metadata });
          } catch (error) {
            const mapped = toAuthError(error, 'professional_onboarding');
            setState(next => ({ ...next, error: mapped }));
            return { kind: 'error', error: mapped };
          }
          if (!result.data?.user?.email_confirmed_at && result.data?.user?.email) {
            return { kind: 'confirmation_required' };
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
            await provisionProfessional(client, result.data.session.user);
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
        if (result.kind === 'success') setState(current => ({ ...current, suppressLegacyResume: true, user: null, status: 'anonymous' }));
        return result;
      },
      deleteAccount: async () => {
        if (globalThis.navigator?.onLine === false) return { kind: 'error', error: 'network_unavailable' };
        const result = await execute('deleting_account', () => client.rpc('delete_my_account'));
        if (result.kind !== 'success') return result;
        await disableBackgroundNotifications();
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
