export const HISTORY_KEY = "sparelink:recentSearches";

export interface HistoryEntry {
  query: string;
  timestamp: number;
}

export function loadSearchHistory(maxItems?: number): HistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) {
      return [];
    }

    const entries = raw
      .map((item) => {
        if (typeof item === "string") {
          return { query: item, timestamp: Date.now() } satisfies HistoryEntry;
        }

        const entry = item as Partial<HistoryEntry>;
        return {
          query: String(entry.query ?? ""),
          timestamp: Number(entry.timestamp ?? Date.now()),
        } satisfies HistoryEntry;
      })
      .filter((entry) => entry.query.length > 0);

    return typeof maxItems === "number" ? entries.slice(0, maxItems) : entries;
  } catch {
    return [];
  }
}

export function persistSearchToHistory(query: string, maxItems = 100): void {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return;
  }

  const existing = loadSearchHistory();
  const updated = [
    { query: normalizedQuery, timestamp: Date.now() },
    ...existing.filter((entry) => entry.query !== normalizedQuery),
  ].slice(0, maxItems);

  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function clearSearchHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
