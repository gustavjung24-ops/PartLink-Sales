import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLicense } from "../../hooks/useLicense";
import { useOfflineStore } from "../../stores/offlineStore";
import { getLicenseBadgeClass, calcDaysRemaining } from "../../lib/licenseUtils";

const RECENT_SEARCHES_KEY = "sparelink:recentSearches";
const MAX_RECENT_SEARCHES = 5;

interface RecentSearchEntry {
  query: string;
  timestamp: number;
}

function loadRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];

    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        return String((item as Partial<RecentSearchEntry>).query ?? "");
      })
      .filter((item) => item.length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function persistSearch(term: string): void {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]") as unknown;
    const normalized = Array.isArray(raw)
      ? raw
          .map((item) => {
            if (typeof item === "string") {
              return { query: item, timestamp: Date.now() } satisfies RecentSearchEntry;
            }

            const entry = item as Partial<RecentSearchEntry>;
            return {
              query: String(entry.query ?? ""),
              timestamp: Number(entry.timestamp ?? Date.now()),
            } satisfies RecentSearchEntry;
          })
          .filter((entry) => entry.query.length > 0)
      : [];

    const updated = [{ query: term, timestamp: Date.now() }, ...normalized.filter((entry) => entry.query !== term)].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([{ query: term, timestamp: Date.now() }]));
  }
}

export function DashboardScreen(): JSX.Element {
  const navigate = useNavigate();
  const { license, state } = useLicense();
  const { isOnline, lastSyncTime, getPendingSyncItems, stats } = useOfflineStore();
  const [quickSearch, setQuickSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());

  const daysRemaining = useMemo(() => calcDaysRemaining(license?.expiresAt ?? null), [license?.expiresAt]);

  // TODO: replace with useQuery when Quotes API is ready
  const pendingQuotes = 0;
  const pendingSync = getPendingSyncItems().length;

  const handleSearch = (q: string) => {
    if (!q.trim()) return;
    persistSearch(q.trim());
    setRecentSearches(loadRecentSearches());
    navigate(`/lookup?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <h1 className="text-2xl font-semibold">Bảng điều khiển</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Theo dõi hoạt động bán hàng, trạng thái giấy phép và đồng bộ thời gian thực.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Báo giá chờ xử lý</p>
          <p className="mt-2 text-3xl font-semibold">{pendingQuotes}</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-600 dark:text-sky-300"
            onClick={() => navigate("/quotes")}
          >
            Mở danh sách báo giá
          </button>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Trạng thái giấy phép</p>
          <span className={["mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold", getLicenseBadgeClass(state, daysRemaining)].join(" ")}>
            {state === "TRIAL" ? `TRIAL (${daysRemaining} ngày)` : state}
          </span>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {state === "ACTIVE" ? "Hệ thống đang hoạt động bình thường." : "Kiểm tra hiệu lực để tránh gián đoạn nghiệp vụ."}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Trạng thái đồng bộ</p>
          <p className="mt-2 text-2xl font-semibold">{isOnline ? "Online" : "Offline"}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Hàng đợi chờ: {pendingSync}</p>
          {lastSyncTime ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lần cuối: {new Date(lastSyncTime).toLocaleString()}
            </p>
          ) : null}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Hiệu suất đồng bộ</p>
          <p className="mt-2 text-2xl font-semibold">{stats.totalSynced}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Lỗi: {stats.totalFailed} | Xung đột: {stats.totalConflicts}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tìm kiếm nhanh</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">⌘/Ctrl + K</span>
          </div>
          <div className="flex gap-2">
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickSearch.trim()) {
                  handleSearch(quickSearch);
                }
              }}
              placeholder="Nhập mã linh kiện hoặc mô tả..."
            />
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              onClick={() => handleSearch(quickSearch)}
            >
              Tìm
            </button>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Tìm kiếm gần đây</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recentSearches.length === 0 ? (
              <li className="text-slate-400 dark:text-slate-500 text-xs">Chưa có lịch sử tìm kiếm.</li>
            ) : (
              recentSearches.map((item) => (
                <li
                  key={item}
                  className="cursor-pointer rounded-md bg-slate-100 px-3 py-2 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                  onClick={() => handleSearch(item)}
                >
                  {item}
                </li>
              ))
            )}
          </ul>
        </article>
      </div>
    </section>
  );
}
