import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearSearchHistory, loadSearchHistory, type HistoryEntry } from "../../lib/searchHistory";

function exportToCsv(entries: HistoryEntry[]) {
  const header = "Truy vấn,Thời gian\n";
  const rows = entries.map((e) => `"${e.query.replace(/"/g, '""')}","${new Date(e.timestamp).toISOString()}"`).join("\n");
  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `search-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SearchHistoryScreen(): JSX.Element {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadSearchHistory());
  const [filterText, setFilterText] = useState("");
  const [cleared, setCleared] = useState(false);

  const filtered = useMemo(() => {
    const q = filterText.toLowerCase();
    return entries.filter((e) => !q || e.query.toLowerCase().includes(q));
  }, [entries, filterText]);

  const grouped = useMemo(() => {
    const groups = new Map<string, HistoryEntry[]>();
    for (const e of filtered) {
      const day = new Date(e.timestamp).toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(e);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const handleClear = () => {
    clearSearchHistory();
    setEntries([]);
    setCleared(true);
  };

  const handleRepeat = (query: string) => {
    navigate(`/lookup?q=${encodeURIComponent(query)}`);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Lịch sử tìm kiếm</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            onClick={() => exportToCsv(entries)}
            disabled={entries.length === 0}
          >
            Xuất CSV
          </button>
          <button
            type="button"
            className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300"
            onClick={handleClear}
            disabled={entries.length === 0}
          >
            Xóa toàn bộ
          </button>
        </div>
      </div>

      <input
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Lọc lịch sử..."
      />

      {cleared || entries.length === 0 ? (
        <div className="py-16 text-center">
          <span className="text-4xl">🕐</span>
          <p className="mt-3 text-slate-500">Chưa có lịch sử tìm kiếm.</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-8 text-center text-slate-400">Không tìm thấy kết quả lọc.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEntries]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{day}</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {dayEntries.map((entry) => (
                  <li key={`${entry.query}-${entry.timestamp}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.query}</p>
                      <p className="text-xs text-slate-400">{new Date(entry.timestamp).toLocaleTimeString("vi-VN")}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-sky-300 px-3 py-1 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/40"
                      onClick={() => handleRepeat(entry.query)}
                    >
                      Tìm lại
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
