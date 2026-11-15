import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, Text, View } from 'react-native';
import { licenseRequestMailto, type LicenseStatus, type LicenseSummary } from '@nial-infra/shared';
import { api, licenseListeners, useSession, useT } from './store';
import { useTheme } from './theme';
import { Button, Field, Muted } from './ui';

/** Blocks the app when the server has no valid licence (trial over). Admins can request / install one right here. */
export function LicenseGate() {
  const t = useT();
  const c = useTheme();
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);
  const [sum, setSum] = useState<LicenseSummary | null>(null);
  const [full, setFull] = useState<LicenseStatus | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const refresh = useCallback(async () => {
    try {
      const s = await api.license.status();
      setSum(s);
      if (s.state === 'blocked' && useSession.getState().user?.role === 'admin') setFull((await api.license.get()).license);
    } catch { /* ConnectionGate covers network problems */ }
  }, []);

  useEffect(() => {
    if (!token) { setSum(null); return; }
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    licenseListeners.add(refresh);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void refresh(); });
    return () => { clearInterval(timer); licenseListeners.delete(refresh); sub.remove(); };
  }, [token, refresh]);

  if (!token || !user || sum?.state !== 'blocked') return null;
  async function install() {
    setBusy(true); setErr('');
    try { setFull((await api.license.import(text.trim())).license); setText(''); await refresh(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{t('license.blockedTitle')}</Text>
        <Text style={{ color: c.mute, fontSize: 14, textAlign: 'center' }}>{t('license.blockedBody')}</Text>
        {sum.reason && <Text style={{ color: c.ink, fontSize: 14, textAlign: 'center' }}>{t(`license.reason_${sum.reason}`)}</Text>}
        {user.role === 'admin' && full ? (
          <>
            <View><Muted>{t('license.installationId')}</Muted><Text selectable style={{ color: c.ink, fontFamily: 'monospace', fontSize: 12 }}>{full.installationId}</Text></View>
            <Button kind="primary" title={t('license.request')} onPress={() => void Linking.openURL(licenseRequestMailto(full.contact, t('license.mailSubject'), t('license.mailBody', { id: full.installationId })))} />
            <Muted>{t('license.requestHelp', { contact: full.contact })}</Muted>
            <Field label={t('license.paste')} value={text} onChangeText={setText} multiline placeholder={t('license.pastePlaceholder')} />
            {!!err && <Text style={{ color: '#ef4444' }}>{err}</Text>}
            <Button kind="primary" title={t('license.import')} disabled={!text.trim()} busy={busy} onPress={() => void install()} />
          </>
        ) : (
          <Text style={{ color: c.ink, textAlign: 'center' }}>{t('license.adminOnlyBody')}</Text>
        )}
        <Button kind="danger" title={t('common.logout')} onPress={() => void useSession.getState().logout()} />
      </ScrollView>
    </View>
  );
}
