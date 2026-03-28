const WEBAPP_URL =
  (process.env.VITE_LICENSE_WEBAPP_URL as string) ||
  (process.env.LICENSE_WEBAPP_URL as string);
const API_KEY =
  (process.env.VITE_LICENSE_API_KEY as string) ||
  (process.env.LICENSE_API_KEY as string);

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
  if (!WEBAPP_URL) {
    throw new Error("LICENSE_WEBAPP_URL not set");
  }

  const url = joinAction(WEBAPP_URL, action);
  const body = { ...payload, ...(API_KEY ? { apiKey: API_KEY } : {}) };
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
