import type { FastifyInstance } from "fastify";
import { approvalWorkflowService } from "./services/approval-workflow.service";
import { authGuard, roleGuard } from "../../middleware/rbac";
import { apiError, apiSuccess, validateRequiredFields } from "../../errors";
import { ApiErrorCode } from "../../types";

export async function registerApprovalRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/",
    { preHandler: [authGuard, roleGuard(["SENIOR_SALES", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const query = request.query as { entityType?: string };
      const items = await approvalWorkflowService.getPendingApprovals(query.entityType);
      return reply.code(200).send(apiSuccess(items));
    }
  );

  fastify.get(
    "/:entityType/:entityId/history",
    { preHandler: [authGuard, roleGuard(["SENIOR_SALES", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const params = request.params as { entityType?: string; entityId?: string };
      if (!params.entityType || !params.entityId) {
        return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, "Missing entityType or entityId"));
      }

      const history = await approvalWorkflowService.getApprovalHistory(params.entityType, params.entityId);
      return reply.code(200).send(apiSuccess(history));
    }
  );

  fastify.patch(
    "/:id/approve",
    { preHandler: [authGuard, roleGuard(["SENIOR_SALES", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const body = (request.body ?? {}) as { approverId?: string; reason?: string };

      if (!params.id) {
        return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, "Missing approval id"));
      }

      const missing = validateRequiredFields(body as Record<string, unknown>, ["approverId"]);
      if (missing) {
        return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, missing));
      }

      const approval = await approvalWorkflowService.approveRequest(params.id, body.approverId!, body.reason);
      if (!approval) {
        return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "Approval request not found"));
      }

      return reply.code(200).send(apiSuccess(approval));
    }
  );

  fastify.patch(
    "/:id/reject",
    { preHandler: [authGuard, roleGuard(["SENIOR_SALES", "ADMIN", "SUPER_ADMIN"])] },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const body = (request.body ?? {}) as { approverId?: string; reason?: string };

      if (!params.id) {
        return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, "Missing approval id"));
      }

      const missing = validateRequiredFields(body as Record<string, unknown>, ["approverId", "reason"]);
      if (missing) {
        return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, missing));
      }

      const approval = await approvalWorkflowService.rejectRequest(params.id, body.approverId!, body.reason!);
      if (!approval) {
        return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "Approval request not found"));
      }

      return reply.code(200).send(apiSuccess(approval));
    }
  );
}
