"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  license: {
    GET_FINGERPRINT: "license:get-fingerprint",
    ACTIVATE: "license:activate",
    VALIDATE: "license:validate",
    GET_CURRENT: "license:get-current",
    DEACTIVATE: "license:deactivate",
    GET_STATE: "license:get-state",
    IS_VALID: "license:is-valid",
    CAN_REBIND: "license:can-rebind"
  },
  updater: {
    CHECK_FOR_UPDATES: "updater:check-for-updates",
    QUIT_AND_INSTALL: "updater:quit-and-install",
    EVENT: "updater:event"
  }
};
const IPC_CHANNELS_LEGACY = {
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
  WINDOW_STATE_CHANGED: "window:state-changed"
};
function unwrapIpcResponse(response) {
  if (!response.success) {
    const errorCode = response.error?.code || "UNKNOWN_ERROR";
    const errorMessage = response.error?.message || "An unknown error occurred";
    const error = new Error(errorMessage);
    error.code = errorCode;
    error.details = response.error?.details;
    throw error;
  }
  if (response.data === void 0) {
    throw new Error("IPC response missing data field");
  }
  return response.data;
}
async function invokeIpc(channel, payload) {
  const response = await electron.ipcRenderer.invoke(channel, payload);
  return unwrapIpcResponse(response);
}
const electronAPI = {
  auth: {
    login: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_LOGIN, payload),
    refresh: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_REFRESH, payload),
    me: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_ME),
    requestPasswordReset: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_REQUEST_PASSWORD_RESET, payload),
    logout: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_LOGOUT, payload),
    loadSession: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_LOAD_SESSION),
    saveSession: (payload) => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_SAVE_SESSION, payload),
    clearSession: () => invokeIpc(IPC_CHANNELS_LEGACY.AUTH_CLEAR_SESSION)
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
    canRebind: () => invokeIpc(IPC_CHANNELS.license.CAN_REBIND)
  },
  events: {
    onWindowStateChanged: (handler) => {
      const listener = (_event, state) => {
        handler(state);
      };
      electron.ipcRenderer.on(IPC_CHANNELS_LEGACY.WINDOW_STATE_CHANGED, listener);
      return () => {
        electron.ipcRenderer.removeListener(IPC_CHANNELS_LEGACY.WINDOW_STATE_CHANGED, listener);
      };
    }
  }
};
const updaterListeners = /* @__PURE__ */ new Map();
const electronUpdater = {
  on: (event, listener) => {
    const wrapped = (_event, payload) => {
      if (payload.event === event) {
        listener(payload.data);
      }
    };
    const existing = updaterListeners.get(event) ?? /* @__PURE__ */ new Map();
    existing.set(listener, wrapped);
    updaterListeners.set(event, existing);
    electron.ipcRenderer.on(IPC_CHANNELS.updater.EVENT, wrapped);
  },
  off: (event, listener) => {
    const listeners = updaterListeners.get(event);
    const wrapped = listeners?.get(listener);
    if (!wrapped) {
      return;
    }
    electron.ipcRenderer.removeListener(IPC_CHANNELS.updater.EVENT, wrapped);
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      updaterListeners.delete(event);
    }
  },
  checkForUpdates: async () => {
    await electron.ipcRenderer.invoke(IPC_CHANNELS.updater.CHECK_FOR_UPDATES);
  },
  quitAndInstall: async () => {
    await electron.ipcRenderer.invoke(IPC_CHANNELS.updater.QUIT_AND_INSTALL);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
electron.contextBridge.exposeInMainWorld("electronUpdater", electronUpdater);
