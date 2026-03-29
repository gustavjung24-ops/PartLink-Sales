import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import {
  type AuthLoginResult,
  type AuthSession,
  type AuthLoginPayload,
  type AuthRefreshResult,
  type AuthUser,
  type FileReadPayload,
  type FileWritePayload,
  type PasswordResetPayload,
  type PasswordResetResult,
  IPC_CHANNELS,
  IPC_CHANNELS_LEGACY,
  type AppInfo,
  type WindowState,
  type SyncOverwriteResult,
} from "@/shared/electronApi";
import { registerLicenseHandlers, unregisterLicenseHandlers } from "./licenseHandlers";
import { withErrorHandling } from "./utils";
import { authService } from "../services/auth";
import { secureSessionStore } from "../services/secureSessionStore";
import { sqliteCacheRecoveryService } from "../services/sqliteCacheRecovery";

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
  withErrorHandling<AuthLoginPayload, AuthLoginResult>(
    IPC_CHANNELS_LEGACY.AUTH_LOGIN,
    async (_event, payload) => {
      if (isVerbose) {
        console.info("[ipc] auth:login", payload.email);
      }
      return authService.login(payload);
    }
  );

  withErrorHandling<{ refreshToken: string }, AuthRefreshResult>(
    IPC_CHANNELS_LEGACY.AUTH_REFRESH,
    async (_event, payload) => {
      if (!payload.refreshToken) {
        throw new Error("Thiếu refresh token");
      }
      return authService.refresh(payload.refreshToken);
    }
  );

  withErrorHandling<void, AuthUser | null>(
    IPC_CHANNELS_LEGACY.AUTH_ME,
    async () => {
      const session = await secureSessionStore.loadSession();
      if (!session?.accessToken) {
        return null;
      }
      return authService.me(session.accessToken);
    }
  );

  withErrorHandling<PasswordResetPayload, PasswordResetResult>(
    IPC_CHANNELS_LEGACY.AUTH_REQUEST_PASSWORD_RESET,
    async (_event, payload) => {
      return authService.requestPasswordReset(payload.email);
    }
  );

  /**
   * AUTH: Logout handler
   */
  withErrorHandling<{ refreshToken?: string } | undefined, void>(
    IPC_CHANNELS_LEGACY.AUTH_LOGOUT,
    async (_event, payload) => {
      await authService.logout(payload?.refreshToken);
    }
  );

  withErrorHandling<void, AuthSession | null>(
    IPC_CHANNELS_LEGACY.AUTH_LOAD_SESSION,
    async () => secureSessionStore.loadSession()
  );

  withErrorHandling<AuthSession, void>(
    IPC_CHANNELS_LEGACY.AUTH_SAVE_SESSION,
    async (_event, payload) => {
      // Look up the refresh token expiry that was recorded when the token was issued.
      // Falls back to 7 days from now when called during bootstrap refresh (Map already restored).
      const refreshTokenExpiry =
        authService.getRefreshTokenExpiry(payload.refreshToken) ??
        Date.now() + 7 * 24 * 60 * 60 * 1000;
      await secureSessionStore.saveSession(payload, refreshTokenExpiry);
    }
  );

  withErrorHandling<void, void>(
    IPC_CHANNELS_LEGACY.AUTH_CLEAR_SESSION,
    async () => {
      await secureSessionStore.clearSession();
    }
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

  /**
   * CACHE: Back up SQLite cache before a server-wins sync overwrite.
   */
  withErrorHandling<{ reason?: string } | undefined, SyncOverwriteResult>(
    IPC_CHANNELS.cache.BACKUP_BEFORE_OVERWRITE,
    async (_event, payload) => {
      return sqliteCacheRecoveryService.backupBeforeOverwrite(payload?.reason);
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
