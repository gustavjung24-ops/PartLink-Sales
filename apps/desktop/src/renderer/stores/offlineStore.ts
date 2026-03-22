/**
 * Offline-First Store - Zustand
 * Platform Layer: Manages offline state, sync queue, and connection status
 *
 * Features:
 * ├── Connection status tracking
 * ├── Sync queue management
 * ├── Cache invalidation
 * ├── Conflict detection
 * └── Offline data persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SyncQueueItem, MachineContext } from "@sparelink/shared";

/**
 * Offline Store State & Actions
 */
export interface OfflineStore {
  // Connection state
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  lastOnlineTime: number | null;

  // Sync queue
  syncQueue: SyncQueueItem[];
  addToSyncQueue: (item: Omit<SyncQueueItem, "id" | "status" | "retryCount" | "createdAt">) => void;
  removeSyncQueueItem: (id: string) => void;
  updateSyncQueueItemStatus: (id: string, status: SyncQueueItem["status"]) => void;
  getPendingSyncItems: () => SyncQueueItem[];
  clearSyncQueue: () => void;

  // Machine context
  machineContext: MachineContext | null;
  setMachineContext: (context: MachineContext) => void;

  // Sync timing
  lastSyncTime: number | null;
  setLastSyncTime: (time: number) => void;

  // Conflicts
  conflicts: Array<{ itemId: string; data: unknown }>;
  addConflict: (itemId: string, data: unknown) => void;
  removeConflict: (itemId: string) => void;
  clearConflicts: () => void;

  // Cache management
  cacheInvalidationTime: Record<string, number>;
  isCacheValid: (key: string, ttl: number) => boolean;
  invalidateCache: (key: string) => void;
  clearCache: () => void;

  // Statistics
  stats: {
    totalQueued: number;
    totalSynced: number;
    totalFailed: number;
    totalConflicts: number;
  };
  recordSync: (status: "synced" | "failed") => void;
}

const generateId = () => `sq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      // Connection state
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      lastOnlineTime: Date.now(),
      setOnline: (online: boolean) => {
        set((state) => ({
          isOnline: online,
          lastOnlineTime: online ? Date.now() : state.lastOnlineTime,
        }));

        if (online) {
          console.log("[Offline Store] Connection restored - attempting sync");
          // TODO: Trigger sync when coming online
        }
      },

      // Sync queue
      syncQueue: [],
      addToSyncQueue: (item) => {
        const newItem: SyncQueueItem = {
          ...item,
          id: generateId(),
          status: "PENDING",
          retryCount: 0,
          createdAt: Date.now(),
        };

        set((state) => ({
          syncQueue: [...state.syncQueue, newItem],
          stats: {
            ...state.stats,
            totalQueued: state.stats.totalQueued + 1,
          },
        }));

        console.log("[Offline Store] Added to sync queue:", newItem.id);
      },

      removeSyncQueueItem: (id: string) => {
        set((state) => ({
          syncQueue: state.syncQueue.filter((item) => item.id !== id),
        }));
      },

      updateSyncQueueItemStatus: (id: string, status: SyncQueueItem["status"]) => {
        set((state) => ({
          syncQueue: state.syncQueue.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status,
                  syncedAt: status === "SYNCED" ? Date.now() : item.syncedAt,
                }
              : item
          ),
        }));
      },

      getPendingSyncItems: () => {
        return get().syncQueue.filter((item) => item.status === "PENDING");
      },

      clearSyncQueue: () => {
        set({ syncQueue: [] });
      },

      // Machine context
      machineContext: null,
      setMachineContext: (context: MachineContext) => {
        set({ machineContext: context });
        console.log("[Offline Store] Machine context set:", context.machineId);
      },

      // Sync timing
      lastSyncTime: null,
      setLastSyncTime: (time: number) => {
        set({ lastSyncTime: time });
        console.log("[Offline Store] Last sync time updated:", new Date(time).toISOString());
      },

      // Conflicts
      conflicts: [],
      addConflict: (itemId: string, data: unknown) => {
        set((state) => ({
          conflicts: [...state.conflicts, { itemId, data }],
          stats: {
            ...state.stats,
            totalConflicts: state.stats.totalConflicts + 1,
          },
        }));

        console.warn("[Offline Store] Conflict detected:", itemId);
      },

      removeConflict: (itemId: string) => {
        set((state) => ({
          conflicts: state.conflicts.filter((c) => c.itemId !== itemId),
        }));
      },

      clearConflicts: () => {
        set({ conflicts: [] });
      },

      // Cache management
      cacheInvalidationTime: {},
      isCacheValid: (key: string, ttl: number) => {
        const invalidatedAt = get().cacheInvalidationTime[key];
        if (!invalidatedAt) return true;
        return Date.now() - invalidatedAt < ttl;
      },

      invalidateCache: (key: string) => {
        set((state) => ({
          cacheInvalidationTime: {
            ...state.cacheInvalidationTime,
            [key]: Date.now(),
          },
        }));
      },

      clearCache: () => {
        set({ cacheInvalidationTime: {} });
      },

      // Statistics
      stats: {
        totalQueued: 0,
        totalSynced: 0,
        totalFailed: 0,
        totalConflicts: 0,
      },

      recordSync: (status: "synced" | "failed") => {
        set((state) => ({
          stats: {
            ...state.stats,
            totalSynced: status === "synced" ? state.stats.totalSynced + 1 : state.stats.totalSynced,
            totalFailed: status === "failed" ? state.stats.totalFailed + 1 : state.stats.totalFailed,
          },
        }));
      },
    }),
    {
      name: "sparelink-offline-store", // LocalStorage key
      version: 1,
      // Only persist certain fields
      partialize: (state) => ({
        syncQueue: state.syncQueue,
        machineContext: state.machineContext,
        lastSyncTime: state.lastSyncTime,
        stats: state.stats,
        cacheInvalidationTime: state.cacheInvalidationTime,
      }),
    }
  )
);

/**
 * Hook to listen to connection status changes
 */
export function useOnlineStatus() {
  const { isOnline, setOnline } = useOfflineStore();

  // Set up listeners (only on client)
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => setOnline(true));
    window.addEventListener("offline", () => setOnline(false));
  }

  return isOnline;
}
