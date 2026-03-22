import { useOfflineStore } from "../../stores/offlineStore";
import { useSyncManager } from "../../services/SyncManager";

export function SyncStatusScreen(): JSX.Element {
  const syncManager = useSyncManager();
  const config = syncManager.getConfig();
  const {
    isOnline,
    lastSyncTime,
    syncQueue,
    conflicts,
    stats,
    clearSyncQueue,
    clearConflicts,
    removeConflict,
  } = useOfflineStore();

  const pending = syncQueue.filter((i) => i.status === "pending");
  const failed = syncQueue.filter((i) => i.status === "failed");
  const syncing = syncQueue.filter((i) => i.status === "syncing");

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trạng thái đồng bộ</h1>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${
            isOnline
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Đã đồng bộ", value: stats.totalSynced, color: "text-emerald-600" },
          { label: "Thất bại", value: stats.totalFailed, color: "text-rose-600" },
          { label: "Xung đột", value: stats.totalConflicts, color: "text-amber-600" },
          { label: "Trong hàng đợi", value: syncQueue.length, color: "text-sky-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {lastSyncTime ? (
        <p className="text-xs text-slate-500">
          Đồng bộ lần cuối: {new Date(lastSyncTime).toLocaleString("vi-VN")}
        </p>
      ) : (
        <p className="text-xs text-slate-400">Chưa đồng bộ lần nào trong phiên này.</p>
      )}

      {/* Sync queue */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-semibold">Hàng đợi đồng bộ</h2>
          {syncQueue.length > 0 && (
            <button
              type="button"
              onClick={clearSyncQueue}
              className="text-xs text-rose-600 hover:underline dark:text-rose-400"
            >
              Xóa toàn bộ
            </button>
          )}
        </div>

        {syncQueue.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-slate-400">Hàng đợi trống.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...syncing, ...pending, ...failed].map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium font-mono">{item.action} · {item.resource}</p>
                  <p className="text-xs text-slate-400">Thử lại: {item.retryCount} · ID: {item.id.slice(0, 12)}…</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.status === "syncing" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" :
                  item.status === "failed" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" :
                  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                }`}>
                  {item.status === "syncing" ? "Đang xử lý" : item.status === "failed" ? "Thất bại" : "Chờ"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Xung đột dữ liệu ({conflicts.length})
            </h2>
            <button
              type="button"
              onClick={clearConflicts}
              className="text-xs text-amber-700 hover:underline dark:text-amber-300"
            >
              Xóa tất cả
            </button>
          </div>
          <ul className="divide-y divide-amber-200 dark:divide-amber-800">
            {conflicts.map((c) => (
              <li key={c.itemId} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-mono">{c.itemId}</p>
                <button
                  type="button"
                  onClick={() => removeConflict(c.itemId)}
                  className="text-xs text-amber-600 hover:underline dark:text-amber-400"
                >
                  Bỏ qua
                </button>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-3 text-xs text-amber-700 dark:text-amber-400">
            Xung đột xảy ra khi cùng một bản ghi được sửa ở cả local và server. Chiến lược hiện tại: <strong>{config.conflictStrategy}</strong>.
          </p>
        </div>
      )}
    </section>
  );
}
