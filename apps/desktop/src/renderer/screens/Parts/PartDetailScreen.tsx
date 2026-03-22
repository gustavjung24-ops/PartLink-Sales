import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MOCK_RESULTS } from "../Search/searchTypes";

function formatPrice(price: number | null): string {
  if (price === null) return "Liên hệ để báo giá";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(price);
}

export function PartDetailScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // In production this would be a useQuery hook fetching by id
  const part = useMemo(() => MOCK_RESULTS.find((p) => p.id === id) ?? null, [id]);

  if (!part) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="text-5xl">📦</span>
        <p className="mt-4 text-lg font-semibold">Không tìm thấy sản phẩm</p>
        <p className="mt-1 text-sm text-slate-500">Mã sản phẩm <code className="font-mono">{id}</code> không tồn tại trong cơ sở dữ liệu.</p>
        <button
          type="button"
          className="mt-5 rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
          onClick={() => navigate(-1)}
        >
          ← Quay lại
        </button>
      </div>
    );
  }

  const sourceLabels: Record<string, string> = {
    COMPANY_AVAILABLE: "🟢 Hàng Công Ty — Có sẵn kho",
    COMPANY_ORDERABLE: "🟢 Hàng Công Ty — Đặt hàng",
    INTERNAL_REPLACEMENT: "🔵 Thay Thế Nội Bộ",
    AI_SUGGESTED_EXTERNAL: "🟠 Đề xuất AI bên ngoài",
  };

  const fields: Array<{ label: string; value: string | null }> = [
    { label: "Mã sản phẩm", value: part.partNumber },
    { label: "Tên sản phẩm", value: part.name },
    { label: "Nhà sản xuất", value: part.manufacturer },
    { label: "Danh mục", value: part.category },
    { label: "Mô tả", value: part.description },
    { label: "Giá", value: formatPrice(part.price) },
    { label: "Tồn kho", value: part.inStock ? `${part.stockQty ?? "?"} đơn vị` : "Hết hàng" },
    { label: "Nguồn dữ liệu", value: sourceLabels[part.source] ?? part.source },
    { label: "Mã tham chiếu", value: part.crossRefCode ?? "—" },
  ];

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" className="text-sm text-sky-600 hover:underline" onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <h1 className="text-xl font-semibold">{part.partNumber}</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex flex-col py-3 sm:flex-row sm:gap-4">
              <dt className="w-40 shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        {part.source === "AI_SUGGESTED_EXTERNAL" ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>Lưu ý:</strong> Đây là đề xuất từ AI bên ngoài. Độ tin cậy:{" "}
            {Math.round(part.confidence * 100)}%. Cần phê duyệt kỹ thuật trước khi đưa vào báo giá.
          </div>
        ) : null}
      </div>

      <div className="flex gap-3">
        {!part.requiresApproval ? (
          <button
            type="button"
            className="rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700"
            onClick={() => navigate(`/quotes/new?partId=${part.id}`)}
          >
            + Thêm vào báo giá
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md border border-amber-300 px-5 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
            onClick={() => navigate(`/approvals?partId=${part.id}`)}
          >
            Yêu cầu phê duyệt
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={() => navigate(-1)}
        >
          Quay lại kết quả
        </button>
      </div>
    </section>
  );
}
