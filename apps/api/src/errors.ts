import { ApiResponse, ApiErrorCode } from "./types";

/**
 * Custom API Error class
 * Platform Layer: Standardized error handling for API routes
 */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Error handler utility - Convert errors to standardized responses
 */
export function handleApiError(error: unknown): ApiResponse {
  console.error("[API ERROR]", error);

  let code: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR;
  let message: string = "An internal error occurred";
  let details: unknown;

  if (error instanceof ApiError) {
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;

    // Map common errors
    if (error.message.includes("ENOENT")) {
      code = ApiErrorCode.NOT_FOUND;
    } else if (error.message.includes("EACCES")) {
      code = ApiErrorCode.FORBIDDEN;
    } else if (error.message.includes("validation")) {
      code = ApiErrorCode.INVALID_PAYLOAD;
    }
  }

  return {
    success: false,
    error: {
      code,
      message,
      details: process.env.DEBUG_API ? details : undefined,
    },
    timestamp: Date.now(),
  };
}

/**
 * Success response builder
 */
export function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Error response builder
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details: process.env.DEBUG_API ? details : undefined,
    },
    timestamp: Date.now(),
  };
}

/**
 * Validation error helper
 */
export function validateRequiredFields(
  payload: Record<string, unknown>,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (!(field in payload) || payload[field] === undefined || payload[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}
