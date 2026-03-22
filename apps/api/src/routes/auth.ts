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
import {
  ApiErrorCode,
  AuthLoginPayload,
  AuthLoginResponse,
  AuthTokenPayload,
} from "../types";
import { apiError, apiSuccess } from "../errors";

type UserRole = AuthTokenPayload["role"];

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
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "sparelink-dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "sparelink-dev-refresh-secret";

const users: UserRecord[] = [
  {
    id: "u-viewer-01",
    username: "viewer",
    email: "viewer@sparelink.local",
    password: "Password@123",
    role: "viewer",
    permissions: ["search:read"],
  },
  {
    id: "u-sales-01",
    username: "sales",
    email: "sales@sparelink.local",
    password: "Password@123",
    role: "sales",
    permissions: ["search:read", "quotes:write"],
  },
  {
    id: "u-manager-01",
    username: "manager",
    email: "manager@sparelink.local",
    password: "Password@123",
    role: "manager",
    permissions: ["search:read", "quotes:write", "approvals:write"],
  },
  {
    id: "u-admin-01",
    username: "admin",
    email: "admin@sparelink.local",
    password: "Password@123",
    role: "admin",
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
      role: user.role,
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
      role: user.role,
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
    role: (decoded.role as AuthTokenPayload["role"]) ?? "viewer",
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
          role: payload.role,
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
