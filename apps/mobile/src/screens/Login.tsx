import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { ApiError, translate } from '@netforge/shared';
import { api, useSession, useT } from '../store';
import { useTheme } from '../theme';
import { Button, Field } from '../ui';

export function Login() {
  const t = useT();
  const c = useTheme();
  const { server: saved, locale, login, setLocale } = useSession();
  const [server, setServer] = useState(saved || 'http://');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const url = server.trim().replace(/\/+$/, '');
    try {
      useSession.setState({ server: url }); // the API client reads the URL from the store
      const r = await api.auth.login(email.trim(), password);
      await login(url, r.token, r.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError(translate(locale, 'auth.invalidCredentials'));
      else if (e instanceof ApiError && e.status === 0) setError(translate(locale, 'auth.connectionFailed'));
      else setError(e instanceof Error ? e.message : translate(locale, 'errors.generic'));
    }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.ink, fontSize: 28, fontWeight: '700' }}>NetForge</Text>
        <Text style={{ color: c.mute, marginBottom: 24 }}>{t('app.tagline')}</Text>
        <Field label={t('auth.serverUrl')} hint={t('mobile.server')} value={server} onChangeText={setServer} keyboardType="url" />
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
        <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
        {error ? <Text accessibilityRole="alert" style={{ color: c.crit, marginBottom: 12 }}>{error}</Text> : null}
        <Button kind="primary" title={busy ? t('auth.signingIn') : t('auth.signIn')} busy={busy} disabled={!email || !password || server.length < 8} onPress={submit} />
        <View style={{ height: 16 }} />
        <Button title={locale === 'fr' ? 'English' : 'Français'} onPress={() => void setLocale(locale === 'fr' ? 'en' : 'fr')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
