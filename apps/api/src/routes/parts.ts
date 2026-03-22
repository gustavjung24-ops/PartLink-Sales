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

import {
  PaginatedResponse,
  PaginationParams,
  PartParsePayload,
  PartParseResult,
  PartSearchPayload,
  PartSearchResult,
} from "../types";

// TODO: Implement with Fastify
// export async function registerPartRoutes(fastify: FastifyInstance) {
//   fastify.post<{ Body: PartSearchPayload }>("/api/parts/search", async (request, reply) => {
//     const validation = validateRequiredFields(request.body, ["query"]);
//     if (validation) {
//       return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
//     }

//     try {
//       const results = await partService.search(request.body);
//       return reply.code(200).send(apiSuccess(results));
//     } catch (error) {
//       return reply.code(500).send(handleApiError(error));
//     }
//   });

//   fastify.post<{ Body: PartParsePayload }>("/api/parts/parse", async (request, reply) => {
//     // TODO: Implement part code parsing
//   });
// }

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
