export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string; message?: string }).message || (data as { error?: string }).error || `Request failed (${res.status})`, res.status, data);
  return data as T;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status, data);
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
  }
}

export const CONF_LABEL: Record<string, { text: string; cls: string; icon: string }> = {
  confirmed: { text: "Confirmed", cls: "b-ok", icon: "✓" },
  historical_pattern: { text: "Usually offered", cls: "b-info", icon: "◐" },
  forecast: { text: "Forecast", cls: "b-neutral", icon: "↗" },
  assumption: { text: "Assumption", cls: "b-warn", icon: "?" },
};
