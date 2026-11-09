import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MEMBER_ROLES, type Invitation, type Member, type MemberRole } from '@netforge/shared';
import { api, errorText } from '../../lib/api';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { Field, Modal } from '../ui';

/** Who can open this client (admin only): members, pending invitations and the invite-by-email form. */
export function MembersModal() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const clientId = useTopology((s) => s.clientId)!;
  const clientName = useTopology((s) => s.clients.find((c) => c.id === s.clientId)?.name ?? '');
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('technician');
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => useUi.getState().toast(errorText(e, (k) => t(k)), 'error');
  const load = () => api.members.list(clientId).then((r) => { setMembers(r.members); setPending(r.invitations); }).catch(fail);
  useEffect(() => { void load(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.members.invite(clientId, email.trim(), role);
      setEmail('');
      setLink(r.emailSent ? null : r.link);
      useUi.getState().toast(r.emailSent ? t('members.sent', { email: r.invitation.email }) : t('members.notSent'), r.emailSent ? 'ok' : 'error');
      await load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); useUi.getState().toast(t('common.copied')); } catch { /* clipboard blocked: the link is visible anyway */ } };

  return (
    <Modal title={`${t('members.title')} · ${clientName}`} onClose={close} width="max-w-2xl">
      <p className="mb-2 text-xs text-mute">{t('members.admins')}</p>
      {members.length === 0 ? <p className="mb-4 text-sm text-mute">{t('members.empty')}</p> : (
        <ul className="mb-4 divide-y divide-line">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{m.name}</div><div className="truncate text-xs text-mute">{m.email}</div></div>
              <select className="nf-input !w-auto" value={m.role} aria-label={t('members.role')} onChange={(e) => void api.members.setRole(clientId, m.userId, e.target.value as MemberRole).then(load).catch(fail)}>
                {MEMBER_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
              </select>
              <button className="nf-btn nf-btn-danger" onClick={() => void api.members.remove(clientId, m.userId).then(load).catch(fail)}>{t('members.remove')}</button>
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-xs font-medium text-mute">{t('members.pending')}</h3>
          <ul className="divide-y divide-line">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1"><div className="truncate">{i.email}</div><div className="text-xs text-mute">{t(`roles.${i.role}`)} · {t('members.expires', { date: new Date(i.expiresAt).toLocaleDateString() })}</div></div>
                <button className="nf-btn" onClick={() => void api.members.revokeInvitation(i.id).then(load).catch(fail)}>{t('members.revoke')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={invite} className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label={t('members.email')}><input className="nf-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={t('members.role')}><select className="nf-input" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>{MEMBER_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</select></Field>
        <button className="nf-btn nf-btn-primary" disabled={busy}>{t('members.invite')}</button>
      </form>
      {link && (
        <div className="mt-3 rounded border border-line bg-bg p-2 text-xs">
          <code className="mono block break-all select-all">{link}</code>
          <button className="nf-btn mt-2" onClick={() => void copy(link)}>{t('members.copyLink')}</button>
        </div>
      )}
    </Modal>
  );
}
