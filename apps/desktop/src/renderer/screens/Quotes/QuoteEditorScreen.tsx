import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MOCK_RESULTS } from "../Search/searchTypes";
import { loadQuotes, type Quote, type QuoteLineItem, quoteTotal, upsertQuote } from "./quoteTypes";

let _idCounter = 100;
const newId = () => `l_${++_idCounter}`;

function formatPrice(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

function buildPreviewText(quote: Quote): string {
  const lines = quote.lines
    .map((l, i) =>
      `  ${i + 1}. ${l.partNumber} — ${l.name} (${l.manufacturer})\n     Số lượng: ${l.qty} × ${formatPrice(l.unitPrice)} = ${formatPrice(l.qty * l.unitPrice)}`
    )
    .join("\n");
  return [
    `=== BÁO GIÁ: ${quote.title} ===`,
    `Khách hàng: ${quote.customerName} <${quote.customerEmail}>`,
    `Ngày tạo: ${new Date(quote.createdAt).toLocaleDateString("vi-VN")}`,
    `Hết hạn: ${new Date(quote.expiresAt).toLocaleDateString("vi-VN")}`,
    ``,
    `Chi tiết hàng hóa:`,
    lines,
    ``,
    `TỔNG CỘNG: ${formatPrice(quoteTotal(quote))}`,
    quote.note ? `\nGhi chú: ${quote.note}` : "",
  ].join("\n");
}

export function QuoteEditorScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id: quoteId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const preloadPartId = searchParams.get("partId");
  const printRef = useRef<HTMLDivElement>(null);

  /* ── state ── */
  const [loadedQuote, setLoadedQuote] = useState<Quote | null>(null);
  const [title, setTitle] = useState(`BG-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<QuoteLineItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);

  const isEditing = Boolean(quoteId && quoteId !== "new");

  useEffect(() => {
    if (!quoteId || quoteId === "new") return;

    const existing = loadQuotes().find((item) => item.id === quoteId);
    if (!existing) return;

    setLoadedQuote(existing);
    setTitle(existing.title);
    setCustomerName(existing.customerName);
    setCustomerEmail(existing.customerEmail);
    setNote(existing.note);
    setLines(existing.lines.map((line) => ({ ...line })));
  }, [quoteId]);

  /* ── preload part from URL param ── */
  useEffect(() => {
    if (isEditing) return;
    if (!preloadPartId) return;
    const part = MOCK_RESULTS.find((p) => p.id === preloadPartId);
    if (!part) return;
    setLines([{
      id: newId(),
      partId: part.id,
      partNumber: part.partNumber,
      name: part.name,
      manufacturer: part.manufacturer,
      qty: 1,
      unitPrice: part.price ?? 0,
      note: "",
    }]);
  }, [isEditing, preloadPartId]);

  const quote: Quote = {
    id: loadedQuote?.id ?? `q_${Date.now()}`,
    title,
    customerName,
    customerEmail,
    status: loadedQuote?.status ?? "draft",
    lines,
    createdAt: loadedQuote?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    expiresAt: loadedQuote?.expiresAt ?? Date.now() + 14 * 86_400_000,
    createdBy: loadedQuote?.createdBy ?? "",
    note,
  };

  const doPrint = () => {
    if (!printRef.current) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${quote.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            pre { white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleSave = () => {
    const persistedQuote: Quote = {
      ...quote,
      updatedAt: Date.now(),
    };

    upsertQuote(persistedQuote);
    setLoadedQuote(persistedQuote);
    setSavedMessage("✓ Đã lưu báo giá");
    setTimeout(() => setSavedMessage(null), 2000);
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: newId(), partId: "", partNumber: "", name: "", manufacturer: "", qty: 1, unitPrice: 0, note: "" },
    ]);
  };

  const updateLine = (id: string, patch: Partial<QuoteLineItem>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildPreviewText(quote));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    if (!printRef.current) {
      setShowPreview(true);
      setPendingPrint(true);
      return;
    }

    doPrint();
  };

  useEffect(() => {
    if (pendingPrint && showPreview && printRef.current) {
      doPrint();
      setPendingPrint(false);
    }
  }, [pendingPrint, showPreview]);

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" className="text-sm text-sky-600 hover:underline" onClick={() => navigate("/quotes")}>
          ← Danh sách báo giá
        </button>
        <h1 className="text-xl font-semibold">{isEditing ? "Chỉnh sửa báo giá" : "Tạo báo giá mới"}</h1>
        {savedMessage ? <span className="text-sm text-emerald-600">{savedMessage}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Header fields */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-medium">Thông tin chung</h2>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Số báo giá</span>
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Tên khách hàng</span>
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Công ty TNHH ..." />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Email khách hàng</span>
              <input type="email" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="procurement@..." />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Ghi chú</span>
              <textarea rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-medium">Tổng quan</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Số mặt hàng</dt>
              <dd>{lines.length}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
              <dt className="font-semibold">Tổng cộng</dt>
              <dd className="font-semibold">{formatPrice(quoteTotal(quote))}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700" onClick={handleSave}>
              Lưu báo giá
            </button>
            <button type="button" className="flex-1 rounded-md bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-700" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? "Ẩn xem trước" : "Xem trước"}
            </button>
            <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={handleCopy}>
              {copied ? "✓ Đã sao chép" : "Sao chép văn bản"}
            </button>
            <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={handlePrint}>
              🖨 In / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Chi tiết hàng hóa</h2>
          <button type="button" className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700" onClick={addLine}>
            + Thêm mặt hàng
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Chưa có mặt hàng. Nhấn "Thêm mặt hàng" hoặc chọn từ trang Tìm kiếm.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-xs font-medium text-slate-500 dark:border-slate-700">
                <tr>
                  <th className="py-2 pr-3 text-left">Mã sản phẩm</th>
                  <th className="py-2 pr-3 text-left">Tên</th>
                  <th className="py-2 pr-3 text-right w-20">SL</th>
                  <th className="py-2 pr-3 text-right w-32">Đơn giá</th>
                  <th className="py-2 pr-3 text-right w-32">Thành tiền</th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3">
                      <input className="w-28 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" value={l.partNumber} onChange={(e) => updateLine(l.id, { partNumber: e.target.value })} placeholder="Mã SP" />
                    </td>
                    <td className="py-2 pr-3">
                      <input className="w-40 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" value={l.name} onChange={(e) => updateLine(l.id, { name: e.target.value })} placeholder="Tên sản phẩm" />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <input type="number" min={1} className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-950" value={l.qty} onChange={(e) => updateLine(l.id, { qty: Math.max(1, Number(e.target.value)) })} />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <input type="number" min={0} className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-xs dark:border-slate-700 dark:bg-slate-950" value={l.unitPrice} onChange={(e) => updateLine(l.id, { unitPrice: Math.max(0, Number(e.target.value)) })} />
                    </td>
                    <td className="py-2 pr-3 text-right text-xs font-medium">{formatPrice(l.qty * l.unitPrice)}</td>
                    <td className="py-2 text-center">
                      <button type="button" className="text-rose-500 hover:text-rose-700" onClick={() => removeLine(l.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan={4} className="py-2 pr-3 text-right text-sm font-semibold">Tổng cộng</td>
                  <td className="py-2 pr-3 text-right text-sm font-semibold">{formatPrice(quoteTotal(quote))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Plain text preview */}
      {showPreview ? (
        <div ref={printRef} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 font-medium">Xem trước văn bản báo giá</h2>
          <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-4 font-mono text-xs dark:bg-slate-950">
            {buildPreviewText(quote)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
