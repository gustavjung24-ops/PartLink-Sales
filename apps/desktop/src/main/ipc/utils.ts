import { IpcMainInvokeEvent, ipcMain } from "electron";

/**
 * IPC Handler Response Format - Standardized for all channels
 */
export interface IpcResponse<T = unknown> {
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
 * IPC Handler Type Definition
 */
type IpcHandler<Payload = unknown, Response = unknown> = (
  event: IpcMainInvokeEvent,
  payload: Payload
) => Promise<Response> | Response;

/**
 * Wraps IPC handler with error handling, logging, and standardized responses
 * Platform Layer: Ensures consistent error handling across all IPC channels
 *
 * @example
 * withErrorHandling<LoginPayload, TokenResponse>(
 *   "auth:login",
 *   async (event, { username, password }) => {
 *     const token = await authService.login(username, password);
 *     return token;
 *   }
 * );
 */
export function withErrorHandling<Payload = unknown, Response = unknown>(
  channel: string,
  handler: IpcHandler<Payload, Response>
) {
  return ipcMain.handle(
    channel,
    async (event, payload: Payload): Promise<IpcResponse<Response>> => {
      try {
        // Debug logging (enable with DEBUG_IPC=true)
        if (process.env.DEBUG_IPC) {
          console.log(`[IPC] Incoming: ${channel}`, { payload });
        }

        const result = await Promise.resolve(handler(event, payload));

        // Success response
        const response: IpcResponse<Response> = {
          success: true,
          data: result,
          timestamp: Date.now(),
        };

        if (process.env.DEBUG_IPC) {
          console.log(`[IPC] Success: ${channel}`, { response });
        }

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = error instanceof Error && "code" in error ? (error as any).code : "INTERNAL_ERROR";

        console.error(`[IPC ERROR] ${channel}:`, {
          code: errorCode,
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Error response
        const response: IpcResponse<Response> = {
          success: false,
          error: {
            code: errorCode as string,
            message: errorMessage,
            details: process.env.DEBUG_IPC ? error : undefined, // Only expose details in debug mode
          },
          timestamp: Date.now(),
        };

        return response;
      }
    }
  );
}

/**
 * Type-safe IPC channel constants
 * Platform Layer: Central definition of all IPC contracts
 */
export const IPC_HANDLERS = {
  // Auth
  "auth:login": "auth:login",
  "auth:refresh": "auth:refresh",
  "auth:me": "auth:me",
  "auth:request-password-reset": "auth:request-password-reset",
  "auth:logout": "auth:logout",
  "auth:load-session": "auth:load-session",
  "auth:save-session": "auth:save-session",
  "auth:clear-session": "auth:clear-session",

  // File System
  "filesystem:read-text-file": "filesystem:read-text-file",
  "filesystem:write-text-file": "filesystem:write-text-file",

  // App Info
  "app:get-info": "app:get-info",

  // Window Management
  "window:minimize": "window:minimize",
  "window:maximize": "window:maximize",
  "window:unmaximize": "window:unmaximize",
  "window:toggle-maximize": "window:toggle-maximize",
  "window:close": "window:close",
  "window:get-state": "window:get-state",
} as const;

/**
 * Validates Renderer sender to prevent unauthorized access
 * Platform Layer: Security check for IPC calls
 */
export function validateSender(event: IpcMainInvokeEvent, channel: string): boolean {
  // Future: Add origin checks, signed token validation
  if (!event.sender) {
    console.error(`[IPC SECURITY] No sender for ${channel}`);
    return false;
  }

  // Add security checks here based on app architecture
  return true;
}

/**
 * Sanitizes errors to prevent sensitive information leakage
 */
export function sanitizeErrorForClient(error: unknown): string {
  if (error instanceof Error) {
    // Map known errors to user-friendly messages
    if (error.message.includes("ENOENT")) {
      return "File not found";
    }
    if (error.message.includes("EACCES")) {
      return "Permission denied";
    }
    // Generic fallback for security
    return "An error occurred";
  }
  return "Unknown error";
}
