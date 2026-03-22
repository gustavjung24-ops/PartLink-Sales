"use strict";
const electron = require("electron");
const node_url = require("node:url");
const path = require("node:path");
const promises = require("node:fs/promises");
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
function getSenderWindow(event) {
  const window = electron.BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("Unable to resolve BrowserWindow from IPC sender");
  }
  return window;
}
function registerIpcHandlers(isVerbose) {
  electron.ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, payload) => {
    if (isVerbose) {
      console.info("[ipc] auth:login", payload.username);
    }
    return {
      accessToken: `stub-token-${payload.username}`,
      expiresIn: 3600
    };
  });
  electron.ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => void 0);
  electron.ipcMain.handle(IPC_CHANNELS.FILESYSTEM_READ_TEXT_FILE, async (_event, payload) => {
    return promises.readFile(payload.filePath, payload.encoding ?? "utf-8");
  });
  electron.ipcMain.handle(IPC_CHANNELS.FILESYSTEM_WRITE_TEXT_FILE, async (_event, payload) => {
    await promises.writeFile(payload.filePath, payload.content, payload.encoding ?? "utf-8");
  });
  electron.ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async () => {
    return {
      name: electron.app.getName(),
      version: electron.app.getVersion(),
      platform: process.platform,
      isPackaged: electron.app.isPackaged
    };
  });
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (event) => {
    getSenderWindow(event).minimize();
  });
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async (event) => {
    getSenderWindow(event).maximize();
  });
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_UNMAXIMIZE, async (event) => {
    getSenderWindow(event).unmaximize();
  });
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, async (event) => {
    const window = getSenderWindow(event);
    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }
    window.maximize();
  });
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event) => {
    getSenderWindow(event).close();
  });
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_GET_STATE, async (event) => {
    const window = getSenderWindow(event);
    return {
      isMaximized: window.isMaximized(),
      isMinimized: window.isMinimized()
    };
  });
}
function unregisterIpcHandlers() {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    electron.ipcMain.removeHandler(channel);
  });
}
const __filename$1 = node_url.fileURLToPath(require("url").pathToFileURL(__filename).href);
const __dirname$1 = path.dirname(__filename$1);
let mainWindow = null;
function getPreloadPath() {
  return path.join(__dirname$1, "../preload/index.js");
}
function getRendererEntry() {
  if (!electron.app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return process.env.ELECTRON_RENDERER_URL;
  }
  return node_url.fileURLToPath(new URL("../renderer/index.html", require("url").pathToFileURL(__filename).href));
}
function createMainWindow() {
  const browserWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  browserWindow.once("ready-to-show", () => {
    browserWindow.show();
  });
  const sendWindowState = () => {
    browserWindow.webContents.send(IPC_CHANNELS.WINDOW_STATE_CHANGED, {
      isMaximized: browserWindow.isMaximized(),
      isMinimized: browserWindow.isMinimized()
    });
  };
  browserWindow.on("maximize", sendWindowState);
  browserWindow.on("unmaximize", sendWindowState);
  browserWindow.on("minimize", sendWindowState);
  browserWindow.on("restore", sendWindowState);
  if (!electron.app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    browserWindow.loadURL(getRendererEntry());
  } else {
    browserWindow.loadFile(getRendererEntry());
  }
  return browserWindow;
}
const hasSingleInstanceLock = electron.app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });
  electron.app.whenReady().then(() => {
    registerIpcHandlers(process.env.DEBUG_IPC === "true");
    mainWindow = createMainWindow();
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
  electron.app.on("before-quit", () => {
    unregisterIpcHandlers();
  });
}
