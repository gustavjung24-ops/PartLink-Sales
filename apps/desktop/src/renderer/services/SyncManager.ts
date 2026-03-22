/**
 * Sync Manager - Handles offline-first sync logic
 * Platform Layer: Coordinates syncing with backend API
 *
 * Responsibilities:
 * ├── Process sync queue when online
 * ├── Handle conflicts
 * ├── Retry failed items with exponential backoff
 * ├── Pull changes from server
 * └── Update cache
 */

import { useOfflineStore } from "../stores/offlineStore";
import type { SyncQueueItem, ConflictResolution } from "@sparelink/shared";

export interface SyncManagerConfig {
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
  conflictStrategy: "CLIENT_WINS" | "SERVER_WINS" | "MERGE";
}

const DEFAULT_CONFIG: SyncManagerConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  batchSize: 10,
  conflictStrategy: "CLIENT_WINS",
};

export class SyncManager {
  private config: SyncManagerConfig;
  private isSyncing = false;

  private syncTimer: NodeJS.Timeout | null = null;
  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start automatic sync when app is online
   * Checks for pending sync every 30 seconds
   */
  startAutoSync() {
    if (this.syncTimer) return;

    console.log("[SyncManager] Starting auto-sync");

    // Initial sync
    this.sync();

    // Periodic sync every 30 seconds
    this.syncTimer = setInterval(() => {
      this.sync();
    }, 30000);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log("[SyncManager] Stopped auto-sync");
    }
  }

  /**
   * Main sync method - Process pending items and pull changes
   */
  async sync() {
    const store = useOfflineStore.getState();

    // Don't sync if already syncing or offline
    if (this.isSyncing || !store.isOnline) return;

    this.isSyncing = true;
    console.log("[SyncManager] Starting sync...");

    try {
      // Step 1: Push local changes to server
      await this.pushChanges();

      // Step 2: Pull changes from server
      await this.pullChanges();

      // Step 3: Update sync time
      store.setLastSyncTime(Date.now());
      console.log("[SyncManager] Sync completed successfully");
    } catch (error) {
      console.error("[SyncManager] Sync failed:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push pending changes to server
   */
  private async pushChanges() {
    const store = useOfflineStore.getState();
    const pendingItems = store.getPendingSyncItems();

    if (pendingItems.length === 0) {
      console.log("[SyncManager] No pending changes to push");
      return;
    }

    console.log(`[SyncManager] Pushing ${pendingItems.length} pending changes`);

    // Process in batches
    for (let i = 0; i < pendingItems.length; i += this.config.batchSize) {
      const batch = pendingItems.slice(i, i + this.config.batchSize);

      try {
        // TODO: Call API endpoint /api/sync/queue
        // const response = await fetch("/api/sync/queue", {
        //   method: "POST",
        //   body: JSON.stringify({
        //     machineContext: store.machineContext,
        //     items: batch,
        //   }),
        // });

        // For now, mark as synced
        for (const item of batch) {
           store.updateSyncQueueItemStatus(item.id, "completed");
          store.recordSync("synced");
        }

        console.log(`[SyncManager] Synced batch of ${batch.length} items`);
      } catch (error) {
        console.error("[SyncManager] Failed to push batch:", error);

        // Retry logic
        for (const item of batch) {
          if (item.retryCount < this.config.maxRetries) {
            // Increment before scheduling so each retry reads the updated count
            store.incrementRetryCount(item.id);
            const delay = this.config.retryDelayMs * Math.pow(2, item.retryCount);
            setTimeout(() => {
              console.log(`[SyncManager] Retrying item ${item.id} (attempt ${item.retryCount + 1})`);
              void this.sync();
            }, delay);
          } else {
            store.updateSyncQueueItemStatus(item.id, "failed");
            store.recordSync("failed");
          }
        }
      }
    }
  }

  /**
   * Pull changes from server
   */
  private async pullChanges() {
    const store = useOfflineStore.getState();

    if (!store.machineContext) {
      console.warn("[SyncManager] No machine context available");
      return;
    }

    console.log("[SyncManager] Pulling changes from server");

    try {
      // TODO: Call API endpoint /api/sync/pull
      // const response = await fetch("/api/sync/pull", {
      //   method: "POST",
      //   body: JSON.stringify({
      //     machineContext: store.machineContext,
      //     lastSyncTime: store.lastSyncTime || 0,
      //   }),
      // });
      // const data = await response.json();

      // Process changes and update local state
      // TODO: Apply changes to react-query cache
      // For now, just log
      console.log("[SyncManager] Pulled changes from server");
    } catch (error) {
      console.error("[SyncManager] Failed to pull changes:", error);
    }
  }

  /**
   * Handle conflict resolution
   */
  async resolveConflict(
    itemId: string,
    clientData: unknown,
    serverData: unknown
  ): Promise<unknown> {
    console.log("[SyncManager] Resolving conflict:", itemId);

    const store = useOfflineStore.getState();
    const strategy = this.config.conflictStrategy;

    let resolvedData: unknown;

    switch (strategy) {
      case "CLIENT_WINS":
        resolvedData = clientData;
        break;
      case "SERVER_WINS":
        resolvedData = serverData;
        break;
      case "MERGE":
        // Simple merge strategy: combine both objects
          if (
            typeof serverData === "object" &&
            serverData !== null &&
            typeof clientData === "object" &&
            clientData !== null
          ) {
            resolvedData = { ...serverData, ...clientData };
          } else {
            resolvedData = clientData;
          }
        break;
    }

    // TODO: Call API to resolve conflict on server
    // const response = await fetch("/api/sync/resolve-conflict", {
    //   method: "POST",
    //   body: JSON.stringify({
    //     strategy,
    //     clientVersion: clientData,
    //     serverVersion: serverData,
    //     resolvedData,
    //   }),
    // });

    store.removeConflict(itemId);
    return resolvedData;
  }

  /**
   * Manually trigger a sync
   */
  async forceSyncNow() {
    console.log("[SyncManager] Force sync triggered");
    await this.sync();
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const store = useOfflineStore.getState();
    return {
      isSyncing: this.isSyncing,
      isOnline: store.isOnline,
      pendingChanges: store.getPendingSyncItems().length,
      conflicts: store.conflicts.length,
      lastSyncTime: store.lastSyncTime,
      stats: store.stats,
    };
  }
}

// Singleton instance
let syncManager: SyncManager | null = null;

export function useSyncManager(): SyncManager {
  if (!syncManager) {
    syncManager = new SyncManager();
  }
  return syncManager;
}
