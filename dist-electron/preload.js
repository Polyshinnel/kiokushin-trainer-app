import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  db: {
    query: (channel, ...args) => ipcRenderer.invoke(`db:${channel}`, ...args)
  },
  sync: {
    start: () => ipcRenderer.invoke("sync:start"),
    getStatus: () => ipcRenderer.invoke("sync:status")
  }
});
