/**
 * Parts Search & Parsing Routes
 * Platform Layer: Part management contracts before implementing logic
 *
 * Routes:
 * ├── POST   /api/parts/search
 * ├── POST   /api/parts/parse
 * ├── GET    /api/parts/:id
 * └── POST   /api/parts/add-favorite
 */

import type { FastifyInstance } from "fastify";
import { PartCodeParser, PartSourceType } from "@sparelink/shared";
import {
  PaginationParams,
  PartParsePayload,
  PartParseResult,
  PartSearchPayload,
  PartSearchResult,
  ApiErrorCode,
} from "../types";
import { apiError, apiSuccess, handleApiError, validateRequiredFields } from "../errors";
import { prisma } from "../database/client";

const partCodeParser = new PartCodeParser();

function toPartSearchResult(record: {
  id: string;
  code: string;
  product: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    unitPrice: unknown;
    inStock: number;
    updatedAt: Date;
  };
}): PartSearchResult {
  return {
    id: record.product.id ?? record.id,
    partNumber: record.code,
    partCode: record.code,
    name: record.product.name,
    manufacturer: "Unknown",
    category: record.product.category,
    description: record.product.description ?? undefined,
    price: Number(record.product.unitPrice),
    inStock: record.product.inStock > 0,
  };
}

export async function registerPartRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: PartSearchPayload }>("/search", async (request, reply) => {
    const validation = validateRequiredFields(request.body as unknown as Record<string, unknown>, ["query"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    try {
      const normalizedQuery = request.body.query.trim().toLowerCase().replace(/\s+/g, "");
      const limit = Math.min(request.body.limit ?? 10, 50);

      const matches = await prisma.productCode.findMany({
        where: {
          OR: [
            { codeNormalized: { contains: normalizedQuery } },
            { code: { contains: request.body.query, mode: "insensitive" } },
            { product: { name: { contains: request.body.query, mode: "insensitive" } } },
          ],
          ...(request.body.category
            ? { product: { category: { equals: request.body.category, mode: "insensitive" } } }
            : {}),
        },
        include: { product: true },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });

      const results = matches.map((match) => ({
        ...toPartSearchResult(match),
        manufacturer: request.body.manufacturer ?? "Unknown",
      }));

      return reply.code(200).send(
        apiSuccess({
          results,
          pagination: {
            page: 1,
            limit,
          } satisfies PaginationParams,
        })
      );
    } catch (error) {
      return reply.code(500).send(handleApiError(error));
    }
  });

  fastify.post<{ Body: PartParsePayload }>("/parse", async (request, reply) => {
    const validation = validateRequiredFields(request.body as unknown as Record<string, unknown>, ["rawCode"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    const parsed = await partCodeParser.parse(request.body.rawCode, "manual");
    if (!parsed.data) {
      return reply.code(400).send(apiError(ApiErrorCode.INVALID_FORMAT, parsed.error?.message ?? "Unable to parse part code"));
    }

    const response: PartParseResult = {
      success: true,
      partNumber: parsed.data.partNumber,
      manufacturer: parsed.data.manufacturer,
      category: parsed.data.category,
      confidence: parsed.data.confidence,
    };

    return reply.code(200).send(apiSuccess(response));
  });

  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    try {
      const product = await prisma.product.findUnique({
        where: { id: request.params.id },
        include: { productCodes: true },
      });

      if (!product) {
        return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "Part not found"));
      }

      const primaryCode = product.productCodes[0]?.code ?? product.id;
      return reply.code(200).send(
        apiSuccess({
          id: product.id,
          partNumber: primaryCode,
          partCode: primaryCode,
          name: product.name,
          manufacturer: "Unknown",
          category: product.category,
          description: product.description ?? undefined,
          price: Number(product.unitPrice),
          inStock: product.inStock > 0,
          specifications: (product.specsJsonB as Record<string, unknown> | null) ?? {},
          suppliers: [],
          sourceType: PartSourceType.COMPANY_AVAILABLE,
        })
      );
    } catch (error) {
      return reply.code(500).send(handleApiError(error));
    }
  });

  fastify.post<{ Body: { partId?: string } }>("/add-favorite", async (request, reply) => {
    const validation = validateRequiredFields(request.body as Record<string, unknown>, ["partId"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    return reply.code(202).send(apiSuccess({ success: true }));
  });
}

export interface PartRoutes {
  /**
   * POST /api/parts/search
   * Search for parts by query, category, manufacturer
   */
  searchContract: {
    request: PartSearchPayload;
    response: {
      results: PartSearchResult[];
      pagination: PaginationParams;
    };
  };

  /**
   * POST /api/parts/parse
   * Parse raw part code to extract part number, manufacturer, etc.
   */
  parseContract: {
    request: PartParsePayload;
    response: PartParseResult;
  };

  /**
   * GET /api/parts/:id
   * Get detailed part information
   */
  getDetailContract: {
    response: PartSearchResult & {
      specifications?: Record<string, unknown>;
      suppliers?: Array<{ name: string; price: number }>;
    };
  };

  /**
   * POST /api/parts/add-favorite
   * Add part to user's favorites
   */
  addFavoriteContract: {
    request: { partId: string };
    response: { success: boolean };
  };
}
