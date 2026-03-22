/**
 * License Service
 * Platform Layer: License management, activation, validation
 *
 * Features:
 * ├── License key generation & encryption
 * ├── Activation with device fingerprinting
 * ├── Validation & expiry checking  
 * ├── Rebinding limits
 * └── Trial license management
 */

import crypto from "crypto";
import { prisma } from "../../../database/client";
import { config } from "../../../config";
import type { License, Activation } from "@prisma/client";

/**
 * License key structure:
 * PREFIX-XXXX-XXXX-XXXX (36 chars)
 * Example: SL-2024-A1B2-C3D4-E5F6
 * Encrypted metadata format: base64(AES-256-GCM(customer_id|expiry|signature))
 */

interface LicenseGenerationParams {
  customerId: string;
  expiryDays: number;
  maxActivations?: number;
  isTrial?: boolean;
}

interface LicenseMetadata {
  customerId: string;
  expiryDate: string; // ISO 8601
  signature: string; // HMAC-SHA256
}

interface ActivationResult {
  activated: boolean;
  license: License | null;
  activation: Activation | null;
  error?: string;
}

export class LicenseService {
  private encryptionKey: Buffer;
  private jwtSecret: string;

  constructor() {
    // Use config encryption key (32 bytes for AES-256)
    const keyStr = config.encryptionKey;
    this.encryptionKey = Buffer.from(keyStr.padEnd(32, "0").slice(0, 32));
    this.jwtSecret = config.jwtSecret;
  }

  /**
   * Generate a new license key
   */
  generateLicenseKey(): string {
    // Format: SL-YYYY-XXXX-XXXX-XXXX
    const year = new Date().getFullYear();
    const segments = [
      crypto.randomBytes(2).toString("hex").toUpperCase(),
      crypto.randomBytes(2).toString("hex").toUpperCase(),
      crypto.randomBytes(2).toString("hex").toUpperCase(),
    ];
    return `SL-${year}-${segments.join("-")}`;
  }

  /**
   * Encrypt license metadata
   */
  private encryptMetadata(metadata: LicenseMetadata): string {
    const plaintext = JSON.stringify(metadata);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();
    const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

    return Buffer.from(combined).toString("base64");
  }

  /**
   * Decrypt license metadata
   */
  private decryptMetadata(encrypted: string): LicenseMetadata | null {
    try {
      const combined = Buffer.from(encrypted, "base64").toString("hex");

      const iv = Buffer.from(combined.slice(0, 32), "hex");
      const authTag = Buffer.from(combined.slice(32, 64), "hex");
      const ciphertext = combined.slice(64);

      const decipher = crypto.createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let plaintext = decipher.update(ciphertext, "hex", "utf8");
      plaintext += decipher.final("utf8");

      return JSON.parse(plaintext);
    } catch (error) {
      console.error("[LicenseService] Decryption failed:", error);
      return null;
    }
  }

  /**
   * Create new license
   */
  async createLicense(params: LicenseGenerationParams): Promise<License> {
    const licenseKey = this.generateLicenseKey();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + params.expiryDays);

    const metadata: LicenseMetadata = {
      customerId: params.customerId,
      expiryDate: expiryDate.toISOString(),
      signature: crypto.randomBytes(16).toString("hex"), // Random for demo
    };

    const encryptedMetadata = this.encryptMetadata(metadata);

    return prisma.license.create({
      data: {
        licenseKey,
        encryptedMetadata,
        status: params.isTrial ? "PENDING" : "ACTIVATED",
        expiryDate,
        isTrial: params.isTrial || false,
        trialEndDate: params.isTrial ? expiryDate : null,
        maxActivations: params.maxActivations || 3,
      },
    });
  }

  /**
   * Activate a license on a device
   */
  async activateLicense(
    licenseKey: string,
    machineId: string,
    fingerprint: Record<string, unknown>
  ): Promise<ActivationResult> {
    try {
      // Find license
      const license = await prisma.license.findUnique({
        where: { licenseKey },
        include: { activations: true },
      });

      if (!license) {
        return {
          activated: false,
          license: null,
          activation: null,
          error: "License not found",
        };
      }

      // Check status
      if (license.status === "REVOKED") {
        return {
          activated: false,
          license,
          activation: null,
          error: "License is revoked",
        };
      }

      if (license.status === "EXPIRED" || (license.expiryDate && license.expiryDate < new Date())) {
        return {
          activated: false,
          license,
          activation: null,
          error: "License is expired",
        };
      }

      // Check activation limit
      if (license.activations.length >= license.maxActivations) {
        return {
          activated: false,
          license,
          activation: null,
          error: `Maximum activations (${license.maxActivations}) reached`,
        };
      }

      // Check if already activated on this machine
      const existingActivation = license.activations.find((a) => a.machineId === machineId);
      if (existingActivation && existingActivation.status === "ACTIVE") {
        return {
          activated: true,
          license,
          activation: existingActivation,
          error: undefined,
        };
      }

      // Create new activation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day validation window

      const activation = await prisma.activation.create({
        data: {
          licenseId: license.id,
          machineId,
          fingerprint: JSON.stringify(fingerprint),
          expiresAt,
          status: "ACTIVE",
          activatedAt: new Date(),
        },
      });

      // Increment activation count
      if (!existingActivation) {
        await prisma.license.update({
          where: { id: license.id },
          data: {
            activationCount: { increment: 1 },
            status: "ACTIVATED",
          },
        });
      }

      return {
        activated: true,
        license,
        activation,
      };
    } catch (error) {
      console.error("[LicenseService] Activation failed:", error);
      return {
        activated: false,
        license: null,
        activation: null,
        error: "Activation failed",
      };
    }
  }

  /**
   * Validate license on a device
   */
  async validateLicense(
    licenseKey: string,
    machineId: string
  ): Promise<{ valid: boolean; reason?: string; daysRemaining?: number }> {
    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey },
        include: { activations: true },
      });

      if (!license) {
        return { valid: false, reason: "License not found" };
      }

      // Check license status
      if (license.status === "REVOKED" || license.status === "SUSPENDED") {
        return { valid: false, reason: `License is ${license.status.toLowerCase()}` };
      }

      // Check expiry
      if (license.expiryDate && license.expiryDate < new Date()) {
        return { valid: false, reason: "License expired" };
      }

      // Find activation for this machine
      const activation = license.activations.find((a) => a.machineId === machineId);

      if (!activation) {
        return { valid: false, reason: "Device not activated for this license" };
      }

      // Check activation expiry (30-day validation window)
      if (activation.expiresAt < new Date()) {
        return { valid: false, reason: "Activation validation expired" };
      }

      // Calculate days remaining
      const daysRemaining = license.expiryDate
        ? Math.ceil((license.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined;

      // Update last validated timestamp
      await prisma.activation.update({
        where: { id: activation.id },
        data: { lastValidatedAt: new Date() },
      });

      return { valid: true, daysRemaining };
    } catch (error) {
      console.error("[LicenseService] Validation failed:", error);
      return { valid: false, reason: "Validation error" };
    }
  }

  /**
   * Rebind license to new device (limited)
   */
  async rebindLicense(
    licenseKey: string,
    oldMachineId: string,
    newMachineId: string,
    fingerprint: Record<string, unknown>,
    maxRebinds = 2
  ): Promise<ActivationResult> {
    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey },
        include: { activations: true },
      });

      if (!license) {
        return {
          activated: false,
          license: null,
          activation: null,
          error: "License not found",
        };
      }

      const oldActivation = license.activations.find((a) => a.machineId === oldMachineId);

      if (!oldActivation) {
        return {
          activated: false,
          license,
          activation: null,
          error: "No activation found for old machine",
        };
      }

      if (oldActivation.rebindCount >= maxRebinds) {
        return {
          activated: false,
          license,
          activation: null,
          error: `Maximum rebinds (${maxRebinds}) exceeded`,
        };
      }

      // Revoke old activation
      await prisma.activation.update({
        where: { id: oldActivation.id },
        data: {
          status: "REVOKED",
          rebindCount: { increment: 1 },
          rebindLastAt: new Date(),
        },
      });

      // Create new activation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const newActivation = await prisma.activation.create({
        data: {
          licenseId: license.id,
          machineId: newMachineId,
          fingerprint: JSON.stringify(fingerprint),
          expiresAt,
          status: "ACTIVE",
          activatedAt: new Date(),
        },
      });

      return {
        activated: true,
        license,
        activation: newActivation,
      };
    } catch (error) {
      console.error("[LicenseService] Rebind failed:", error);
      return {
        activated: false,
        license: null,
        activation: null,
        error: "Rebind failed",
      };
    }
  }

  /**
   * Revoke a license
   */
  async revokeLicense(licenseKey: string, reason?: string): Promise<boolean> {
    try {
      await prisma.license.update({
        where: { licenseKey },
        data: {
          status: "REVOKED",
        },
      });

      // Revoke all activations
      await prisma.activation.updateMany({
        where: { license: { licenseKey } },
        data: { status: "REVOKED" },
      });

      console.log(`[LicenseService] License ${licenseKey} revoked${reason ? `: ${reason}` : ""}`);
      return true;
    } catch (error) {
      console.error("[LicenseService] Revoke failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const licenseService = new LicenseService();
