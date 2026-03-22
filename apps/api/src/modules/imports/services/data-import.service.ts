/**
 * Data Import Service with Conflict Resolution
 * Platform Layer: Bulk product data import, conflict detection, approval workflow
 *
 * States: NEW → VALIDATED → [CONFLICT → STAGED] → APPLIED | REJECTED
 * Conflict resolution: Manual review, applies at key decision point
 */

import { prisma } from "../../../database/client";
import { auditRepository } from "../../../database/repositories";
import { approvalWorkflowService } from "../../approvals/services/approval-workflow.service";
import type { ImportRowStaging, Prisma } from "@prisma/client";

interface ImportRow {
  code: string;
  name: string;
  category: string;
  unitPrice: number;
  specsJsonB?: Record<string, unknown>;
}

interface ConflictData {
  type: "DUPLICATE_CODE" | "SPEC_MISMATCH" | "PRICE_VARIANCE";
  existingProduct?: Record<string, unknown>;
  proposedData: Record<string, unknown>;
}

interface BatchImportResult {
  batchId: string;
  totalRows: number;
  validated: number;
  conflicts: number;
  applied: number;
  rejected: number;
}

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function readImportRow(value: Prisma.JsonValue | null): ImportRow {
  return (value ?? {}) as unknown as ImportRow;
}

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export class DataImportService {
  /**
   * Create import batch
   */
  async createImportBatch(
    batchId: string,
    rows: ImportRow[],
    createdBy: string
  ): Promise<{ batch: string; rowIds: string[] }> {
    const rowIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const stagingRow = await prisma.importRowStaging.create({
        data: {
          batchId,
          rowNumber: i + 1,
          rawData: toJsonValue(rows[i]),
          status: "NEW",
        },
      });

      rowIds.push(stagingRow.id);
    }

    // Log audit
    await auditRepository.logAction(
      "IMPORT_BATCH_CREATED",
      "IMPORT_BATCH",
      batchId,
      createdBy,
      { totalRows: rows.length, batchId }
    );

    console.log(`[DataImport] Batch ${batchId} created with ${rows.length} rows`);
    return { batch: batchId, rowIds };
  }

  /**
   * Validate import rows
   */
  async validateBatch(batchId: string): Promise<BatchImportResult> {
    const rows = await prisma.importRowStaging.findMany({
      where: { batchId },
    });

    let validated = 0;
    let conflicts = 0;

    for (const row of rows) {
      const data = readImportRow(row.rawData);

      // Basic validation
      if (!data.code || !data.name || !data.category) {
        await prisma.importRowStaging.update({
          where: { id: row.id },
          data: {
            status: "REJECTED",
            rejectionReason: "Missing required fields: code, name, or category",
          },
        });
        continue;
      }

      // Check for conflicts
      const conflict = await this.detectConflict(data);

      if (conflict) {
        await prisma.importRowStaging.update({
          where: { id: row.id },
          data: {
            status: "CONFLICT",
            conflictType: conflict.type,
            conflictData: toJsonValue(conflict),
          },
        });
        conflicts++;
      } else {
        // Mark as validated, ready to test/apply
        await prisma.importRowStaging.update({
          where: { id: row.id },
          data: { status: "VALIDATED" },
        });
        validated++;
      }
    }

    console.log(
      `[DataImport] Batch ${batchId} validated: ${validated} OK, ${conflicts} conflicts`
    );

    return {
      batchId,
      totalRows: rows.length,
      validated,
      conflicts,
      applied: 0,
      rejected: 0,
    };
  }

  /**
   * Detect conflicts with existing products
   */
  private async detectConflict(data: ImportRow, client: PrismaClientLike = prisma): Promise<ConflictData | null> {
    // Check for duplicate code
    const existing = await client.productCode.findUnique({
      where: { codeNormalized: data.code.toLowerCase().replace(/\s+/g, "") },
      include: { product: true },
    });

    if (existing) {
      // Check if specs differ
      const existingSpecs = existing.product.specsJsonB as Record<string, unknown> | null;
      const proposedSpecs = data.specsJsonB || {};

      if (JSON.stringify(existingSpecs) !== JSON.stringify(proposedSpecs)) {
        return {
          type: "SPEC_MISMATCH",
          existingProduct: {
            id: existing.product.id,
            name: existing.product.name,
            category: existing.product.category,
            unitPrice: Number(existing.product.unitPrice),
            specsJsonB: existing.product.specsJsonB as Record<string, unknown> | null,
          },
          proposedData: data as unknown as Record<string, unknown>,
        };
      }

      // Check if price differs significantly (±10%)
      const existingPrice = Number(existing.product.unitPrice);
      const priceVariance = Math.abs(
        (data.unitPrice - existingPrice) / existingPrice
      );

      if (priceVariance > 0.1) {
        return {
          type: "PRICE_VARIANCE",
          existingProduct: {
            id: existing.product.id,
            name: existing.product.name,
            category: existing.product.category,
            unitPrice: Number(existing.product.unitPrice),
            specsJsonB: existing.product.specsJsonB as Record<string, unknown> | null,
          },
          proposedData: data as unknown as Record<string, unknown>,
        };
      }

      // Product already exists identically
      return {
        type: "DUPLICATE_CODE",
        existingProduct: {
          id: existing.product.id,
          name: existing.product.name,
          category: existing.product.category,
          unitPrice: Number(existing.product.unitPrice),
          specsJsonB: existing.product.specsJsonB as Record<string, unknown> | null,
        },
        proposedData: data as unknown as Record<string, unknown>,
      };
    }

    return null;
  }

  /**
   * Approve and apply batch
   */
  async applyBatch(batchId: string, approvedBy: string): Promise<BatchImportResult> {
    const rows = await prisma.importRowStaging.findMany({
      where: { batchId },
    });

    let applied = 0;
    let rejected = 0;

    for (const row of rows) {
      if (row.status === "CONFLICT") {
        await approvalWorkflowService.submitApprovalRequest({
          entityType: "IMPORT_BATCH",
          entityId: `${batchId}:${row.id}`,
          data: {
            conflictType: row.conflictType,
            conflictData: row.conflictData as Prisma.JsonValue,
            rawData: row.rawData as Prisma.JsonValue,
          },
          requestedById: approvedBy,
          reason: "Import conflict requires approval",
        });
        continue;
      }

      if (row.status === "NEW" || row.status === "REJECTED") {
        // Skip rows that are not ready for application
        continue;
      }

      if (row.status !== "VALIDATED" && row.status !== "STAGED") {
        continue;
      }

      try {
        const outcome = await prisma.$transaction(async (tx) => {
          const data = readImportRow(row.rawData);

          if (row.status === "VALIDATED") {
            const latestConflict = await this.detectConflict(data, tx);
            if (latestConflict) {
              await tx.importRowStaging.update({
                where: { id: row.id },
                data: {
                  status: "CONFLICT",
                  conflictType: latestConflict.type,
                  conflictData: toJsonValue(latestConflict),
                  processedBy: approvedBy,
                  processedAt: new Date(),
                },
              });
              return "CONFLICT" as const;
            }
          }

          const normalizedCode = data.code.toLowerCase().replace(/\s+/g, "");
          const existingCode = await tx.productCode.findUnique({
            where: { codeNormalized: normalizedCode },
            include: { product: true },
          });

          if (existingCode) {
            await tx.product.update({
              where: { id: existingCode.product.id },
              data: {
                specsJsonB: toJsonValue(data.specsJsonB || {}),
                unitPrice: data.unitPrice,
              },
            });
          } else {
            await tx.product.create({
              data: {
                name: data.name,
                category: data.category,
                unitPrice: data.unitPrice,
                specsJsonB: toJsonValue(data.specsJsonB || {}),
                productCodes: {
                  create: {
                    code: data.code,
                    codeNormalized: normalizedCode,
                    sourceSystem: "IMPORT",
                  },
                },
              },
            });
          }

          await tx.importRowStaging.update({
            where: { id: row.id },
            data: {
              status: "APPLIED",
              processedBy: approvedBy,
              processedAt: new Date(),
              rejectionReason: null,
            },
          });

          return "APPLIED" as const;
        });

        if (outcome === "APPLIED") {
          applied++;
        }
      } catch (error) {
        console.error(`[DataImport] Error applying row ${row.id}: ${error}`);
        rejected++;

        await prisma.importRowStaging.update({
          where: { id: row.id },
          data: {
            status: "REJECTED",
            rejectionReason: `Error applying row: ${String(error)}`,
          },
        });
      }
    }

    // Log audit
    await auditRepository.logAction(
      "IMPORT_BATCH_APPLIED",
      "IMPORT_BATCH",
      batchId,
      approvedBy,
      { applied, rejected }
    );

    console.log(`[DataImport] Batch ${batchId} applied: ${applied} products, ${rejected} failed`);

    return {
      batchId,
      totalRows: rows.length,
      validated: 0,
      conflicts: 0,
      applied,
      rejected,
    };
  }

  /**
   * Resolve a conflict manually
   */
  async resolveConflict(
    rowId: string,
    decision: "APPLY_OVERRIDE" | "USE_EXISTING" | "REJECT",
    reason: string,
    resolvedBy: string
  ): Promise<ImportRowStaging> {
    let newStatus: "STAGED" | "APPLIED" | "REJECTED" = "STAGED";

    if (decision === "APPLY_OVERRIDE") {
      newStatus = "STAGED";
    } else if (decision === "USE_EXISTING") {
      newStatus = "APPLIED";
    } else {
      newStatus = "REJECTED";
    }

    const updated = await prisma.importRowStaging.update({
      where: { id: rowId },
      data: {
        status: newStatus,
        processedBy: resolvedBy,
        processedAt: new Date(),
        rejectionReason: newStatus === "REJECTED" ? reason : null,
      },
    });

    console.log(`[DataImport] Row ${rowId} conflict resolved: ${decision}`);
    return updated;
  }

  /**
   * Get batch summary
   */
  async getBatchSummary(batchId: string): Promise<BatchImportResult> {
    const rows = await prisma.importRowStaging.findMany({
      where: { batchId },
    });

    const counts: Record<string, number> = {
      NEW: 0,
      VALIDATED: 0,
      CONFLICT: 0,
      STAGED: 0,
      APPLIED: 0,
      REJECTED: 0,
    };

    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status]++;
      }
    }

    return {
      batchId,
      totalRows: rows.length,
      validated: counts.VALIDATED,
      conflicts: counts.CONFLICT,
      applied: counts.APPLIED,
      rejected: counts.REJECTED,
    };
  }
}

// Singleton export
export const dataImportService = new DataImportService();
