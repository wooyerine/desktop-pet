const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  onActivity: (cb) => ipcRenderer.on('activity', (_e, type) => cb(type)),
  onPetSize: (cb) => ipcRenderer.on('pet-size', (_e, px) => cb(px)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_e, p) => cb(p)),
  fit: (height) => ipcRenderer.send('fit', height),
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  quit: () => ipcRenderer.send('quit'),
  status: () => ipcRenderer.invoke('status'),
});
