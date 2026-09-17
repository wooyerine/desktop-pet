const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  onActivity: (cb) => ipcRenderer.on('activity', (_e, type) => cb(type)),
  onPetSize: (cb) => ipcRenderer.on('pet-size', (_e, px) => cb(px)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_e, p) => cb(p)),
  onScreenLock: (cb) => ipcRenderer.on('screen-lock', (_e, locked) => cb(locked)),
  onRoam: (cb) => ipcRenderer.on('roam', (_e, geo) => cb(geo)),
  roam: (on) => ipcRenderer.send('roam', on),
  roamReady: () => ipcRenderer.send('roam-ready'),
  clickThrough: (on) => ipcRenderer.send('click-through', on),
  fit: (height) => ipcRenderer.send('fit', height),
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  quit: () => ipcRenderer.send('quit'),
  status: () => ipcRenderer.invoke('status'),
});
