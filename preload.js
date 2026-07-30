const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  onActivity: (cb) => ipcRenderer.on('activity', (_e, type) => cb(type)),
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  quit: () => ipcRenderer.send('quit'),
  status: () => ipcRenderer.invoke('status'),
});
