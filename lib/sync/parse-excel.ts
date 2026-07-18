import * as XLSX from "xlsx";
import type { ExcelRow } from "@/lib/matching/types";
import { deriveBrand } from "./derive-brand";

/** ExcelRow plus the Arabic item name, kept in rawRowData for display. */
export type ParsedRow = ExcelRow & { name: string };

// Section/label rows that aren't real stocked products.
const SKIP_NAMES = new Set(["مشترك", "صيانه", "صيانة", "اعلان كيان", "إعلان كيان"]);

function toQuantity(raw: unknown): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Parse the local stock .xls/.xlsx into rows ready for matchRow().
 * Skips blank spacer rows, supplier-section headers (`المورد : N`), and
 * label rows. Brand is derived from the Arabic name (the sheet has none).
 * Throws if the expected header can't be found, so a changed export
 * format fails loudly instead of silently producing garbage.
 */
export function parseStockSheet(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Excel file has no sheets");

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });

  const headerIdx = grid.findIndex((r) => r.some((c) => String(c).includes("الموديل")));
  if (headerIdx === -1) {
    throw new Error('Unrecognized stock sheet: no "رقم الموديل" header column found');
  }

  // Resolve columns from the header labels rather than fixed indices —
  // the export's leading blank column can shift positions between readers.
  const header = grid[headerIdx];
  const colOf = (kw: string) => header.findIndex((c) => String(c).includes(kw));
  const cModel = colOf("الموديل");
  const cName = colOf("الصنف");
  const cQty = colOf("الرصيد");
  if (cModel < 0 || cName < 0 || cQty < 0) {
    throw new Error("Unrecognized stock sheet: missing الرصيد / أسم الصنف / رقم الموديل columns");
  }

  const out: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i];
    const model = String(row[cModel] ?? "").trim();
    const name = String(row[cName] ?? "").trim();

    if (!model) continue; // blank spacer row
    if (model.includes("المورد") || name.includes("المورد")) continue; // supplier section header
    if (SKIP_NAMES.has(name)) continue;
    if (model.replace(/[^A-Za-z0-9]/g, "").length < 2) continue; // not a real model code

    const quantity = toQuantity(row[cQty]);
    if (quantity === null) continue; // no stock reading on this row

    out.push({
      rawModelNumber: model,
      brand: deriveBrand(name),
      quantity,
      fileRowNumber: i + 1, // 1-based Excel row
      name,
    });
  }

  return out;
}
