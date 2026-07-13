import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("ros2NodeMap", {
  platform: process.platform,
});

