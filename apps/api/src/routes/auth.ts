/**
 * Authentication Routes
 * Platform Layer: Auth contracts before implementing logic
 *
 * Routes:
 * ├── POST   /api/auth/login
 * ├── POST   /api/auth/logout
 * ├── POST   /api/auth/refresh
 * └── GET    /api/auth/me
 */

import {
  ApiErrorCode,
  ApiResponse,
  AuthLoginPayload,
  AuthLoginResponse,
} from "../types";

// TODO: Implement with Fastify
// export async function registerAuthRoutes(fastify: FastifyInstance) {
//   fastify.post<{ Body: AuthLoginPayload }>("/api/auth/login", async (request, reply) => {
//     const validation = validateRequiredFields(request.body, ["username", "password"]);
//     if (validation) {
//       return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
//     }

//     try {
//       const result = await authService.login(request.body);
//       return reply.code(200).send(apiSuccess(result));
//     } catch (error) {
//       return reply.code(401).send(handleApiError(error));
//     }
//   });

//   fastify.post("/api/auth/logout", async (request, reply) => {
//     // TODO: Implement logout
//     return reply.code(200).send(apiSuccess(null));
//   });

//   fastify.get("/api/auth/me", async (request, reply) => {
//     // TODO: Validate JWT token
//     // TODO: Return current user info
//   });
// }

export interface AuthRoutes {
  /**
   * POST /api/auth/login
   * Login with username and password
   */
  loginContract: {
    request: AuthLoginPayload;
    response: AuthLoginResponse;
  };

  /**
   * POST /api/auth/logout
   * Logout current user
   */
  logoutContract: {
    request: null;
    response: null;
  };

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  refreshContract: {
    request: { refreshToken: string };
    response: { accessToken: string; expiresIn: number };
  };

  /**
   * GET /api/auth/me
   * Get current authenticated user info
   */
  meContract: {
    response: { id: string; username: string; email: string };
  };
}
