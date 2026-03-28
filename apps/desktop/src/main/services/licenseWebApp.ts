const BUILD_URL = ((import.meta as any)?.env?.VITE_LICENSE_WEBAPP_URL as string) || "";
const BUILD_KEY = ((import.meta as any)?.env?.VITE_LICENSE_API_KEY as string) || "";

function resolveUrl(): string {
  return process.env.VITE_LICENSE_WEBAPP_URL || process.env.LICENSE_WEBAPP_URL || BUILD_URL || "";
}

function resolveKey(): string {
  return process.env.VITE_LICENSE_API_KEY || process.env.LICENSE_API_KEY || BUILD_KEY || "";
}

type Status = "OK" | "ACTIVE" | "INVALID" | "BOUND_OTHER" | "ERROR";

export interface WebAppResp {
  ok: boolean;
  status: Status;
  message?: string;
  data?: any;
}

function joinAction(url: string, action: string): string {
  return url.includes("?")
    ? `${url}&action=${encodeURIComponent(action)}`
    : `${url}?action=${encodeURIComponent(action)}`;
}

export async function callWebApp(
  action: "check" | "activate",
  payload: Record<string, any>
): Promise<WebAppResp> {
  const base = resolveUrl();
  if (!base) {
    throw new Error("LICENSE_WEBAPP_URL not configured");
  }

  const url = joinAction(base, action);
  const key = resolveKey();
  const body = { ...payload, ...(key ? { apiKey: key } : {}) };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal as any,
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: response.ok,
        status: response.ok ? "OK" : "ERROR",
        message: text,
      };
    }
  } finally {
    clearTimeout(timeoutId);
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
