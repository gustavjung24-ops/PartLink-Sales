import { BrowserWindow, app, ipcMain } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateDownloadedEvent, type UpdateInfo } from "electron-updater";
import crypto from "node:crypto";
import { machineIdSync } from "node-machine-id";
import { IPC_CHANNELS, type UpdaterBridgeEvent, type UpdaterEventName } from "@/shared/electronApi";

const DEFAULT_ROLLOUT_PERCENTAGE = 100;

function clampPercentage(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_ROLLOUT_PERCENTAGE;
  }

  return Math.min(100, Math.max(0, value));
}

function getRolloutBucket(): number {
  const machineId = machineIdSync(true);
  const hash = crypto.createHash("sha256").update(machineId).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 100;
}

export class AppUpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private initialized = false;
  private rolloutPercentage = clampPercentage(
    Number(process.env.SPARELINK_UPDATE_ROLLOUT_PERCENTAGE ?? DEFAULT_ROLLOUT_PERCENTAGE)
  );

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  initialize(window: BrowserWindow | null): void {
    if (this.initialized) {
      this.setMainWindow(window);
      return;
    }

    this.setMainWindow(window);
    this.initialized = true;

    autoUpdater.autoDownload =
      process.env.SPARELINK_AUTO_DOWNLOAD !== "false";
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = process.env.SPARELINK_ALLOW_PRERELEASE === "true";

    if (process.env.SPARELINK_UPDATE_URL) {
      autoUpdater.setFeedURL({
        provider: "generic",
        url: process.env.SPARELINK_UPDATE_URL,
        channel: process.env.SPARELINK_UPDATE_CHANNEL || "latest",
      });
    }

    autoUpdater.on("checking-for-update", () => {
      this.emit("checking-for-update");
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.emit("update-available", info);
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      this.emit("update-not-available", info);
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      this.emit("download-progress", progress);
    });

    autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
      this.emit("update-downloaded", event);
    });

    autoUpdater.on("error", (error) => {
      this.emit("error", {
        message: error?.message ?? "Unknown updater error",
      });
    });

    ipcMain.handle(IPC_CHANNELS.updater.CHECK_FOR_UPDATES, async () => {
      await this.checkForUpdates();
    });

    ipcMain.handle(IPC_CHANNELS.updater.QUIT_AND_INSTALL, async () => {
      this.quitAndInstall();
    });
  }

  async checkForUpdates(): Promise<void> {
    if (!app.isPackaged) {
      this.emit("update-not-available");
      return;
    }

    // For offline/private deployments without update host configured,
    // skip updater checks to avoid noisy app-update.yml errors.
    if (!process.env.SPARELINK_UPDATE_URL) {
      this.emit("update-not-available");
      return;
    }

    if (!this.isEligibleForRollout()) {
      this.emit("update-not-available");
      return;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await autoUpdater.checkForUpdates();
        return;
      } catch (err) {
        if (attempt === 1) {
          this.emit("error", {
            message: (err as Error).message || "Failed to check for updates",
          });
        }
      }
    }
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  dispose(): void {
    ipcMain.removeHandler(IPC_CHANNELS.updater.CHECK_FOR_UPDATES);
    ipcMain.removeHandler(IPC_CHANNELS.updater.QUIT_AND_INSTALL);
    autoUpdater.removeAllListeners();
    this.initialized = false;
  }

  private isEligibleForRollout(): boolean {
    return getRolloutBucket() < this.rolloutPercentage;
  }

  private emit(event: UpdaterEventName, data?: unknown): void {
    const payload: UpdaterBridgeEvent = { event, data };
    this.mainWindow?.webContents.send(IPC_CHANNELS.updater.EVENT, payload);
  }
}

export const appUpdater = new AppUpdaterService();
