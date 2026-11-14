// Exposes a tiny, explicit API to the web UI. The renderer never gets Node or the raw ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nialInfraDesktop', {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.invoke('nf:get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('nf:set-server-url', url),
  saveFile: (name, data, mime) => ipcRenderer.invoke('nf:save-file', { name, data, mime }),
  openFile: (extensions) => ipcRenderer.invoke('nf:open-file', { extensions }),
  onMenu: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on('nf:menu', handler);
    return () => ipcRenderer.removeListener('nf:menu', handler);
  },
});
