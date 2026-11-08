const STORAGE_KEY = 'netforge-editor-state-v2';
const LANG_KEY = 'netforge-lang';

const deviceCatalog = [
  { type: 'firewall', icon: 'FW', color: 'var(--device-firewall)', ports: 8, fr: 'Pare-feu', en: 'Firewall', metaFr: 'Edge security', metaEn: 'Edge security' },
  { type: 'switch', icon: 'SW', color: 'var(--device-switch)', ports: 24, fr: 'Switch', en: 'Switch', metaFr: 'Core / Access', metaEn: 'Core / Access' },
  { type: 'router', icon: 'RT', color: 'var(--device-router)', ports: 6, fr: 'Routeur', en: 'Router', metaFr: 'WAN / MPLS', metaEn: 'WAN / MPLS' },
  { type: 'server', icon: 'SR', color: 'var(--device-server)', ports: 4, fr: 'Serveur', en: 'Server', metaFr: 'App / DB', metaEn: 'App / DB' },
  { type: 'access_point', icon: 'AP', color: 'var(--device-ap)', ports: 2, fr: 'Wi-Fi', en: 'Wi-Fi AP', metaFr: 'Indoor / Outdoor', metaEn: 'Indoor / Outdoor' },
  { type: 'client', icon: 'CL', color: 'var(--device-client)', ports: 1, fr: 'Client', en: 'Client', metaFr: 'PC / Printer', metaEn: 'PC / Printer' },
  { type: 'material', icon: 'IMG', color: 'var(--device-material)', ports: 0, fr: 'Materiel image', en: 'Image material', metaFr: 'PNG / JPG', metaEn: 'PNG / JPG' }
];

const i18n = {
  fr: {
    title: 'Professional Network Designer',
    newProject: 'Nouveau',
    import: 'Importer',
    export: 'Exporter',
    saveLocal: 'Sauver',
    loadLocal: 'Charger',
    toolsTitle: 'Outils',
    selectMode: 'Selection',
    linkMode: 'Lier',
    deleteSelected: 'Supprimer',
    fitView: 'Centrer',
    libraryTitle: 'Materiel',
    addSample: 'Exemple',
    importImage: 'Importer image',
    canvasTitle: 'Schema reseau interactif',
    rackSize: 'Taille baie',
    rackSnap: 'Aligner sur baie',
    canvasHint: 'Utilise la bibliotheque pour creer ton premier equipement.',
    nodesLabel: 'Noeuds',
    linksLabel: 'Liens',
    modeLabel: 'Mode',
    validationTitle: 'Validation',
    inspectorTitle: 'Inspecteur',
    inspectorEmpty: 'Selectionne un equipement ou un lien pour modifier ses proprietes.',
    typeLabel: 'Type',
    nameLabel: 'Nom',
    roleLabel: 'Role',
    mgmtIpLabel: 'IP management',
    portsLabel: 'Ports',
    widthLabel: 'Largeur',
    applyDevice: 'Appliquer equipement',
    sourceLabel: 'Port source',
    destLabel: 'Port destination',
    modeLabelSmall: 'Mode',
    nativeVlanLabel: 'VLAN native',
    taggedVlansLabel: 'VLANs tagues',
    accessVlanLabel: 'VLAN access',
    applyLink: 'Appliquer lien',
    modeSelect: 'Selection',
    modeLink: 'Lien',
    saved: 'Projet sauve localement',
    loaded: 'Projet charge',
    imported: 'Import termine',
    exported: 'Export termine',
    resetDone: 'Nouveau projet cree',
    csvHelp: 'CSV attendu: type,name,role,mgmtIp,ports,x,y,width',
    noSelection: 'Aucune selection'
  },
  en: {
    title: 'Professional Network Designer',
    newProject: 'New',
    import: 'Import',
    export: 'Export',
    saveLocal: 'Save',
    loadLocal: 'Load',
    toolsTitle: 'Tools',
    selectMode: 'Select',
    linkMode: 'Link',
    deleteSelected: 'Delete',
    fitView: 'Center',
    libraryTitle: 'Equipment',
    addSample: 'Sample',
    importImage: 'Import image',
    canvasTitle: 'Interactive network diagram',
    rackSize: 'Rack size',
    rackSnap: 'Snap to rack',
    canvasHint: 'Use the library to create your first device.',
    nodesLabel: 'Nodes',
    linksLabel: 'Links',
    modeLabel: 'Mode',
    validationTitle: 'Validation',
    inspectorTitle: 'Inspector',
    inspectorEmpty: 'Select a device or a link to edit properties.',
    typeLabel: 'Type',
    nameLabel: 'Name',
    roleLabel: 'Role',
    mgmtIpLabel: 'Management IP',
    portsLabel: 'Ports',
    widthLabel: 'Width',
    applyDevice: 'Apply device',
    sourceLabel: 'Source port',
    destLabel: 'Destination port',
    modeLabelSmall: 'Mode',
    nativeVlanLabel: 'Native VLAN',
    taggedVlansLabel: 'Tagged VLANs',
    accessVlanLabel: 'Access VLAN',
    applyLink: 'Apply link',
    modeSelect: 'Select',
    modeLink: 'Link',
    saved: 'Project saved locally',
    loaded: 'Project loaded',
    imported: 'Import complete',
    exported: 'Export complete',
    resetDone: 'New project created',
    csvHelp: 'Expected CSV: type,name,role,mgmtIp,ports,x,y,width',
    noSelection: 'No selection'
  }
};

const state = {
  language: localStorage.getItem(LANG_KEY) || 'fr',
  toolMode: 'select',
  nodes: [],
  links: [],
  selected: null,
  selectedType: null,
  connectSourceId: null,
  rackSize: 42,
  rackSnap: false
};

let nodeCounter = 1;
let linkCounter = 1;
let drag = null;

const el = {
  langToggle: document.getElementById('langToggle'),
  newProjectBtn: document.getElementById('newProjectBtn'),
  importTrigger: document.getElementById('importTrigger'),
  importImageBtn: document.getElementById('importImageBtn'),
  fileImport: document.getElementById('fileImport'),
  exportMenuToggle: document.getElementById('exportMenuToggle'),
  exportMenu: document.getElementById('exportMenu'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  exportSvgBtn: document.getElementById('exportSvgBtn'),
  saveLocalBtn: document.getElementById('saveLocalBtn'),
  loadLocalBtn: document.getElementById('loadLocalBtn'),
  selectModeBtn: document.getElementById('selectModeBtn'),
  linkModeBtn: document.getElementById('linkModeBtn'),
  deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
  fitViewBtn: document.getElementById('fitViewBtn'),
  addSampleBtn: document.getElementById('addSampleBtn'),
  rackSize: document.getElementById('rackSize'),
  rackSnap: document.getElementById('rackSnap'),
  canvas: document.getElementById('canvas'),
  rackLayer: document.getElementById('rackLayer'),
  linkLayer: document.getElementById('linkLayer'),
  nodeLayer: document.getElementById('nodeLayer'),
  canvasHint: document.getElementById('canvasHint'),
  deviceLibrary: document.getElementById('deviceLibrary'),
  libraryTemplate: document.getElementById('libraryItemTemplate'),
  nodeCount: document.getElementById('nodeCount'),
  linkCount: document.getElementById('linkCount'),
  modeIndicator: document.getElementById('modeIndicator'),
  validationCount: document.getElementById('validationCount'),
  validationList: document.getElementById('validationList'),
  selectionType: document.getElementById('selectionType'),
  inspectorEmpty: document.getElementById('inspectorEmpty'),
  deviceForm: document.getElementById('deviceForm'),
  deviceType: document.getElementById('deviceType'),
  deviceName: document.getElementById('deviceName'),
  deviceRole: document.getElementById('deviceRole'),
  deviceMgmtIp: document.getElementById('deviceMgmtIp'),
  devicePorts: document.getElementById('devicePorts'),
  deviceWidth: document.getElementById('deviceWidth'),
  linkForm: document.getElementById('linkForm'),
  linkSourcePort: document.getElementById('linkSourcePort'),
  linkDestPort: document.getElementById('linkDestPort'),
  linkMode: document.getElementById('linkMode'),
  linkNativeVlan: document.getElementById('linkNativeVlan'),
  linkTaggedVlans: document.getElementById('linkTaggedVlans'),
  linkAccessVlan: document.getElementById('linkAccessVlan')
};

function tr(key) {
  const dict = i18n[state.language] || i18n.fr;
  return dict[key] || key;
}

function escapeHtml(v) {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function catalog(type) {
  return deviceCatalog.find((d) => d.type === type) || deviceCatalog[1];
}

function makeNode(type, x, y, patch = {}) {
  const c = catalog(type);
  const id = `n${nodeCounter++}`;
  return {
    id,
    type,
    name: patch.name || `${state.language === 'fr' ? c.fr : c.en} ${id.slice(1)}`,
    role: patch.role || '',
    mgmtIp: patch.mgmtIp || '',
    ports: Number.isFinite(patch.ports) ? patch.ports : c.ports,
    x: Number.isFinite(x) ? x : 120,
    y: Number.isFinite(y) ? y : 120,
    width: Number.isFinite(patch.width) ? patch.width : (type === 'material' ? 220 : 180),
    imageSrc: patch.imageSrc || ''
  };
}

function makeLink(sourceId, destId, patch = {}) {
  return {
    id: `l${linkCounter++}`,
    sourceId,
    destId,
    sourcePort: patch.sourcePort || 'Gi1/0/1',
    destPort: patch.destPort || 'Gi1/0/1',
    mode: patch.mode || 'access',
    nativeVlan: patch.nativeVlan || '',
    taggedVlans: Array.isArray(patch.taggedVlans) ? patch.taggedVlans : [],
    accessVlan: patch.accessVlan || ''
  };
}

function getNode(id) {
  return state.nodes.find((n) => n.id === id);
}

function getLink(id) {
  return state.links.find((l) => l.id === id);
}

function setSelection(sel) {
  state.selected = sel;
  state.selectedType = sel ? sel.type : null;
}

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.querySelectorAll('[data-i18n]').forEach((item) => {
    const key = item.getAttribute('data-i18n');
    if (key) {
      item.textContent = tr(key);
    }
  });
  el.langToggle.textContent = state.language === 'fr' ? 'FR / EN' : 'EN / FR';
}

function renderLibrary() {
  el.deviceLibrary.innerHTML = '';
  deviceCatalog.forEach((d) => {
    const btn = el.libraryTemplate.content.firstElementChild.cloneNode(true);
    btn.querySelector('.library-icon').textContent = d.icon;
    btn.querySelector('.library-icon').style.background = d.color;
    btn.querySelector('.library-name').textContent = state.language === 'fr' ? d.fr : d.en;
    btn.querySelector('.library-meta').textContent = state.language === 'fr' ? d.metaFr : d.metaEn;
    btn.addEventListener('click', () => addNode(d.type));
    el.deviceLibrary.appendChild(btn);
  });
}

function rackMetrics() {
  const rect = el.canvas.getBoundingClientRect();
  const width = rect.width || el.canvas.clientWidth || 1000;
  const height = rect.height || el.canvas.clientHeight || 700;
  const rackWidth = Math.min(360, Math.max(280, width * 0.34));
  const rackHeight = Math.max(420, height - 120);
  return {
    canvasWidth: width,
    canvasHeight: height,
    x: (width - rackWidth) / 2,
    y: 56,
    width: rackWidth,
    height: rackHeight,
    unitHeight: rackHeight / state.rackSize
  };
}

function renderRack() {
  const m = rackMetrics();
  let html = `<div class="rack-outline" style="left:${m.x}px;top:${m.y}px;width:${m.width}px;height:${m.height}px"></div>`;
  for (let i = 0; i <= state.rackSize; i += 1) {
    const top = m.y + i * m.unitHeight;
    const label = state.rackSize - i;
    html += `<div class="rack-unit" style="top:${top}px"></div>`;
    if (i % 2 === 0 && label > 0) {
      html += `<div class="rack-label" style="top:${top - 6}px">${label}U</div>`;
    }
  }
  el.rackLayer.innerHTML = html;
}

function addNode(type) {
  const m = rackMetrics();
  const x = m.x + (m.width / 2) - 90 + (Math.random() * 36 - 18);
  const y = m.y + 40 + state.nodes.length * 18;
  const node = makeNode(type, x, y);
  if (state.rackSnap) {
    snapNodeToRack(node);
  }
  state.nodes.push(node);
  setSelection({ type: 'node', id: node.id });
  render();
}

function addSample() {
  state.nodes = [
    makeNode('firewall', 320, 130, { name: 'FW-EDGE', role: 'dmz', mgmtIp: '10.10.0.1/24', ports: 8 }),
    makeNode('switch', 540, 230, { name: 'SW-CORE', role: 'core', mgmtIp: '10.10.0.2/24', ports: 24 }),
    makeNode('server', 600, 390, { name: 'SRV-APP', role: 'app', mgmtIp: '10.10.0.30/24', ports: 4 }),
    makeNode('client', 360, 520, { name: 'PC-OPS', role: 'user', mgmtIp: '', ports: 1 })
  ];
  state.links = [
    makeLink(state.nodes[0].id, state.nodes[1].id, { mode: 'trunk', nativeVlan: 10, taggedVlans: [20, 30] }),
    makeLink(state.nodes[1].id, state.nodes[2].id, { mode: 'access', accessVlan: 20 }),
    makeLink(state.nodes[1].id, state.nodes[3].id, { mode: 'access', accessVlan: 20, sourcePort: 'Gi1/0/10', destPort: 'Eth0' })
  ];
  setSelection({ type: 'node', id: state.nodes[1].id });
  render();
}

function nodeCenter(node) {
  return {
    x: node.x + node.width / 2,
    y: node.y + (node.type === 'material' ? 78 : 52)
  };
}

function renderLinks() {
  const m = rackMetrics();
  el.linkLayer.setAttribute('viewBox', `0 0 ${m.canvasWidth} ${m.canvasHeight}`);
  el.linkLayer.innerHTML = state.links.map((link) => {
    const src = getNode(link.sourceId);
    const dst = getNode(link.destId);
    if (!src || !dst) {
      return '';
    }
    const a = nodeCenter(src);
    const b = nodeCenter(dst);
    const c1 = (a.x + b.x) / 2;
    const selected = state.selectedType === 'link' && state.selected && state.selected.id === link.id;
    const path = `M ${a.x} ${a.y} C ${c1} ${a.y}, ${c1} ${b.y}, ${b.x} ${b.y}`;
    return `<g data-link-id="${link.id}">
      <path class="link-line ${selected ? 'selected' : ''}" d="${path}" />
      <text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 7}" fill="#9cc2ff" font-size="11" text-anchor="middle">${escapeHtml(link.mode.toUpperCase())}</text>
    </g>`;
  }).join('');

  el.linkLayer.querySelectorAll('g[data-link-id]').forEach((g) => {
    g.addEventListener('click', (event) => {
      event.stopPropagation();
      setSelection({ type: 'link', id: g.dataset.linkId });
      render();
    });
  });
}

function renderNodes() {
  el.nodeLayer.innerHTML = '';
  state.nodes.forEach((node) => {
    const c = catalog(node.type);
    const selected = state.selectedType === 'node' && state.selected && state.selected.id === node.id;
    const card = document.createElement('article');
    card.className = `diagram-node${selected ? ' selected' : ''}`;
    card.dataset.nodeId = node.id;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.style.width = `${node.width}px`;

    const ports = node.ports > 0
      ? `<div class="node-points">${Array.from({ length: Math.min(node.ports, 8) }, (_, i) => `<span class="port-chip">${i + 1}</span>`).join('')}</div>`
      : '';

    const image = node.imageSrc ? `<img class="node-thumbnail" src="${node.imageSrc}" alt="material" />` : '';

    card.innerHTML = `
      <div class="node-header">
        <div>
          <div class="node-type">${state.language === 'fr' ? c.fr : c.en}</div>
          <div class="node-name">${escapeHtml(node.name)}</div>
        </div>
        <div class="node-marker" style="background:${c.color}"></div>
      </div>
      <div class="node-meta">${escapeHtml(node.role || '')}${node.role && node.mgmtIp ? '<br />' : ''}${escapeHtml(node.mgmtIp || '')}</div>
      ${image}
      ${ports}
      <div class="node-actions">
        <button class="node-action" data-action="connect" type="button">${state.language === 'fr' ? 'Relier' : 'Link'}</button>
        <button class="node-action" data-action="delete" type="button">${state.language === 'fr' ? 'Suppr.' : 'Delete'}</button>
      </div>
    `;

    card.addEventListener('pointerdown', onNodePointerDown);
    card.addEventListener('click', (event) => onNodeClick(event, node.id));
    el.nodeLayer.appendChild(card);
  });
}

function onNodeClick(event, nodeId) {
  const action = event.target && event.target.dataset ? event.target.dataset.action : null;
  if (action === 'delete') {
    event.stopPropagation();
    removeNode(nodeId);
    return;
  }

  if (action === 'connect') {
    event.stopPropagation();
    if (state.connectSourceId && state.connectSourceId !== nodeId) {
      state.links.push(makeLink(state.connectSourceId, nodeId));
      state.connectSourceId = null;
      state.toolMode = 'select';
      setSelection({ type: 'link', id: state.links[state.links.length - 1].id });
      render();
      return;
    }
    state.connectSourceId = nodeId;
    state.toolMode = 'link';
    setSelection({ type: 'node', id: nodeId });
    render();
    return;
  }

  if (state.toolMode === 'link') {
    if (state.connectSourceId && state.connectSourceId !== nodeId) {
      state.links.push(makeLink(state.connectSourceId, nodeId));
      state.connectSourceId = null;
      state.toolMode = 'select';
      setSelection({ type: 'link', id: state.links[state.links.length - 1].id });
      render();
      return;
    }
    state.connectSourceId = nodeId;
  }

  setSelection({ type: 'node', id: nodeId });
  renderInspector();
  renderStatus();
}

function onNodePointerDown(event) {
  const nodeId = event.currentTarget.dataset.nodeId;
  const node = getNode(nodeId);
  if (!node) {
    return;
  }

  drag = {
    nodeId,
    offsetX: event.clientX - node.x,
    offsetY: event.clientY - node.y
  };

  event.currentTarget.classList.add('dragging');
  setSelection({ type: 'node', id: nodeId });
  renderInspector();
  renderStatus();

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function onPointerMove(event) {
  if (!drag) {
    return;
  }
  const node = getNode(drag.nodeId);
  if (!node) {
    return;
  }

  node.x = Math.max(8, event.clientX - drag.offsetX);
  node.y = Math.max(8, event.clientY - drag.offsetY);

  if (state.rackSnap) {
    snapNodeToRack(node);
  }

  const elNode = el.nodeLayer.querySelector(`[data-node-id="${drag.nodeId}"]`);
  if (elNode) {
    elNode.style.left = `${node.x}px`;
    elNode.style.top = `${node.y}px`;
  }
  renderLinks();
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove);
  if (drag) {
    const nodeEl = el.nodeLayer.querySelector(`[data-node-id="${drag.nodeId}"]`);
    if (nodeEl) {
      nodeEl.classList.remove('dragging');
    }
  }
  drag = null;
  renderValidation();
  renderLinks();
}

function snapNodeToRack(node) {
  const m = rackMetrics();
  const xMin = m.x + 8;
  const xMax = m.x + m.width - node.width - 8;
  node.x = Math.min(xMax, Math.max(xMin, node.x));

  const normalized = (node.y - m.y) / m.unitHeight;
  const snappedIndex = Math.round(normalized);
  node.y = m.y + Math.max(0, Math.min(state.rackSize - 1, snappedIndex)) * m.unitHeight;
}

function removeNode(nodeId) {
  state.nodes = state.nodes.filter((n) => n.id !== nodeId);
  state.links = state.links.filter((l) => l.sourceId !== nodeId && l.destId !== nodeId);
  if (state.connectSourceId === nodeId) {
    state.connectSourceId = null;
  }
  if (state.selected && state.selected.id === nodeId) {
    setSelection(null);
  }
  render();
}

function removeSelected() {
  if (!state.selected) {
    return;
  }
  if (state.selected.type === 'node') {
    removeNode(state.selected.id);
  } else {
    state.links = state.links.filter((l) => l.id !== state.selected.id);
    setSelection(null);
    render();
  }
}

function renderStatus() {
  el.nodeCount.textContent = String(state.nodes.length);
  el.linkCount.textContent = String(state.links.length);
  if (state.toolMode === 'link') {
    el.modeIndicator.textContent = state.connectSourceId ? `${tr('modeLink')}*` : tr('modeLink');
  } else {
    el.modeIndicator.textContent = tr('modeSelect');
  }

  el.selectModeBtn.classList.toggle('active', state.toolMode === 'select');
  el.linkModeBtn.classList.toggle('active', state.toolMode === 'link');
}

function renderValidation() {
  const issues = [];

  state.nodes.forEach((n) => {
    if (n.type !== 'material' && !n.mgmtIp) {
      issues.push({ type: 'info', message: `${n.name}: ${state.language === 'fr' ? 'IP management manquante' : 'missing management IP'}` });
    }
    if (n.ports < 0) {
      issues.push({ type: 'warning', message: `${n.name}: invalid ports` });
    }
  });

  state.links.forEach((l) => {
    const a = getNode(l.sourceId);
    const b = getNode(l.destId);
    if (!a || !b) {
      return;
    }

    if (l.sourcePort === l.destPort) {
      issues.push({ type: 'warning', message: `${a.name} ↔ ${b.name}: same ports` });
    }

    if ((a.type === 'client' || b.type === 'client') && l.mode === 'trunk') {
      issues.push({ type: 'critical', message: `${a.name} ↔ ${b.name}: client in trunk` });
    }

    if (l.mode === 'trunk' && (!l.taggedVlans || l.taggedVlans.length === 0)) {
      issues.push({ type: 'warning', message: `${a.name} ↔ ${b.name}: trunk without tagged VLAN` });
    }

    if (l.mode === 'access' && !l.accessVlan) {
      issues.push({ type: 'warning', message: `${a.name} ↔ ${b.name}: access without VLAN` });
    }
  });

  if (!issues.length) {
    issues.push({ type: 'info', message: state.language === 'fr' ? 'Aucune alerte detectee.' : 'No alerts detected.' });
  }

  el.validationCount.textContent = String(issues.length);
  el.validationList.innerHTML = issues.map((it) => `<li class="${it.type}">${escapeHtml(it.message)}</li>`).join('');
}

function renderInspector() {
  el.deviceForm.classList.add('hidden');
  el.linkForm.classList.add('hidden');
  el.inspectorEmpty.classList.remove('hidden');
  el.selectionType.textContent = tr('noSelection');

  if (!state.selected) {
    return;
  }

  if (state.selected.type === 'node') {
    const n = getNode(state.selected.id);
    if (!n) {
      return;
    }
    el.inspectorEmpty.classList.add('hidden');
    el.deviceForm.classList.remove('hidden');
    el.selectionType.textContent = n.name;
    el.deviceType.innerHTML = deviceCatalog.map((d) => `<option value="${d.type}">${state.language === 'fr' ? d.fr : d.en}</option>`).join('');
    el.deviceType.value = n.type;
    el.deviceName.value = n.name;
    el.deviceRole.value = n.role || '';
    el.deviceMgmtIp.value = n.mgmtIp || '';
    el.devicePorts.value = n.ports;
    el.deviceWidth.value = n.width;
    return;
  }

  if (state.selected.type === 'link') {
    const l = getLink(state.selected.id);
    if (!l) {
      return;
    }
    el.inspectorEmpty.classList.add('hidden');
    el.linkForm.classList.remove('hidden');
    el.selectionType.textContent = l.id.toUpperCase();
    el.linkSourcePort.value = l.sourcePort;
    el.linkDestPort.value = l.destPort;
    el.linkMode.value = l.mode;
    el.linkNativeVlan.value = l.nativeVlan;
    el.linkTaggedVlans.value = Array.isArray(l.taggedVlans) ? l.taggedVlans.join(',') : '';
    el.linkAccessVlan.value = l.accessVlan;
  }
}

function renderHint(text) {
  el.canvasHint.textContent = text;
  el.canvasHint.classList.remove('hidden');
  window.clearTimeout(renderHint.timer);
  renderHint.timer = window.setTimeout(() => {
    el.canvasHint.textContent = tr('canvasHint');
    if (state.nodes.length) {
      el.canvasHint.classList.add('hidden');
    }
  }, 1600);
}

function render() {
  applyTranslations();
  renderLibrary();
  renderRack();
  renderLinks();
  renderNodes();
  renderStatus();
  renderValidation();
  renderInspector();

  if (!state.nodes.length) {
    el.canvasHint.classList.remove('hidden');
    el.canvasHint.textContent = tr('canvasHint');
  }
}

function saveLocal() {
  const payload = {
    state,
    nodeCounter,
    linkCounter
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  renderHint(tr('saved'));
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    renderHint(state.language === 'fr' ? 'Aucune sauvegarde locale' : 'No local saved state');
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (data && data.state) {
      Object.assign(state, data.state);
      nodeCounter = data.nodeCounter || state.nodes.length + 1;
      linkCounter = data.linkCounter || state.links.length + 1;
    }
    render();
    renderHint(tr('loaded'));
  } catch {
    renderHint(state.language === 'fr' ? 'Erreur de chargement' : 'Load error');
  }
}

function exportJson() {
  downloadFile('netforge-topology.json', JSON.stringify({ nodes: state.nodes, links: state.links, rackSize: state.rackSize }, null, 2), 'application/json');
  renderHint(tr('exported'));
}

function exportCsv() {
  const rows = ['rowType,id,type,name,role,mgmtIp,ports,x,y,width,sourceId,destId,sourcePort,destPort,mode,nativeVlan,taggedVlans,accessVlan'];
  state.nodes.forEach((n) => {
    rows.push(['node', n.id, n.type, n.name, n.role || '', n.mgmtIp || '', n.ports, Math.round(n.x), Math.round(n.y), n.width, '', '', '', '', '', '', '', ''].map(csvSafe).join(','));
  });
  state.links.forEach((l) => {
    rows.push(['link', l.id, '', '', '', '', '', '', '', '', l.sourceId, l.destId, l.sourcePort, l.destPort, l.mode, l.nativeVlan || '', (l.taggedVlans || []).join('|'), l.accessVlan || ''].map(csvSafe).join(','));
  });
  downloadFile('netforge-topology.csv', rows.join('\n'), 'text/csv');
  renderHint(tr('exported'));
}

function exportSvg() {
  const m = rackMetrics();
  const linkContent = state.links.map((l) => {
    const aNode = getNode(l.sourceId);
    const bNode = getNode(l.destId);
    if (!aNode || !bNode) {
      return '';
    }
    const a = nodeCenter(aNode);
    const b = nodeCenter(bNode);
    const c = (a.x + b.x) / 2;
    return `<path d="M ${a.x} ${a.y} C ${c} ${a.y}, ${c} ${b.y}, ${b.x} ${b.y}" stroke="#7cc9ff" stroke-width="3" fill="none"/>`;
  }).join('');

  const nodeContent = state.nodes.map((n) => {
    const c = catalog(n.type);
    const w = n.width;
    const h = n.type === 'material' ? 190 : 112;
    const img = n.imageSrc ? `<image href="${n.imageSrc}" x="${n.x + 8}" y="${n.y + 54}" width="${w - 16}" height="80" preserveAspectRatio="xMidYMid slice"/>` : '';
    return `<g>
      <rect x="${n.x}" y="${n.y}" width="${w}" height="${h}" rx="12" fill="#122038" stroke="rgba(255,255,255,0.2)"/>
      <circle cx="${n.x + w - 12}" cy="${n.y + 12}" r="4" fill="${c.color.includes('var(') ? '#7cc9ff' : c.color}"/>
      <text x="${n.x + 10}" y="${n.y + 20}" fill="#95a8c2" font-size="10">${escapeHtml(state.language === 'fr' ? c.fr : c.en)}</text>
      <text x="${n.x + 10}" y="${n.y + 38}" fill="#edf3fb" font-size="13">${escapeHtml(n.name)}</text>
      ${img}
    </g>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(m.canvasWidth)}" height="${Math.round(m.canvasHeight)}" viewBox="0 0 ${Math.round(m.canvasWidth)} ${Math.round(m.canvasHeight)}">
    <rect width="100%" height="100%" fill="#07111d"/>
    ${linkContent}
    ${nodeContent}
  </svg>`;

  downloadFile('netforge-topology.svg', svg, 'image/svg+xml');
  renderHint(tr('exported'));
}

function csvSafe(value) {
  const text = String(value ?? '');
  return '"' + text.replaceAll('"', '""') + '"';
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetProject() {
  state.nodes = [];
  state.links = [];
  state.selected = null;
  state.selectedType = null;
  state.toolMode = 'select';
  state.connectSourceId = null;
  nodeCounter = 1;
  linkCounter = 1;
  render();
  renderHint(tr('resetDone'));
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    renderHint(tr('csvHelp'));
    return;
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const index = (name) => header.indexOf(name);

  lines.slice(1).forEach((line) => {
    const cols = splitCsvLine(line);
    const type = (cols[index('type')] || 'switch').trim().toLowerCase();
    const x = Number(cols[index('x')]);
    const y = Number(cols[index('y')]);
    const node = makeNode(type, Number.isFinite(x) ? x : undefined, Number.isFinite(y) ? y : undefined, {
      name: cols[index('name')] || undefined,
      role: cols[index('role')] || undefined,
      mgmtIp: cols[index('mgmtip')] || undefined,
      ports: Number(cols[index('ports')]),
      width: Number(cols[index('width')])
    });
    if (state.rackSnap) {
      snapNodeToRack(node);
    }
    state.nodes.push(node);
  });
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

function importFiles(files) {
  if (!files || !files.length) {
    return;
  }
  const list = Array.from(files);
  let pending = list.length;

  list.forEach((file) => {
    const lower = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      try {
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          const node = makeNode('material', undefined, undefined, {
            name: file.name.replace(/\.[^.]+$/, ''),
            imageSrc: String(result),
            width: 240
          });
          if (state.rackSnap) {
            snapNodeToRack(node);
          }
          state.nodes.push(node);
        } else if (lower.endsWith('.csv')) {
          parseCsv(String(result));
        } else if (lower.endsWith('.json')) {
          const parsed = JSON.parse(String(result));
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.links)) {
            state.nodes.push(...parsed.nodes);
            state.links.push(...parsed.links);
            if (parsed.rackSize) {
              state.rackSize = Number(parsed.rackSize) || state.rackSize;
              el.rackSize.value = String(state.rackSize);
            }
            nodeCounter = Math.max(nodeCounter, state.nodes.length + 1);
            linkCounter = Math.max(linkCounter, state.links.length + 1);
          }
        }
      } catch {
        // ignore malformed file and continue
      }

      pending -= 1;
      if (pending === 0) {
        render();
        renderHint(tr('imported'));
      }
    };

    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}

function loadEventHandlers() {
  el.langToggle.addEventListener('click', () => {
    state.language = state.language === 'fr' ? 'en' : 'fr';
    localStorage.setItem(LANG_KEY, state.language);
    render();
  });

  el.newProjectBtn.addEventListener('click', resetProject);
  el.saveLocalBtn.addEventListener('click', saveLocal);
  el.loadLocalBtn.addEventListener('click', loadLocal);

  el.importTrigger.addEventListener('click', () => {
    el.fileImport.value = '';
    el.fileImport.click();
  });

  el.importImageBtn.addEventListener('click', () => {
    el.fileImport.value = '';
    el.fileImport.accept = '.png,.jpg,.jpeg,image/png,image/jpeg';
    el.fileImport.click();
  });

  el.fileImport.addEventListener('change', () => {
    importFiles(el.fileImport.files);
    el.fileImport.accept = '.json,.csv,.png,.jpg,.jpeg,image/png,image/jpeg,text/csv,application/json';
  });

  el.exportMenuToggle.addEventListener('click', () => {
    el.exportMenu.classList.toggle('hidden');
  });

  el.exportJsonBtn.addEventListener('click', () => {
    exportJson();
    el.exportMenu.classList.add('hidden');
  });

  el.exportCsvBtn.addEventListener('click', () => {
    exportCsv();
    el.exportMenu.classList.add('hidden');
  });

  el.exportSvgBtn.addEventListener('click', () => {
    exportSvg();
    el.exportMenu.classList.add('hidden');
  });

  document.addEventListener('click', (event) => {
    if (!el.exportMenu.contains(event.target) && event.target !== el.exportMenuToggle) {
      el.exportMenu.classList.add('hidden');
    }
  });

  el.selectModeBtn.addEventListener('click', () => {
    state.toolMode = 'select';
    state.connectSourceId = null;
    renderStatus();
  });

  el.linkModeBtn.addEventListener('click', () => {
    state.toolMode = 'link';
    renderStatus();
  });

  el.deleteSelectedBtn.addEventListener('click', removeSelected);
  el.fitViewBtn.addEventListener('click', fitView);
  el.addSampleBtn.addEventListener('click', addSample);

  el.rackSize.addEventListener('change', () => {
    state.rackSize = Number(el.rackSize.value) || 42;
    if (state.rackSnap) {
      state.nodes.forEach((node) => snapNodeToRack(node));
    }
    render();
  });

  el.rackSnap.addEventListener('change', () => {
    state.rackSnap = !!el.rackSnap.checked;
    if (state.rackSnap) {
      state.nodes.forEach((node) => snapNodeToRack(node));
      render();
    }
  });

  el.canvas.addEventListener('click', () => {
    if (!drag) {
      setSelection(null);
      renderInspector();
      renderStatus();
    }
  });

  el.deviceForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.selected || state.selected.type !== 'node') {
      return;
    }
    const node = getNode(state.selected.id);
    if (!node) {
      return;
    }
    node.type = el.deviceType.value;
    node.name = el.deviceName.value.trim() || node.name;
    node.role = el.deviceRole.value.trim();
    node.mgmtIp = el.deviceMgmtIp.value.trim();
    node.ports = Number(el.devicePorts.value) || 0;
    node.width = Number(el.deviceWidth.value) || node.width;
    if (state.rackSnap) {
      snapNodeToRack(node);
    }
    render();
  });

  el.linkForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.selected || state.selected.type !== 'link') {
      return;
    }
    const link = getLink(state.selected.id);
    if (!link) {
      return;
    }
    link.sourcePort = el.linkSourcePort.value.trim() || link.sourcePort;
    link.destPort = el.linkDestPort.value.trim() || link.destPort;
    link.mode = el.linkMode.value;
    link.nativeVlan = el.linkNativeVlan.value ? Number(el.linkNativeVlan.value) : '';
    link.taggedVlans = el.linkTaggedVlans.value
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    link.accessVlan = el.linkAccessVlan.value ? Number(el.linkAccessVlan.value) : '';
    render();
  });

  window.addEventListener('resize', () => {
    renderRack();
    renderLinks();
  });
}

function fitView() {
  if (!state.nodes.length) {
    return;
  }
  const m = rackMetrics();
  const minX = Math.min(...state.nodes.map((n) => n.x));
  const minY = Math.min(...state.nodes.map((n) => n.y));
  const maxX = Math.max(...state.nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...state.nodes.map((n) => n.y + (n.type === 'material' ? 190 : 112)));

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const dx = Math.max(10, (m.canvasWidth - contentW) / 2 - minX);
  const dy = Math.max(10, (m.canvasHeight - contentH) / 2 - minY);

  state.nodes = state.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  if (state.rackSnap) {
    state.nodes.forEach((n) => snapNodeToRack(n));
  }
  render();
}

function loadInitial() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    render();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.state) {
      Object.assign(state, parsed.state);
      nodeCounter = parsed.nodeCounter || nodeCounter;
      linkCounter = parsed.linkCounter || linkCounter;
    }
  } catch {
    // ignore
  }
  el.rackSize.value = String(state.rackSize);
  el.rackSnap.checked = !!state.rackSnap;
  render();
}

function init() {
  loadEventHandlers();
  loadInitial();
  if (!state.nodes.length) {
    renderHint(tr('canvasHint'));
  }
}

init();
