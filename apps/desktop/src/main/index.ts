import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { IPC_CHANNELS } from "@/shared/electronApi";
import { registerIpcHandlers, unregisterIpcHandlers } from "./ipc/handlers";
import { licenseStateManager } from "./services/license";
import { licenseApiService } from "./services/licenseApi";
import { secureLicenseStore } from "./services/secureLicenseStore";
import { deviceFingerprintService } from "./services/fingerprint";
import { sqliteCacheRecoveryService } from "./services/sqliteCacheRecovery";
import { appUpdater } from "./services/updater";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  return path.join(__dirname, "../preload/index.js");
}

function getRendererEntry(): string {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return process.env.ELECTRON_RENDERER_URL;
  }

  return fileURLToPath(new URL("../renderer/index.html", import.meta.url));
}

function createMainWindow(): BrowserWindow {
  const browserWindow = new BrowserWindow({
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
    browserWindow.webContents.send(IPC_CHANNELS.window.STATE_CHANGED, {
      isMaximized: browserWindow.isMaximized(),
      isMinimized: browserWindow.isMinimized()
    });
  };

  browserWindow.on("maximize", sendWindowState);
  browserWindow.on("unmaximize", sendWindowState);
  browserWindow.on("minimize", sendWindowState);
  browserWindow.on("restore", sendWindowState);

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    browserWindow.loadURL(getRendererEntry());
  } else {
    browserWindow.loadFile(getRendererEntry());
  }

  return browserWindow;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    const sqliteHealth = await sqliteCacheRecoveryService.ensureHealthyCache(async () => {
      console.warn(
        "[SQLite Cache] Local cache was quarantined. A fresh cache must be rebuilt from the server on next sync."
      );
    });

    if (sqliteHealth.status !== "healthy" && sqliteHealth.status !== "missing") {
      console.warn("[SQLite Cache] Startup maintenance result:", sqliteHealth);
    }

    const storedLicense = await secureLicenseStore.loadLicenseData();
    await licenseStateManager.initialize(storedLicense);
    licenseApiService.restoreNonce(storedLicense?.nonce ?? null);

    registerIpcHandlers(process.env.DEBUG_IPC === "true");
    mainWindow = createMainWindow();
    appUpdater.initialize(mainWindow);
    licenseStateManager.startValidationTimer(6 * 60 * 60 * 1000, async () => {
      const current = licenseStateManager.getCurrentLicense();
      if (!current?.key) {
        return;
      }

      const fingerprint = await deviceFingerprintService.getFingerprint();
      const response = await licenseApiService.validateLicense(current.key, fingerprint);
      response.licenseData.nonce = response.nonce;

      licenseStateManager.setLicense(response.licenseData);
      await secureLicenseStore.saveLicenseData(response.licenseData);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
        appUpdater.setMainWindow(mainWindow);
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    licenseStateManager.stopValidationTimer();
    appUpdater.dispose();
    unregisterIpcHandlers();
  });
}
