/**
 * API Server Entry Point
 * Platform Layer: Fastify-based REST API server
 *
 * Project Structure:
 * ├── src/
 * │   ├── main.ts              (this file - server entry)
 * │   ├── types.ts             (API contracts)
 * │   ├── errors.ts            (error handling)
 * │   ├── config.ts            (environment variables)
 * │   ├── middleware/          (Auth, logging, etc.)
 * │   ├── routes/              (API endpoints)
 * │   │   ├── auth.ts
 * │   │   ├── products.ts
 * │   │   ├── quotes.ts
 * │   │   ├── licenses.ts
 * │   │   └── health.ts
 * │   ├── modules/             (Business logic & services)
 * │   └── database/            (ORM, repositories config)
 */

import Fastify from "fastify";
import fastifyCorss from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import pino from "pino";
import { config } from "./config";
import { connectDatabase, disconnectDatabase, runMigrations, seedDatabase } from "./database/client";

const logger = pino({
  level: config.logLevel,
});

/**
 * Initialize and start Fastify server
 */
async function startServer() {
  try {
    logger.info("[Server] Starting SPARELINK API...");
    logger.info(`[Server] Environment: ${config.nodeEnv}`);
    logger.info(`[Server] Port: ${config.port}`);

    // Connect to database
    await connectDatabase();
    
    // Run migrations (only in dev/demo mode)
    if (!config.isProd) {
      await runMigrations();
      await seedDatabase();
    }

    // Initialize Fastify
    const app = Fastify({
      logger: config.isDev,
      trustProxy: config.isProd,
    });

    // Register CORS
    await app.register(fastifyCorss, {
      origin: config.corsOrigin.split(","),
      credentials: true,
    });

    // Register JWT
    await app.register(fastifyJwt, {
      secret: config.jwtSecret,
    });

    // Health check endpoint
    app.get("/health", async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }));

    // API version endpoint
    app.get("/api/version", async () => ({
      version: "1.0.0",
      environment: config.nodeEnv,
    }));

    // TODO: Register route modules:
    // await app.register(registerAuthRoutes, { prefix: "/api/auth" });
    // await app.register(registerProductRoutes, { prefix: "/api/products" });
    // await app.register(registerQuoteRoutes, { prefix: "/api/quotes" });
    // await app.register(registerLicenseRoutes, { prefix: "/api/licenses" });
    // await app.register(registerApprovalRoutes, { prefix: "/api/approvals" });

    // Global error handler
    app.setErrorHandler((error, request, reply) => {
      logger.error({
        method: request.method,
        url: request.url,
        statusCode: error.statusCode || 500,
        message: error.message,
      });

      reply.status(error.statusCode || 500).send({
        error: {
          message: error.message,
          code: error.code || "INTERNAL_SERVER_ERROR",
        },
      });
    });

    // Graceful shutdown handling
    process.on("SIGTERM", async () => {
      logger.info("[Server] SIGTERM received, shutting down gracefully...");
      await app.close();
      await disconnectDatabase();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("[Server] SIGINT received, shutting down gracefully...");
      await app.close();
      await disconnectDatabase();
      process.exit(0);
    });

    // Start server
    await app.listen({ port: config.port, host: config.host });
    logger.info(`[Server] ✓ Listening on http://${config.host}:${config.port}`);

  } catch (error) {
    logger.error("[Server] Fatal error:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
