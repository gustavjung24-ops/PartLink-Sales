import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import {
  AuthLoginPayload,
  type FileReadPayload,
  type FileWritePayload,
  IPC_CHANNELS,
  type AppInfo,
  type WindowState
} from "@/shared/electronApi";

function getSenderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    throw new Error("Unable to resolve BrowserWindow from IPC sender");
  }

  return window;
}

export function registerIpcHandlers(isVerbose: boolean): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, payload: AuthLoginPayload) => {
    if (isVerbose) {
      console.info("[ipc] auth:login", payload.username);
    }

    return {
      accessToken: `stub-token-${payload.username}`,
      expiresIn: 3600
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => undefined);

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_READ_TEXT_FILE, async (_event, payload: FileReadPayload) => {
    return readFile(payload.filePath, payload.encoding ?? "utf-8");
  });

  ipcMain.handle(IPC_CHANNELS.FILESYSTEM_WRITE_TEXT_FILE, async (_event, payload: FileWritePayload) => {
    await writeFile(payload.filePath, payload.content, payload.encoding ?? "utf-8");
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async (): Promise<AppInfo> => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged
    };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (event) => {
    getSenderWindow(event).minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async (event) => {
    getSenderWindow(event).maximize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_UNMAXIMIZE, async (event) => {
    getSenderWindow(event).unmaximize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, async (event) => {
    const window = getSenderWindow(event);
    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event) => {
    getSenderWindow(event).close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_STATE, async (event): Promise<WindowState> => {
    const window = getSenderWindow(event);
    return {
      isMaximized: window.isMaximized(),
      isMinimized: window.isMinimized()
    };
  });
}

export function unregisterIpcHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
