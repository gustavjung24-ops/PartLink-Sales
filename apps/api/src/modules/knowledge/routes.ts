import type { FastifyInstance } from "fastify";
import { authGuard, roleGuard } from "../../middleware/rbac";

const knowledgeHandler = {
  logGap: async () => ({ logged: true }),
  listGaps: async () => ({ items: [] }),
  uploadDocument: async () => ({ uploaded: true }),
  approveDocument: async () => ({ approved: true }),
  deleteDocument: async () => ({ deleted: true }),
};

export async function registerKnowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/api/knowledge/gaps", knowledgeHandler.logGap);

  fastify.get(
    "/api/knowledge/gaps",
    { preHandler: [authGuard, roleGuard(["ADMIN", "SUPER_ADMIN"])] },
    knowledgeHandler.listGaps
  );

  fastify.post(
    "/api/knowledge/documents",
    { preHandler: [authGuard, roleGuard(["ADMIN", "SUPER_ADMIN"])] },
    knowledgeHandler.uploadDocument
  );

  fastify.patch(
    "/api/knowledge/documents/:id/approve",
    { preHandler: [authGuard, roleGuard(["ADMIN", "SUPER_ADMIN"])] },
    knowledgeHandler.approveDocument
  );

  fastify.delete(
    "/api/knowledge/documents/:id",
    { preHandler: [authGuard, roleGuard(["SUPER_ADMIN"])] },
    knowledgeHandler.deleteDocument
  );
}
