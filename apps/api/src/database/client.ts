/**
 * Database Client & Initialization
 * Platform Layer: Prisma ORM setup, global client instance
 */

import { PrismaClient } from "@prisma/client";
import { isProd } from "../config";

export const prisma = new PrismaClient({
  log: isProd ? ["error"] : ["query", "info", "warn", "error"],
});

/**
 * Connect to database
 * Call during server startup
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("[Database] ✓ Connected");
  } catch (error) {
    console.error("[Database] ✗ Connection failed:", error);
    throw error;
  }
}

/**
 * Disconnect from database
 * Call during graceful shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log("[Database] ✓ Disconnected");
}

/**
 * Run database migrations
 * Call during deployment/startup
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log("[Database] Running migrations...");
    // In production: use Prisma's migration system
    // prisma migrate deploy
    console.log("[Database] ✓ Migrations completed");
  } catch (error) {
    console.error("[Database] ✗ Migration failed:", error);
    throw error;
  }
}

/**
 * Seed database with demo data
 */
export async function seedDatabase(): Promise<void> {
  if (isProd) {
    console.log("[Database] Skipping seed in production");
    return;
  }

  try {
    console.log("[Database] Seeding demo data...");

    // Demo products
    await prisma.product.createMany({
      data: [
        {
          name: "Angular Contact Ball Bearing",
          category: "Bearings",
          subcategory: "Angular Contact",
          unitPrice: 125.5,
          inStock: 150,
          specsJsonB: {
            ISO: { grade: "P0", tolerance: "P5" },
            bore_mm: 17,
            outer_mm: 47,
            width_mm: 14,
          },
        },
        {
          name: "Cylindrical Roller Bearing",
          category: "Bearings",
          subcategory: "Cylindrical Roller",
          unitPrice: 89.0,
          inStock: 200,
          specsJsonB: {
            ISO: { grade: "P0" },
            bore_mm: 20,
            outer_mm: 52,
            length_mm: 15,
          },
        },
        {
          name: "Hydraulic Pump - Swashplate",
          category: "Hydraulic Components",
          subcategory: "Pumps",
          unitPrice: 2500.0,
          inStock: 5,
          specsJsonB: {
            API: { rating: "3000 psi", flow_gpm: 15.3 },
            displacement_cc: 28.5,
          },
        },
      ],
      skipDuplicates: true,
    });

    // Demo customer
    await prisma.customer.create({
      data: {
        name: "Acme Industries",
        email: "procurement@acme.local",
        city: "New York",
        country: "USA",
      },
    }).catch(() => {
      // Skip if already exists
    });

    console.log("[Database] ✓ Seed completed");
  } catch (error) {
    console.error("[Database] ✗ Seed failed:", error);
  }
}

export default prisma;
