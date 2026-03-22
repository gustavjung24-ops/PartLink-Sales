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

import jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";
import { config } from "../config";
import {
  ApiErrorCode,
  AuthLoginPayload,
  AuthLoginResponse,
  AuthTokenPayload,
  UserRole,
} from "../types";
import { apiError, apiSuccess } from "../errors";

interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  permissions: string[];
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const ACCESS_SECRET = config.jwtSecret;
const REFRESH_SECRET = config.jwtRefreshSecret;

const users: UserRecord[] = [
  {
    id: "u-user-01",
    username: "user",
    email: "user@sparelink.local",
    password: "Password@123",
    role: "USER",
    permissions: ["search:read"],
  },
  {
    id: "u-sales-01",
    username: "sales",
    email: "sales@sparelink.local",
    password: "Password@123",
    role: "SALES",
    permissions: ["search:read", "quotes:write"],
  },
  {
    id: "u-senior-01",
    username: "senior",
    email: "senior@sparelink.local",
    password: "Password@123",
    role: "SENIOR_SALES",
    permissions: ["search:read", "quotes:write", "approvals:write"],
  },
  {
    id: "u-admin-01",
    username: "admin",
    email: "admin@sparelink.local",
    password: "Password@123",
    role: "ADMIN",
    permissions: ["*"],
  },
  {
    id: "u-superadmin-01",
    username: "superadmin",
    email: "superadmin@sparelink.local",
    password: "Password@123",
    role: "SUPER_ADMIN",
    permissions: ["*"],
  },
];

const refreshAllowList = new Set<string>();

function createAccessToken(user: UserRecord): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: [user.role],
      permissions: user.permissions,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );
}

function createRefreshToken(user: UserRecord): string {
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      roles: [user.role],
      permissions: user.permissions,
      type: "refresh",
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
  );

  refreshAllowList.add(token);
  return token;
}

function decodeToken(token: string, secret: string): AuthTokenPayload {
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

  return {
    userId: String(decoded.userId ?? ""),
    username: String(decoded.username ?? ""),
    email: String(decoded.email ?? ""),
    roles: Array.isArray(decoded.roles) ? decoded.roles.map((role) => String(role) as UserRole) : ["USER"],
    permissions: Array.isArray(decoded.permissions) ? decoded.permissions.map(String) : [],
    iat: Number(decoded.iat ?? 0),
    exp: Number(decoded.exp ?? 0),
  };
}

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: AuthLoginPayload }>("/api/auth/login", async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply
        .code(400)
        .send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, "Missing required username or password"));
    }

    const normalized = username.toLowerCase();
    const user = users.find(
      (item) => item.username.toLowerCase() === normalized || item.email.toLowerCase() === normalized
    );

    if (!user || user.password !== password) {
      return reply
        .code(401)
        .send(apiError(ApiErrorCode.INVALID_CREDENTIALS, "Invalid username/email or password"));
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    const response: AuthLoginResponse = {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };

    return reply.code(200).send(apiSuccess(response));
  });

  fastify.post<{ Body: { refreshToken?: string } }>("/api/auth/logout", async (request, reply) => {
    const refreshToken = request.body?.refreshToken;
    if (refreshToken) {
      refreshAllowList.delete(refreshToken);
    }

    return reply.code(200).send(apiSuccess({ revoked: true }));
  });

  fastify.post<{ Body: { refreshToken?: string } }>("/api/auth/refresh", async (request, reply) => {
    const refreshToken = request.body?.refreshToken;

    if (!refreshToken) {
      return reply
        .code(400)
        .send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, "Missing refresh token"));
    }

    if (!refreshAllowList.has(refreshToken)) {
      return reply.code(401).send(apiError(ApiErrorCode.UNAUTHORIZED, "Refresh token revoked"));
    }

    try {
      const payload = decodeToken(refreshToken, REFRESH_SECRET);
      const user = users.find((item) => item.id === payload.userId);

      if (!user) {
        return reply.code(401).send(apiError(ApiErrorCode.UNAUTHORIZED, "User not found"));
      }

      const accessToken = createAccessToken(user);
      return reply.code(200).send(
        apiSuccess({
          accessToken,
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        })
      );
    } catch {
      refreshAllowList.delete(refreshToken);
      return reply.code(401).send(apiError(ApiErrorCode.TOKEN_EXPIRED, "Refresh token expired or invalid"));
    }
  });

  fastify.get("/api/auth/me", async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send(apiError(ApiErrorCode.UNAUTHORIZED, "Missing bearer token"));
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const payload = decodeToken(token, ACCESS_SECRET);
      return reply.code(200).send(
        apiSuccess({
          id: payload.userId,
          username: payload.username,
          email: payload.email,
          role: payload.roles[0] ?? "USER",
          permissions: payload.permissions,
        })
      );
    } catch {
      return reply.code(401).send(apiError(ApiErrorCode.TOKEN_EXPIRED, "Access token expired or invalid"));
    }
  });
}

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
