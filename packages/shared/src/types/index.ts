/**
 * Shared Types for SPARELINK
 * Common data structures used across desktop and API applications
 */

/**
 * Result type indicating success or failure of an operation
 */
export enum ResultType {
  SUCCESS = "success",
  ERROR = "error",
  PENDING = "pending",
  CACHED = "cached",
}

/**
 * Generic result wrapper for API responses and operations
 */
export interface OperationResult<T = unknown> {
  type: ResultType;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  id: string;
}

/**
 * Search result item representing a spare part
 */
export interface SearchResultItem {
  id: string;
  partNumber: string;
  partCode: string;
  name: string;
  description: string;
  category: string;
  manufacturer: string;
  price: number;
  stock: number;
  lastUpdated: string;
  imageUrl?: string;
  tags?: string[];
}

/**
 * Parsed part code information
 */
export interface ParsedCode {
  rawCode: string;
  partNumber: string;
  manufacturer: string;
  category: string;
  attributes: {
    [key: string]: string;
  };
  confidence: number;
  parseMethod: "ocr" | "barcode" | "manual" | "database";
  processingTimeMs: number;
}

/**
 * Sync queue item for offline-first functionality
 */
export interface SyncQueueItem {
  id: string;
  action: "create" | "update" | "delete" | "search";
  resource: string;
  data: unknown;
  timestamp: string;
  status: "pending" | "syncing" | "completed" | "failed";
  retryCount: number;
  error?: string;
}

/**
 * Conflict resolution strategy for sync conflicts
 */
export interface ConflictResolution {
  strategy: "client-wins" | "server-wins" | "merge" | "manual";
  clientVersion: unknown;
  serverVersion: unknown;
  resolvedVersion?: unknown;
  timestamp: string;
}

/**
 * Machine identifier for offline-first tracking
 */
export interface MachineContext {
  machineId: string;
  osType: "windows" | "macos" | "linux";
  appVersion: string;
  lastSyncTime: string;
}

/**
 * License System Types
 */
export * from "./license";
