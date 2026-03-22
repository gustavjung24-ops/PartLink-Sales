import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type ElectronAPI, type WindowState, type IpcResponse } from "@/shared/electronApi";

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
    login: (payload) => invokeIpc(IPC_CHANNELS.AUTH_LOGIN, payload),
    logout: () => invokeIpc(IPC_CHANNELS.AUTH_LOGOUT)
  },
  fileSystem: {
    readTextFile: (payload) => invokeIpc(IPC_CHANNELS.FILESYSTEM_READ_TEXT_FILE, payload),
    writeTextFile: (payload) => invokeIpc(IPC_CHANNELS.FILESYSTEM_WRITE_TEXT_FILE, payload)
  },
  app: {
    getInfo: () => invokeIpc(IPC_CHANNELS.APP_GET_INFO)
  },
  window: {
    minimize: () => invokeIpc(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => invokeIpc(IPC_CHANNELS.WINDOW_MAXIMIZE),
    unmaximize: () => invokeIpc(IPC_CHANNELS.WINDOW_UNMAXIMIZE),
    toggleMaximize: () => invokeIpc(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
    close: () => invokeIpc(IPC_CHANNELS.WINDOW_CLOSE),
    getState: () => invokeIpc(IPC_CHANNELS.WINDOW_GET_STATE)
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
