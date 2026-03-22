import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLicense } from "../hooks/useLicense";
import { useOfflineStore } from "../stores/offlineStore";

const recentSearchesSeed = [
  "Turbine NGV-200",
  "Filter F1200 / mã chéo",
  "Valve kit PZ-77",
  "Bơm dầu LPX-9",
];

function statusColor(state: string, daysRemaining: number): string {
  if (state === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (state === "TRIAL" && daysRemaining > 7) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
  }

  if (state === "TRIAL" && daysRemaining <= 7) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { license, state } = useLicense();
  const { isOnline, lastSyncTime, getPendingSyncItems, stats } = useOfflineStore();
  const [quickSearch, setQuickSearch] = useState("");

  const daysRemaining = useMemo(() => {
    if (!license?.expiresAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  }, [license?.expiresAt]);

  const pendingQuotes = 7;
  const pendingSync = getPendingSyncItems().length;

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
          <span className={["mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold", statusColor(state, daysRemaining)].join(" ")}>
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
              placeholder="Nhập mã linh kiện hoặc mô tả..."
            />
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              onClick={() => navigate(`/lookup?q=${encodeURIComponent(quickSearch)}`)}
            >
              Tìm
            </button>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Tìm kiếm gần đây</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recentSearchesSeed.map((item) => (
              <li key={item} className="rounded-md bg-slate-100 px-3 py-2 dark:bg-slate-800">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
