import { create } from 'zustand';
import type { LicenseSummary } from '@nial-infra/shared';
import { api } from '../lib/api';
import { useAuth } from './auth';

/** Licence state of the server (trial / licensed / blocked). Refreshed periodically and whenever the API answers 402. */
interface LicenseState {
  summary: LicenseSummary | null;
  refresh(): Promise<void>;
}

export const useLicense = create<LicenseState>((set) => ({
  summary: null,
  refresh: async () => {
    try { set({ summary: await api.license.status() }); } catch { /* connection problems are handled by ConnectionGate */ }
  },
}));

export function startLicenseWatch(): () => void {
  const run = () => { if (useAuth.getState().token) void useLicense.getState().refresh(); };
  run();
  const timer = setInterval(run, 60_000);
  window.addEventListener('nf-license-required', run);
  return () => { clearInterval(timer); window.removeEventListener('nf-license-required', run); };
}
