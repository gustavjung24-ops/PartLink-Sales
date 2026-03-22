/** Source classification for search results */
export type ResultSource =
  | "COMPANY_AVAILABLE"      // 🟢 Hàng Công Ty — có sẵn kho
  | "COMPANY_ORDERABLE"      // 🟢 Hàng Công Ty — đặt hàng được
  | "INTERNAL_REPLACEMENT"   // 🔵 Thay Thế Nội Bộ — đã phê duyệt
  | "AI_SUGGESTED_EXTERNAL"; // 🟠 Đề xuất AI — cần phê duyệt

export interface PartResult {
  id: string;
  partNumber: string;
  name: string;
  manufacturer: string;
  category: string;
  description: string;
  price: number | null;
  inStock: boolean;
  stockQty: number | null;
  source: ResultSource;
  /** 0–1 confidence score for AI_SUGGESTED_EXTERNAL */
  confidence: number;
  /** Original code this result cross-references */
  crossRefCode?: string;
  /** Whether this needs approval workflow before quoting */
  requiresApproval: boolean;
  thumbnailUrl?: string;
}

export interface SearchFilters {
  manufacturer: string;
  category: string;
  availability: "all" | "in_stock";
}

export const EMPTY_FILTERS: SearchFilters = {
  manufacturer: "",
  category: "",
  availability: "all",
};

/** Seed data for dev previews */
export const MOCK_RESULTS: PartResult[] = [
  {
    id: "p_001",
    partNumber: "NGV-200-A",
    name: "Turbine NGV Blade Assembly",
    manufacturer: "SIEMENS",
    category: "Turbine",
    description: "Nozzle guide vane 1st stage, high alloy steel",
    price: 4_500_000,
    inStock: true,
    stockQty: 3,
    source: "COMPANY_AVAILABLE",
    confidence: 1,
    requiresApproval: false,
  },
  {
    id: "p_002",
    partNumber: "NGV-200-B",
    name: "Turbine NGV Blade (Alt)",
    manufacturer: "GE",
    category: "Turbine",
    description: "Approved equivalent — GE variant",
    price: 4_200_000,
    inStock: false,
    stockQty: 0,
    source: "COMPANY_ORDERABLE",
    confidence: 1,
    crossRefCode: "NGV-200-A",
    requiresApproval: false,
  },
  {
    id: "p_003",
    partNumber: "NGV-200-INT",
    name: "NGV Blade — Internal Replacement",
    manufacturer: "InHouse",
    category: "Turbine",
    description: "Validated internal replacement part, approved by engineering",
    price: 3_800_000,
    inStock: true,
    stockQty: 5,
    source: "INTERNAL_REPLACEMENT",
    confidence: 0.95,
    crossRefCode: "NGV-200-A",
    requiresApproval: false,
  },
  {
    id: "p_004",
    partNumber: "NGV-200-EXT",
    name: "NGV Blade — External AI Match",
    manufacturer: "Mitsubishi",
    category: "Turbine",
    description: "AI-suggested external alternative — compatibility unverified",
    price: null,
    inStock: false,
    stockQty: null,
    source: "AI_SUGGESTED_EXTERNAL",
    confidence: 0.72,
    crossRefCode: "NGV-200-A",
    requiresApproval: true,
  },
  {
    id: "p_005",
    partNumber: "F1200-HYD",
    name: "Hydraulic Filter F1200",
    manufacturer: "MANN",
    category: "Filter",
    description: "High pressure hydraulic filter, 10μm",
    price: 850_000,
    inStock: true,
    stockQty: 14,
    source: "COMPANY_AVAILABLE",
    confidence: 1,
    requiresApproval: false,
  },
];
