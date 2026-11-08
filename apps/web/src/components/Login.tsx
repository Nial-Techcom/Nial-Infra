import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@netforge/shared';
import { api } from '../lib/api';
import { getServerUrl, isDesktop, setServerUrl } from '../lib/platform';
import { useAuth } from '../store/auth';
import { Field } from './ui';

export function Login() {
  const { t, i18n } = useTranslation();
  const setSession = useAuth((s) => s.setSession);
  const [server, setServer] = useState(getServerUrl() ?? 'http://localhost:5000');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = i18n.resolvedLanguage === 'fr' ? 'fr' : 'en';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isDesktop) await setServerUrl(server.trim());
      const r = await api.auth.login(email, password);
      setSession(r.token, r.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError(t('auth.invalidCredentials'));
      else if (err instanceof ApiError && err.status === 0) setError(t('auth.connectionFailed'));
      else setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-panel p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="6" fill="rgb(var(--bg))" stroke="rgb(var(--line))" /><path d="M6 22h6v-6h8v-6h6" stroke="rgb(var(--trunk))" strokeWidth="3" fill="none" strokeLinejoin="round" /></svg>
          <div>
            <h1 className="text-lg font-semibold leading-tight">NetForge</h1>
            <p className="text-xs text-mute">{t('app.tagline')}</p>
          </div>
        </div>
        <div className="space-y-3">
          {isDesktop && <Field label={t('auth.serverUrl')}><input className="nf-input mono" value={server} onChange={(e) => setServer(e.target.value)} required inputMode="url" autoCapitalize="off" /></Field>}
          <Field label={t('auth.email')}><input className="nf-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <Field label={t('auth.password')}><input className="nf-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          {error && <p role="alert" className="text-sm text-crit">{error}</p>}
          <button className="nf-btn nf-btn-primary w-full" disabled={busy}>{busy ? t('auth.signingIn') : t('auth.signIn')}</button>
        </div>
        <button type="button" className="mt-4 text-xs text-mute hover:text-ink" onClick={() => i18n.changeLanguage(lang === 'fr' ? 'en' : 'fr')}>{lang === 'fr' ? 'English' : 'Français'}</button>
      </form>
    </main>
  );
}
