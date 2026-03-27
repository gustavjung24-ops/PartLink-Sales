"use strict";
const electron = require("electron");
const node_url = require("node:url");
const path = require("node:path");
const promises = require("node:fs/promises");
const crypto = require("crypto");
const os = require("os");
const crypto$1 = require("node:crypto");
const Database = require("better-sqlite3");
const electronUpdater = require("electron-updater");
const nodeMachineId = require("node-machine-id");
const IPC_CHANNELS = {
  auth: {
    LOGIN: "auth:login",
    REFRESH: "auth:refresh",
    ME: "auth:me",
    REQUEST_PASSWORD_RESET: "auth:request-password-reset",
    LOGOUT: "auth:logout",
    LOAD_SESSION: "auth:load-session",
    SAVE_SESSION: "auth:save-session",
    CLEAR_SESSION: "auth:clear-session"
  },
  filesystem: {
    READ_TEXT_FILE: "filesystem:read-text-file",
    WRITE_TEXT_FILE: "filesystem:write-text-file"
  },
  app: {
    GET_INFO: "app:get-info"
  },
  window: {
    MINIMIZE: "window:minimize",
    MAXIMIZE: "window:maximize",
    UNMAXIMIZE: "window:unmaximize",
    TOGGLE_MAXIMIZE: "window:toggle-maximize",
    CLOSE: "window:close",
    GET_STATE: "window:get-state",
    STATE_CHANGED: "window:state-changed"
  },
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
  WINDOW_GET_STATE: "window:get-state"
};
function withErrorHandling(channel, handler) {
  return electron.ipcMain.handle(
    channel,
    async (event, payload) => {
      try {
        if (process.env.DEBUG_IPC) {
          console.log(`[IPC] Incoming: ${channel}`, { payload });
        }
        const result = await Promise.resolve(handler(event, payload));
        const response = {
          success: true,
          data: result,
          timestamp: Date.now()
        };
        if (process.env.DEBUG_IPC) {
          console.log(`[IPC] Success: ${channel}`, { response });
        }
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = error instanceof Error && "code" in error ? error.code : "INTERNAL_ERROR";
        console.error(`[IPC ERROR] ${channel}:`, {
          code: errorCode,
          message: errorMessage,
          stack: error instanceof Error ? error.stack : void 0
        });
        const response = {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
            details: process.env.DEBUG_IPC ? error : void 0
            // Only expose details in debug mode
          },
          timestamp: Date.now()
        };
        return response;
      }
    }
  );
}
function generateFingerprintHash(machineId, osType, osRelease, osArchitecture, hostnameHash) {
  const data = `${machineId}|${osType}|${osRelease}|${osArchitecture}|${hostnameHash}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}
function hashHostname(hostname) {
  return crypto.createHash("sha256").update(hostname).digest("hex");
}
class DeviceFingerprintService {
  fingerprint = null;
  fingerprintFilePath = path.join(electron.app.getPath("userData"), "license", "fingerprint.dat");
  serializeMachineId(machineId) {
    if (electron.safeStorage.isEncryptionAvailable()) {
      return electron.safeStorage.encryptString(machineId);
    }
    console.warn("[Fingerprint Service] safeStorage unavailable — machineId stored in plaintext");
    return Buffer.from(machineId, "utf-8");
  }
  deserializeMachineId(content) {
    return electron.safeStorage.isEncryptionAvailable() ? electron.safeStorage.decryptString(content) : content.toString("utf-8");
  }
  async loadPersistedMachineId() {
    try {
      const content = await promises.readFile(this.fingerprintFilePath);
      const machineId = this.deserializeMachineId(content).trim();
      return machineId.length > 0 ? machineId : null;
    } catch {
      return null;
    }
  }
  async persistMachineId(machineId) {
    const dirPath = path.dirname(this.fingerprintFilePath);
    await promises.mkdir(dirPath, { recursive: true });
    await promises.writeFile(this.fingerprintFilePath, this.serializeMachineId(machineId));
  }
  /**
   * Get or generate device fingerprint
   * Caches result in memory for app lifetime
   */
  async getFingerprint() {
    if (this.fingerprint) {
      return this.fingerprint;
    }
    let machineId = await this.loadPersistedMachineId();
    if (!machineId) {
      machineId = `${os.hostname()}-${crypto.randomBytes(8).toString("hex")}`;
      await this.persistMachineId(machineId);
    }
    const osType = process.platform;
    const osRelease = os.release();
    const osArchitecture = os.arch();
    const osHostname = os.hostname();
    const hostnameHash = hashHostname(osHostname);
    const fingerprint = {
      machineId,
      osType,
      osRelease,
      osArchitecture,
      osHostname,
      hostnameHash,
      fingerprint: generateFingerprintHash(machineId, osType, osRelease, osArchitecture, hostnameHash),
      createdAt: Date.now()
    };
    this.fingerprint = fingerprint;
    if (process.env.DEBUG_LICENSE) {
      console.log("[Fingerprint Service] Generated fingerprint:", {
        machineId,
        osType,
        osArchitecture,
        fingerprint: fingerprint.fingerprint.substring(0, 16) + "..."
      });
    }
    return fingerprint;
  }
  /**
   * Get cached fingerprint or throw if not initialized
   */
  getCachedFingerprint() {
    if (!this.fingerprint) {
      throw new Error("Fingerprint not initialized. Call getFingerprint() first.");
    }
    return this.fingerprint;
  }
  /**
   * Get fingerprint hash only (for sending to server)
   * Never send raw machine ID or hostname to server
   */
  async getFingerprintHash() {
    const fp = await this.getFingerprint();
    return fp.fingerprint;
  }
  /**
   * Validate fingerprint matches current system
   * Returns true if fingerprint hasn't changed (device not cloned, etc.)
   */
  async validateFingerprint(storedFingerprint) {
    const current = await this.getFingerprint();
    if (current.osType !== storedFingerprint.osType || current.osArchitecture !== storedFingerprint.osArchitecture) {
      console.warn("[Fingerprint Service] Platform changed - device may be compromised");
      return false;
    }
    if (current.machineId !== storedFingerprint.machineId) {
      console.warn("[Fingerprint Service] Machine ID changed - different device detected");
      return false;
    }
    return true;
  }
  /**
   * Get human-readable fingerprint summary for UI display
   */
  async getFingerprintSummary() {
    const fp = await this.getFingerprint();
    return `${fp.osType} | ${fp.osArchitecture} | ${fp.fingerprint.substring(0, 12)}...`;
  }
}
const deviceFingerprintService = new DeviceFingerprintService();
var LicenseState;
(function(LicenseState2) {
  LicenseState2["NO_LICENSE"] = "NO_LICENSE";
  LicenseState2["TRIAL"] = "TRIAL";
  LicenseState2["ACTIVE"] = "ACTIVE";
  LicenseState2["EXPIRED"] = "EXPIRED";
  LicenseState2["SUSPENDED"] = "SUSPENDED";
  LicenseState2["DEACTIVATED"] = "DEACTIVATED";
})(LicenseState || (LicenseState = {}));
var PartSourceType;
(function(PartSourceType2) {
  PartSourceType2["COMPANY_AVAILABLE"] = "COMPANY_AVAILABLE";
  PartSourceType2["COMPANY_ORDERABLE"] = "COMPANY_ORDERABLE";
  PartSourceType2["INTERNAL_REPLACEMENT"] = "INTERNAL_REPLACEMENT";
  PartSourceType2["AI_SUGGESTED_EXTERNAL"] = "AI_SUGGESTED_EXTERNAL";
})(PartSourceType || (PartSourceType = {}));
var ResultType;
(function(ResultType2) {
  ResultType2["SUCCESS"] = "success";
  ResultType2["ERROR"] = "error";
  ResultType2["PENDING"] = "pending";
  ResultType2["CACHED"] = "cached";
})(ResultType || (ResultType = {}));
const STATE_TRANSITIONS = {
  [LicenseState.NO_LICENSE]: [LicenseState.TRIAL, LicenseState.ACTIVE],
  [LicenseState.TRIAL]: [LicenseState.ACTIVE, LicenseState.EXPIRED, LicenseState.NO_LICENSE],
  [LicenseState.ACTIVE]: [
    LicenseState.EXPIRED,
    LicenseState.SUSPENDED,
    LicenseState.DEACTIVATED
  ],
  [LicenseState.EXPIRED]: [
    LicenseState.ACTIVE,
    LicenseState.SUSPENDED,
    LicenseState.NO_LICENSE
  ],
  [LicenseState.SUSPENDED]: [
    LicenseState.ACTIVE,
    LicenseState.EXPIRED,
    LicenseState.NO_LICENSE
  ],
  [LicenseState.DEACTIVATED]: [LicenseState.NO_LICENSE]
};
class LicenseStateManager {
  licenseData = null;
  stateChangeListeners = [];
  validationTimer = null;
  /**
   * Initialize license from stored data
   */
  async initialize(licenseData) {
    if (licenseData) {
      this.licenseData = licenseData;
      this.updateStateBasedOnExpiry();
      console.log(`[License Manager] Initialized with state: ${this.licenseData.status}`);
    } else {
      this.licenseData = null;
      console.log("[License Manager] Initialized without license");
    }
  }
  /**
   * Get current license data
   */
  getCurrentLicense() {
    return this.licenseData;
  }
  /**
   * Get current state
   */
  getCurrentState() {
    if (!this.licenseData) {
      return LicenseState.NO_LICENSE;
    }
    return this.licenseData.status;
  }
  /**
   * Check if license is valid (can be used)
   */
  isLicenseValid() {
    if (!this.licenseData) return false;
    const state = this.licenseData.status;
    return state === LicenseState.ACTIVE || state === LicenseState.TRIAL && this.licenseData.expiresAt > Date.now();
  }
  /**
   * Validate and perform state transition
   */
  canTransitionTo(fromState, toState) {
    const validNextStates = STATE_TRANSITIONS[fromState] || [];
    return validNextStates.includes(toState);
  }
  /**
   * Transition to new state with validation
   */
  transitionState(newState, reason) {
    if (!this.licenseData) {
      console.error("[License Manager] Cannot transition: no license data");
      return;
    }
    const currentState = this.licenseData.status;
    if (!this.canTransitionTo(currentState, newState)) {
      throw new Error(
        `Invalid state transition: ${currentState} → ${newState}. Allowed: ${STATE_TRANSITIONS[currentState].join(", ")}`
      );
    }
    const previousState = currentState;
    this.licenseData.status = newState;
    const event = {
      previousState,
      newState,
      reason,
      timestamp: Date.now(),
      licenseData: this.licenseData
    };
    console.log(
      `[License Manager] State transition: ${previousState} → ${newState} (${reason})`
    );
    this.stateChangeListeners.forEach((listener) => listener(event));
  }
  /**
   * Set license from activation or validation response
   */
  setLicense(licenseData, isFirstActivation = false) {
    const previousState = this.getCurrentState();
    this.licenseData = licenseData;
    this.updateStateBasedOnExpiry();
    if (isFirstActivation) {
      const event = {
        previousState,
        newState: this.licenseData.status,
        reason: "Initial activation",
        timestamp: Date.now(),
        licenseData: this.licenseData
      };
      this.stateChangeListeners.forEach((listener) => listener(event));
    }
    console.log(`[License Manager] License set: ${licenseData.productName} (expires: ${new Date(licenseData.expiresAt).toISOString()})`);
  }
  /**
   * Update state based on expiry time
   * Called after loading persisted data or on validation
   */
  updateStateBasedOnExpiry() {
    if (!this.licenseData) return;
    const now = Date.now();
    const state = this.licenseData.status;
    if (state === LicenseState.ACTIVE && now > this.licenseData.expiresAt && (!this.licenseData.graceUntil || now > this.licenseData.graceUntil)) {
      this.transitionState(LicenseState.EXPIRED, "License expiration date passed");
    }
    if (state === LicenseState.EXPIRED && this.licenseData.graceUntil && now <= this.licenseData.graceUntil) {
      console.log(
        `[License Manager] In grace period until ${new Date(this.licenseData.graceUntil).toISOString()}`
      );
    }
  }
  /**
   * Mark license as suspended
   */
  suspendLicense(reason = "Server requested suspension") {
    if (!this.licenseData) return;
    this.transitionState(LicenseState.SUSPENDED, reason);
  }
  /**
   * Deactivate license for device switch
   */
  deactivateLicense() {
    if (!this.licenseData) return;
    this.licenseData.totalResets = (this.licenseData.totalResets || 0) + 1;
    this.licenseData.lastResetDate = Date.now();
    if (this.licenseData.totalResets >= this.licenseData.maxDeviceResets) {
      console.warn(
        `[License Manager] Device rebinding limit reached: ${this.licenseData.totalResets}/${this.licenseData.maxDeviceResets}`
      );
    }
    this.transitionState(LicenseState.DEACTIVATED, "User requested deactivation for device switch");
  }
  /**
   * Clear license (remove from this device)
   */
  clearLicense() {
    this.licenseData = null;
    console.log("[License Manager] License cleared");
  }
  /**
   * Get remaining trial days
   */
  getRemainingTrialDays() {
    if (!this.licenseData || this.licenseData.status !== LicenseState.TRIAL) {
      return 0;
    }
    const now = Date.now();
    const expiresAt = this.licenseData.expiresAt;
    const daysRemaining = Math.max(0, Math.floor((expiresAt - now) / (1e3 * 60 * 60 * 24)));
    return daysRemaining;
  }
  /**
   * Register listener for state changes
   */
  onStateChange(listener) {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }
  /**
   * Start periodic validation timer
   */
  startValidationTimer(intervalMs = 6 * 60 * 60 * 1e3, runServerValidation) {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }
    this.validationTimer = setInterval(() => {
      this.updateStateBasedOnExpiry();
      console.log(`[License Manager] Periodic validation check: ${this.getCurrentState()}`);
      if (runServerValidation) {
        void runServerValidation().catch((error) => {
          console.warn("[License Manager] Periodic server validation failed:", error);
        });
      }
    }, intervalMs);
    console.log(`[License Manager] Validation timer started (interval: ${intervalMs}ms)`);
  }
  /**
   * Stop validation timer
   */
  stopValidationTimer() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
      console.log("[License Manager] Validation timer stopped");
    }
  }
  /**
   * Get device rebinding info
   */
  getDeviceRebindingInfo() {
    if (!this.licenseData) return null;
    return {
      current: this.licenseData.totalResets || 0,
      max: this.licenseData.maxDeviceResets,
      remaining: Math.max(0, this.licenseData.maxDeviceResets - (this.licenseData.totalResets || 0))
    };
  }
  canRebindDevice() {
    const info = this.getDeviceRebindingInfo();
    if (!info) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        remaining: 0
      };
    }
    return {
      allowed: info.remaining > 0,
      current: info.current,
      max: info.max,
      remaining: info.remaining
    };
  }
}
const licenseStateManager = new LicenseStateManager();
class LicenseApiService {
  apiBaseUrl;
  lastValidation = null;
  clockSkewThresholdMs = 5 * 60 * 1e3;
  // 5 minutes
  clockRollbackToleranceMs = 2 * 60 * 1e3;
  // 2 minutes
  nonceRequiredAfterMs = Date.UTC(2026, 2, 24, 0, 0, 0);
  // 2026-03-24T00:00:00Z
  lastServerNonce = null;
  constructor(apiBaseUrl = "http://localhost:3000") {
    this.apiBaseUrl = apiBaseUrl;
  }
  restoreNonce(nonce) {
    this.lastServerNonce = nonce ?? null;
  }
  /**
   * Activate license on this device
   */
  async activateLicense(licenseKey, fingerprint) {
    if (!licenseKey || !fingerprint) {
      throw new Error("License key and fingerprint required");
    }
    const payload = {
      key: licenseKey,
      deviceFingerprint: fingerprint,
      clientTime: Date.now()
    };
    try {
      console.log("[License API] Activating license...");
      const response = await fetch(`${this.apiBaseUrl}/api/licenses/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Activation failed: ${response.statusText}`);
      }
      const raw = await response.json();
      const data = "data" in raw ? raw.data : raw;
      if (!data || !data.licenseData) {
        throw new Error("Activation response malformed");
      }
      this.lastValidation = {
        response: data,
        cachedAt: Date.now()
      };
      this.lastServerNonce = data.nonce;
      data.licenseData.nonce = data.nonce;
      console.log(
        `[License API] Activation successful: ${data.licenseData.productName} (expires: ${new Date(data.licenseData.expiresAt).toISOString()})`
      );
      return data;
    } catch (error) {
      console.error("[License API] Activation failed:", error);
      throw error;
    }
  }
  /**
   * Validate license periodically (background task)
   * Task 3.5: Anti-clock-skew validation
   */
  async validateLicense(licenseKey, fingerprint) {
    const clientTime = Date.now();
    const payload = {
      key: licenseKey,
      deviceFingerprint: fingerprint,
      lastNonce: this.lastServerNonce || "",
      clientTime
    };
    try {
      console.log("[License API] Validating license...");
      const response = await fetch(`${this.apiBaseUrl}/api/licenses/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Validation failed: ${response.statusText}`);
      }
      const raw = await response.json();
      const data = "data" in raw ? raw.data : raw;
      if (!data || !data.licenseData) {
        throw new Error("Validation response malformed");
      }
      const skewResult = this.detectClockSkew(clientTime, data.serverTime);
      if (skewResult.severity === "CRITICAL") {
        console.error("[License API] Clock skew CRITICAL - forcing re-auth:", skewResult);
        throw new Error("System clock appears to be manipulated. License re-authentication required.");
      } else if (skewResult.severity === "WARNING") {
        console.warn("[License API] Clock skew detected:", skewResult);
      }
      if (data.status === LicenseState.SUSPENDED) {
        console.warn("[License API] License suspended by server");
      } else if (data.status === LicenseState.EXPIRED) {
        console.log("[License API] License expired", {
          graceExpiresAt: data.graceExpiresAt ? new Date(data.graceExpiresAt).toISOString() : "No grace period"
        });
      }
      this.lastValidation = {
        response: data,
        cachedAt: Date.now()
      };
      this.lastServerNonce = data.nonce;
      data.licenseData.nonce = data.nonce;
      console.log(`[License API] Validation successful: ${data.status}`);
      return data;
    } catch (error) {
      console.error("[License API] Validation failed:", error);
      if (this.lastValidation && this.isGraceValid(this.lastValidation.response)) {
        const cacheAge = Date.now() - this.lastValidation.cachedAt;
        console.log(
          `[License API] Returning cached validation (age: ${(cacheAge / 1e3 / 60).toFixed(1)} minutes)`
        );
        return this.lastValidation.response;
      }
      if (this.lastValidation) {
        throw new Error("Offline grace invalid due to system clock rollback. Online re-validation required.");
      }
      throw error;
    }
  }
  /**
   * Anti-clock-rollback guard for offline grace usage.
   * If client time is earlier than server-issued nonce time (minus tolerance),
   * treat as potential time manipulation and invalidate cached grace.
   */
  isGraceValid(validation) {
    const clientNow = Date.now();
    const nonceIssuedAt = validation.nonceIssuedAt ?? validation.licenseData.nonceIssuedAt;
    if (!nonceIssuedAt) {
      if (Date.now() >= this.nonceRequiredAfterMs) {
        console.error("[License API] nonceIssuedAt missing after migration cutoff; rejecting cached token.");
        return false;
      }
      console.warn("[License API] nonceIssuedAt missing in cached token; temporary compatibility mode active.");
      return true;
    }
    if (clientNow < nonceIssuedAt - this.clockRollbackToleranceMs) {
      console.error("[License API] Clock rollback detected in offline mode", {
        clientNow,
        nonceIssuedAt
      });
      return false;
    }
    return clientNow < validation.licenseData.expiresAt;
  }
  /**
   * Task 3.5: Detect clock skew between client and server
   */
  detectClockSkew(clientTime, serverTime) {
    const skewMs = clientTime - serverTime;
    const absoluteSkew = Math.abs(skewMs);
    let severity;
    if (absoluteSkew < 60 * 1e3) {
      severity = "NONE";
    } else if (absoluteSkew < 5 * 60 * 1e3) {
      severity = "WARNING";
    } else {
      severity = "CRITICAL";
    }
    if (process.env.DEBUG_LICENSE) {
      console.log("[License API] Clock skew check:", { skewMs, severity });
    }
    return {
      isSkewed: severity !== "NONE",
      skewMs,
      severity
    };
  }
  /**
   * Deactivate license for device switch
   */
  async deactivateLicense(licenseKey, deviceId) {
    const payload = {
      key: licenseKey,
      deviceId,
      reason: "DEVICE_SWITCH"
    };
    try {
      console.log("[License API] Deactivating license for device switch...");
      const response = await fetch(`${this.apiBaseUrl}/api/licenses/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Deactivation failed: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("[License API] Deactivation successful:", data.message);
      this.lastValidation = null;
      this.lastServerNonce = null;
    } catch (error) {
      console.error("[License API] Deactivation failed:", error);
      throw error;
    }
  }
  /**
   * Get last valid response (for UI display during offline)
   */
  getLastValidation() {
    return this.lastValidation?.response || null;
  }
  /**
   * Check if cached response is still within grace period
   */
  isCacheValid(gracePeriodMs = 24 * 60 * 60 * 1e3) {
    if (!this.lastValidation) return false;
    if (!this.isGraceValid(this.lastValidation.response)) {
      return false;
    }
    const cacheAge = Date.now() - this.lastValidation.cachedAt;
    return cacheAge < gracePeriodMs;
  }
  /**
   * Offline mode: returns cached validation if available
   */
  async getOfflineLicense() {
    if (this.lastValidation && this.isGraceValid(this.lastValidation.response)) {
      return this.lastValidation.response;
    }
    throw new Error("No valid cached license data available. Must validate online first.");
  }
}
const licenseApiService = new LicenseApiService();
class SecureLicenseStore {
  licenseFilePath = path.join(electron.app.getPath("userData"), "license", "license.dat");
  serialize(payload) {
    const content = JSON.stringify(payload);
    if (electron.safeStorage.isEncryptionAvailable()) {
      return electron.safeStorage.encryptString(content);
    }
    console.warn("[SecureLicenseStore] safeStorage unavailable — license stored in plaintext");
    return Buffer.from(content, "utf-8");
  }
  deserialize(content) {
    const raw = electron.safeStorage.isEncryptionAvailable() ? electron.safeStorage.decryptString(content) : content.toString("utf-8");
    return JSON.parse(raw);
  }
  async saveLicenseData(licenseData) {
    const dirPath = path.dirname(this.licenseFilePath);
    await promises.mkdir(dirPath, { recursive: true });
    const payload = {
      licenseData,
      savedAt: Date.now()
    };
    const encrypted = this.serialize(payload);
    await promises.writeFile(this.licenseFilePath, encrypted);
  }
  async loadStoredPayload() {
    try {
      const content = await promises.readFile(this.licenseFilePath);
      return this.deserialize(content);
    } catch {
      return null;
    }
  }
  async loadLicenseData() {
    const payload = await this.loadStoredPayload();
    return payload?.licenseData ?? null;
  }
  async clearLicenseData() {
    await promises.rm(this.licenseFilePath, { force: true });
  }
}
const secureLicenseStore = new SecureLicenseStore();
const IPC_LICENSE_CHANNELS = {
  "license:get-fingerprint": "license:get-fingerprint",
  "license:activate": "license:activate",
  "license:validate": "license:validate",
  "license:get-current": "license:get-current",
  "license:deactivate": "license:deactivate",
  "license:get-state": "license:get-state",
  "license:is-valid": "license:is-valid",
  "license:can-rebind": "license:can-rebind"
};
function registerLicenseHandlers() {
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:get-fingerprint"],
    async () => {
      const fingerprint = await deviceFingerprintService.getFingerprint();
      return fingerprint;
    }
  );
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:activate"],
    async (_event, payload) => {
      if (!payload.licenseKey) {
        throw new Error("License key is required");
      }
      const fingerprint = await deviceFingerprintService.getFingerprint();
      const response = await licenseApiService.activateLicense(payload.licenseKey, fingerprint);
      response.licenseData.nonce = response.nonce;
      licenseStateManager.setLicense(response.licenseData, true);
      await secureLicenseStore.saveLicenseData(response.licenseData);
      return response;
    }
  );
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:validate"],
    async (_event, payload) => {
      if (!payload.licenseKey) {
        throw new Error("License key is required");
      }
      const fingerprint = await deviceFingerprintService.getFingerprint();
      const response = await licenseApiService.validateLicense(payload.licenseKey, fingerprint);
      response.licenseData.nonce = response.nonce;
      licenseStateManager.setLicense(response.licenseData);
      await secureLicenseStore.saveLicenseData(response.licenseData);
      return response;
    }
  );
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:get-current"],
    async () => {
      return licenseStateManager.getCurrentLicense();
    }
  );
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:deactivate"],
    async () => {
      const current = licenseStateManager.getCurrentLicense();
      if (!current) {
        throw new Error("No license to deactivate");
      }
      await licenseApiService.deactivateLicense(current.key, current.deviceId);
      licenseStateManager.deactivateLicense();
      const updatedLicense = licenseStateManager.getCurrentLicense();
      if (updatedLicense) {
        await secureLicenseStore.saveLicenseData(updatedLicense);
      }
    }
  );
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:get-state"],
    async () => {
      return licenseStateManager.getCurrentState();
    }
  );
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:is-valid"],
    async () => {
      return licenseStateManager.isLicenseValid();
    }
  );
  withErrorHandling(
    IPC_LICENSE_CHANNELS["license:can-rebind"],
    async () => {
      return licenseStateManager.canRebindDevice();
    }
  );
}
function unregisterLicenseHandlers() {
  Object.values(IPC_LICENSE_CHANNELS).forEach((channel) => {
    electron.ipcMain.removeHandler(channel);
  });
}
class SecureSessionStore {
  sessionFilePath = path.join(electron.app.getPath("userData"), "auth", "session.dat");
  serialize(payload) {
    const content = JSON.stringify(payload);
    if (electron.safeStorage.isEncryptionAvailable()) {
      return electron.safeStorage.encryptString(content);
    }
    console.warn("[SecureSessionStore] safeStorage unavailable — session stored in plaintext");
    return Buffer.from(content, "utf-8");
  }
  deserialize(content) {
    const raw = electron.safeStorage.isEncryptionAvailable() ? electron.safeStorage.decryptString(content) : content.toString("utf-8");
    return JSON.parse(raw);
  }
  async saveSession(session, refreshTokenExpiry) {
    const dirPath = path.dirname(this.sessionFilePath);
    await promises.mkdir(dirPath, { recursive: true });
    const payload = {
      session,
      refreshTokenExpiry,
      savedAt: Date.now()
    };
    const encrypted = this.serialize(payload);
    await promises.writeFile(this.sessionFilePath, encrypted);
  }
  /** Returns the full stored payload, including refreshTokenExpiry. */
  async loadStoredPayload() {
    try {
      const content = await promises.readFile(this.sessionFilePath);
      return this.deserialize(content);
    } catch {
      return null;
    }
  }
  async loadSession() {
    const payload = await this.loadStoredPayload();
    return payload?.session ?? null;
  }
  async clearSession() {
    await promises.rm(this.sessionFilePath, { force: true });
  }
}
const secureSessionStore = new SecureSessionStore();
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1e3;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
const USERS = [
  {
    id: "u_sales_01",
    name: "Nguyen Van User",
    email: "user@sparelink.local",
    password: "Password@123",
    roles: ["USER"]
  },
  {
    id: "u_senior_01",
    name: "Tran Thu Senior",
    email: "senior@sparelink.local",
    password: "Password@123",
    roles: ["SENIOR_SALES"]
  },
  {
    id: "u_admin_01",
    name: "Le Minh Admin",
    email: "admin@sparelink.local",
    password: "Password@123",
    roles: ["ADMIN"]
  },
  {
    id: "u_super_01",
    name: "Pham Thanh Super",
    email: "super@sparelink.local",
    password: "Password@123",
    roles: ["SUPER_ADMIN"]
  }
];
class AuthService {
  refreshTokens = /* @__PURE__ */ new Map();
  toAuthUser(record) {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      roles: record.roles
    };
  }
  findById(id) {
    const user = USERS.find((item) => item.id === id);
    if (!user) {
      throw new Error("Tài khoản không tồn tại");
    }
    return user;
  }
  /**
   * NOTE: Access token format is a non-cryptographic opaque string for the
   * desktop IPC layer only — NOT a JWT and NOT compatible with the REST API.
   * Replace with proper JWT before integrating with the API backend.
   */
  issueAccessToken(user) {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL_MS;
    const tokenPayload = `${user.id}.${expiresAt}.${crypto$1.randomBytes(16).toString("hex")}`;
    return {
      accessToken: tokenPayload,
      expiresAt,
      expiresIn: Math.floor((expiresAt - issuedAt) / 1e3)
    };
  }
  issueRefreshToken(user) {
    const token = `${user.id}.rf.${crypto$1.randomBytes(20).toString("hex")}`;
    this.refreshTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
      revoked: false
    });
    return token;
  }
  /** Returns the expiry (Unix ms) of a refresh token, or null if not registered/expired. */
  getRefreshTokenExpiry(refreshToken) {
    return this.refreshTokens.get(refreshToken)?.expiresAt ?? null;
  }
  async login(payload) {
    const email = payload.email.trim().toLowerCase();
    const user = USERS.find((item) => item.email.toLowerCase() === email);
    if (!user || user.password !== payload.password) {
      throw new Error("Email hoặc mật khẩu không đúng");
    }
    const refreshToken = this.issueRefreshToken(user);
    const access = this.issueAccessToken(user);
    const now = Date.now();
    return {
      user: this.toAuthUser(user),
      refreshToken,
      issuedAt: now,
      ...access
    };
  }
  async refresh(refreshToken) {
    let tokenState = this.refreshTokens.get(refreshToken);
    if (!tokenState) {
      const stored = await secureSessionStore.loadStoredPayload();
      if (stored?.session.refreshToken === refreshToken) {
        const expiry = stored.refreshTokenExpiry ?? 0;
        if (Date.now() < expiry) {
          const userId = refreshToken.split(".rf.")[0];
          tokenState = { userId, expiresAt: expiry, revoked: false };
          this.refreshTokens.set(refreshToken, tokenState);
        }
      }
    }
    if (!tokenState || tokenState.revoked) {
      throw new Error("Phiên làm việc không hợp lệ");
    }
    if (Date.now() >= tokenState.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
    }
    const user = this.findById(tokenState.userId);
    return this.issueAccessToken(user);
  }
  async me(accessToken) {
    const userId = accessToken.split(".")[0];
    if (!userId) {
      return null;
    }
    try {
      const user = this.findById(userId);
      return this.toAuthUser(user);
    } catch {
      return null;
    }
  }
  async logout(refreshToken) {
    if (!refreshToken) {
      return;
    }
    const existing = this.refreshTokens.get(refreshToken);
    if (existing) {
      this.refreshTokens.set(refreshToken, {
        ...existing,
        revoked: true
      });
    }
  }
  async requestPasswordReset(email) {
    const normalized = email.trim().toLowerCase();
    const exists = USERS.some((item) => item.email.toLowerCase() === normalized);
    if (!exists) {
      return {
        sent: true,
        message: "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu sẽ được gửi trong vài phút."
      };
    }
    return {
      sent: true,
      message: "Đã gửi hướng dẫn đặt lại mật khẩu tới email của bạn."
    };
  }
}
const authService = new AuthService();
function getSenderWindow(event) {
  const window = electron.BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("Unable to resolve BrowserWindow from IPC sender");
  }
  return window;
}
function registerIpcHandlers(isVerbose) {
  registerLicenseHandlers();
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_LOGIN,
    async (_event, payload) => {
      if (isVerbose) {
        console.info("[ipc] auth:login", payload.email);
      }
      return authService.login(payload);
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_REFRESH,
    async (_event, payload) => {
      if (!payload.refreshToken) {
        throw new Error("Thiếu refresh token");
      }
      return authService.refresh(payload.refreshToken);
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_ME,
    async () => {
      const session = await secureSessionStore.loadSession();
      if (!session?.accessToken) {
        return null;
      }
      return authService.me(session.accessToken);
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_REQUEST_PASSWORD_RESET,
    async (_event, payload) => {
      return authService.requestPasswordReset(payload.email);
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_LOGOUT,
    async (_event, payload) => {
      await authService.logout(payload?.refreshToken);
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_LOAD_SESSION,
    async () => secureSessionStore.loadSession()
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_SAVE_SESSION,
    async (_event, payload) => {
      const refreshTokenExpiry = authService.getRefreshTokenExpiry(payload.refreshToken) ?? Date.now() + 7 * 24 * 60 * 60 * 1e3;
      await secureSessionStore.saveSession(payload, refreshTokenExpiry);
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.AUTH_CLEAR_SESSION,
    async () => {
      await secureSessionStore.clearSession();
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.FILESYSTEM_READ_TEXT_FILE,
    async (_event, payload) => {
      return promises.readFile(payload.filePath, { encoding: payload.encoding ?? "utf-8" });
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.FILESYSTEM_WRITE_TEXT_FILE,
    async (_event, payload) => {
      await promises.writeFile(payload.filePath, payload.content, payload.encoding ?? "utf-8");
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.APP_GET_INFO,
    async () => ({
      name: electron.app.getName(),
      version: electron.app.getVersion(),
      platform: process.platform,
      isPackaged: electron.app.isPackaged
    })
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.WINDOW_MINIMIZE,
    async (event) => {
      getSenderWindow(event).minimize();
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.WINDOW_MAXIMIZE,
    async (event) => {
      getSenderWindow(event).maximize();
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.WINDOW_UNMAXIMIZE,
    async (event) => {
      getSenderWindow(event).unmaximize();
    }
  );
  withErrorHandling(
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
  withErrorHandling(
    IPC_CHANNELS_LEGACY.WINDOW_CLOSE,
    async (event) => {
      getSenderWindow(event).close();
    }
  );
  withErrorHandling(
    IPC_CHANNELS_LEGACY.WINDOW_GET_STATE,
    async (event) => {
      const window = getSenderWindow(event);
      return {
        isMaximized: window.isMaximized(),
        isMinimized: window.isMinimized()
      };
    }
  );
}
function unregisterIpcHandlers() {
  unregisterLicenseHandlers();
  const allChannels = Object.values(IPC_CHANNELS).flatMap(
    (group) => typeof group === "object" ? Object.values(group) : group
  );
  allChannels.forEach((channel) => {
    if (typeof channel === "string") {
      electron.ipcMain.removeHandler(channel);
    }
  });
}
class SqliteCacheRecoveryService {
  databasePath = process.env.SPARELINK_SQLITE_CACHE_PATH ?? path.join(electron.app.getPath("userData"), "cache", "offline-cache.sqlite");
  backupDir = path.join(electron.app.getPath("userData"), "cache", "backups");
  quarantineDir = path.join(electron.app.getPath("userData"), "cache", "corrupt");
  getDatabasePath() {
    return this.databasePath;
  }
  async ensureHealthyCache(rebuildFromServer) {
    const exists = await this.fileExists(this.databasePath);
    if (!exists) {
      return {
        status: "missing",
        databasePath: this.databasePath,
        detail: "No local SQLite cache found."
      };
    }
    let database = null;
    try {
      database = new Database(this.databasePath, {
        readonly: true,
        fileMustExist: true
      });
      const integrity = database.prepare("PRAGMA integrity_check(1)").pluck().get();
      if (integrity !== "ok") {
        throw new Error(`PRAGMA integrity_check returned: ${integrity}`);
      }
      return {
        status: "healthy",
        databasePath: this.databasePath
      };
    } catch (error) {
      database?.close();
      database = null;
      const backupPath = await this.quarantineDatabase("startup-integrity-failed");
      await promises.rm(this.databasePath, { force: true });
      if (rebuildFromServer) {
        await rebuildFromServer();
        return {
          status: "recovered",
          databasePath: this.databasePath,
          backupPath: backupPath ?? void 0,
          detail: error instanceof Error ? error.message : "SQLite cache recovery triggered."
        };
      }
      return {
        status: "rebuild-required",
        databasePath: this.databasePath,
        backupPath: backupPath ?? void 0,
        detail: error instanceof Error ? error.message : "SQLite cache requires rebuild."
      };
    } finally {
      database?.close();
    }
  }
  async backupBeforeOverwrite(reason = "sync-overwrite") {
    const exists = await this.fileExists(this.databasePath);
    if (!exists) {
      return null;
    }
    await promises.mkdir(this.backupDir, { recursive: true });
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, "-");
    const targetPath = path.join(this.backupDir, `offline-cache-${safeReason}-${timestamp}.sqlite`);
    await promises.copyFile(this.databasePath, targetPath);
    return targetPath;
  }
  async quarantineDatabase(reason) {
    const exists = await this.fileExists(this.databasePath);
    if (!exists) {
      return null;
    }
    await promises.mkdir(this.quarantineDir, { recursive: true });
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const targetPath = path.join(this.quarantineDir, `offline-cache-${reason}-${timestamp}.sqlite`);
    await promises.copyFile(this.databasePath, targetPath);
    return targetPath;
  }
  async fileExists(filePath) {
    try {
      await promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
const sqliteCacheRecoveryService = new SqliteCacheRecoveryService();
const DEFAULT_ROLLOUT_PERCENTAGE = 100;
function clampPercentage(value) {
  if (Number.isNaN(value)) {
    return DEFAULT_ROLLOUT_PERCENTAGE;
  }
  return Math.min(100, Math.max(0, value));
}
function getRolloutBucket() {
  const machineId = nodeMachineId.machineIdSync(true);
  const hash = crypto$1.createHash("sha256").update(machineId).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 100;
}
class AppUpdaterService {
  mainWindow = null;
  initialized = false;
  rolloutPercentage = clampPercentage(
    Number(process.env.SPARELINK_UPDATE_ROLLOUT_PERCENTAGE ?? DEFAULT_ROLLOUT_PERCENTAGE)
  );
  setMainWindow(window) {
    this.mainWindow = window;
  }
  initialize(window) {
    if (this.initialized) {
      this.setMainWindow(window);
      return;
    }
    this.setMainWindow(window);
    this.initialized = true;
    electronUpdater.autoUpdater.autoDownload = process.env.SPARELINK_AUTO_DOWNLOAD !== "false";
    electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
    electronUpdater.autoUpdater.allowPrerelease = process.env.SPARELINK_ALLOW_PRERELEASE === "true";
    if (process.env.SPARELINK_UPDATE_URL) {
      electronUpdater.autoUpdater.setFeedURL({
        provider: "generic",
        url: process.env.SPARELINK_UPDATE_URL,
        channel: process.env.SPARELINK_UPDATE_CHANNEL || "latest"
      });
    }
    electronUpdater.autoUpdater.on("checking-for-update", () => {
      this.emit("checking-for-update");
    });
    electronUpdater.autoUpdater.on("update-available", (info) => {
      this.emit("update-available", info);
    });
    electronUpdater.autoUpdater.on("update-not-available", (info) => {
      this.emit("update-not-available", info);
    });
    electronUpdater.autoUpdater.on("download-progress", (progress) => {
      this.emit("download-progress", progress);
    });
    electronUpdater.autoUpdater.on("update-downloaded", (event) => {
      this.emit("update-downloaded", event);
    });
    electronUpdater.autoUpdater.on("error", (error) => {
      this.emit("error", {
        message: error?.message ?? "Unknown updater error"
      });
    });
    electron.ipcMain.handle(IPC_CHANNELS.updater.CHECK_FOR_UPDATES, async () => {
      await this.checkForUpdates();
    });
    electron.ipcMain.handle(IPC_CHANNELS.updater.QUIT_AND_INSTALL, async () => {
      this.quitAndInstall();
    });
  }
  async checkForUpdates() {
    if (!electron.app.isPackaged) {
      this.emit("update-not-available");
      return;
    }
    if (!this.isEligibleForRollout()) {
      this.emit("update-not-available");
      return;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await electronUpdater.autoUpdater.checkForUpdates();
        return;
      } catch (err) {
        if (attempt === 1) {
          this.emit("error", {
            message: err.message || "Failed to check for updates"
          });
        }
      }
    }
  }
  quitAndInstall() {
    electronUpdater.autoUpdater.quitAndInstall();
  }
  dispose() {
    electron.ipcMain.removeHandler(IPC_CHANNELS.updater.CHECK_FOR_UPDATES);
    electron.ipcMain.removeHandler(IPC_CHANNELS.updater.QUIT_AND_INSTALL);
    electronUpdater.autoUpdater.removeAllListeners();
    this.initialized = false;
  }
  isEligibleForRollout() {
    return getRolloutBucket() < this.rolloutPercentage;
  }
  emit(event, data) {
    const payload = { event, data };
    this.mainWindow?.webContents.send(IPC_CHANNELS.updater.EVENT, payload);
  }
}
const appUpdater = new AppUpdaterService();
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
    browserWindow.webContents.send(IPC_CHANNELS.window.STATE_CHANGED, {
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
  electron.app.whenReady().then(async () => {
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
    licenseStateManager.startValidationTimer(6 * 60 * 60 * 1e3, async () => {
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
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
        appUpdater.setMainWindow(mainWindow);
      }
    });
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
  electron.app.on("before-quit", () => {
    licenseStateManager.stopValidationTimer();
    appUpdater.dispose();
    unregisterIpcHandlers();
  });
}
