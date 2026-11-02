// Puente mínimo entre la ventana y el launcher. En el juego solo sirve para que sepa que corre en la app de escritorio.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("ggDesktop", {
  isDesktop: true,
  platform: process.platform,
  ready: () => ipcRenderer.send("launcher-ready"),
  onStatus: (cb) => ipcRenderer.on("status", (_e, s) => cb(s)),
  retry: () => ipcRenderer.send("retry"),
  proceed: () => ipcRenderer.send("proceed"),
  quit: () => ipcRenderer.send("quit"),
});
