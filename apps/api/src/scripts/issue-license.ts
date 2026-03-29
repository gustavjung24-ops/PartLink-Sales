import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface CliArgs {
  customerId: string;
  expiryDate: string;
  maxActivations: number;
  isTrial: boolean;
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  pnpm license:issue -- <customerId> <expiryDate:YYYY-MM-DD> [maxActivations] [isTrial]");
  console.log("");
  console.log("Example (1 key, 1 machine, expires on 2026-12-31):");
  console.log("  pnpm license:issue -- CUST-ACME-001 2026-12-31 1 false");
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.length < 2) {
    printUsage();
    throw new Error("Missing required arguments");
  }

  const customerId = argv[0].trim();
  const expiryDate = argv[1].trim();
  const maxActivations = argv[2] ? Number(argv[2]) : 1;
  const isTrial = argv[3] ? parseBoolean(argv[3]) : false;

  if (!customerId) {
    throw new Error("customerId is required");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    throw new Error("expiryDate must be in YYYY-MM-DD format");
  }

  if (!Number.isFinite(maxActivations) || maxActivations < 1) {
    throw new Error("maxActivations must be a positive number");
  }

  return {
    customerId,
    expiryDate,
    maxActivations,
    isTrial,
  };
}

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}`);
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    process.env[key] = value;
  }
}

function calculateExpiryDays(expiryDate: string): number {
  const target = new Date(`${expiryDate}T23:59:59.999`);
  if (Number.isNaN(target.getTime())) {
    throw new Error("Invalid expiryDate");
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = target.getTime() - Date.now();
  const days = Math.ceil(diffMs / msPerDay);

  if (days < 1) {
    throw new Error("expiryDate must be in the future");
  }

  return days;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = path.resolve(scriptDir, "../..");
  const envPath = path.resolve(apiRoot, ".env");

  loadEnvFile(envPath);

  const expiryDays = calculateExpiryDays(args.expiryDate);

  const [{ licenseService }, { prisma }] = await Promise.all([
    import("../modules/licenses/services/license.service.ts"),
    import("../database/client.ts"),
  ]);

  try {
    const license = await licenseService.createLicense({
      customerId: args.customerId,
      expiryDays,
      maxActivations: args.maxActivations,
      isTrial: args.isTrial,
    });

    console.log(`LICENSE_KEY=${license.licenseKey}`);
    console.log(`CUSTOMER_ID=${args.customerId}`);
    console.log(`EXPIRES_ON=${args.expiryDate}`);
    console.log(`EXPIRY_DAYS=${expiryDays}`);
    console.log(`MAX_ACTIVATIONS=${args.maxActivations}`);
    console.log(`IS_TRIAL=${args.isTrial}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[license:issue] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
