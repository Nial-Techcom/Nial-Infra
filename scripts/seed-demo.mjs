// Creates a small demo network so you can try NetForge right away.
// Usage: node scripts/seed-demo.mjs http://localhost:3000 admin@example.com "password"
import { createRequire } from 'node:module';
const { createApi } = createRequire(import.meta.url)('../packages/shared/dist/index.js');

const [server, email, password] = process.argv.slice(2);
if (!server || !email || !password) { console.error('Usage: node scripts/seed-demo.mjs <server-url> <email> <password>'); process.exit(1); }

let token = null;
const api = createApi({ baseUrl: `${server.replace(/\/+$/, '')}/api/v1`, getToken: () => token });
token = (await api.auth.login(email, password)).token;

const { client } = await api.clients.create(`Demo ${new Date().toISOString().slice(0, 10)}`);
const { site } = await api.sites.create(client.id, 'Siège');
const dev = async (name, type, x, y, extra = {}) =>
  (await api.devices.create({ clientId: client.id, siteId: site.id, name, type, x, y, portCount: 24, portPrefix: 'Gi1/0/', ...extra })).device;

const fw = await dev('FW-01', 'firewall', 300, 20, { portCount: 4, portPrefix: 'port', role: 'dmz', mgmtIp: '192.168.1.1/24', mgmtVlan: 99 });
const core = await dev('SW-CORE', 'switch', 300, 180, { role: 'core', mgmtIp: '192.168.1.2/24', mgmtVlan: 99 });
const acc1 = await dev('SW-ACC-01', 'switch', 80, 360, { role: 'access', mgmtIp: '192.168.1.3/24', mgmtVlan: 99 });
const acc2 = await dev('SW-ACC-02', 'switch', 520, 360 , { role: 'access' }); // no management IP on purpose -> info alert
const srv = await dev('SRV-01', 'server', 300, 360, { portCount: 2, portPrefix: 'eth', mgmtIp: '192.168.1.10/24' });
const pc = await dev('PC-01', 'client', 80, 540, { portCount: 1, portPrefix: 'eth' });
const ap = await dev('AP-01', 'access_point', 520, 540, { portCount: 1, portPrefix: 'eth' });

const link = (a, ap_, b, bp, body) => api.links.create({ sourceId: a.id, sourcePort: ap_, destId: b.id, destPort: bp, ...body });
await link(fw, 'port1', core, 'Gi1/0/1', { mode: 'trunk', nativeVlan: 99, taggedVlans: [10, 20, 30] });
await link(core, 'Gi1/0/2', acc1, 'Gi1/0/1', { mode: 'trunk', nativeVlan: 99, taggedVlans: [10, 20] });
await link(core, 'Gi1/0/3', srv, 'eth1', { mode: 'access', accessVlan: 30 });
await link(core, 'Gi1/0/4', acc2, 'Gi1/0/1', { mode: 'access', accessVlan: 10 }); // switch<->switch in access -> warning R003
await link(acc1, 'Gi1/0/5', pc, 'eth1', { mode: 'access', accessVlan: 10 });
await link(acc2, 'Gi1/0/5', ap, 'eth1', { mode: 'trunk', nativeVlan: 10, taggedVlans: [] }); // trunk with no VLAN -> warning R006

console.log(`Demo client created: ${client.name}. Open NetForge and pick it in the client list.`);
