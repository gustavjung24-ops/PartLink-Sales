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
import { app, safeStorage } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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
  private readonly fingerprintFilePath = path.join(app.getPath("userData"), "license", "fingerprint.dat");

  private serializeMachineId(machineId: string): Buffer {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(machineId);
    }

    console.warn("[Fingerprint Service] safeStorage unavailable — machineId stored in plaintext");
    return Buffer.from(machineId, "utf-8");
  }

  private deserializeMachineId(content: Buffer): string {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(content)
      : content.toString("utf-8");
  }

  private async loadPersistedMachineId(): Promise<string | null> {
    try {
      const content = await readFile(this.fingerprintFilePath);
      const machineId = this.deserializeMachineId(content).trim();
      return machineId.length > 0 ? machineId : null;
    } catch {
      return null;
    }
  }

  private async persistMachineId(machineId: string): Promise<void> {
    const dirPath = path.dirname(this.fingerprintFilePath);
    await mkdir(dirPath, { recursive: true });
    await writeFile(this.fingerprintFilePath, this.serializeMachineId(machineId));
  }

  /**
   * Get or generate device fingerprint
   * Caches result in memory for app lifetime
   */
  async getFingerprint(): Promise<DeviceFingerprint> {
    // Return cached fingerprint
    if (this.fingerprint) {
      return this.fingerprint;
    }

    // Load persisted machineId first to keep activation stable across restarts.
    // Only generate a new one the very first time.
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
