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

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthLoginResult {
  accessToken: string;
  expiresIn: number;
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

export interface ElectronAPI {
  auth: {
    login: (payload: AuthLoginPayload) => Promise<AuthLoginResult>;
    logout: () => Promise<void>;
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
  events: {
    onWindowStateChanged: (handler: (state: WindowState) => void) => () => void;
  };
}

export const IPC_CHANNELS = {
  AUTH_LOGIN: "auth:login",
  AUTH_LOGOUT: "auth:logout",
  FILESYSTEM_READ_TEXT_FILE: "filesystem:read-text-file",
  FILESYSTEM_WRITE_TEXT_FILE: "filesystem:write-text-file",
  APP_GET_INFO: "app:get-info",
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_UNMAXIMIZE: "window:unmaximize",
  WINDOW_TOGGLE_MAXIMIZE: "window:toggle-maximize",
  WINDOW_CLOSE: "window:close",
  WINDOW_GET_STATE: "window:get-state",
  WINDOW_STATE_CHANGED: "window:state-changed"
} as const;
