import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  db: {
    query: (channel, ...args) => ipcRenderer.invoke(`db:${channel}`, ...args)
  },
  auth: {
    login: (login, password) => ipcRenderer.invoke("auth:login", login, password)
  },
  sync: {
    start: () => ipcRenderer.invoke("sync:start"),
    getStatus: () => ipcRenderer.invoke("sync:status")
  }
});
