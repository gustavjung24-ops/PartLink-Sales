const WEBAPP_URL =
  (process.env.VITE_LICENSE_WEBAPP_URL as string) ||
  process.env.LICENSE_WEBAPP_URL;
const API_KEY =
  (process.env.VITE_LICENSE_API_KEY as string) ||
  process.env.LICENSE_API_KEY;

type Status = "OK" | "ACTIVE" | "INVALID" | "BOUND_OTHER" | "ERROR";
export interface WebAppResp {
  ok: boolean;
  status: Status;
  message?: string;
  data?: unknown;
}

async function callWebApp(
  action: "check" | "activate",
  payload: Record<string, unknown>
): Promise<WebAppResp> {
  if (!WEBAPP_URL) throw new Error("LICENSE_WEBAPP_URL not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(
      `${WEBAPP_URL}?action=${encodeURIComponent(action)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal as AbortSignal,
      }
    );
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: res.ok, status: res.ok ? "OK" : "ERROR", message: text };
    }
  } finally {
    clearTimeout(timer);
  }
}

export function checkLicense(licenseKey: string, softwareName: string) {
  return callWebApp("check", { licenseKey, softwareName });
}
export function activateLicense(
  licenseKey: string,
  machineId: string,
  softwareName: string,
  customer?: string,
  phone?: string
) {
  return callWebApp("activate", {
    licenseKey,
    machineId,
    softwareName,
    customer,
    phone,
  });
}
