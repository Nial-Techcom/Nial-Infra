export const en = {
  app: {
    title: 'NetForge - Infrastructure Designer',
    description: 'Design your network infrastructure with VLANs, Trunks, and Tagging',
    tagline: 'Infrastructure Topology Designer',
  },
  common: {
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', create: 'Create', add: 'Add', close: 'Close',
    confirm: 'Confirm', yes: 'Yes', no: 'No', loading: 'Loading…', search: 'Search', none: 'None', error: 'Error',
    retry: 'Retry', back: 'Back', name: 'Name', optional: 'optional', import: 'Import', export: 'Export',
    actions: 'Actions', copy: 'Copy', copied: 'Copied', download: 'Download', settings: 'Settings', language: 'Language',
    logout: 'Sign out', required: 'Required', noData: 'No data', deleteConfirm: 'Delete "{{name}}"? This cannot be undone.',
    readOnly: 'Read-only', theme: 'Theme', light: 'Light', dark: 'Dark', refresh: 'Refresh', details: 'Details',
  },
  auth: {
    signIn: 'Sign in', email: 'Email', password: 'Password', serverUrl: 'Server URL', server: 'Server',
    invalidCredentials: 'Invalid email or password', signingIn: 'Signing in…', changePassword: 'Change password',
    currentPassword: 'Current password', newPassword: 'New password (8+ characters)', passwordChanged: 'Password updated',
    welcome: 'Welcome, {{name}}', connectionFailed: 'Cannot reach the server. Check the URL and your network.',
  },
  roles: { admin: 'Admin', technician: 'Technician', viewer: 'Viewer' },
  sidebar: {
    clients: 'Clients', devices: 'Device Library', search: 'Search...', newClient: 'New client', newSite: 'New site',
    noClient: 'No client yet. Create one to start designing.', selectClient: 'Select a client', sites: 'Sites',
    unassigned: 'No site', renameClient: 'Rename client', clientName: 'Client name', siteName: 'Site name',
    customDevice: 'Custom device', dragHint: 'Drag a device onto the canvas',
  },
  deviceTypes: {
    firewall: 'Firewall', switch: 'Switch', router: 'Router', server: 'Server', access_point: 'Access point', client: 'Client',
  },
  deviceRoles: { core: 'Core', distribution: 'Distribution', access: 'Access', dmz: 'DMZ', backup: 'Backup' },
  modals: {
    device: {
      title: 'Device properties', identity: 'Identity', management: 'Management & Access', vlanMapping: 'VLAN Mapping',
      name: 'Name', client: 'Client', site: 'Site', type: 'Type', model: 'Model', serial: 'Serial number', role: 'Role',
      mgmtIp: 'Management IP', mgmtIpHint: 'e.g. 192.168.1.254/24', gateway: 'Gateway', mgmtPort: 'Management port',
      protocols: 'Protocols', credentials: 'Credentials', username: 'Username', password: 'Password',
      passwordStored: 'A password is stored (encrypted). Leave empty to keep it.', revealPassword: 'Reveal password',
      mgmtVlan: 'Management VLAN', ports: 'Ports', portCount: 'Port count', portPrefix: 'Port prefix',
      portsHint: 'Ports are named prefix + number, e.g. Gi1/0/1', connections: 'Connections',
    },
    cable: {
      title: 'Cable configuration', sourcePort: 'Source port', destPort: 'Destination port', mode: 'Mode',
      access: 'Access', trunk: 'Trunk', nativeVlan: 'Native VLAN (Untagged)', destNativeVlan: 'Native VLAN (destination end)',
      taggedVlans: 'Tagged VLANs', taggedHint: 'e.g. 10,20,30-35', accessVlan: 'Access VLAN', from: 'From', to: 'To',
      sameAsSource: 'same as source',
    },
  },
  alerts: {
    title: 'Alerts', critical: 'Critical', warning: 'Warning', info: 'Info', none: 'No issue detected 🎉',
    messages: {
      R001: 'A client device ({{device}}) cannot be connected in Trunk mode.',
      R002: 'Native VLAN mismatch on trunk {{source}} ↔ {{dest}} ({{a}} vs {{b}}).',
      R003: 'Switch {{source}} is linked to switch {{dest}} in Access mode; use a Trunk.',
      R004: 'Device {{device}} has no management IP.',
      R005: 'Source and destination ports are identical ({{device}} {{port}}).',
      R006: 'Trunk {{source}} ↔ {{dest}} has no tagged VLANs.',
      R007: 'Access link {{source}} ↔ {{dest}} has no VLAN defined.',
      R008: 'Port {{port}} of {{device}} is used by {{count}} links.',
      R009: 'Management IP {{ip}} is used by several devices ({{devices}}).',
      R010: 'Link {{source}} ↔ {{dest}} loops back on the same device.',
      R011: 'Management IP of {{device}} is not a valid IPv4 address.',
      R012: 'A link refers to a device that does not exist.',
    },
  },
  exports: {
    title: 'Export', csv: 'Export CSV (cabling matrix)', pdf: 'Export PDF', png: 'Export PNG', svg: 'Export SVG',
    config: 'Export Config Script', shmnlt: 'Export .shmnlt', importShmnlt: 'Import .shmnlt', vendor: 'Vendor',
    scope: 'Scope', allDevices: 'All network devices', thisDevice: 'This device', cisco: 'Cisco IOS', huawei: 'Huawei VRP',
    arista: 'Arista EOS', imported: 'Imported {{devices}} devices and {{links}} links', failed: 'Export failed',
  },
  search: { placeholder: 'Search devices, IPs, ports, clients…', noResults: 'No result', hint: 'Ctrl+P' },
  revisions: {
    title: 'Version history', save: 'Save a version', note: 'Note (optional)', restore: 'Restore', empty: 'No version saved yet.',
    saved: 'Version saved', restoreConfirm: 'Replace the current schema by this version? A backup version is created first.',
    restored: 'Version restored', by: 'by {{name}}',
  },
  users: {
    title: 'Users', add: 'Add user', role: 'Role', email: 'Email', name: 'Name', password: 'Password',
    deleteSelf: 'You cannot delete your own account.',
  },
  canvas: {
    empty: 'Drag a device from the library to start', connectHint: 'Drag from a device handle to another device to create a cable',
    deleteSelection: 'Delete selection', fit: 'Fit view', zoomIn: 'Zoom in', zoomOut: 'Zoom out', links: 'links', devices: 'devices',
    editCable: 'Edit cable', editDevice: 'Edit device', removeDevice: 'Remove device', removeCable: 'Remove cable',
    differentClient: 'Both devices must belong to the same client.',
  },
  mobile: {
    diagram: 'Diagram', cables: 'Cables', addCable: 'Add cable', addDevice: 'Add device', pickDevice: 'Pick a device', pickPort: 'Pick a port',
    server: 'Server URL (e.g. https://netforge.example.com)', empty: 'Nothing here yet', pullToRefresh: 'Pull down to refresh',
    shareFailed: 'Could not share the file', settings: 'Settings', deleteDevice: 'Delete device', deleteCable: 'Delete cable',
    portInUse: 'in use', sameDevice: 'Pick two different devices', tapDevice: 'Tap a device to open it', imported: 'Import done',
  },
  errors: {
    network: 'Network error', unauthorized: 'Session expired, please sign in again', forbidden: 'You do not have permission to do this',
    generic: 'Something went wrong', notFound: 'Not found',
  },
};

export type Translation = typeof en;
