/**
 * API Layer - Shared Types & Contracts
 * Platform Layer: Define API contracts before implementing routes
 */

/**
 * REST API Response Format - Standardized for all endpoints
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}

/**
 * API Error Codes - Platform layer standardized error handling
 */
export enum ApiErrorCode {
  // Auth errors
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  FORBIDDEN = "FORBIDDEN",

  // Validation errors
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT = "INVALID_FORMAT",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  RESOURCE_LOCKED = "RESOURCE_LOCKED",

  // Server errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * Pagination params - Standard across all list endpoints
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: "asc" | "desc";
}

/**
 * Paginated response - Standard list endpoint response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Authentication types
 */
export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Part search & parsing types
 */
export interface PartSearchPayload {
  query: string;
  category?: string;
  manufacturer?: string;
  limit?: number;
}

export interface PartSearchResult {
  id: string;
  partNumber: string;
  partCode: string;
  name: string;
  manufacturer: string;
  category: string;
  description?: string;
  price?: number;
  inStock: boolean;
}

export interface PartParsePayload {
  rawCode: string;
}

export interface PartParseResult {
  success: boolean;
  partNumber?: string;
  manufacturer?: string;
  category?: string;
  confidence: number;
}

/**
 * Sync/Offline types
 */
export interface SyncQueueItem {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  resource: string;
  resourceId: string;
  payload: unknown;
  status: "PENDING" | "SYNCED" | "FAILED";
  retryCount: number;
  createdAt: number;
  syncedAt?: number;
}

export interface ConflictResolution {
  strategy: "CLIENT_WINS" | "SERVER_WINS" | "MERGE";
  clientVersion: unknown;
  serverVersion: unknown;
  resolvedData: unknown;
}

/**
 * Machine context - For offline-first sync
 */
export interface MachineContext {
  machineId: string;
  osType: string;
  appVersion: string;
  lastSyncTime: number;
}
