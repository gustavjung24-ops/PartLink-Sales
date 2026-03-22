/**
 * License Management Routes
 * Platform Layer: License activation and validation contracts
 *
 * Routes:
 * ├── POST   /api/licenses/activate
 * ├── POST   /api/licenses/validate
 * ├── POST   /api/licenses/deactivate
 * └── GET    /api/licenses/status
 */

import {
  LicenseActivationPayload,
  LicenseValidationPayload,
  LicenseValidationResponse,
  DeviceDeactivationPayload,
} from "@sparelink/shared";

// TODO: Implement with Fastify
// export async function registerLicenseRoutes(fastify: FastifyInstance) {
//   fastify.post<{ Body: LicenseActivationPayload }>("/api/licenses/activate", async (request, reply) => {
//     // Validate license key format
//     // Check device fingerprint matches DB
//     // Generate activation token
//     // Return license data + nonce for future requests
//   });
//
//   fastify.post<{ Body: LicenseValidationPayload }>("/api/licenses/validate", async (request, reply) => {
//     // Re-validate periodic: license still active?
//     // Check nonce from previous request
//     // Detect clock skew: client_time vs server_time
//     // Return new nonce for next cycle
//   });
//
//   fastify.post<{ Body: DeviceDeactivationPayload }>("/api/licenses/deactivate", async (request, reply) => {
//     // Prepare license for device switch
//     // Decrement rebinding counter
//     // Reset device binding
//   });
//
//   fastify.get<{ Params: { key: string } }>("/api/licenses/status/:key", async (request, reply) => {
//     // Get current license status (for support/debugging)
//   });
// }

export interface LicenseRoutes {
  /**
   * POST /api/licenses/activate
   * Activate license on new device
   * Returns: LicenseValidationResponse with initial nonce
   */
  activateContract: {
    request: LicenseActivationPayload;
    response: LicenseValidationResponse;
  };

  /**
   * POST /api/licenses/validate
   * Periodic license re-validation (background task)
   * Checks if license still valid, detects clock skew
   * Returns: Updated LicenseValidationResponse with new nonce
   */
  validateContract: {
    request: LicenseValidationPayload;
    response: LicenseValidationResponse;
  };

  /**
   * POST /api/licenses/deactivate
   * Deactivate license from device (for switch to new device)
   * Decrements rebinding counter
   */
  deactivateContract: {
    request: DeviceDeactivationPayload;
    response: { success: boolean; message: string };
  };

  /**
   * GET /api/licenses/status/:key
   * Get current license status (public, for support tools)
   */
  statusContract: {
    response: {
      key: string;
      status: string;
      activatedAt: number;
      expiresAt: number;
      deviceId: string;
      resets: { current: number; max: number; resetDate: number };
    };
  };
}
