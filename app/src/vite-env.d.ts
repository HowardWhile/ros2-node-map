/// <reference types="vite/client" />

interface Ros2NodeMapDomainConfig {
  configurable: boolean;
  mode: "system" | "custom";
  systemDomainId: string;
  customDomainId: string;
  effectiveDomainId: string;
}

interface Window {
  ros2NodeMap?: {
    platform: string;
    getDomainConfig: () => Promise<Ros2NodeMapDomainConfig>;
    setDomainConfig: (settings: {
      mode: "system" | "custom";
      customDomainId: string;
    }) => Promise<Ros2NodeMapDomainConfig>;
  };
}
