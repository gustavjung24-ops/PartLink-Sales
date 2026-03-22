export type QuoteStatus = "draft" | "sent" | "approved" | "rejected" | "expired";

export interface QuoteLineItem {
  id: string;
  partId: string;
  partNumber: string;
  name: string;
  manufacturer: string;
  qty: number;
  unitPrice: number;
  note: string;
}

export interface Quote {
  id: string;
  title: string;
  customerName: string;
  customerEmail: string;
  status: QuoteStatus;
  lines: QuoteLineItem[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  createdBy: string;
  note: string;
}

export function quoteTotal(quote: Quote): number {
  return quote.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

export function statusLabel(status: QuoteStatus): { label: string; cls: string } {
  switch (status) {
    case "draft":    return { label: "Nháp",       cls: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" };
    case "sent":     return { label: "Đã gửi",     cls: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300" };
    case "approved": return { label: "Đã duyệt",   cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" };
    case "rejected": return { label: "Từ chối",    cls: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300" };
    case "expired":  return { label: "Hết hạn",    cls: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
  }
}

const now = Date.now();
export const MOCK_QUOTES: Quote[] = [
  {
    id: "q_001",
    title: "BG-2026-001",
    customerName: "Công ty TNHH ABC",
    customerEmail: "procurement@abc.vn",
    status: "draft",
    lines: [
      { id: "l1", partId: "p_001", partNumber: "NGV-200-A", name: "Turbine NGV Blade", manufacturer: "SIEMENS", qty: 2, unitPrice: 4_500_000, note: "" },
    ],
    createdAt: now - 3_600_000,
    updatedAt: now - 1_800_000,
    expiresAt: now + 7 * 86_400_000,
    createdBy: "sales@sparelink.local",
    note: "Ưu tiên giao trong tuần",
  },
  {
    id: "q_002",
    title: "BG-2026-002",
    customerName: "Xí nghiệp XYZ",
    customerEmail: "xyz@xn.vn",
    status: "sent",
    lines: [
      { id: "l2", partId: "p_005", partNumber: "F1200-HYD", name: "Hydraulic Filter F1200", manufacturer: "MANN", qty: 5, unitPrice: 850_000, note: "" },
    ],
    createdAt: now - 86_400_000,
    updatedAt: now - 43_200_000,
    expiresAt: now + 14 * 86_400_000,
    createdBy: "sales@sparelink.local",
    note: "",
  },
];
