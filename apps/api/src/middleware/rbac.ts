import type { FastifyReply, FastifyRequest } from "fastify";

export type Role = "USER" | "SALES" | "SENIOR_SALES" | "ADMIN" | "SUPER_ADMIN";

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
}

type JwtPayload = {
  userId?: string;
  id?: string;
  email?: string;
  role?: Role;
  roles?: Role[];
};

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthenticatedUser | JwtPayload;
};

function normalizeUser(payload: JwtPayload): AuthenticatedUser {
  const roles = Array.isArray(payload.roles)
    ? payload.roles
    : payload.role
      ? [payload.role]
      : [];

  return {
    id: payload.userId ?? payload.id ?? "",
    email: payload.email ?? "",
    roles,
  };
}

export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = normalizeUser((authenticatedRequest.user ?? {}) as JwtPayload);
  } catch {
    reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid token" },
      timestamp: Date.now(),
    });
  }
}

export function roleGuard(allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userRoles = ((request as AuthenticatedRequest).user as AuthenticatedUser | undefined)?.roles ?? [];
    const hasPermission = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasPermission) {
      reply.code(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient role to access this resource" },
        timestamp: Date.now(),
      });
      return;
    }
  };
}
