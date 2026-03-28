/**
 * License API Integration Service
 * Handles backend communication for license activation and validation
 *
 * Task 3.4: Server authentication integration
 * - POST /api/licenses/activate (key + fingerprint)
 * - POST /api/licenses/validate (periodic re-check)
 * - Cache last valid response + grace period
 * - Detect clock skew
 */

import type {
  LicenseActivationPayload,
  LicenseValidationPayload,
  LicenseValidationResponse,
  DeviceDeactivationPayload,
  ClockSkewResult,
  DeviceFingerprint,
} from "@sparelink/shared";
import { LicenseState } from "@sparelink/shared";

interface CachedValidation {
  response: LicenseValidationResponse;
  cachedAt: number;
}

export class LicenseApiService {
  private apiBaseUrl: string;
  private lastValidation: CachedValidation | null = null;
  private clockSkewThresholdMs = 5 * 60 * 1000; // 5 minutes
  private clockRollbackToleranceMs = 2 * 60 * 1000; // 2 minutes
  private nonceRequiredAfterMs = Date.UTC(2026, 2, 24, 0, 0, 0); // 2026-03-24T00:00:00Z
  private lastServerNonce: string | null = null;

  constructor(
    apiBaseUrl: string = process.env.VITE_LICENSE_API_URL ||
      process.env.LICENSE_API_URL ||
      "http://localhost:3000"
  ) {
    this.apiBaseUrl = apiBaseUrl;
  }

  restoreNonce(nonce: string | null | undefined): void {
    this.lastServerNonce = nonce ?? null;
  }

  /**
   * Activate license on this device
   */
  async activateLicense(
    licenseKey: string,
    fingerprint: DeviceFingerprint
  ): Promise<LicenseValidationResponse> {
    if (!licenseKey || !fingerprint) {
      throw new Error("License key and fingerprint required");
    }

    const payload: LicenseActivationPayload = {
      key: licenseKey,
      deviceFingerprint: fingerprint,
      clientTime: Date.now(),
    };

    try {
      console.log("[License API] Activating license...");

      const response = await fetch(`${this.apiBaseUrl}/api/licenses/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Activation failed: ${response.statusText}`);
      }

      const raw = (await response.json()) as { data?: LicenseValidationResponse } | LicenseValidationResponse;
      const data = ("data" in raw ? raw.data : raw) as LicenseValidationResponse;

      if (!data || !data.licenseData) {
        throw new Error("Activation response malformed");
      }

      // Cache response
      this.lastValidation = {
        response: data,
        cachedAt: Date.now(),
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
  async validateLicense(
    licenseKey: string,
    fingerprint: DeviceFingerprint
  ): Promise<LicenseValidationResponse> {
    const clientTime = Date.now();

    const payload: LicenseValidationPayload = {
      key: licenseKey,
      deviceFingerprint: fingerprint,
      lastNonce: this.lastServerNonce || "",
      clientTime,
    };

    try {
      console.log("[License API] Validating license...");

      const response = await fetch(`${this.apiBaseUrl}/api/licenses/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Validation failed: ${response.statusText}`);
      }

      const raw = (await response.json()) as { data?: LicenseValidationResponse } | LicenseValidationResponse;
      const data = ("data" in raw ? raw.data : raw) as LicenseValidationResponse;

      if (!data || !data.licenseData) {
        throw new Error("Validation response malformed");
      }

      // Check for clock skew
      const skewResult = this.detectClockSkew(clientTime, data.serverTime);
      if (skewResult.severity === "CRITICAL") {
        console.error("[License API] Clock skew CRITICAL - forcing re-auth:", skewResult);
        // TODO: Emit event to force re-authentication
        throw new Error("System clock appears to be manipulated. License re-authentication required.");
      } else if (skewResult.severity === "WARNING") {
        console.warn("[License API] Clock skew detected:", skewResult);
      }

      // Check status
      if (data.status === LicenseState.SUSPENDED) {
        console.warn("[License API] License suspended by server");
      } else if (data.status === LicenseState.EXPIRED) {
        console.log("[License API] License expired", {
          graceExpiresAt: data.graceExpiresAt
            ? new Date(data.graceExpiresAt).toISOString()
            : "No grace period",
        });
      }

      // Cache response
      this.lastValidation = {
        response: data,
        cachedAt: Date.now(),
      };

      this.lastServerNonce = data.nonce;
      data.licenseData.nonce = data.nonce;

      console.log(`[License API] Validation successful: ${data.status}`);

      return data;
    } catch (error) {
      console.error("[License API] Validation failed:", error);

      // If offline, return cached response only when anti-rollback check passes
      if (this.lastValidation && this.isGraceValid(this.lastValidation.response)) {
        const cacheAge = Date.now() - this.lastValidation.cachedAt;
        console.log(
          `[License API] Returning cached validation (age: ${(cacheAge / 1000 / 60).toFixed(1)} minutes)`
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
  private isGraceValid(validation: LicenseValidationResponse): boolean {
    const clientNow = Date.now();
    const nonceIssuedAt = validation.nonceIssuedAt ?? validation.licenseData.nonceIssuedAt;

    if (!nonceIssuedAt) {
      // Backward compatibility sunset: old tokens are accepted for a short migration window.
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
        nonceIssuedAt,
      });
      return false;
    }

    return clientNow < validation.licenseData.expiresAt;
  }

  /**
   * Task 3.5: Detect clock skew between client and server
   */
  private detectClockSkew(clientTime: number, serverTime: number): ClockSkewResult {
    const skewMs = clientTime - serverTime;
    const absoluteSkew = Math.abs(skewMs);

    let severity: "NONE" | "WARNING" | "CRITICAL";

    if (absoluteSkew < 60 * 1000) {
      // < 1 minute
      severity = "NONE";
    } else if (absoluteSkew < 5 * 60 * 1000) {
      // < 5 minutes
      severity = "WARNING";
    } else {
      severity = "CRITICAL"; // > 5 minutes = possible clock tampering
    }

    if (process.env.DEBUG_LICENSE) {
      console.log("[License API] Clock skew check:", { skewMs, severity });
    }

    return {
      isSkewed: severity !== "NONE",
      skewMs,
      severity,
    };
  }

  /**
   * Deactivate license for device switch
   */
  async deactivateLicense(licenseKey: string, deviceId: string): Promise<void> {
    const payload: DeviceDeactivationPayload = {
      key: licenseKey,
      deviceId,
      reason: "DEVICE_SWITCH",
    };

    try {
      console.log("[License API] Deactivating license for device switch...");

      const response = await fetch(`${this.apiBaseUrl}/api/licenses/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Deactivation failed: ${response.statusText}`);
      }

      const data = await response.json();

      console.log("[License API] Deactivation successful:", data.message);

      // Clear cached validation
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
  getLastValidation(): LicenseValidationResponse | null {
    return this.lastValidation?.response || null;
  }

  /**
   * Check if cached response is still within grace period
   */
  isCacheValid(gracePeriodMs: number = 24 * 60 * 60 * 1000): boolean {
    // 24 hours default
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
  async getOfflineLicense(): Promise<LicenseValidationResponse> {
    if (this.lastValidation && this.isGraceValid(this.lastValidation.response)) {
      return this.lastValidation.response;
    }
    throw new Error("No valid cached license data available. Must validate online first.");
  }
}

export const licenseApiService = new LicenseApiService();
