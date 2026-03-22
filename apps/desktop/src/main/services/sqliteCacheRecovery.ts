import Database from "better-sqlite3";
import { app } from "electron";
import { access, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

export interface SqliteCacheHealthResult {
  status: "missing" | "healthy" | "recovered" | "rebuild-required";
  databasePath: string;
  backupPath?: string;
  detail?: string;
}

export class SqliteCacheRecoveryService {
  private readonly databasePath =
    process.env.SPARELINK_SQLITE_CACHE_PATH
    ?? path.join(app.getPath("userData"), "cache", "offline-cache.sqlite");

  private readonly backupDir = path.join(app.getPath("userData"), "cache", "backups");
  private readonly quarantineDir = path.join(app.getPath("userData"), "cache", "corrupt");

  getDatabasePath(): string {
    return this.databasePath;
  }

  async ensureHealthyCache(
    rebuildFromServer?: () => Promise<void>
  ): Promise<SqliteCacheHealthResult> {
    const exists = await this.fileExists(this.databasePath);
    if (!exists) {
      return {
        status: "missing",
        databasePath: this.databasePath,
        detail: "No local SQLite cache found.",
      };
    }

    let database: Database.Database | null = null;

    try {
      database = new Database(this.databasePath, {
        readonly: true,
        fileMustExist: true,
      });

      const integrity = database.prepare("PRAGMA integrity_check(1)").pluck().get() as string;
      if (integrity !== "ok") {
        throw new Error(`PRAGMA integrity_check returned: ${integrity}`);
      }

      return {
        status: "healthy",
        databasePath: this.databasePath,
      };
    } catch (error) {
      database?.close();
      database = null;

      const backupPath = await this.quarantineDatabase("startup-integrity-failed");
      await rm(this.databasePath, { force: true });

      if (rebuildFromServer) {
        await rebuildFromServer();
        return {
          status: "recovered",
          databasePath: this.databasePath,
          backupPath: backupPath ?? undefined,
          detail: error instanceof Error ? error.message : "SQLite cache recovery triggered.",
        };
      }

      return {
        status: "rebuild-required",
        databasePath: this.databasePath,
        backupPath: backupPath ?? undefined,
        detail: error instanceof Error ? error.message : "SQLite cache requires rebuild.",
      };
    } finally {
      database?.close();
    }
  }

  async backupBeforeOverwrite(reason: string = "sync-overwrite"): Promise<string | null> {
    const exists = await this.fileExists(this.databasePath);
    if (!exists) {
      return null;
    }

    await mkdir(this.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, "-");
    const targetPath = path.join(this.backupDir, `offline-cache-${safeReason}-${timestamp}.sqlite`);

    await copyFile(this.databasePath, targetPath);
    return targetPath;
  }

  private async quarantineDatabase(reason: string): Promise<string | null> {
    const exists = await this.fileExists(this.databasePath);
    if (!exists) {
      return null;
    }

    await mkdir(this.quarantineDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const targetPath = path.join(this.quarantineDir, `offline-cache-${reason}-${timestamp}.sqlite`);
    await copyFile(this.databasePath, targetPath);
    return targetPath;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const sqliteCacheRecoveryService = new SqliteCacheRecoveryService();