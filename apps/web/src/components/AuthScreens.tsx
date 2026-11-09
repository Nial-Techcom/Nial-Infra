import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, type AuthConfig, type InvitePreview } from '@netforge/shared';
import { api, errorText } from '../lib/api';
import { getServerUrl, isDesktop, setServerUrl } from '../lib/platform';
import { useAuth } from '../store/auth';
import { Field } from './ui';

/** Query-string tokens from the links sent by email: ?reset=… and ?invite=… */
export const urlParams = () => {
  const p = new URLSearchParams(window.location.search);
  return { reset: p.get('reset'), invite: p.get('invite') };
};
export const clearUrlParams = () => { try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ignore */ } };

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const Logo = () => (
  <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="6" fill="rgb(var(--bg))" stroke="rgb(var(--line))" /><path d="M6 22h6v-6h8v-6h6" stroke="rgb(var(--trunk))" strokeWidth="3" fill="none" strokeLinejoin="round" /></svg>
);

export function Card({ children, onSubmit }: { children: React.ReactNode; onSubmit?: (e: React.FormEvent) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'fr' ? 'fr' : 'en';
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={onSubmit ?? ((e) => e.preventDefault())} className="w-full max-w-sm rounded-lg border border-line bg-panel p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3"><Logo /><div><h1 className="text-lg font-semibold leading-tight">NetForge</h1><p className="text-xs text-mute">{t('app.tagline')}</p></div></div>
        {children}
        <button type="button" className="mt-4 block text-xs text-mute hover:text-ink" onClick={() => i18n.changeLanguage(lang === 'fr' ? 'en' : 'fr')}>{lang === 'fr' ? 'English' : 'Français'}</button>
      </form>
    </main>
  );
}

const Link = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button type="button" className="text-xs text-access hover:underline" onClick={onClick}>{children}</button>;

/** Sign in, create an account, forgot password, and reset password: one card, four modes. */
export function AuthScreens() {
  const { t } = useTranslation();
  const setSession = useAuth((s) => s.setSession);
  const params = urlParams();
  const [mode, setMode] = useState<Mode>(params.reset ? 'reset' : 'login');
  const [server, setServer] = useState(getServerUrl() ?? 'http://localhost:5000');
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteBad, setInviteBad] = useState(false);
  const [f, setF] = useState({ email: '', name: '', password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Server config + invitation preview (the invited address pre-fills the form and cannot be changed).
  useEffect(() => {
    let live = true;
    api.auth.config().then((c) => live && setCfg(c)).catch(() => undefined);
    if (params.invite) {
      api.invitations.preview(params.invite).then((p) => { if (live) { setInvite(p); setF((x) => ({ ...x, email: p.email })); setMode('register'); } }).catch(() => live && setInviteBad(true));
    }
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) setError(t('auth.invalidCredentials'));
    else if (err instanceof ApiError && err.status === 0) setError(t('auth.connectionFailed'));
    else setError(errorText(err, (k) => t(k)));
  };
  const go = (m: Mode) => { setMode(m); setError(null); setInfo(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if ((mode === 'register' || mode === 'reset') && (f.password.length < 8 || f.password !== f.password2)) { setError(f.password.length < 8 ? t('account.passwordHint') : t('users.passwordMismatch')); return; }
    setBusy(true);
    try {
      if (isDesktop) await setServerUrl(server.trim());
      if (mode === 'login') { const r = await api.auth.login(f.email, f.password); setSession(r.token, r.user); }
      else if (mode === 'register') { const r = await api.auth.register({ email: f.email, name: f.name, password: f.password, inviteToken: params.invite ?? undefined }); clearUrlParams(); setSession(r.token, r.user); }
      else if (mode === 'forgot') { await api.auth.forgotPassword(f.email); setInfo(t('account.linkSent')); }
      else if (mode === 'reset') {
        try { await api.auth.resetPassword(params.reset!, f.password); clearUrlParams(); setF((x) => ({ ...x, password: '', password2: '' })); setMode('login'); setInfo(t('account.resetDone')); }
        catch (err) { if (err instanceof ApiError && err.status === 400) setError(t('account.resetInvalid')); else throw err; }
      }
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  const title = mode === 'register' ? t('account.createAccount') : mode === 'forgot' ? t('account.forgotTitle') : mode === 'reset' ? t('account.resetTitle') : null;
  const registerClosed = mode === 'register' && cfg && !cfg.registrationEnabled && !invite;

  return (
    <Card onSubmit={submit}>
      <div className="space-y-3">
        {title && <h2 className="text-base font-semibold">{title}</h2>}
        {invite && <p className="rounded border border-access/50 bg-access/10 p-2 text-sm">{t('account.inviteFor', { client: invite.clientName, role: t(`roles.${invite.role}`) })}</p>}
        {inviteBad && <p role="alert" className="rounded border border-crit p-2 text-sm text-crit">{t('account.inviteInvalid')}</p>}
        {isDesktop && mode !== 'reset' && <Field label={t('auth.serverUrl')}><input className="nf-input mono" value={server} onChange={(e) => setServer(e.target.value)} required inputMode="url" autoCapitalize="off" /></Field>}
        {mode === 'forgot' && <p className="text-sm text-mute">{cfg && !cfg.emailEnabled ? t('account.emailDisabled') : t('account.forgotHelp')}</p>}
        {registerClosed && <p role="alert" className="text-sm text-crit">{t('account.registrationClosed')}</p>}

        {mode === 'register' && <Field label={t('account.fullName')}><input className="nf-input" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} required autoFocus /></Field>}
        {mode !== 'reset' && <Field label={t('auth.email')}><input className="nf-input" type="email" autoComplete="username" value={f.email} readOnly={!!invite && mode === 'register'} onChange={(e) => set('email', e.target.value)} required autoFocus={mode !== 'register'} /></Field>}
        {mode !== 'forgot' && <Field label={mode === 'login' ? t('auth.password') : t('users.password')} hint={mode === 'login' ? undefined : t('account.passwordHint')}><input className="nf-input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={(e) => set('password', e.target.value)} required /></Field>}
        {(mode === 'register' || mode === 'reset') && <Field label={t('users.confirmPassword')}><input className="nf-input" type="password" autoComplete="new-password" value={f.password2} onChange={(e) => set('password2', e.target.value)} required /></Field>}

        {error && <p role="alert" className="text-sm text-crit">{error}</p>}
        {info && <p role="status" className="text-sm text-ok">{info}</p>}
        <button className="nf-btn nf-btn-primary w-full" disabled={busy || !!registerClosed || (mode === 'forgot' && !!cfg && !cfg.emailEnabled)}>
          {mode === 'login' ? (busy ? t('auth.signingIn') : t('auth.signIn')) : mode === 'register' ? t('account.register') : mode === 'forgot' ? t('account.sendLink') : t('common.save')}
        </button>
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          {mode === 'login' && <>{cfg?.registrationEnabled !== false || invite ? <Link onClick={() => go('register')}>{t('account.noAccount')}</Link> : <span />}<Link onClick={() => go('forgot')}>{t('account.forgot')}</Link></>}
          {mode !== 'login' && <Link onClick={() => { if (mode === 'reset') clearUrlParams(); go('login'); }}>{mode === 'register' ? t('account.haveAccount') : t('account.backToSignIn')}</Link>}
        </div>
      </div>
    </Card>
  );
}

/** Signed in and holding an invitation link: confirm and join the client. */
export function InviteAccept({ token, onDone }: { token: string; onDone: () => void }) {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user)!;
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [bad, setBad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.invitations.preview(token).then(setPreview).catch(() => setBad(true)); }, [token]);
  const wrong = preview && preview.email !== user.email.toLowerCase();

  async function accept() {
    try { await api.invitations.accept(token); clearUrlParams(); onDone(); } catch (e) { setError(errorText(e, (k) => t(k))); }
  }
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">{t('account.inviteTitle')}</h2>
      {bad && <p role="alert" className="mb-3 text-sm text-crit">{t('account.inviteInvalid')}</p>}
      {preview && <p className="mb-3 text-sm">{t('account.inviteFor', { client: preview.clientName, role: t(`roles.${preview.role}`) })}</p>}
      {wrong && <p role="alert" className="mb-3 text-sm text-crit">{t('account.inviteWrongUser', { email: preview!.email })}</p>}
      {error && <p role="alert" className="mb-3 text-sm text-crit">{error}</p>}
      <div className="flex gap-2">
        <button className="nf-btn nf-btn-primary flex-1" disabled={!preview || !!wrong} onClick={accept}>{t('account.inviteAccept')}</button>
        <button className="nf-btn" onClick={() => { clearUrlParams(); if (wrong || bad) useAuth.getState().logout(); onDone(); }}>{wrong ? t('common.logout') : t('common.cancel')}</button>
      </div>
    </Card>
  );
}

/** Shown to a signed-in user who is not a member of any client yet. */
export function NoClient() {
  const { t } = useTranslation();
  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold">{t('account.noClientTitle')}</h2>
      <p className="mb-4 text-sm text-mute">{t('account.noClientBody')}</p>
      <div className="flex gap-2">
        <button type="button" className="nf-btn flex-1" onClick={() => void import('../store/topology').then((m) => m.useTopology.getState().loadClients())}>{t('common.refresh')}</button>
        <button type="button" className="nf-btn" onClick={() => useAuth.getState().logout()}>{t('common.logout')}</button>
      </div>
    </Card>
  );
}
