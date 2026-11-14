import { useMemo } from 'react';
import { summarizeAlerts, validateTopology } from '@nial-infra/shared';
import { useTopology } from '../store/topology';

/** Real-time validation: recomputed on every change with the same engine the server uses. */
export function useAlerts() {
  const devices = useTopology((s) => s.devices);
  const links = useTopology((s) => s.links);
  return useMemo(() => {
    const alerts = validateTopology({ devices, links });
    return { alerts, counts: summarizeAlerts(alerts) };
  }, [devices, links]);
}
