/**
 * License System Types & Contracts
 * Platform Layer: All license-related types shared between desktop and backend
 */

/**
 * License States - State machine for license lifecycle
 */
export enum LicenseState {
  NO_LICENSE = "NO_LICENSE",          // No license installed
  TRIAL = "TRIAL",                    // Trial period active (limited by time)
  ACTIVE = "ACTIVE",                  // Valid license, subscription active
  EXPIRED = "EXPIRED",                // License expired, grace period may apply
  SUSPENDED = "SUSPENDED",            // License suspended (payment issue, etc.)
  DEACTIVATED = "DEACTIVATED",        // User deactivated, ready for rebinding
}

/**
 * Device fingerprint - Unique machine identifier
 */
export interface DeviceFingerprint {
  machineId: string;                  // Machine node ID (OS-specific)
  osType: string;                     // "darwin" | "linux" | "win32"
  osRelease: string;                  // OS version
  osArchitecture: string;             // "x64" | "arm64"
  osHostname: string;                 // Machine hostname
  hostnameHash: string;               // SHA256(hostname) - anonymized
  fingerprint: string;                // SHA256 of all combined data
  createdAt: number;                  // Timestamp when fingerprint generated
}

/**
 * License Data - Stored on client and validated with server
 */
export interface LicenseData {
  key: string;                        // License key (e.g., "SL-XXXX-XXXX-XXXX")
  deviceId: string;                   // Device fingerprint.machineId this license is bound to
  status: LicenseState;               // Current license state
  activatedAt: number;                // Timestamp license activated
  expiresAt: number;                  // Trial end or subscription end
  graceUntil?: number;                // Optional grace period after expiration
  productName: string;                // e.g., "SPARELINK Pro"
  productVersion: string;             // e.g., "1.0.0"
  features: string[];                 // Enabled features
  maxDeviceResets: number;            // Device rebinding limit per month
  totalResets: number;                // Total resets done
  lastResetDate?: number;             // Last reset timestamp
}

/**
 * License response from server validation
 */
export interface LicenseValidationResponse {
  success: boolean;
  status: LicenseState;
  licenseData: LicenseData;
  serverTime: number;                 // Server time for clock-skew detection
  nonce: string;                      // Challenge token for next validation
  graceExpiresAt?: number;            // When grace period ends (if any)
  message?: string;                   // Human-readable message
}

/**
 * License activation request to server
 */
export interface LicenseActivationPayload {
  key: string;
  deviceFingerprint: DeviceFingerprint;
}

/**
 * License validation request to server (periodic re-check)
 */
export interface LicenseValidationPayload {
  key: string;
  deviceFingerprint: DeviceFingerprint;
  lastNonce: string;                  // From previous validation response
  clientTime: number;                 // Client system time
}

/**
 * License state transition event
 */
export interface LicenseStateChangeEvent {
  previousState: LicenseState;
  newState: LicenseState;
  reason: string;                     // Why state changed
  timestamp: number;
  licenseData: LicenseData;
}

/**
 * Trial license info
 */
export interface TrialLicenseInfo {
  remainingDays: number;
  totalDays: number;
  percentElapsed: number;
  expiresAt: number;
}

/**
 * Deactivation request for device switch
 */
export interface DeviceDeactivationPayload {
  key: string;
  deviceId: string;
  reason: "DEVICE_SWITCH" | "SUPPORT_REQUEST";
}

/**
 * Clock skew detection result
 */
export interface ClockSkewResult {
  isSkewed: boolean;
  skewMs: number;                     // Negative if client is behind, positive if ahead
  severity: "NONE" | "WARNING" | "CRITICAL";
}

/**
 * Device rebinding history
 */
export interface DeviceRebindingRecord {
  oldDeviceId: string;
  newDeviceId: string;
  timestamp: number;
  reason: string;
}

/**
 * Device rebinding availability for current license
 */
export interface DeviceRebindingStatus {
  allowed: boolean;
  current: number;
  max: number;
  remaining: number;
}

/**
 * License metadata for UI display
 */
export interface LicenseDisplayInfo {
  state: LicenseState;
  productName: string;
  activatedDate: string;              // Formatted date
  expiryDate: string;                 // Formatted date
  daysRemaining?: number;
  deviceId: string;
  features: string[];
  isValid: boolean;
}
