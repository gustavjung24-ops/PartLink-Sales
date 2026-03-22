"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
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
};
const electronAPI = {
  auth: {
    login: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload),
    logout: () => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT)
  },
  fileSystem: {
    readTextFile: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_READ_TEXT_FILE, payload),
    writeTextFile: (payload) => electron.ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_WRITE_TEXT_FILE, payload)
  },
  app: {
    getInfo: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO)
  },
  window: {
    minimize: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    unmaximize: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_UNMAXIMIZE),
    toggleMaximize: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
    close: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    getState: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_STATE)
  },
  events: {
    onWindowStateChanged: (handler) => {
      const listener = (_event, state) => {
        handler(state);
      };
      electron.ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);
      return () => {
        electron.ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);
      };
    }
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
