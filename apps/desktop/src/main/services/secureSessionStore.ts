import { app, safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuthSession } from "@/shared/electronApi";

interface StoredAuthPayload {
  session: AuthSession;
  savedAt: number;
}

export class SecureSessionStore {
  private readonly sessionFilePath = path.join(app.getPath("userData"), "auth", "session.dat");

  private serialize(payload: StoredAuthPayload): Buffer {
    const content = JSON.stringify(payload);

    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(content);
    }

    return Buffer.from(content, "utf-8");
  }

  private deserialize(content: Buffer): StoredAuthPayload {
    const raw = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(content)
      : content.toString("utf-8");

    return JSON.parse(raw) as StoredAuthPayload;
  }

  async saveSession(session: AuthSession): Promise<void> {
    const dirPath = path.dirname(this.sessionFilePath);
    await mkdir(dirPath, { recursive: true });

    const payload: StoredAuthPayload = {
      session,
      savedAt: Date.now(),
    };

    const encrypted = this.serialize(payload);
    await writeFile(this.sessionFilePath, encrypted);
  }

  async loadSession(): Promise<AuthSession | null> {
    try {
      const content = await readFile(this.sessionFilePath);
      const payload = this.deserialize(content);
      return payload.session;
    } catch {
      return null;
    }
  }

  async clearSession(): Promise<void> {
    await rm(this.sessionFilePath, { force: true });
  }
}

export const secureSessionStore = new SecureSessionStore();
