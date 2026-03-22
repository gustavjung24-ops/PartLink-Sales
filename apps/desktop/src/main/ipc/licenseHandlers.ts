/**
 * License IPC Handlers
 * Expose license operations to renderer process via IPC
 * 
 * All handlers use withErrorHandling wrapper for standardized responses
 */

import { ipcMain } from "electron";
import { withErrorHandling } from "./utils";
import { deviceFingerprintService } from "../services/fingerprint";
import { licenseStateManager } from "../services/license";
import { licenseApiService } from "../services/licenseApi";
import type {
  DeviceFingerprint,
  DeviceRebindingStatus,
  LicenseData,
  LicenseValidationResponse,
} from "@sparelink/shared";

export const IPC_LICENSE_CHANNELS = {
  "license:get-fingerprint": "license:get-fingerprint",
  "license:activate": "license:activate",
  "license:validate": "license:validate",
  "license:get-current": "license:get-current",
  "license:deactivate": "license:deactivate",
  "license:get-state": "license:get-state",
  "license:is-valid": "license:is-valid",
  "license:can-rebind": "license:can-rebind",
} as const;

/**
 * Get device fingerprint
 * Returns hashed fingerprint data for license binding
 */
export function registerLicenseHandlers(): void {
  withErrorHandling<void, DeviceFingerprint>(
    IPC_LICENSE_CHANNELS["license:get-fingerprint"],
    async () => {
      const fingerprint = await deviceFingerprintService.getFingerprint();
      return fingerprint;
    }
  );

  /**
   * Activate license with key
   * Sends activation request to server, returns license data
   */
  withErrorHandling<{ licenseKey: string }, LicenseValidationResponse>(
    IPC_LICENSE_CHANNELS["license:activate"],
    async (_event, payload) => {
      if (!payload.licenseKey) {
        throw new Error("License key is required");
      }

      const fingerprint = await deviceFingerprintService.getFingerprint();
      const response = await licenseApiService.activateLicense(payload.licenseKey, fingerprint);

      // Update local state
      licenseStateManager.setLicense(response.licenseData, true);

      return response;
    }
  );

  /**
   * Validate existing license (periodic re-check)
   * Detects clock skew, checks expiration, refreshes nonce
   */
  withErrorHandling<{ licenseKey: string }, LicenseValidationResponse>(
    IPC_LICENSE_CHANNELS["license:validate"],
    async (_event, payload) => {
      if (!payload.licenseKey) {
        throw new Error("License key is required");
      }

      const fingerprint = await deviceFingerprintService.getFingerprint();
      const response = await licenseApiService.validateLicense(payload.licenseKey, fingerprint);

      // Update local state
      licenseStateManager.setLicense(response.licenseData);

      return response;
    }
  );

  /**
   * Get current license data
   */
  withErrorHandling<void, LicenseData | null>(
    IPC_LICENSE_CHANNELS["license:get-current"],
    async () => {
      return licenseStateManager.getCurrentLicense();
    }
  );

  /**
   * Deactivate license for device switch
   * Decrements rebinding counter, prepares for new device
   */
  withErrorHandling<void, void>(
    IPC_LICENSE_CHANNELS["license:deactivate"],
    async () => {
      const current = licenseStateManager.getCurrentLicense();
      if (!current) {
        throw new Error("No license to deactivate");
      }

      // Notify server
      await licenseApiService.deactivateLicense(current.key, current.deviceId);

      // Update local state
      licenseStateManager.deactivateLicense();
    }
  );

  /**
   * Get current license state (e.g., ACTIVE, TRIAL, EXPIRED)
   */
  withErrorHandling<void, string>(
    IPC_LICENSE_CHANNELS["license:get-state"],
    async () => {
      return licenseStateManager.getCurrentState();
    }
  );

  /**
   * Check if license is currently valid (can be used)
   */
  withErrorHandling<void, boolean>(
    IPC_LICENSE_CHANNELS["license:is-valid"],
    async () => {
      return licenseStateManager.isLicenseValid();
    }
  );

  withErrorHandling<void, DeviceRebindingStatus>(
    IPC_LICENSE_CHANNELS["license:can-rebind"],
    async () => {
      return licenseStateManager.canRebindDevice();
    }
  );
}

/**
 * Unregister all license handlers
 */
export function unregisterLicenseHandlers(): void {
  Object.values(IPC_LICENSE_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
