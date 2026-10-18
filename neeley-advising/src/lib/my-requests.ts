const KEY = "neeley.requests.v1";

/** The ids of requests this browser sent, so a student can see their status without signing in. */
export function rememberRequest(id: string): void {
  try {
    const ids = recallRequests();
    if (!ids.includes(id)) localStorage.setItem(KEY, JSON.stringify([id, ...ids].slice(0, 20)));
  } catch {
    /* storage can be blocked */
  }
}

export function recallRequests(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
