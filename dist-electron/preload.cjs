var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_preload = __commonJS({
  "preload.cjs"() {
    const { contextBridge, ipcRenderer } = require("electron");
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
  }
});
require_preload();
