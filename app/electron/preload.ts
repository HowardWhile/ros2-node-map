import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ros2NodeMap", {
  platform: process.platform,
  getDomainConfig: () => ipcRenderer.invoke("domain:get"),
  setDomainConfig: (settings: { mode: "system" | "custom"; customDomainId: string }) =>
    ipcRenderer.invoke("domain:set", settings),
});
