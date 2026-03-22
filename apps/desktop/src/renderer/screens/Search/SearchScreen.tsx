import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOfflineStore } from "../../stores/offlineStore";
import type { PartResult, ResultSource, SearchFilters } from "./searchTypes";
import { EMPTY_FILTERS, MOCK_RESULTS } from "./searchTypes";

/* ─── helpers ─────────────────────────────────────────────────────────── */

function sourceBadge(source: ResultSource): { label: string; cls: string } {
  switch (source) {
    case "COMPANY_AVAILABLE":
      return { label: "Hàng Công Ty (Có sẵn)", cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" };
    case "COMPANY_ORDERABLE":
      return { label: "Hàng Công Ty (Đặt hàng)", cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" };
    case "INTERNAL_REPLACEMENT":
      return { label: "Thay Thế Nội Bộ", cls: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300" };
    case "AI_SUGGESTED_EXTERNAL":
      return { label: "Đề xuất AI", cls: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
  }
}

function cardBorder(source: ResultSource): string {
  if (source === "AI_SUGGESTED_EXTERNAL") return "border-dashed border-amber-300 dark:border-amber-700";
  if (source === "INTERNAL_REPLACEMENT") return "border-sky-200 dark:border-sky-800";
  return "border-slate-200 dark:border-slate-800";
}

function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(price);
}

function confidenceBar(score: number): string {
  if (score >= 0.9) return "bg-emerald-500";
  if (score >= 0.7) return "bg-amber-500";
  return "bg-rose-500";
}

/* ─── sub-components ───────────────────────────────────────────────────── */

function SectionHeader({ icon, title, tooltip }: { icon: string; title: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-3 flex items-center gap-2">
      <span>{icon}</span>
      <h2 className="text-base font-semibold">{title}</h2>
      <button
        type="button"
        className="relative text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        aria-label="Thông tin nguồn"
      >
        ⓘ
        {show ? (
          <div className="absolute left-6 top-0 z-10 w-56 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {tooltip}
          </div>
        ) : null}
      </button>
    </div>
  );
}

function PartCard({ part, onAddToQuote, onViewDetail }: { part: PartResult; onAddToQuote: (p: PartResult) => void; onViewDetail: (p: PartResult) => void }) {
  const badge = sourceBadge(part.source);
  return (
    <article
      className={["rounded-xl border bg-white p-4 transition hover:shadow-md dark:bg-slate-900", cardBorder(part.source)].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={["rounded-full border px-2 py-0.5 text-[11px] font-medium", badge.cls].join(" ")}>{badge.label}</span>
            {part.requiresApproval ? (
              <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300">⚠ Cần phê duyệt</span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-semibold">{part.partNumber}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{part.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">{part.manufacturer} · {part.category}</p>
          {part.description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{part.description}</p> : null}
          {part.crossRefCode ? <p className="mt-1 text-xs text-slate-400">Mã tham chiếu: {part.crossRefCode}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold">{formatPrice(part.price)}</p>
          <p className={["mt-0.5 text-xs font-medium", part.inStock ? "text-emerald-600" : "text-slate-400"].join(" ")}>
            {part.inStock ? `Còn ${part.stockQty ?? "?"}` : "Hết hàng"}
          </p>
        </div>
      </div>

      {part.source === "AI_SUGGESTED_EXTERNAL" ? (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Độ tin cậy AI</span>
            <span>{Math.round(part.confidence * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className={["h-full rounded-full", confidenceBar(part.confidence)].join(" ")} style={{ width: `${part.confidence * 100}%` }} />
          </div>
          <p className="mt-1 text-[10px] italic text-amber-700 dark:text-amber-400">
            ⚠ Kết quả từ AI bên ngoài — chưa xác minh tương thích. Yêu cầu phê duyệt trước khi báo giá.
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={() => onViewDetail(part)}
        >
          Chi tiết
        </button>
        {!part.requiresApproval ? (
          <button
            type="button"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
            onClick={() => onAddToQuote(part)}
          >
            + Thêm vào báo giá
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40"
            onClick={() => onAddToQuote(part)}
          >
            Yêu cầu phê duyệt
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl">🔍</span>
      <p className="mt-4 text-lg font-semibold">Không tìm thấy kết quả</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {query ? `Không có sản phẩm nào khớp với "${query}".` : "Nhập mã linh kiện hoặc mô tả để bắt đầu."}
      </p>
    </div>
  );
}

/* ─── main screen ──────────────────────────────────────────────────────── */

export function SearchScreen(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToSyncQueue } = useOfflineStore();

  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [committed, setCommitted] = useState(initialQ);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  /* ── Filtering mock data ── */
  const results = useMemo(() => {
    if (!committed.trim()) return [];
    const q = committed.toLowerCase();
    return MOCK_RESULTS.filter((p) => {
      const matchQ =
        p.partNumber.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.crossRefCode?.toLowerCase().includes(q) ?? false);
      const matchMfr = !filters.manufacturer || p.manufacturer.toLowerCase().includes(filters.manufacturer.toLowerCase());
      const matchCat = !filters.category || p.category.toLowerCase().includes(filters.category.toLowerCase());
      const matchAvail = filters.availability === "all" || p.inStock;
      return matchQ && matchMfr && matchCat && matchAvail;
    });
  }, [committed, filters]);

  const companyResults = results.filter((p) => p.source === "COMPANY_AVAILABLE" || p.source === "COMPANY_ORDERABLE");
  const internalResults = results.filter((p) => p.source === "INTERNAL_REPLACEMENT");
  const aiResults = results.filter((p) => p.source === "AI_SUGGESTED_EXTERNAL");

  const manufacturers = useMemo(() => Array.from(new Set(MOCK_RESULTS.map((p) => p.manufacturer))).sort(), []);
  const categories = useMemo(() => Array.from(new Set(MOCK_RESULTS.map((p) => p.category))).sort(), []);

  const handleSearch = () => {
    const q = query.trim();
    setCommitted(q);
    if (q) setSearchParams({ q }, { replace: true });
    // Record in offline sync queue for history
    if (q) {
      addToSyncQueue({ action: "search", resource: "part_search", data: { query: q, timestamp: new Date().toISOString() } });
    }
  };

  const handleAddToQuote = (part: PartResult) => {
    setAddedIds((prev) => new Set([...prev, part.id]));
    navigate(`/quotes/new?partId=${part.id}`);
  };

  const handleViewDetail = (part: PartResult) => {
    navigate(`/parts/${part.id}`);
  };

  return (
    <section className="space-y-4">
      {/* Search bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="mb-3 text-xl font-semibold">Tra mã & Quy đổi linh kiện</h1>
        <div className="flex gap-2">
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Nhập mã linh kiện, mô tả hoặc mã tham chiếu chéo..."
            autoFocus
          />
          <button
            type="button"
            className="shrink-0 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            onClick={handleSearch}
            disabled={!query.trim()}
          >
            Tìm kiếm
          </button>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            value={filters.manufacturer}
            onChange={(e) => setFilters((f) => ({ ...f, manufacturer: e.target.value }))}
          >
            <option value="">Tất cả nhà sản xuất</option>
            {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            value={filters.availability}
            onChange={(e) => setFilters((f) => ({ ...f, availability: e.target.value as SearchFilters["availability"] }))}
          >
            <option value="all">Tất cả tình trạng</option>
            <option value="in_stock">Chỉ còn hàng</option>
          </select>
          {(filters.manufacturer || filters.category || filters.availability !== "all") ? (
            <button type="button" className="text-xs text-sky-600 hover:underline" onClick={() => setFilters(EMPTY_FILTERS)}>
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {!committed.trim() ? (
        <EmptyState query="" />
      ) : results.length === 0 ? (
        <EmptyState query={committed} />
      ) : (
        <div className="space-y-6">
          {/* Company */}
          {companyResults.length > 0 ? (
            <div>
              <SectionHeader
                icon="🟢"
                title={`Hàng Công Ty (${companyResults.length})`}
                tooltip="Sản phẩm do công ty cung cấp trực tiếp — dữ liệu có thẩm quyền từ hệ thống kho."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {companyResults.map((p) => (
                  <PartCard key={p.id} part={p} onAddToQuote={handleAddToQuote} onViewDetail={handleViewDetail} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Internal */}
          {internalResults.length > 0 ? (
            <div>
              <SectionHeader
                icon="🔵"
                title={`Thay Thế Nội Bộ (${internalResults.length})`}
                tooltip="Linh kiện thay thế đã được bộ phận kỹ thuật phê duyệt nội bộ."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {internalResults.map((p) => (
                  <PartCard key={p.id} part={p} onAddToQuote={handleAddToQuote} onViewDetail={handleViewDetail} />
                ))}
              </div>
            </div>
          ) : null}

          {/* AI Suggested */}
          {aiResults.length > 0 ? (
            <div>
              <SectionHeader
                icon="🟠"
                title={`Đề xuất AI/API (${aiResults.length})`}
                tooltip="Kết quả từ AI bên ngoài — độ tương thích chưa được xác minh. Cần phê duyệt trước khi báo giá."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {aiResults.map((p) => (
                  <PartCard key={p.id} part={p} onAddToQuote={handleAddToQuote} onViewDetail={handleViewDetail} />
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-slate-400">
            Tổng {results.length} kết quả — {companyResults.length} hàng công ty · {internalResults.length} thay thế nội bộ · {aiResults.length} đề xuất AI
          </p>
        </div>
      )}
    </section>
  );
}
