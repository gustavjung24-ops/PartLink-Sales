/**
 * Repository Pattern - Data Access Layer
 * Abstracts Prisma queries into reusable repository classes
 */

import { prisma } from "./client";
import type { Prisma } from "@prisma/client";

/**
 * Base repository class with common CRUD operations
 * T: Entity type
 * M: Prisma Model (delegate)
 */
export abstract class BaseRepository<T = unknown> {
  protected prisma = prisma;

  abstract getDelegate(): any; // Returns prisma.modelName delegate

  /**
   * Find by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.getDelegate().findUnique({
      where: { id },
    });
  }

  /**
   * Find many with filtering, pagination, sorting
   */
  async findMany(
    where?: any,
    options?: {
      take?: number;
      skip?: number;
      orderBy?: any;
    }
  ): Promise<T[]> {
    return this.getDelegate().findMany({
      where,
      take: options?.take || 50,
      skip: options?.skip || 0,
      orderBy: options?.orderBy,
    });
  }

  /**
   * Count records
   */
  async count(where?: any): Promise<number> {
    return this.getDelegate().count({ where });
  }

  /**
   * Create new record
   */
  async create(data: any): Promise<T> {
    return this.getDelegate().create({ data });
  }

  /**
   * Update by ID
   */
  async update(id: string, data: any): Promise<T | null> {
    return this.getDelegate().update({
      where: { id },
      data,
    }).catch(() => null);
  }

  /**
   * Delete by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.getDelegate().delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upsert: create or update
   */
  async upsert(
    where: any,
    create: any,
    update: any
  ): Promise<T> {
    return this.getDelegate().upsert({
      where,
      create,
      update,
    });
  }
}

/**
 * User Repository
 */
export class UserRepository extends BaseRepository {
  getDelegate() {
    return this.prisma.user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });
  }

  async createWithRoles(data: any, roles: string[]) {
    return this.prisma.user.create({
      data: {
        ...data,
        userRoles: {
          create: roles.map((roleName) => ({
            role: {
              connect: { name: roleName },
            },
          })),
        },
      },
      include: { userRoles: { include: { role: true } } },
    });
  }
}

/**
 * Product Repository
 */
export class ProductRepository extends BaseRepository {
  getDelegate() {
    return this.prisma.product;
  }

  async findByCode(code: string) {
    return this.prisma.productCode.findUnique({
      where: { codeNormalized: code.toLowerCase().replace(/\s+/g, "") },
      include: { product: true },
    });
  }

  async search(query: string, limit = 10) {
    // Search using trigram index on code
    return this.prisma.$queryRaw`
      SELECT DISTINCT p.*
      FROM products p
      INNER JOIN product_codes pc ON p.id = pc.product_id
      WHERE pc.code_normalized % ${query.toLowerCase()}
      ORDER BY similarity(pc.code_normalized, ${query.toLowerCase()}) DESC
      LIMIT ${limit}
    `;
  }
}

/**
 * License Repository
 */
export class LicenseRepository extends BaseRepository {
  getDelegate() {
    return this.prisma.license;
  }

  async findByKey(licenseKey: string) {
    return this.prisma.license.findUnique({
      where: { licenseKey },
      include: { activations: true },
    });
  }

  async getActiveCount() {
    return this.prisma.license.count({
      where: { status: "ACTIVATED" },
    });
  }
}

/**
 * Quote Repository
 */
export class QuoteRepository extends BaseRepository {
  getDelegate() {
    return this.prisma.quote;
  }

  async findFullQuote(id: string) {
    return this.prisma.quote.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: true,
        lineItems: {
          include: { product: true },
        },
      },
    });
  }

  async findByCustomer(customerId: string) {
    return this.prisma.quote.findMany({
      where: { customerId },
      include: {
        customer: true,
        lineItems: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

/**
 * Approval Repository
 */
export class ApprovalRepository extends BaseRepository {
  getDelegate() {
    return this.prisma.approval;
  }

  async findPendingByType(entityType: string) {
    return this.prisma.approval.findMany({
      where: {
        status: "PENDING",
        entityType,
      },
      include: { requestedByUser: true },
      orderBy: { requestedAt: "asc" },
    });
  }
}

/**
 * Audit Log Repository
 */
export class AuditLogRepository extends BaseRepository {
  getDelegate() {
    return this.prisma.auditLog;
  }

  async logAction(
    action: string,
    entityType: string,
    entityId: string | null,
    userId: string | null,
    changes?: any,
    context?: { ipAddress?: string; userAgent?: string }
  ) {
    return this.prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        changes: changes || {},
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    });
  }
}

// Export singleton instances
export const userRepository = new UserRepository();
export const productRepository = new ProductRepository();
export const licenseRepository = new LicenseRepository();
export const quoteRepository = new QuoteRepository();
export const approvalRepository = new ApprovalRepository();
export const auditRepository = new AuditLogRepository();
