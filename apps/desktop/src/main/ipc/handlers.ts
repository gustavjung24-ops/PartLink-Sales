import { app, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import {
  AuthLoginPayload,
  type FileReadPayload,
  type FileWritePayload,
  IPC_CHANNELS,
  type AppInfo,
  type WindowState
} from "@/shared/electronApi";
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
  /**
   * AUTH: Login handler
   */
  withErrorHandling<AuthLoginPayload, { accessToken: string; expiresIn: number }>(
    IPC_CHANNELS.AUTH_LOGIN,
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
    IPC_CHANNELS.AUTH_LOGOUT,
    async () => undefined
  );

  /**
   * FILE SYSTEM: Read text file
   */
  withErrorHandling<FileReadPayload, string>(
    IPC_CHANNELS.FILESYSTEM_READ_TEXT_FILE,
    async (_event, payload) => {
      const content = await readFile(payload.filePath, payload.encoding ?? "utf-8");
      return typeof content === "string" ? content : content.toString();
    }
  );

  /**
   * FILE SYSTEM: Write text file
   */
  withErrorHandling<FileWritePayload, void>(
    IPC_CHANNELS.FILESYSTEM_WRITE_TEXT_FILE,
    async (_event, payload) => {
      await writeFile(payload.filePath, payload.content, payload.encoding ?? "utf-8");
    }
  );

  /**
   * APP: Get application info
   */
  withErrorHandling<void, AppInfo>(
    IPC_CHANNELS.APP_GET_INFO,
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
    IPC_CHANNELS.WINDOW_MINIMIZE,
    async (event) => {
      getSenderWindow(event).minimize();
    }
  );

  /**
   * WINDOW: Maximize
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS.WINDOW_MAXIMIZE,
    async (event) => {
      getSenderWindow(event).maximize();
    }
  );

  /**
   * WINDOW: Unmaximize
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS.WINDOW_UNMAXIMIZE,
    async (event) => {
      getSenderWindow(event).unmaximize();
    }
  );

  /**
   * WINDOW: Toggle maximize
   */
  withErrorHandling<void, void>(
    IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE,
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
    IPC_CHANNELS.WINDOW_CLOSE,
    async (event) => {
      getSenderWindow(event).close();
    }
  );

  /**
   * WINDOW: Get state
   */
  withErrorHandling<void, WindowState>(
    IPC_CHANNELS.WINDOW_GET_STATE,
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
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
