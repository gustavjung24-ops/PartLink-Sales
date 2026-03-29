import { disconnectDatabase } from "../database/client";
import { licenseService } from "../modules/licenses/services/license.service";

interface CreateLicenseCliArgs {
  customerId: string;
  expiryDays: number;
  maxActivations?: number;
  isTrial: boolean;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function parseArgs(argv: string[]): CreateLicenseCliArgs {
  const argMap = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Thiếu giá trị cho tham số --${key}`);
    }

    argMap.set(key, next);
    index += 1;
  }

  const customerId = argMap.get("customerId")?.trim();
  if (!customerId) {
    throw new Error("Thiếu --customerId");
  }

  const expiryDaysRaw = argMap.get("expiryDays");
  if (!expiryDaysRaw) {
    throw new Error("Thiếu --expiryDays");
  }

  const expiryDays = Number.parseInt(expiryDaysRaw, 10);
  if (!Number.isFinite(expiryDays) || expiryDays <= 0) {
    throw new Error("--expiryDays phải là số nguyên dương");
  }

  const maxActivationsRaw = argMap.get("maxActivations");
  let maxActivations: number | undefined;
  if (maxActivationsRaw !== undefined) {
    maxActivations = Number.parseInt(maxActivationsRaw, 10);
    if (!Number.isFinite(maxActivations) || maxActivations <= 0) {
      throw new Error("--maxActivations phải là số nguyên dương");
    }
  }

  const trialRaw = argMap.get("trial");
  const isTrial = trialRaw ? parseBoolean(trialRaw) : false;

  return {
    customerId,
    expiryDays,
    maxActivations,
    isTrial,
  };
}

function printUsage(): void {
  console.log("Usage:");
  console.log(
    "pnpm --filter @sparelink/api license:create -- --customerId CUST-001 --expiryDays 365 [--maxActivations 3] [--trial true]"
  );
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));

    const license = await licenseService.createLicense({
      customerId: args.customerId,
      expiryDays: args.expiryDays,
      maxActivations: args.maxActivations,
      isTrial: args.isTrial,
    });

    console.log("License created successfully");
    console.log(JSON.stringify({
      licenseKey: license.licenseKey,
      customerId: args.customerId,
      status: license.status,
      isTrial: license.isTrial,
      maxActivations: license.maxActivations,
      expiryDate: license.expiryDate?.toISOString() ?? null,
      createdAt: license.createdAt.toISOString(),
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Create license failed: ${message}`);
    printUsage();
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();
