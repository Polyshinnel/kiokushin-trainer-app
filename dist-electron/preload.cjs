var o = (n, e) => () => (e || n((e = { exports: {} }).exports, e), e.exports);
var r = o(() => {
  const { contextBridge: i, ipcRenderer: t } = require("electron");
  i.exposeInMainWorld("electronAPI", {
    db: {
      query: (n, ...e) => t.invoke(`db:${n}`, ...e)
    },
    auth: {
      login: (n, e) => t.invoke("auth:login", n, e)
    },
    sync: {
      start: () => t.invoke("sync:start"),
      getStatus: () => t.invoke("sync:status")
    }
  });
});
module.exports = r();
