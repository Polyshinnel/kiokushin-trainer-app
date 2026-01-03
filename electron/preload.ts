const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (channel: string, ...args: unknown[]) => 
      ipcRenderer.invoke(`db:${channel}`, ...args),
  },
  
  auth: {
    login: (login: string, password: string) => 
      ipcRenderer.invoke('auth:login', login, password),
  },
  
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    getStatus: () => ipcRenderer.invoke('sync:status'),
  }
})

