import Database from "better-sqlite3";
import { app } from "electron";
import { access, appendFile, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

export interface SqliteCacheHealthResult {
  status: "missing" | "healthy" | "recovered" | "rebuild-required";
  databasePath: string;
  backupPath?: string;
  detail?: string;
}

export interface SyncOverwriteResult {
  backupPath: string | null;
  /** ISO-8601 timestamp recorded in the audit log. */
  loggedAt: string;
}

export class SqliteCacheRecoveryService {
  private readonly databasePath =
    process.env.SPARELINK_SQLITE_CACHE_PATH
    ?? path.join(app.getPath("userData"), "cache", "offline-cache.sqlite");

  private readonly backupDir = path.join(app.getPath("userData"), "cache", "backups");
  private readonly quarantineDir = path.join(app.getPath("userData"), "cache", "corrupt");
  private readonly auditLogPath = path.join(app.getPath("userData"), "cache", "sync-audit.log");

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

  /**
   * Back up the current SQLite cache before a sync overwrite replaces it with
   * server data.  The conflict resolution strategy is **server wins**: the
   * authoritative server state always replaces the local cache.  A pre-overwrite
   * backup is kept so a fallback is available if the new data fails integrity
   * checks.  Every call is appended to the sync audit log for traceability.
   *
   * @param reason  Short label describing why the overwrite is happening
   *                (e.g. "sync-overwrite", "force-refresh").
   * @returns       The path of the backup file and the log timestamp.
   */
  async backupBeforeOverwrite(reason: string = "sync-overwrite"): Promise<SyncOverwriteResult> {
    const loggedAt = new Date().toISOString();
    const backupPath = await this._createBackup(reason);
    await this._appendSyncAuditLog(reason, backupPath, loggedAt);
    return { backupPath, loggedAt };
  }

  private async _createBackup(reason: string): Promise<string | null> {
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

  /**
   * Append a structured line to the sync audit log so overwrite events can be
   * traced during incident investigation.
   */
  private async _appendSyncAuditLog(
    reason: string,
    backupPath: string | null,
    timestamp: string,
  ): Promise<void> {
    const line = JSON.stringify({
      event: "sync-overwrite",
      reason,
      backupPath,
      timestamp,
      databasePath: this.databasePath,
    }) + "\n";
    try {
      await mkdir(path.dirname(this.auditLogPath), { recursive: true });
      await appendFile(this.auditLogPath, line, { encoding: "utf8" });
    } catch (error) {
      // Non-fatal: logging failure must not block the sync operation.
      console.error("[SqliteCacheRecovery] Sync audit log write failed:", error);
    }
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