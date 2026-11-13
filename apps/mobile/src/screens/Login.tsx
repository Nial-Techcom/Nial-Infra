import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { ApiError, isInsecureRemoteUrl, translate, type AuthConfig } from '@infra-tech/shared';
import { api, useSession, useT } from '../store';
import { useTheme } from '../theme';
import { Button, Field } from '../ui';

type Mode = 'login' | 'register' | 'forgot';

/** Sign in, create an account (no client access until invited) and "forgot password". */
export function Login() {
  const t = useT();
  const c = useTheme();
  const { server: saved, locale, login, setLocale } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [server, setServer] = useState(saved || 'http://');
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  const [f, setF] = useState({ email: '', name: '', password: '', password2: '', invite: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const url = server.trim().replace(/\/+$/, '');

  // The server tells whether registration / e-mail are available (needs a valid URL first).
  useEffect(() => {
    if (!/^https?:\/\/.{3,}/.test(url)) { setCfg(null); return; }
    const id = setTimeout(() => {
      useSession.setState({ server: url });
      api.auth.config().then(setCfg).catch(() => setCfg(null));
    }, 500);
    return () => clearTimeout(id);
  }, [url]);

  // Accept a pasted invitation link or the bare code.
  const inviteToken = (v: string) => { const m = v.match(/invite=([\w-]+)/); return (m ? m[1] : v).trim(); };

  async function submit() {
    setBusy(true); setError(null); setInfo(null);
    try {
      useSession.setState({ server: url }); // the API client reads the URL from the store
      if (mode === 'login') { const r = await api.auth.login(f.email.trim(), f.password); await login(url, r.token, r.user); }
      else if (mode === 'register') {
        if (f.password.length < 8) throw new Error(t('account.passwordHint'));
        if (f.password !== f.password2) throw new Error(t('users.passwordMismatch'));
        const r = await api.auth.register({ email: f.email.trim(), name: f.name.trim(), password: f.password, inviteToken: f.invite.trim() ? inviteToken(f.invite) : undefined });
        await login(url, r.token, r.user);
      } else { await api.auth.forgotPassword(f.email.trim()); setInfo(t('account.linkSent')); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError(translate(locale, 'auth.invalidCredentials'));
      else if (e instanceof ApiError && e.status === 0) setError(translate(locale, 'auth.connectionFailed'));
      else setError(e instanceof Error ? e.message : translate(locale, 'errors.generic'));
    }
    setBusy(false);
  }
  const go = (m: Mode) => { setMode(m); setError(null); setInfo(null); };
  const ok = url.length >= 8 && !!f.email && (mode === 'forgot' || !!f.password) && (mode !== 'register' || !!f.name.trim());
  const closed = mode === 'register' && cfg && !cfg.registrationEnabled && !f.invite.trim();
  const noMail = mode === 'forgot' && cfg && !cfg.emailEnabled;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.ink, fontSize: 28, fontWeight: '700' }}>Infra-Tech</Text>
        <Text style={{ color: c.mute, marginBottom: 24 }}>{mode === 'register' ? t('account.createAccount') : mode === 'forgot' ? t('account.forgotTitle') : t('app.tagline')}</Text>
        <Field label={t('auth.serverUrl')} hint={t('mobile.server')} value={server} onChangeText={setServer} keyboardType="url" />
        {isInsecureRemoteUrl(url) ? <Text accessibilityRole="alert" style={{ color: c.warn ?? c.crit, marginBottom: 12 }}>{t('auth.insecureServer')}</Text> : null}
        {mode === 'register' && <Field label={t('account.fullName')} value={f.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" autoComplete="name" />}
        <Field label={t('auth.email')} value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoComplete="email" />
        {mode !== 'forgot' && <Field label={t('auth.password')} hint={mode === 'register' ? t('account.passwordHint') : undefined} value={f.password} onChangeText={(v) => set('password', v)} secureTextEntry autoComplete="password" onSubmitEditing={mode === 'login' ? submit : undefined} />}
        {mode === 'register' && <Field label={t('users.confirmPassword')} value={f.password2} onChangeText={(v) => set('password2', v)} secureTextEntry />}
        {mode === 'register' && <Field label={`${t('account.inviteTitle')} (${t('common.optional')})`} hint={t('account.inviteHintMobile')} value={f.invite} onChangeText={(v) => set('invite', v)} />}
        {noMail ? <Text style={{ color: c.mute, marginBottom: 12 }}>{t('account.emailDisabled')}</Text> : null}
        {closed ? <Text accessibilityRole="alert" style={{ color: c.crit, marginBottom: 12 }}>{t('account.registrationClosed')}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: c.crit, marginBottom: 12 }}>{error}</Text> : null}
        {info ? <Text style={{ color: c.ok, marginBottom: 12 }}>{info}</Text> : null}
        <Button kind="primary" title={busy ? t('auth.signingIn') : mode === 'login' ? t('auth.signIn') : mode === 'register' ? t('account.register') : t('account.sendLink')} busy={busy} disabled={!ok || !!closed || !!noMail} onPress={submit} />
        <View style={{ height: 12 }} />
        {mode === 'login' && <Button title={t('account.noAccount')} onPress={() => go('register')} />}
        {mode === 'login' && <View style={{ height: 8 }} />}
        {mode === 'login' && <Button title={t('account.forgot')} onPress={() => go('forgot')} />}
        {mode !== 'login' && <Button title={t('account.backToSignIn')} onPress={() => go('login')} />}
        <View style={{ height: 16 }} />
        <Button title={locale === 'fr' ? 'English' : 'Français'} onPress={() => void setLocale(locale === 'fr' ? 'en' : 'fr')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
