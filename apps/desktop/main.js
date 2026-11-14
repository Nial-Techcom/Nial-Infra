const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEV_URL = process.env.NIAL_INFRA_DEV_URL;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}
function writeSettings(patch) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), ...patch }, null, 2));
}

function validServerUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch { return false; }
}

let win = null;

// Only our own window (the bundled UI, or the dev server) may talk to the main process.
const trustedSender = (e) => {
  const u = e.senderFrame?.url ?? '';
  return u.startsWith('file://') || (!!DEV_URL && u.startsWith(DEV_URL));
};
const guard = (handler) => (e, ...args) => {
  if (!trustedSender(e)) throw new Error('Untrusted sender');
  return handler(e, ...args);
};

// Defence in depth: the UI needs no permission (camera, geolocation…), no <webview>, no new windows.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (ev) => ev.preventDefault());
  contents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  contents.session.setPermissionCheckHandler(() => false);
});

function createWindow() {
  const bounds = readSettings().bounds ?? { width: 1360, height: 860 };
  win = new BrowserWindow({
    ...bounds, minWidth: 900, minHeight: 600, backgroundColor: '#141A22', title: 'Nial-Infra',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(app.isPackaged ? path.join(__dirname, 'renderer', 'index.html') : path.join(__dirname, '..', 'web', 'dist', 'index.html'));

  // The UI must never navigate away or open arbitrary windows; external links go to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://') && url !== DEV_URL && !(DEV_URL && url.startsWith(DEV_URL))) e.preventDefault(); });
  win.on('close', () => { if (win && !win.isMaximized()) writeSettings({ bounds: win.getBounds() }); });
  win.on('closed', () => { win = null; });
}

const send = (action) => win?.webContents.send('nf:menu', action);

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Import .shmnlt…', accelerator: 'CmdOrCtrl+O', click: () => send('import-shmnlt') },
        { label: 'Export .shmnlt…', accelerator: 'CmdOrCtrl+S', click: () => send('export-shmnlt') },
        { label: 'Export CSV…', click: () => send('export-csv') },
        { label: 'Export PDF…', click: () => send('export-pdf') },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { label: 'Search…', click: () => send('search') },
        { label: 'Toggle theme', click: () => send('toggle-theme') },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('nf:get-server-url', guard(() => readSettings().serverUrl ?? null));
ipcMain.handle('nf:set-server-url', guard((_e, url) => {
  if (typeof url !== 'string' || !validServerUrl(url)) throw new Error('Invalid server URL');
  writeSettings({ serverUrl: url.replace(/\/+$/, '') });
}));

ipcMain.handle('nf:save-file', guard(async (_e, { name, data, mime }) => {
  const safe = String(name).replace(/[\\/:*?"<>|]+/g, '_');
  const ext = path.extname(safe).slice(1);
  const r = await dialog.showSaveDialog(win, { defaultPath: safe, filters: ext ? [{ name: mime || ext, extensions: [ext] }] : [] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, typeof data === 'string' ? data : Buffer.from(data));
  return true;
}));

ipcMain.handle('nf:open-file', guard(async (_e, { extensions }) => {
  const exts = Array.isArray(extensions) ? extensions.filter((x) => /^[a-z0-9]+$/i.test(x)) : [];
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: exts.length ? [{ name: 'Nial-Infra', extensions: exts }] : [] });
  if (r.canceled || !r.filePaths[0]) return null;
  const file = r.filePaths[0];
  if (fs.statSync(file).size > 20 * 1024 * 1024) throw new Error('File too large');
  return { name: path.basename(file), text: fs.readFileSync(file, 'utf8') };
}));

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
