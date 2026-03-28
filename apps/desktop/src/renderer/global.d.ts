import type { ElectronAPI, ElectronUpdaterAPI } from "@/shared/electronApi";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electronUpdater?: ElectronUpdaterAPI;
    license: {
      check: (k: string) => Promise<{
        ok: boolean;
        status: string;
        message?: string;
        data?: unknown;
      }>;
      activate: (k: string, c?: string, p?: string) => Promise<{
        ok: boolean;
        status: string;
        message?: string;
        data?: unknown;
      }>;
    };
  }
}

export {};
