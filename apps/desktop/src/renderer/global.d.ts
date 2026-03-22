import type { ElectronAPI, ElectronUpdaterAPI } from "@/shared/electronApi";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electronUpdater?: ElectronUpdaterAPI;
  }
}

export {};
