import { app, safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LicenseData } from "@sparelink/shared";

interface StoredLicensePayload {
  licenseData: LicenseData;
  savedAt: number;
}

export class SecureLicenseStore {
  private readonly licenseFilePath = path.join(app.getPath("userData"), "license", "license.dat");

  private serialize(payload: StoredLicensePayload): Buffer {
    const content = JSON.stringify(payload);

    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(content);
    }

    console.warn("[SecureLicenseStore] safeStorage unavailable — license stored in plaintext");
    return Buffer.from(content, "utf-8");
  }

  private deserialize(content: Buffer): StoredLicensePayload {
    const raw = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(content)
      : content.toString("utf-8");

    return JSON.parse(raw) as StoredLicensePayload;
  }

  async saveLicenseData(licenseData: LicenseData): Promise<void> {
    const dirPath = path.dirname(this.licenseFilePath);
    await mkdir(dirPath, { recursive: true });

    const payload: StoredLicensePayload = {
      licenseData,
      savedAt: Date.now(),
    };

    const encrypted = this.serialize(payload);
    await writeFile(this.licenseFilePath, encrypted);
  }

  async loadStoredPayload(): Promise<StoredLicensePayload | null> {
    try {
      const content = await readFile(this.licenseFilePath);
      return this.deserialize(content);
    } catch {
      return null;
    }
  }

  async loadLicenseData(): Promise<LicenseData | null> {
    const payload = await this.loadStoredPayload();
    return payload?.licenseData ?? null;
  }

  async clearLicenseData(): Promise<void> {
    await rm(this.licenseFilePath, { force: true });
  }
}

export const secureLicenseStore = new SecureLicenseStore();
