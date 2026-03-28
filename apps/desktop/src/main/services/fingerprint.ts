import { machineId } from "node-machine-id";
import { createHash } from "crypto";
let cached: string | null = null;
export async function getHashedMachineId(): Promise<string> {
  if (cached) return cached;
  const id = await machineId();
  cached = createHash("sha256").update(id).digest("hex");
  return cached;
}
