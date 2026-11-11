import { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { AuthScreens, InviteAccept, NoClient, urlParams } from './components/AuthScreens';
import { RackView } from './components/canvas/RackView';
import { Header } from './components/layout/Header';
import { NetForgeCanvas } from './components/canvas/NetForgeCanvas';
import { ModalHost } from './components/modals/ModalHost';
import { AlertsPanel } from './components/panels/AlertsPanel';
import { Sidebar } from './components/sidebar/Sidebar';
import { ConnectionGate } from './components/ConnectionGate';
import { ConfirmHost, ToastHost } from './components/ui';
import { api } from './lib/api';
import { desktop } from './lib/platform';
import { exportCsv, exportPdf, exportShmnlt, importShmnlt } from './lib/exports';
import { useAuth } from './store/auth';
import { startConnectionWatch } from './store/connection';
import { useTopology } from './store/topology';
import { useUi } from './store/ui';

function Workspace() {
  const alertsOpen = useUi((s) => s.alertsOpen);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const view = useUi((s) => s.view);
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="relative flex min-h-0 flex-1">
        {/* On narrow screens the sidebar slides over the canvas instead of squeezing it. */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} absolute inset-y-0 left-0 z-30 lg:static lg:block`}>
          <Sidebar />
        </div>
        <main className="min-w-0 flex-1">{view === 'rack' ? <RackView /> : <NetForgeCanvas />}</main>
        {alertsOpen && <div className="absolute inset-y-0 right-0 z-30 xl:static"><AlertsPanel /></div>}
      </div>
    </div>
  );
}

export function App() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const theme = useUi((s) => s.theme);
  const loaded = useTopology((s) => s.loaded);
  const clientCount = useTopology((s) => s.clients.length);
  const [, bump] = useState(0);
  // Read from the URL on every render: registering with an invitation clears it, signing in with one keeps it.
  const invite = user && token ? urlParams().invite : null;

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // No offline mode: keep checking that the server answers (blocks the UI while it does not).
  useEffect(() => startConnectionWatch(), []);

  // Validate the stored session once, then load the clients.
  useEffect(() => {
    if (!token) { useTopology.getState().reset(); return; }
    let live = true;
    api.auth.me().then((r) => { if (live) { useAuth.getState().setUser(r.user); void useTopology.getState().loadClients(); } }).catch(() => undefined);
    return () => { live = false; };
  }, [token]);

  // Global shortcuts: Ctrl/Cmd+P opens search; desktop menu actions are routed here too.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (useAuth.getState().token) useUi.getState().open({ kind: 'search' });
      }
    };
    window.addEventListener('keydown', key);
    const off = desktop?.onMenu((a) => {
      if (a === 'search') useUi.getState().open({ kind: 'search' });
      if (a === 'export-csv') void exportCsv();
      if (a === 'export-pdf') void exportPdf();
      if (a === 'export-shmnlt') void exportShmnlt();
      if (a === 'import-shmnlt') void importShmnlt();
      if (a === 'toggle-theme') useUi.getState().toggleTheme();
    });
    return () => { window.removeEventListener('keydown', key); off?.(); };
  }, []);

  return (
    <>
      {user && token ? (
        invite ? (
          <InviteAccept token={invite} onDone={() => { bump((n) => n + 1); void useTopology.getState().loadClients(); }} />
        ) : loaded && clientCount === 0 && user.role !== 'admin' ? (
          <NoClient />
        ) : (
          <ReactFlowProvider>
            <Workspace />
            <ModalHost />
          </ReactFlowProvider>
        )
      ) : (
        <AuthScreens />
      )}
      <ConnectionGate />
      <ConfirmHost />
      <ToastHost />
    </>
  );
}
