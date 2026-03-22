/**
 * Offline-First Sync Routes
 * Platform Layer: Sync contracts before implementing offline logic
 *
 * Routes:
 * ├── POST   /api/sync/queue
 * ├── POST   /api/sync/pull
 * ├── POST   /api/sync/resolve-conflict
 * └── GET    /api/sync/status
 */

import { ConflictResolution, MachineContext, SyncQueueItem } from "../types";

// TODO: Implement with Fastify
// export async function registerSyncRoutes(fastify: FastifyInstance) {
//   fastify.post<{ Body: { items: SyncQueueItem[] } }>("/api/sync/queue", async (request, reply) => {
//     // TODO: Process sync queue items
//     // Implement conflict resolution if needed
//   });

//   fastify.post<{ Body: { machineContext: MachineContext } }>("/api/sync/pull", async (request, reply) => {
//     // TODO: Pull latest changes from server
//     // Return only changes since lastSyncTime
//   });
// }

export interface SyncRoutes {
  /**
   * POST /api/sync/queue
   * Push offline changes to server
   */
  queueContract: {
    request: {
      machineContext: MachineContext;
      items: SyncQueueItem[];
    };
    response: {
      processed: number;
      conflicts: Array<{ itemId: string; conflict: ConflictResolution }>;
      failed: Array<{ itemId: string; reason: string }>;
    };
  };

  /**
   * POST /api/sync/pull
   * Pull latest changes from server for offline-first client
   */
  pullContract: {
    request: {
      machineContext: MachineContext;
      lastSyncTime: number;
    };
    response: {
      changes: Array<{
        resource: string;
        action: "CREATE" | "UPDATE" | "DELETE";
        data: unknown;
      }>;
      serverTime: number;
    };
  };

  /**
   * POST /api/sync/resolve-conflict
   * Resolve data conflicts between client and server versions
   */
  resolveConflictContract: {
    request: ConflictResolution;
    response: { resolved: boolean; data: unknown };
  };

  /**
   * GET /api/sync/status
   * Get current sync status and pending changes count
   */
  statusContract: {
    response: {
      machineId: string;
      lastSyncTime: number;
      pendingChanges: number;
      conflicts: number;
    };
  };
}
