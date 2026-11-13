import { buildShmnlt, cablingMatrixCsv, parseShmnlt } from '@infra-tech/shared';
import i18n from '../i18n';
import { useTopology } from '../store/topology';
import { useUi } from '../store/ui';
import { api, errorText } from './api';
import { openTextFile, safeName, saveFile } from './platform';

const ctx = () => {
  const s = useTopology.getState();
  const client = s.clients.find((c) => c.id === s.clientId);
  return client ? { client, ...s } : null;
};
const fail = (e: unknown) => useUi.getState().toast(`${i18n.t('exports.failed')}: ${errorText(e, (k) => i18n.t(k))}`, 'error');

export async function exportCsv() {
  const c = ctx();
  if (!c) return;
  // BOM so Excel opens accents correctly.
  await saveFile(`${safeName(c.client.name)}-cabling.csv`, '﻿' + cablingMatrixCsv(c.devices, c.links), 'text/csv');
}

export async function exportPdf() {
  const c = ctx();
  if (!c) return;
  try {
    await saveFile(`${safeName(c.client.name)}-cabling.pdf`, await api.exports.pdf(c.client.id), 'application/pdf');
  } catch (e) { fail(e); }
}

export async function exportShmnlt() {
  const c = ctx();
  if (!c) return;
  const file = buildShmnlt(c.client.name, c.sites, c.devices, c.links);
  await saveFile(`${safeName(c.client.name)}.shmnlt`, JSON.stringify(file, null, 2), 'application/json');
}

export async function importShmnlt() {
  const c = ctx();
  if (!c) return;
  const picked = await openTextFile(['shmnlt', 'json']);
  if (!picked) return;
  try {
    const file = parseShmnlt(picked.text); // validated locally before anything is sent
    const r = await api.clients.importShmnlt(c.client.id, file);
    await useTopology.getState().reload();
    useUi.getState().toast(i18n.t('exports.imported', { devices: r.devices, links: r.links }));
  } catch (e) { fail(e); }
}
