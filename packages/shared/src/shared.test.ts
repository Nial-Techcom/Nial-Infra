import { describe, expect, it } from 'vitest';
import {
  alertMessage, buildCablingMatrix, buildShmnlt, cablingMatrixCsv, csvCell, formatVlanList, generateDeviceConfig,
  parseIpCidr, parseShmnlt, parseVlanList, prefixToMask, translate, validateTopology,
} from './index';

const dev = (id: string, name: string, type: any, mgmtIp: string | null = '10.0.0.' + id.length) => ({ id, name, type, mgmtIp, mgmtGateway: '10.0.0.254', mgmtVlan: 99 });
const link = (o: any) => ({ id: 'l1', sourcePort: 'Gi1/0/1', destPort: 'Gi1/0/2', mode: 'trunk', nativeVlan: null, destNativeVlan: null, taggedVlans: [10, 20], accessVlan: null, ...o });

describe('net helpers', () => {
  it('parses IP and CIDR', () => {
    expect(parseIpCidr('192.168.1.254/24')).toEqual({ ip: '192.168.1.254', prefix: 24 });
    expect(parseIpCidr('300.1.1.1')).toBeNull();
    expect(parseIpCidr('1.2.3.4/33')).toBeNull();
    expect(prefixToMask(24)).toBe('255.255.255.0');
    expect(prefixToMask(20)).toBe('255.255.240.0');
  });
  it('parses and formats VLAN lists', () => {
    expect(parseVlanList('10, 20,30-32 abc 5000')).toEqual([10, 20, 30, 31, 32]);
    expect(formatVlanList([10, 11, 12, 20])).toBe('10-12,20');
  });
});

describe('validation engine', () => {
  const devices = [dev('a', 'SW1', 'switch'), dev('bb', 'SW2', 'switch'), dev('c', 'PC1', 'client', null), dev('dd', 'FW1', 'firewall', null)];
  const rules = (links: any[], devs = devices) => validateTopology({ devices: devs, links }).map((a) => a.rule);

  it('R001 client in trunk', () => expect(rules([link({ sourceId: 'a', destId: 'c' })])).toContain('R001'));
  it('R002 native mismatch', () => expect(rules([link({ sourceId: 'a', destId: 'bb', nativeVlan: 1, destNativeVlan: 99 })])).toContain('R002'));
  it('R003 switch-switch access', () => expect(rules([link({ sourceId: 'a', destId: 'bb', mode: 'access', accessVlan: 10 })])).toContain('R003'));
  it('R004 missing mgmt IP (not for clients)', () => {
    const r = validateTopology({ devices, links: [] });
    expect(r.filter((a) => a.rule === 'R004').map((a) => a.deviceId)).toEqual(['dd']);
  });
  it('R005 identical ports on same device', () => expect(rules([link({ sourceId: 'a', destId: 'a', sourcePort: 'x', destPort: 'x' })])).toContain('R005'));
  it('R006 trunk without tagged', () => expect(rules([link({ sourceId: 'a', destId: 'bb', taggedVlans: [] })])).toContain('R006'));
  it('R007 access without vlan', () => expect(rules([link({ sourceId: 'a', destId: 'c', mode: 'access' })])).toContain('R007'));
  it('R008 port used twice', () => {
    const r = rules([link({ id: 'l1', sourceId: 'a', destId: 'bb' }), link({ id: 'l2', sourceId: 'a', destId: 'dd', destPort: 'p9' })]);
    expect(r).toContain('R008');
  });
  it('R008 not raised twice for a self loop on one port', () => {
    const r = validateTopology({ devices, links: [link({ sourceId: 'a', destId: 'a', sourcePort: 'x', destPort: 'x' })] });
    expect(r.filter((a) => a.rule === 'R008')).toHaveLength(0);
  });
  it('R009 duplicate mgmt IP and R011 invalid IP', () => {
    const d2 = [dev('a', 'A', 'switch', '10.1.1.1/24'), dev('b', 'B', 'router', '10.1.1.1'), dev('c', 'C', 'switch', 'nope')];
    const r = validateTopology({ devices: d2, links: [] }).map((a) => a.rule);
    expect(r.filter((x) => x === 'R009')).toHaveLength(2);
    expect(r).toContain('R011');
  });
  it('clean topology has no critical alert', () => {
    const r = validateTopology({ devices: [dev('a', 'SW1', 'switch'), dev('bb', 'SW2', 'switch')], links: [link({ sourceId: 'a', destId: 'bb', nativeVlan: 99 })] });
    expect(r.filter((a) => a.type !== 'info')).toHaveLength(0);
  });
  it('sorts by severity and localizes messages', () => {
    const r = validateTopology({ devices, links: [link({ sourceId: 'a', destId: 'c' })] });
    expect(r[0].type).toBe('critical');
    expect(alertMessage('fr', r[0])).toContain('Trunk');
    expect(translate('fr', 'alerts.title')).toBe('Alertes');
  });
});

describe('config export', () => {
  const devices = [dev('a', 'SW CORE', 'switch', '10.0.0.1/24'), dev('bb', 'SW2', 'switch')];
  const links = [link({ sourceId: 'a', destId: 'bb', nativeVlan: 99, taggedVlans: [10, 11, 12, 20] }), link({ id: 'l2', sourceId: 'a', destId: 'bb', sourcePort: 'Gi1/0/3', destPort: 'Gi1/0/4', mode: 'access', accessVlan: 30 })];
  it('cisco', () => {
    const c = generateDeviceConfig('cisco', devices[0], devices, links);
    expect(c).toContain('hostname SW-CORE');
    expect(c).toContain('switchport mode trunk');
    expect(c).toContain('switchport trunk native vlan 99');
    expect(c).toContain('switchport trunk allowed vlan 10-12,20,99');
    expect(c).toContain('switchport access vlan 30');
    expect(c).toContain('ip address 10.0.0.1 255.255.255.0');
  });
  it('huawei', () => {
    const c = generateDeviceConfig('huawei', devices[0], devices, links);
    expect(c).toContain('port link-type trunk');
    expect(c).toContain('port trunk pvid vlan 99');
    expect(c).toContain('port trunk allow-pass vlan 10 to 12 20 99');
    expect(c).toContain('port default vlan 30');
  });
  it('arista', () => expect(generateDeviceConfig('arista', devices[0], devices, links)).not.toContain('encapsulation'));
  it('device names cannot inject CLI lines', () => {
    const evil = [{ ...devices[0], name: 'x\nreload' }, devices[1]];
    expect(generateDeviceConfig('cisco', evil[0], evil, links)).not.toMatch(/^reload/m);
  });
});

describe('csv + shmnlt', () => {
  it('escapes cells and blocks formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(null)).toBe('');
  });
  it('builds a two-sided matrix', () => {
    const devices = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const rows = buildCablingMatrix(devices, [link({ sourceId: 'a', destId: 'b' })]);
    expect(rows).toHaveLength(3);
    expect(cablingMatrixCsv(devices, [link({ sourceId: 'a', destId: 'b' })]).split('\r\n')[0]).toContain('Connected To');
  });
  it('round-trips .shmnlt and rejects bad files', () => {
    const now = new Date().toISOString();
    const d: any = { id: 'a', clientId: 'c', siteId: null, name: 'A', type: 'switch', model: null, serial: null, role: null, mgmtIp: null, mgmtGateway: null, mgmtPort: null, mgmtProtocols: [], mgmtVlan: null, portCount: 24, portPrefix: 'Gi1/0/', x: 1, y: 2, credentialsUsername: 'admin', hasCredentials: true, createdAt: now, updatedAt: now };
    const file = buildShmnlt('ACME', [], [d], []);
    expect(JSON.stringify(file)).not.toContain('admin');
    expect(parseShmnlt(JSON.stringify(file)).devices[0].name).toBe('A');
    expect(() => parseShmnlt('{"format":"x"}')).toThrow();
    expect(() => parseShmnlt('nope')).toThrow();
    const bad = { ...file, links: [{ sourceId: 'a', sourcePort: '1', destId: 'zz', destPort: '2', mode: 'access' }] };
    expect(() => parseShmnlt(JSON.stringify(bad))).toThrow(/unknown device/);
  });
});
