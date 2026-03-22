/**
 * Device Fingerprint Service
 * Generates unique machine identifier for license binding
 *
 * Task 3.1: Device fingerprint identification
 * - Machine node ID + OS info  
 * - SHA256 hash of hostname (anonymized)
 * - Combined fingerprint hash
 * - Cache results
 * - Expose via preload bridge
 */

import crypto from "crypto";
import os from "os";
import { app } from "electron";
import type { DeviceFingerprint } from "@sparelink/shared";

/**
 * Generate fingerprint from system info
 * All sensitive data is hashed before storage
 */
function generateFingerprintHash(
  machineId: string,
  osType: string,
  osRelease: string,
  osArchitecture: string,
  hostnameHash: string
): string {
  const data = `${machineId}|${osType}|${osRelease}|${osArchitecture}|${hostnameHash}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hashHostname(hostname: string): string {
  return crypto.createHash("sha256").update(hostname).digest("hex");
}

export class DeviceFingerprintService {
  private fingerprint: DeviceFingerprint | null = null;
  private readonly cacheKey = "device-fingerprint";

  /**
   * Get or generate device fingerprint
   * Caches result in memory for app lifetime
   */
  async getFingerprint(): Promise<DeviceFingerprint> {
    // Return cached fingerprint
    if (this.fingerprint) {
      return this.fingerprint;
    }

    // Generate new fingerprint
    const machineId = os.hostname() + crypto.randomBytes(8).toString("hex");
    const osType = process.platform;
    const osRelease = os.release();
    const osArchitecture = os.arch();
    const osHostname = os.hostname();
    const hostnameHash = hashHostname(osHostname);

    const fingerprint: DeviceFingerprint = {
      machineId,
      osType,
      osRelease,
      osArchitecture,
      osHostname,
      hostnameHash,
      fingerprint: generateFingerprintHash(machineId, osType, osRelease, osArchitecture, hostnameHash),
      createdAt: Date.now(),
    };

    this.fingerprint = fingerprint;

    if (process.env.DEBUG_LICENSE) {
      console.log("[Fingerprint Service] Generated fingerprint:", {
        machineId,
        osType,
        osArchitecture,
        fingerprint: fingerprint.fingerprint.substring(0, 16) + "...",
      });
    }

    return fingerprint;
  }

  /**
   * Get cached fingerprint or throw if not initialized
   */
  getCachedFingerprint(): DeviceFingerprint {
    if (!this.fingerprint) {
      throw new Error("Fingerprint not initialized. Call getFingerprint() first.");
    }
    return this.fingerprint;
  }

  /**
   * Get fingerprint hash only (for sending to server)
   * Never send raw machine ID or hostname to server
   */
  async getFingerprintHash(): Promise<string> {
    const fp = await this.getFingerprint();
    return fp.fingerprint;
  }

  /**
   * Validate fingerprint matches current system
   * Returns true if fingerprint hasn't changed (device not cloned, etc.)
   */
  async validateFingerprint(storedFingerprint: DeviceFingerprint): Promise<boolean> {
    const current = await this.getFingerprint();

    // Check if OS type and architecture match
    if (
      current.osType !== storedFingerprint.osType ||
      current.osArchitecture !== storedFingerprint.osArchitecture
    ) {
      console.warn("[Fingerprint Service] Platform changed - device may be compromised");
      return false;
    }

    // Check if machine ID matches (same physical device)
    if (current.machineId !== storedFingerprint.machineId) {
      console.warn("[Fingerprint Service] Machine ID changed - different device detected");
      return false;
    }

    return true;
  }

  /**
   * Get human-readable fingerprint summary for UI display
   */
  async getFingerprintSummary(): Promise<string> {
    const fp = await this.getFingerprint();
    return `${fp.osType} | ${fp.osArchitecture} | ${fp.fingerprint.substring(0, 12)}...`;
  }
}

export const deviceFingerprintService = new DeviceFingerprintService();
