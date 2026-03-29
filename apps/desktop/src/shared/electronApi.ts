/**
 * Standardized IPC Response Format
 * Platform Layer: All IPC responses follow this contract
 */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}

// Import license types from shared package
import type {
  DeviceFingerprint,
  DeviceRebindingStatus,
  LicenseData,
  LicenseValidationResponse,
} from "@sparelink/shared";

export interface AuthLoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export type UserRole = "USER" | "SALES" | "SENIOR_SALES" | "ADMIN" | "SUPER_ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthLoginResult extends AuthSession {
  expiresIn: number;
}

export interface AuthRefreshResult {
  accessToken: string;
  expiresIn: number;
  expiresAt: number;
}

export interface PasswordResetPayload {
  email: string;
}

export interface PasswordResetResult {
  sent: boolean;
  message: string;
}

export interface FileReadPayload {
  filePath: string;
  encoding?: "utf8" | "utf-8";
}

export interface FileWritePayload {
  filePath: string;
  content: string;
  encoding?: "utf8" | "utf-8";
}

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isPackaged: boolean;
}

export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
}

export type UpdaterEventName =
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "download-progress"
  | "update-downloaded"
  | "error";

export interface UpdaterBridgeEvent {
  event: UpdaterEventName;
  data?: unknown;
}

export interface ElectronUpdaterAPI {
  on: (event: UpdaterEventName, listener: (...args: unknown[]) => void) => void;
  off: (event: UpdaterEventName, listener: (...args: unknown[]) => void) => void;
  checkForUpdates: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
}

export interface SyncOverwriteResult {
  backupPath: string | null;
  /** ISO-8601 timestamp recorded in the audit log. */
  loggedAt: string;
}

export interface ElectronAPI {
  auth: {
    login: (payload: AuthLoginPayload) => Promise<AuthLoginResult>;
    refresh: (payload: { refreshToken: string }) => Promise<AuthRefreshResult>;
    me: () => Promise<AuthUser | null>;
    requestPasswordReset: (payload: PasswordResetPayload) => Promise<PasswordResetResult>;
    logout: (payload?: { refreshToken?: string }) => Promise<void>;
    loadSession: () => Promise<AuthSession | null>;
    saveSession: (payload: AuthSession) => Promise<void>;
    clearSession: () => Promise<void>;
  };
  cache: {
    /** Back up the SQLite cache before a server-wins sync overwrite. */
    backupBeforeOverwrite: (reason?: string) => Promise<SyncOverwriteResult>;
  };
  fileSystem: {
    readTextFile: (payload: FileReadPayload) => Promise<string>;
    writeTextFile: (payload: FileWritePayload) => Promise<void>;
  };
  app: {
    getInfo: () => Promise<AppInfo>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
    getState: () => Promise<WindowState>;
  };
  license: {
    getFingerprint: () => Promise<DeviceFingerprint>;
    activate: (payload: { licenseKey: string }) => Promise<LicenseValidationResponse>;
    validate: (payload: { licenseKey: string }) => Promise<LicenseValidationResponse>;
    getCurrent: () => Promise<LicenseData | null>;
    deactivate: () => Promise<void>;
    getState: () => Promise<string>;
    isValid: () => Promise<boolean>;
    canRebind: () => Promise<DeviceRebindingStatus>;
  };
  events: {
    onWindowStateChanged: (handler: (state: WindowState) => void) => () => void;
  };
}

export const IPC_CHANNELS = {
  auth: {
    LOGIN: "auth:login",
    REFRESH: "auth:refresh",
    ME: "auth:me",
    REQUEST_PASSWORD_RESET: "auth:request-password-reset",
    LOGOUT: "auth:logout",
    LOAD_SESSION: "auth:load-session",
    SAVE_SESSION: "auth:save-session",
    CLEAR_SESSION: "auth:clear-session",
  },
  filesystem: {
    READ_TEXT_FILE: "filesystem:read-text-file",
    WRITE_TEXT_FILE: "filesystem:write-text-file",
  },
  app: {
    GET_INFO: "app:get-info",
  },
  window: {
    MINIMIZE: "window:minimize",
    MAXIMIZE: "window:maximize",
    UNMAXIMIZE: "window:unmaximize",
    TOGGLE_MAXIMIZE: "window:toggle-maximize",
    CLOSE: "window:close",
    GET_STATE: "window:get-state",
    STATE_CHANGED: "window:state-changed",
  },
  license: {
    GET_FINGERPRINT: "license:get-fingerprint",
    ACTIVATE: "license:activate",
    VALIDATE: "license:validate",
    GET_CURRENT: "license:get-current",
    DEACTIVATE: "license:deactivate",
    GET_STATE: "license:get-state",
    IS_VALID: "license:is-valid",
    CAN_REBIND: "license:can-rebind",
  },
  updater: {
    CHECK_FOR_UPDATES: "updater:check-for-updates",
    QUIT_AND_INSTALL: "updater:quit-and-install",
    EVENT: "updater:event"
  },
  cache: {
    BACKUP_BEFORE_OVERWRITE: "cache:backup-before-overwrite",
  },
} as const;

// Flattened for backwards compatibility
export const IPC_CHANNELS_LEGACY = {
  AUTH_LOGIN: "auth:login",
  AUTH_REFRESH: "auth:refresh",
  AUTH_ME: "auth:me",
  AUTH_REQUEST_PASSWORD_RESET: "auth:request-password-reset",
  AUTH_LOGOUT: "auth:logout",
  AUTH_LOAD_SESSION: "auth:load-session",
  AUTH_SAVE_SESSION: "auth:save-session",
  AUTH_CLEAR_SESSION: "auth:clear-session",
  FILESYSTEM_READ_TEXT_FILE: "filesystem:read-text-file",
  FILESYSTEM_WRITE_TEXT_FILE: "filesystem:write-text-file",
  APP_GET_INFO: "app:get-info",
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_UNMAXIMIZE: "window:unmaximize",
  WINDOW_TOGGLE_MAXIMIZE: "window:toggle-maximize",
  WINDOW_CLOSE: "window:close",
  WINDOW_GET_STATE: "window:get-state",
  WINDOW_STATE_CHANGED: "window:state-changed",
  UPDATER_CHECK_FOR_UPDATES: "updater:check-for-updates",
  UPDATER_QUIT_AND_INSTALL: "updater:quit-and-install",
  UPDATER_EVENT: "updater:event",
} as const;
