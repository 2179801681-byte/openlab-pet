const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('pet:set-ignore-mouse', !!ignore),
  dragStart: (screenX, screenY) =>
    ipcRenderer.send('pet:drag-start', { screenX, screenY }),
  dragMove: (screenX, screenY) =>
    ipcRenderer.send('pet:drag-move', { screenX, screenY }),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  quit: () => ipcRenderer.send('pet:quit'),
  getState: () => ipcRenderer.invoke('pet:get-state'),
  click: () => ipcRenderer.invoke('pet:click'),
  onWalkStart: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('pet:walk-start', handler);
    return () => ipcRenderer.removeListener('pet:walk-start', handler);
  },
  onWalkEnd: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('pet:walk-end', handler);
    return () => ipcRenderer.removeListener('pet:walk-end', handler);
  }
});