import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ros2NodeMap", {
  platform: process.platform,
  getDomainConfig: () => ipcRenderer.invoke("domain:get"),
  setDomainConfig: (settings: { mode: "system" | "custom"; customDomainId: string }) =>
    ipcRenderer.invoke("domain:set", settings),
  getRuntimeStatus: () => ipcRenderer.invoke("runtime:get"),
  onRuntimeStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on("runtime:status", listener);
    return () => ipcRenderer.removeListener("runtime:status", listener);
  },
});
