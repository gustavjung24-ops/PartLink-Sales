import { app, safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuthSession } from "@/shared/electronApi";

interface StoredAuthPayload {
  session: AuthSession;
  /** Unix ms when the stored refresh token expires. Used to restore AuthService Map after restart. */
  refreshTokenExpiry: number;
  savedAt: number;
}

export class SecureSessionStore {
  private readonly sessionFilePath = path.join(app.getPath("userData"), "auth", "session.dat");

  private serialize(payload: StoredAuthPayload): Buffer {
    const content = JSON.stringify(payload);

    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(content);
    }

    console.warn("[SecureSessionStore] safeStorage unavailable — session stored in plaintext");
    return Buffer.from(content, "utf-8");
  }

  private deserialize(content: Buffer): StoredAuthPayload {
    const raw = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(content)
      : content.toString("utf-8");

    return JSON.parse(raw) as StoredAuthPayload;
  }

  async saveSession(session: AuthSession, refreshTokenExpiry: number): Promise<void> {
    const dirPath = path.dirname(this.sessionFilePath);
    await mkdir(dirPath, { recursive: true });

    const payload: StoredAuthPayload = {
      session,
      refreshTokenExpiry,
      savedAt: Date.now(),
    };

    const encrypted = this.serialize(payload);
    await writeFile(this.sessionFilePath, encrypted);
  }

  /** Returns the full stored payload, including refreshTokenExpiry. */
  async loadStoredPayload(): Promise<StoredAuthPayload | null> {
    try {
      const content = await readFile(this.sessionFilePath);
      return this.deserialize(content);
    } catch {
      return null;
    }
  }

  async loadSession(): Promise<AuthSession | null> {
    const payload = await this.loadStoredPayload();
    return payload?.session ?? null;
  }

  async clearSession(): Promise<void> {
    await rm(this.sessionFilePath, { force: true });
  }
}

export const secureSessionStore = new SecureSessionStore();
