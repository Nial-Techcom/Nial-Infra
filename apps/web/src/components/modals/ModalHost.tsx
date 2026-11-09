import { useUi } from '../../store/ui';
import { CableModal } from './CableModal';
import { DeviceModal } from './DeviceModal';
import { AdminModal } from './AdminModal';
import { MembersModal } from './MembersModal';
import { ConfigModal, CustomDeviceModal, HistoryModal, NameModal, PasswordModal, SearchModal, UsersModal } from './OtherModals';

/** Renders whichever modal the UI store asks for. Keyed so each opening starts from fresh form state. */
export function ModalHost() {
  const m = useUi((s) => s.modal);
  if (!m) return null;
  switch (m.kind) {
    case 'device': return <DeviceModal key={m.id} id={m.id} />;
    case 'cable': return <CableModal key={m.linkId ?? `${m.draft?.sourceId}-${m.draft?.destId}`} linkId={m.linkId} draft={m.draft} />;
    case 'config': return <ConfigModal deviceId={m.deviceId} />;
    case 'custom-device': return <CustomDeviceModal pos={m.pos} />;
    case 'name': return <NameModal title={m.title} label={m.label} initial={m.initial} onSubmit={m.onSubmit} />;
    case 'history': return <HistoryModal />;
    case 'users': return <UsersModal />;
    case 'admin': return <AdminModal />;
    case 'members': return <MembersModal />;
    case 'password': return <PasswordModal />;
    case 'search': return <SearchModal />;
  }
}
