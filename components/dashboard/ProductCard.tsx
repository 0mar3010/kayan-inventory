import type { ProductStockRow } from "@/lib/matching/product-lookup.service";

const TILE_BG = ["#FBECED", "#EAF1F6", "#EEF3EA", "#F6F0EA", "#F0ECF4", "#EAF4F2"];

function syncState(p: ProductStockRow): { cls: string; label: string; kind: "ok" | "warn" | "danger" } {
  const { localStock: a, shopifyStock: b } = p;
  if (a !== null && b !== null && a !== b) return { cls: "danger", label: "غير متطابق", kind: "danger" };
  const min = Math.min(a ?? Infinity, b ?? Infinity);
  if (min <= 5) return { cls: "warn", label: "منخفض", kind: "warn" };
  return { cls: "ok", label: "متطابق", kind: "ok" };
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-12 w-12">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </svg>
  );
}

const BADGE: Record<string, string> = {
  ok: "bg-kayan-ok-tint text-kayan-ok",
  warn: "bg-kayan-warn-tint text-kayan-warn",
  danger: "bg-kayan-red-tint text-kayan-red",
};

export function ProductCard({ product, index }: { product: ProductStockRow; index: number }) {
  const s = syncState(product);
  const tile = TILE_BG[index % TILE_BG.length];

  return (
    <article className="overflow-hidden rounded-2xl border border-kayan-line bg-white shadow-sm transition hover:border-[#D8D4D4] hover:shadow-md">
      <div className="relative grid h-32 place-items-center" style={{ background: tile }}>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-3" />
        ) : (
          <span className="text-kayan-ink/30">
            <BoxIcon />
          </span>
        )}
        <span className={`absolute end-2.5 top-2.5 rounded-full px-2 py-1 text-[11px] font-bold ${BADGE[s.kind]}`}>
          {s.label}
        </span>
      </div>

      <div className="p-3.5">
        {product.englishName && (
          <div className="truncate font-body text-sm font-semibold text-kayan-ink">{product.englishName}</div>
        )}
        <div className="truncate text-sm text-kayan-ink-2">{product.arabicName}</div>

        <div className="mt-2 flex items-center gap-2 text-xs text-kayan-muted">
          {product.sku && (
            <span className="rounded-md bg-kayan-bg px-1.5 py-0.5 font-mono text-[11px] text-kayan-ink-2">
              {product.sku}
            </span>
          )}
          <span className="truncate">
            {product.brand}
            {product.category ? ` · ${product.category}` : ""}
          </span>
        </div>

        <div className="mt-3 flex gap-2 border-t border-kayan-line pt-3">
          <StockCell label="المخزن" value={product.localStock} />
          <div className="w-px bg-kayan-line" />
          <StockCell label="شوبيفاي" value={product.shopifyStock} />
        </div>
      </div>
    </article>
  );
}

function StockCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex-1 text-center">
      <div className="mb-0.5 text-[11px] font-semibold text-kayan-muted">{label}</div>
      <div className={`tnum font-mono text-[17px] font-bold ${value === 0 ? "text-kayan-red" : "text-kayan-ink"}`}>
        {value === null ? "—" : value}
      </div>
    </div>
  );
}
