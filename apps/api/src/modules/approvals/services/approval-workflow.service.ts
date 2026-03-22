/**
 * Approval Workflow Service
 * Platform Layer: Manages approval queues, notifications, and workflow state
 *
 * Workflow states:
 * PENDING → APPROVED | REJECTED
 * Entities: PRODUCT_MAPPING, IMPORT_BATCH
 */

import { prisma } from "../../../database/client";
import { auditRepository } from "../../../database/repositories";
import type { Approval, Prisma, User } from "@prisma/client";

interface ApprovalRequest {
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  requestedById: string;
  reason?: string;
}

interface ApprovalEvent {
  type: "PENDING" | "APPROVED" | "REJECTED";
  approval: Approval;
  approver?: User;
  timestamp: Date;
}

// In-memory event subscribers (replace with pub/sub in production)
const subscribers: Map<string, (event: ApprovalEvent) => void> = new Map();

export class ApprovalWorkflowService {
  /**
   * Submit an approval request
   */
  async submitApprovalRequest(request: ApprovalRequest): Promise<Approval> {
    const approval = await prisma.approval.create({
      data: {
        entityType: request.entityType,
        entityId: request.entityId,
        data: request.data as Prisma.InputJsonValue,
        status: "PENDING",
        requestedBy: request.requestedById,
        requestedAt: new Date(),
      },
    });

    // Log audit
    await auditRepository.logAction(
      "SUBMIT_APPROVAL",
      request.entityType,
      request.entityId,
      request.requestedById,
      { data: request.data, reason: request.reason }
    );

    // Emit event
    this.emitEvent({
      type: "PENDING",
      approval,
      timestamp: new Date(),
    });

    return approval;
  }

  /**
   * Approve a request
   */
  async approveRequest(
    approvalId: string,
    approverId: string,
    reason?: string
  ): Promise<Approval | null> {
    try {
      const approvalUpdate = {
        status: "APPROVED",
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionReason: null,
      } as Prisma.ApprovalUpdateInput & Record<string, unknown>;

      approvalUpdate["approvalNote"] = reason || null;

      const approval = await prisma.approval.update({
        where: { id: approvalId },
        data: approvalUpdate,
        include: { requestedByUser: true },
      });

      // Log audit
      await auditRepository.logAction(
        "APPROVE_APPROVAL",
        approval.entityType,
        approval.entityId,
        approverId,
        { approvalId, reason }
      );

      // Emit event with approver info
      const approver = await prisma.user.findUnique({
        where: { id: approverId },
      });

      this.emitEvent({
        type: "APPROVED",
        approval,
        approver: approver || undefined,
        timestamp: new Date(),
      });

      // Execute post-approval actions
      await this.handleApprovalAction(approval);

      return approval;
    } catch (error) {
      console.error("[ApprovalWorkflow] Approve failed:", error);
      return null;
    }
  }

  /**
   * Reject a request
   */
  async rejectRequest(
    approvalId: string,
    approverId: string,
    reason: string
  ): Promise<Approval | null> {
    try {
      const approval = await prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: "REJECTED",
          approvedBy: approverId,
          approvedAt: new Date(),
          rejectionReason: reason,
        },
      });

      // Log audit
      await auditRepository.logAction(
        "REJECT_APPROVAL",
        approval.entityType,
        approval.entityId,
        approverId,
        { approvalId, reason }
      );

      // Emit event
      this.emitEvent({
        type: "REJECTED",
        approval,
        timestamp: new Date(),
      });

      await this.handleRejectionAction(approval);

      return approval;
    } catch (error) {
      console.error("[ApprovalWorkflow] Reject failed:", error);
      return null;
    }
  }

  /**
   * Get pending approvals by type
   */
  async getPendingApprovals(entityType?: string) {
    return prisma.approval.findMany({
      where: {
        status: "PENDING",
        ...(entityType && { entityType }),
      },
      include: {
        requestedByUser: true,
      },
      orderBy: {
        requestedAt: "asc",
      },
    });
  }

  /**
   * Get approval history for an entity
   */
  async getApprovalHistory(entityType: string, entityId: string) {
    return prisma.approval.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        requestedByUser: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
    });
  }

  /**
   * Get approval count by status
   */
  async getApprovalStats() {
    const [pending, approved, rejected] = await Promise.all([
      prisma.approval.count({ where: { status: "PENDING" } }),
      prisma.approval.count({ where: { status: "APPROVED" } }),
      prisma.approval.count({ where: { status: "REJECTED" } }),
    ]);

    return { pending, approved, rejected };
  }

  /**
   * Handle post-approval actions based on entity type
   */
  private async handleApprovalAction(approval: Approval) {
    if (approval.status !== "APPROVED") return;

    switch (approval.entityType) {
      case "PRODUCT_MAPPING":
        // Update mapping status to APPROVED
        await prisma.productMapping.update({
          where: { id: approval.entityId },
          data: { status: "APPROVED" },
        });
        break;

      case "IMPORT_BATCH":
        {
          const [batchId, rowId] = approval.entityId.split(":");
          if (rowId) {
            await prisma.importRowStaging.update({
              where: { id: rowId },
              data: {
                batchId,
                status: "STAGED",
                processedBy: approval.approvedBy,
                processedAt: approval.approvedAt ?? new Date(),
                rejectionReason: null,
              },
            });
          }
        }
        break;

      default:
        console.warn(`[ApprovalWorkflow] Unknown entity type: ${approval.entityType}`);
    }
  }

  private async handleRejectionAction(approval: Approval) {
    if (approval.status !== "REJECTED") return;

    if (approval.entityType === "IMPORT_BATCH") {
      const [, rowId] = approval.entityId.split(":");
      if (!rowId) return;

      await prisma.importRowStaging.update({
        where: { id: rowId },
        data: {
          status: "REJECTED",
          processedBy: approval.approvedBy,
          processedAt: approval.approvedAt ?? new Date(),
          rejectionReason: approval.rejectionReason,
        },
      }).catch(() => null);
    }
  }

  /**
   * Subscribe to approval events
   */
  subscribe(id: string, callback: (event: ApprovalEvent) => void): () => void {
    subscribers.set(id, callback);

    // Return unsubscribe function
    return () => {
      subscribers.delete(id);
    };
  }

  /**
   * Emit event to all subscribers
   */
  private emitEvent(event: ApprovalEvent) {
    for (const callback of subscribers.values()) {
      try {
        callback(event);
      } catch (error) {
        console.error("[ApprovalWorkflow] Event handler error:", error);
      }
    }
  }
}

// Export singleton instance
export const approvalWorkflowService = new ApprovalWorkflowService();
