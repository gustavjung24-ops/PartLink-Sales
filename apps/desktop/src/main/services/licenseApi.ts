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

type WebAppStatus = "OK" | "ACTIVE" | "BOUND_OTHER" | "EXPIRED" | "SUSPENDED" | "INVALID";

interface WebAppLicenseResponse {
  ok?: boolean;
  success?: boolean;
  status?: string;
  message?: string;
  expiresAt?: string | number;
  expiryAt?: string | number;
  activatedAt?: string | number;
  remainingDays?: number;
}

export class LicenseApiService {
  private apiBaseUrl: string;
  private webAppUrl: string | null;
  private webAppApiKey: string | null;
  private webAppAppName: string;
  private lastValidation: CachedValidation | null = null;
  private clockSkewThresholdMs = 5 * 60 * 1000; // 5 minutes
  private clockRollbackToleranceMs = 2 * 60 * 1000; // 2 minutes
  private nonceRequiredAfterMs = Date.UTC(2026, 2, 24, 0, 0, 0); // 2026-03-24T00:00:00Z
  private lastServerNonce: string | null = null;

  constructor(apiBaseUrl: string = "http://localhost:3000") {
    this.apiBaseUrl = apiBaseUrl;
    const configuredWebAppUrl = process.env.LICENSE_WEBAPP_URL?.trim();
    this.webAppUrl = configuredWebAppUrl ? configuredWebAppUrl : null;
    this.webAppApiKey = process.env.LICENSE_API_KEY?.trim() || null;
    this.webAppAppName = process.env.LICENSE_APP_NAME?.trim() || "Partling-sale";
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

    if (this.webAppUrl) {
      return this.activateViaWebApp(licenseKey, fingerprint);
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
    if (this.webAppUrl) {
      return this.validateViaWebApp(licenseKey, fingerprint);
    }

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
    if (this.webAppUrl) {
      // Google Apps Script SOP currently supports activate/check only.
      // For now, clear local cache and require admin-side rebind in Sheet.
      this.lastValidation = null;
      this.lastServerNonce = null;
      console.warn("[License API] Deactivate via WebApp is not implemented. Use admin rebind process.", {
        licenseKey,
        deviceId,
      });
      return;
    }

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

  private async activateViaWebApp(
    licenseKey: string,
    fingerprint: DeviceFingerprint
  ): Promise<LicenseValidationResponse> {
    const data = await this.callWebApp("activate", licenseKey, fingerprint);
    const normalized = this.normalizeWebAppStatus(data.status);
    const mapped = this.mapWebAppResponse(normalized, data, licenseKey, fingerprint, "Kich hoat thanh cong");

    if (!mapped.success || mapped.status === LicenseState.EXPIRED || mapped.status === LicenseState.SUSPENDED) {
      throw new Error(mapped.message || "Kich hoat that bai");
    }

    this.lastValidation = {
      response: mapped,
      cachedAt: Date.now(),
    };
    this.lastServerNonce = mapped.nonce;

    return mapped;
  }

  private async validateViaWebApp(
    licenseKey: string,
    fingerprint: DeviceFingerprint
  ): Promise<LicenseValidationResponse> {
    try {
      const data = await this.callWebApp("check", licenseKey, fingerprint);
      const normalized = this.normalizeWebAppStatus(data.status);
      const mapped = this.mapWebAppResponse(normalized, data, licenseKey, fingerprint, "Kiem tra ban quyen thanh cong");

      if (!mapped.success) {
        throw new Error(mapped.message || "Kiem tra ban quyen that bai");
      }

      this.lastValidation = {
        response: mapped,
        cachedAt: Date.now(),
      };
      this.lastServerNonce = mapped.nonce;

      return mapped;
    } catch (error) {
      if (this.lastValidation && this.isGraceValid(this.lastValidation.response)) {
        return this.lastValidation.response;
      }

      throw error;
    }
  }

  private async callWebApp(
    action: "activate" | "check",
    licenseKey: string,
    fingerprint: DeviceFingerprint
  ): Promise<WebAppLicenseResponse> {
    if (!this.webAppUrl) {
      throw new Error("LICENSE_WEBAPP_URL is not configured");
    }

    const endpoint = `${this.webAppUrl}${this.webAppUrl.includes("?") ? "&" : "?"}action=${action}`;
    const payload: Record<string, unknown> = {
      apiKey: this.webAppApiKey,
      activationCode: licenseKey,
      key: licenseKey,
      machineId: fingerprint.machineId,
      deviceId: fingerprint.machineId,
      appName: this.webAppAppName,
      softwareName: this.webAppAppName,
      clientTime: Date.now(),
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = (await response.json().catch(() => ({}))) as WebAppLicenseResponse;
    if (!response.ok) {
      throw new Error(raw.message || "License WebApp request failed");
    }

    return raw;
  }

  private normalizeWebAppStatus(status?: string): WebAppStatus {
    const normalized = (status || "INVALID").trim().toUpperCase();
    if (
      normalized === "OK" ||
      normalized === "ACTIVE" ||
      normalized === "BOUND_OTHER" ||
      normalized === "EXPIRED" ||
      normalized === "SUSPENDED"
    ) {
      return normalized;
    }
    return "INVALID";
  }

  private mapWebAppResponse(
    status: WebAppStatus,
    data: WebAppLicenseResponse,
    licenseKey: string,
    fingerprint: DeviceFingerprint,
    okMessage: string
  ): LicenseValidationResponse {
    const now = Date.now();
    const expiresAtRaw = data.expiresAt ?? data.expiryAt;
    const expiresAt = this.parseMillis(expiresAtRaw, now + 24 * 60 * 60 * 1000);
    const activatedAt = this.parseMillis(data.activatedAt, now);
    const remainingDays = typeof data.remainingDays === "number"
      ? data.remainingDays
      : Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));

    let mappedState: LicenseState;
    let success = true;
    let message = data.message || okMessage;

    switch (status) {
      case "OK":
      case "ACTIVE":
        mappedState = LicenseState.ACTIVE;
        message = data.message || (status === "OK" ? "Kich hoat thanh cong. Con han su dung." : "Ban quyen da kich hoat tren may nay.");
        break;
      case "BOUND_OTHER":
        mappedState = LicenseState.SUSPENDED;
        success = false;
        message = data.message || "Da duoc su dung tren mot thiet bi khac.";
        break;
      case "EXPIRED":
        mappedState = LicenseState.EXPIRED;
        success = false;
        message = data.message || "Ban quyen da het han.";
        break;
      case "SUSPENDED":
        mappedState = LicenseState.SUSPENDED;
        success = false;
        message = data.message || "Ma bi khoa tam thoi.";
        break;
      default:
        mappedState = LicenseState.NO_LICENSE;
        success = false;
        message = data.message || "Ma khong ton tai hoac khong hop le.";
        break;
    }

    return {
      success,
      status: mappedState,
      serverTime: now,
      nonce: this.lastServerNonce || "WEBAPP",
      nonceIssuedAt: now,
      graceExpiresAt: mappedState === LicenseState.EXPIRED ? expiresAt : undefined,
      message: `${message}${success ? ` Con ${remainingDays} ngay.` : ""}`,
      licenseData: {
        key: licenseKey,
        deviceId: fingerprint.machineId,
        status: mappedState,
        activatedAt,
        expiresAt,
        productName: this.webAppAppName,
        productVersion: "1.0.0",
        features: ["search", "quotes", "offline-sync"],
        maxDeviceResets: 0,
        totalResets: 0,
        lastValidatedAt: now,
        nonceIssuedAt: now,
        nonce: this.lastServerNonce || "WEBAPP",
      },
    };
  }

  private parseMillis(value: string | number | undefined, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }
}

export const licenseApiService = new LicenseApiService();
