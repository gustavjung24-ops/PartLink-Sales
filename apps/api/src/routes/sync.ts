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

import type { FastifyInstance } from "fastify";
import { ConflictResolution, MachineContext, SyncQueueItem } from "../types";
import { apiError, apiSuccess, validateRequiredFields } from "../errors";
import { ApiErrorCode } from "../types";

function resolveConflictVersion(conflict: ConflictResolution) {
  switch (conflict.strategy) {
    case "client-wins":
      return conflict.clientVersion;
    case "server-wins":
      return conflict.serverVersion;
    case "merge":
      return conflict.resolvedVersion ?? {
        client: conflict.clientVersion,
        server: conflict.serverVersion,
      };
    default:
      return conflict.resolvedVersion ?? null;
  }
}

export async function registerSyncRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: { machineContext?: MachineContext; items?: SyncQueueItem[] } }>("/queue", async (request, reply) => {
    const validation = validateRequiredFields(request.body as Record<string, unknown>, ["machineContext", "items"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    return reply.code(200).send(
      apiSuccess({
        processed: request.body.items?.length ?? 0,
        conflicts: [],
        failed: [],
      })
    );
  });

  fastify.post<{ Body: { machineContext?: MachineContext; lastSyncTime?: number } }>("/pull", async (request, reply) => {
    const validation = validateRequiredFields(request.body as Record<string, unknown>, ["machineContext", "lastSyncTime"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    return reply.code(200).send(
      apiSuccess({
        changes: [],
        serverTime: Date.now(),
      })
    );
  });

  fastify.post<{ Body: ConflictResolution }>("/resolve-conflict", async (request, reply) => {
    const validation = validateRequiredFields(request.body as unknown as Record<string, unknown>, ["strategy", "clientVersion", "serverVersion", "timestamp"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    return reply.code(200).send(
      apiSuccess({
        resolved: request.body.strategy !== "manual",
        data: resolveConflictVersion(request.body),
      })
    );
  });

  fastify.get<{ Querystring: { machineId?: string } }>("/status", async (request, reply) => {
    return reply.code(200).send(
      apiSuccess({
        machineId: request.query.machineId ?? "unknown",
        lastSyncTime: Date.now(),
        pendingChanges: 0,
        conflicts: 0,
      })
    );
  });
}

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
