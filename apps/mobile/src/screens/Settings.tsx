import { Text, View } from 'react-native';
import { useSession, useT } from '../store';
import { useTheme } from '../theme';
import { Button, Header, Muted } from '../ui';

export function Settings({ onBack }: { onBack: () => void }) {
  const t = useT();
  const c = useTheme();
  const { user, server, locale, setLocale, logout } = useSession();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('mobile.settings')} onBack={onBack} />
      <View style={{ padding: 14, gap: 12 }}>
        <View><Text style={{ color: c.ink, fontWeight: '600', fontSize: 16 }}>{user?.name}</Text><Muted>{`${user?.email} · ${user ? t(`roles.${user.role}`) : ''}`}</Muted></View>
        <View><Muted>{t('auth.server')}</Muted><Text style={{ color: c.ink }}>{server}</Text></View>
        <Button title={`${t('common.language')}: ${locale === 'fr' ? 'English' : 'Français'}`} onPress={() => void setLocale(locale === 'fr' ? 'en' : 'fr')} />
        <Button kind="danger" title={t('common.logout')} onPress={() => void logout()} />
      </View>
    </View>
  );
}
