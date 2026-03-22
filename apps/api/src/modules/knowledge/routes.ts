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
  fastify.post("/gaps", knowledgeHandler.logGap);

  fastify.get(
    "/gaps",
    { preHandler: [authGuard, roleGuard(["ADMIN", "SUPER_ADMIN"])] },
    knowledgeHandler.listGaps
  );

  fastify.post(
    "/documents",
    { preHandler: [authGuard, roleGuard(["ADMIN", "SUPER_ADMIN"])] },
    knowledgeHandler.uploadDocument
  );

  fastify.patch(
    "/documents/:id/approve",
    { preHandler: [authGuard, roleGuard(["ADMIN", "SUPER_ADMIN"])] },
    knowledgeHandler.approveDocument
  );

  fastify.delete(
    "/documents/:id",
    { preHandler: [authGuard, roleGuard(["SUPER_ADMIN"])] },
    knowledgeHandler.deleteDocument
  );
}
