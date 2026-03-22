/**
 * Part Code Parser
 * Parses and validates various part code formats
 * Supports OCR, barcode, and manual entry methods
 *
 * Example formats supported:
 * ├── Texas Instruments: SN74HC04N
 * ├── Philips/NXP: MC321H100
 * ├── Motorola: 2N2222A
 * └── Generic: ABC-123-XYZ
 */

import { ParsedCode, OperationResult, ResultType } from "../types";

/**
 * Part code format patterns
 */
const PART_CODE_PATTERNS = {
  // Texas Instruments: SN74HC04N

  // Philips/NXP: MC321H100

  // Motorola: 2N2222A

  // Generic: ABC-123-XYZ or ABC123XYZ
  ti: /^SN(?<series>\d{2})(?<type>[A-Z]{2})\d{2}(?<package>[A-Z]+)$/i,
  nxp: /^MC(?<series>\d{3})(?<variant>[A-Z])\d{2,3}$/i,
  motorola: /^(?<series>\d[A-Z])\d{4}(?<suffix>[A-Z])?$/i,
  generic: /^(?<manufacturer>[A-Z]{2,4})[\-]?(?<number>\d{3,6})[\-]?(?<variant>[A-Z0-9]{1,3})?$/i,
};

/**
 * Manufacturer database (minimal)
 */
const MANUFACTURERS: Record<string, string> = {
  SN: "Texas Instruments",
  MC: "Motorola",
  "2N": "Motorola",
  LM: "National Semiconductor",
  NE: "Signetics",
  TL: "Texas Instruments",
  OP: "Precision Monolithics",
  CA: "RCA",
  CL: "Cirrus Logic",
};

/**
 * Part code fuzzy matching utility
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      // Min of: insertion, deletion, substitution
      dp[i][j] = Math.min(
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j] + 1,      // deletion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toUpperCase(), b.toUpperCase());
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

export class PartCodeParser {
  /**
   * Parse a part code from various input methods
   */
  public async parse(
    input: string,
    method: "ocr" | "barcode" | "manual" | "database" = "manual"
  ): Promise<OperationResult<ParsedCode>> {
    const startTime = Date.now();

    try {
      const trimmedInput = input.trim().toUpperCase();

      if (!trimmedInput) {
        throw new Error("Input cannot be empty");
      }

      let parsed: ParsedCode;

      switch (method) {
        case "manual":
        case "database":
          parsed = this.parseManual(trimmedInput);
          break;

        case "barcode":
          parsed = this.parseBarcode(trimmedInput);
          break;

        case "ocr":
          // For now, treat OCR same as manual
          // TODO: Add OCR-specific preprocessing
          parsed = this.parseManual(trimmedInput);
          break;

        default:
          parsed = this.parseManual(trimmedInput);
      }

      // Normalize and validate
      const normalized = this.normalize(parsed);
      const isValid = this.validate(normalized);

      return {
        type: isValid ? ResultType.SUCCESS : ResultType.CACHED,
        data: {
          ...normalized,
          confidence: isValid ? 0.95 : 0.6,
          parseMethod: method,
          processingTimeMs: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
        id: `parse-${Date.now()}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        type: ResultType.ERROR,
        error: {
          code: "PARSE_FAILED",
          message,
        },
        timestamp: new Date().toISOString(),
        id: `parse-${Date.now()}`,
      };
    }
  }

  /**
   * Parse manual/text input
   */
  private parseManual(input: string): ParsedCode {
    // Try each pattern
    for (const [format, pattern] of Object.entries(PART_CODE_PATTERNS)) {
      const match = input.match(pattern);
      if (match) {
        const groups = match.groups || {};
        const manufacturer = this.identifyManufacturer(input);

        return {
          rawCode: input,
          partNumber: input,
          manufacturer: manufacturer || "Unknown",
          category: this.identifyCategory(input),
          attributes: {
            format,
            ...groups,
          },
          confidence: 0.8,
          parseMethod: "manual",
          processingTimeMs: 0,
        };
      }
    }

    // Fallback to generic parsing
    return {
      rawCode: input,
      partNumber: input,
      manufacturer: this.identifyManufacturer(input),
      category: "Unknown",
      attributes: { format: "unknown" },
      confidence: 0.3,
      parseMethod: "manual",
      processingTimeMs: 0,
    };
  }

  /**
   * Parse barcode format (UPC, EAN, etc.)
   */
  private parseBarcode(input: string): ParsedCode {
    // Barcode often contains part number at specific positions
    // For now, just use the barcode as part number
    return {
      rawCode: input,
      partNumber: input.substring(0, 12), // Typical part number length
      manufacturer: this.identifyManufacturer(input),
      category: "Unknown",
      attributes: {
        format: "barcode",
        fullBarcode: input,
      },
      confidence: 0.7,
      parseMethod: "barcode",
      processingTimeMs: 0,
    };
  }

  /**
   * Identify manufacturer from part code
   */
  private identifyManufacturer(code: string): string {
    const prefix = code.substring(0, 4).toUpperCase();

    // Check 4-char prefix
    if (MANUFACTURERS[prefix]) {
      return MANUFACTURERS[prefix];
    }

    // Check 3-char prefix
    if (MANUFACTURERS[prefix.substring(0, 3)]) {
      return MANUFACTURERS[prefix.substring(0, 3)];
    }

    // Check 2-char prefix
    if (MANUFACTURERS[prefix.substring(0, 2)]) {
      return MANUFACTURERS[prefix.substring(0, 2)];
    }

    return "Unknown";
  }

  /**
   * Identify part category (IC, Resistor, Capacitor, etc.)
   */
  private identifyCategory(code: string): string {
    const lower = code.toLowerCase();

    if (lower.includes("ic") || /^\d+[a-z]{2,4}[a-z0-9]+$/.test(lower)) {
      return "IC";
    }
    if (/r\d/.test(lower)) {
      return "Resistor";
    }
    if (/c\d/.test(lower)) {
      return "Capacitor";
    }
    if (/l\d/.test(lower)) {
      return "Inductor";
    }
    if (/d\d/.test(lower) || /led/.test(lower)) {
      return "Diode";
    }
    if (/q\d/.test(lower)) {
      return "Transistor";
    }

    return "Component";
  }

  /**
   * Validate parsed code against known formats
   */
  public validate(code: ParsedCode): boolean {
    // Validation checks
    if (!code.partNumber || code.partNumber.length < 2) {
      return false;
    }

    // Part number should have alphanumeric characters
    if (!/^[A-Z0-9\-\/]+$/i.test(code.partNumber)) {
      return false;
    }

    // Confidence should be reasonable
    if (code.confidence < 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Normalize part code to standard format
   */
  public normalize(code: ParsedCode): ParsedCode {
    return {
      ...code,
      partNumber: code.partNumber.toUpperCase().trim(),
      manufacturer: code.manufacturer.toUpperCase().trim(),
    };
  }

  /**
   * Search for similar part codes (fuzzy matching)
   */
  public async search(code: ParsedCode, maxResults: number = 5): Promise<OperationResult<ParsedCode[]>> {
    try {
      const searchKey = code.partNumber;

      // Simulated database search
      // In real implementation, this would query a database
      const database: ParsedCode[] = [
        {
          rawCode: "SN74HC04N",
          partNumber: "SN74HC04N",
          manufacturer: "Texas Instruments",
          category: "IC",
          attributes: { format: "ti" },
          confidence: 1.0,
          parseMethod: "database",
          processingTimeMs: 0,
        },
        {
          rawCode: "SN74HC05N",
          partNumber: "SN74HC05N",
          manufacturer: "Texas Instruments",
          category: "IC",
          attributes: { format: "ti" },
          confidence: 0.95,
          parseMethod: "database",
          processingTimeMs: 0,
        },
      ];

      // Calculate similarity scores
      const results = database
        .map((item) => ({
          ...item,
          similarity: calculateSimilarity(searchKey, item.partNumber),
        }))
        .filter((item) => item.similarity > 0.6)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults)
        .map(({ similarity, ...item }) => item);

      return {
        type: ResultType.SUCCESS,
        data: results,
        timestamp: new Date().toISOString(),
        id: `search-${Date.now()}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        type: ResultType.ERROR,
        error: {
          code: "SEARCH_FAILED",
          message,
        },
        timestamp: new Date().toISOString(),
        id: `search-${Date.now()}`,
      };
    }
  }
}

export default new PartCodeParser();

