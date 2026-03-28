import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS_LEGACY,
  IPC_CHANNELS,
  type ElectronAPI,
  type ElectronUpdaterAPI,
  type UpdaterBridgeEvent,
  type UpdaterEventName,
  type WindowState,
  type IpcResponse,
} from "@/shared/electronApi";

/**
 * Adapter: Converts IpcResponse<T> to T or throws error
 * Platform Layer: Handles standardized IPC response format
 */
function unwrapIpcResponse<T>(response: IpcResponse<T>): T {
  if (!response.success) {
    const errorCode = response.error?.code || "UNKNOWN_ERROR";
    const errorMessage = response.error?.message || "An unknown error occurred";
    const error = new Error(errorMessage) as any;
    error.code = errorCode;
    error.details = response.error?.details;
    throw error;
  }

  if (response.data === undefined) {
    throw new Error("IPC response missing data field");
  }

  return response.data;
}

/**
 * IPC Invoker: Wraps ipcRenderer.invoke with response unwrapping
 */
async function invokeIpc<T>(channel: string, payload?: unknown): Promise<T> {
  const response = await ipcRenderer.invoke(channel, payload);
  return unwrapIpcResponse<T>(response);
}

const electronAPI: ElectronAPI = {
  auth: {
    login: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_LOGIN, payload),
    refresh: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_REFRESH, payload),
    me: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_ME),
    requestPasswordReset: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_REQUEST_PASSWORD_RESET, payload),
    logout: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_LOGOUT, payload),
    loadSession: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_LOAD_SESSION),
    saveSession: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_SAVE_SESSION, payload),
    clearSession: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_CLEAR_SESSION),
    getSetupStatus: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_GET_SETUP_STATUS),
    createInitialAdmin: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_CREATE_INITIAL_ADMIN, payload),
    listUsers: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_LIST_USERS),
    createUser: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_CREATE_USER, payload),
    updateUser: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_UPDATE_USER, payload)
  },
  fileSystem: {
    readTextFile: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.FILESYSTEM_READ_TEXT_FILE, payload),
    writeTextFile: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.FILESYSTEM_WRITE_TEXT_FILE, payload)
  },
  app: {
    getInfo: () => invokeIpc(IPC_CHANNELS_LEGACY.APP_GET_INFO)
  },
  window: {
    minimize: () => invokeIpc(IPC_CHANNELS_LEGACY.WINDOW_MINIMIZE),
    maximize: () => invokeIpc(IPC_CHANNELS_LEGACY.WINDOW_MAXIMIZE),
    unmaximize: () => invokeIpc(IPC_CHANNELS_LEGACY.WINDOW_UNMAXIMIZE),
    toggleMaximize: () => invokeIpc(IPC_CHANNELS_LEGACY.WINDOW_TOGGLE_MAXIMIZE),
    close: () => invokeIpc(IPC_CHANNELS_LEGACY.WINDOW_CLOSE),
    getState: () => invokeIpc(IPC_CHANNELS_LEGACY.WINDOW_GET_STATE)
  },
  license: {
    getFingerprint: () => invokeIpc(IPC_CHANNELS.license.GET_FINGERPRINT),
    activate: (payload) => invokeIpc(IPC_CHANNELS.license.ACTIVATE, payload),
    validate: (payload) => invokeIpc(IPC_CHANNELS.license.VALIDATE, payload),
    getCurrent: () => invokeIpc(IPC_CHANNELS.license.GET_CURRENT),
    deactivate: () => invokeIpc(IPC_CHANNELS.license.DEACTIVATE),
    getState: () => invokeIpc(IPC_CHANNELS.license.GET_STATE),
    isValid: () => invokeIpc(IPC_CHANNELS.license.IS_VALID),
    canRebind: () => invokeIpc(IPC_CHANNELS.license.CAN_REBIND),
  },
  events: {
    onWindowStateChanged: (handler: (state: WindowState) => void) => {
      const listener = (_event: unknown, state: WindowState) => {
        handler(state);
      };

      ipcRenderer.on(IPC_CHANNELS_LEGACY.WINDOW_STATE_CHANGED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS_LEGACY.WINDOW_STATE_CHANGED, listener);
      };
    }
  }
};

const updaterListeners = new Map<UpdaterEventName, Map<(...args: unknown[]) => void, (_event: unknown, payload: UpdaterBridgeEvent) => void>>();

const electronUpdater: ElectronUpdaterAPI = {
  on: (event, listener) => {
    const wrapped = (_event: unknown, payload: UpdaterBridgeEvent) => {
      if (payload.event === event) {
        listener(payload.data);
      }
    };

    const existing = updaterListeners.get(event) ?? new Map();
    existing.set(listener, wrapped);
    updaterListeners.set(event, existing);
    ipcRenderer.on(IPC_CHANNELS.updater.EVENT, wrapped);
  },
  off: (event, listener) => {
    const listeners = updaterListeners.get(event);
    const wrapped = listeners?.get(listener);
    if (!wrapped) {
      return;
    }

    ipcRenderer.removeListener(IPC_CHANNELS.updater.EVENT, wrapped);
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      updaterListeners.delete(event);
    }
  },
  checkForUpdates: async () => {
    await ipcRenderer.invoke(IPC_CHANNELS.updater.CHECK_FOR_UPDATES);
  },
  quitAndInstall: async () => {
    await ipcRenderer.invoke(IPC_CHANNELS.updater.QUIT_AND_INSTALL);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
contextBridge.exposeInMainWorld("electronUpdater", electronUpdater);

contextBridge.exposeInMainWorld("license", {
  check: (k: string) => ipcRenderer.invoke("license:webapp:check", k),
  activate: (k: string, c?: string, p?: string) =>
    ipcRenderer.invoke("license:webapp:activate", {
      licenseKey: k,
      customer: c,
      phone: p,
    }),
});
