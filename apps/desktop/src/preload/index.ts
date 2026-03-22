import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type ElectronAPI, type WindowState } from "@/shared/electronApi";

const electronAPI: ElectronAPI = {
  auth: {
    login: (payload) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT)
  },
  fileSystem: {
    readTextFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_READ_TEXT_FILE, payload),
    writeTextFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.FILESYSTEM_WRITE_TEXT_FILE, payload)
  },
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO)
  },
  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    unmaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_UNMAXIMIZE),
    toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_STATE)
  },
  events: {
    onWindowStateChanged: (handler: (state: WindowState) => void) => {
      const listener = (_event: unknown, state: WindowState) => {
        handler(state);
      };

      ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);
      };
    }
  }
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
