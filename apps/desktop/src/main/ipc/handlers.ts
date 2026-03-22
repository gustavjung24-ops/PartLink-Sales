import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import {
  type AuthLoginPayload,
  type FileReadPayload,
  type FileWritePayload,
  IPC_CHANNELS,
  IPC_CHANNELS_LEGACY,
  type AppInfo,
  type WindowState
} from "@/shared/electronApi";
import { registerLicenseHandlers, unregisterLicenseHandlers } from "./licenseHandlers";
import { withErrorHandling } from "./utils";

/**
 * Helper to safely get sender window with proper error handling
 */
function getSenderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("Unable to resolve BrowserWindow from IPC sender");
  }
  return window;
}

/**
 * Register all IPC handlers with error handling wrapper
 * Platform Layer: Centralized IPC registration with standardized error responses
 */
export function registerIpcHandlers(isVerbose: boolean): void {
  registerLicenseHandlers();

  /**
   * AUTH: Login handler
   */
  withErrorHandling<AuthLoginPayload, { accessToken: string; expiresIn: number }>(
    IPC_CHANNELS_LEGACY.AUTH_LOGIN,
    async (_event, payload) => {
      if (isVerbose) {
        console.info("[ipc] auth:login", payload.username);
      }
      return {
        accessToken: `stub-token-${payload.username}`,
        expiresIn: 3600
      };
    }
  );

  /**
   * AUTH: Logout handler
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS_LEGACY.AUTH_LOGOUT,
    async () => undefined
  );

  /**
   * FILE SYSTEM: Read text file
   */
  withErrorHandling<FileReadPayload, string>(
    IPC_CHANNELS_LEGACY.FILESYSTEM_READ_TEXT_FILE,
    async (_event, payload) => {
      return readFile(payload.filePath, { encoding: payload.encoding ?? "utf-8" });
    }
  );

  /**
   * FILE SYSTEM: Write text file
   */
  withErrorHandling<FileWritePayload, void>(
    IPC_CHANNELS_LEGACY.FILESYSTEM_WRITE_TEXT_FILE,
    async (_event, payload) => {
      await writeFile(payload.filePath, payload.content, payload.encoding ?? "utf-8");
    }
  );

  /**
   * APP: Get application info
   */
  withErrorHandling<void, AppInfo>(
    IPC_CHANNELS_LEGACY.APP_GET_INFO,
    async (): Promise<AppInfo> => ({
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged
    })
  );

  /**
   * WINDOW: Minimize
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS_LEGACY.WINDOW_MINIMIZE,
    async (event) => {
      getSenderWindow(event).minimize();
    }
  );

  /**
   * WINDOW: Maximize
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS_LEGACY.WINDOW_MAXIMIZE,
    async (event) => {
      getSenderWindow(event).maximize();
    }
  );

  /**
   * WINDOW: Unmaximize
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS_LEGACY.WINDOW_UNMAXIMIZE,
    async (event) => {
      getSenderWindow(event).unmaximize();
    }
  );

  /**
   * WINDOW: Toggle maximize
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS_LEGACY.WINDOW_TOGGLE_MAXIMIZE,
    async (event) => {
      const window = getSenderWindow(event);
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  );

  /**
   * WINDOW: Close
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS_LEGACY.WINDOW_CLOSE,
    async (event) => {
      getSenderWindow(event).close();
    }
  );

  /**
   * WINDOW: Get state
   */
  withErrorHandling<void, WindowState>(
    IPC_CHANNELS_LEGACY.WINDOW_GET_STATE,
    async (event): Promise<WindowState> => {
      const window = getSenderWindow(event);
      return {
        isMaximized: window.isMaximized(),
        isMinimized: window.isMinimized()
      };
    }
  );
}

export function unregisterIpcHandlers(): void {
  unregisterLicenseHandlers();

  // Flatten nested IPC_CHANNELS structure
  const allChannels = Object.values(IPC_CHANNELS).flatMap(group =>
    typeof group === "object" ? Object.values(group) : group
  );
  allChannels.forEach((channel) => {
    if (typeof channel === "string") {
      ipcMain.removeHandler(channel);
    }
  });
}
