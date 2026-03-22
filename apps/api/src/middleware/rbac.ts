import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";

export type Role = "USER" | "SALES" | "SENIOR_SALES" | "ADMIN" | "SUPER_ADMIN";

interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
}

// Type-safe request with user
type AuthenticatedRequest = FastifyRequest & {
  user?: AuthenticatedUser;
};

export function authGuard(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid bearer token" },
      timestamp: Date.now(),
    });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  const roleSegment = token.split(".")[1] || "USER";
  const role = roleSegment.toUpperCase() as Role;

  const authRequest = request as AuthenticatedRequest;
  authRequest.user = {
    id: "mock-user-id",
    email: "mock@sparelink.local",
    roles: [role],
  };

  done();
}

export function roleGuard(allowedRoles: Role[]) {
  return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
    const authRequest = request as AuthenticatedRequest;
    const userRoles = authRequest.user?.roles ?? [];
    const hasPermission = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasPermission) {
      reply.code(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient role to access this resource" },
        timestamp: Date.now(),
      });
      return;
    }

    done();
  };
}
