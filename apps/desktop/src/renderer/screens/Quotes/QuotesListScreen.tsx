import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadQuotes, statusLabel, quoteTotal, type Quote } from "./quoteTypes";

function formatPrice(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("vi-VN");
}

export function QuotesListScreen(): JSX.Element {
  const navigate = useNavigate();
  const [quotes] = useState<Quote[]>(loadQuotes);
  const [filter, setFilter] = useState<"all" | Quote["status"]>("all");

  const visible = filter === "all" ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Báo giá</h1>
        <button
          type="button"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          onClick={() => navigate("/quotes/new")}
        >
          + Tạo báo giá mới
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "draft", "sent", "approved", "rejected", "expired"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              filter === s
                ? "border-sky-500 bg-sky-600 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "Tất cả" : statusLabel(s).label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="py-12 text-center text-slate-500">Không có báo giá nào.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Số báo giá</th>
                <th className="px-4 py-3 text-left">Khách hàng</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3 text-left">Ngày tạo</th>
                <th className="px-4 py-3 text-left">Hết hạn</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((q) => {
                const { label, cls } = statusLabel(q.status);
                return (
                  <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{q.title}</td>
                    <td className="px-4 py-3">
                      <p>{q.customerName}</p>
                      <p className="text-xs text-slate-400">{q.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={["rounded-full border px-2 py-0.5 text-xs font-medium", cls].join(" ")}>{label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatPrice(quoteTotal(q))}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(q.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(q.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-sky-600 hover:underline"
                        onClick={() => navigate(`/quotes/${q.id}`)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
