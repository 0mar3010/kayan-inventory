import type { ProductStockRow } from "@/lib/matching/product-lookup.service";

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-12 w-12">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </svg>
  );
}

function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return `${Math.round(price).toLocaleString("ar-EG")} ج.م`;
}

export function ProductCard({ product }: { product: ProductStockRow; index?: number }) {
  const mismatch =
    product.localStock !== null && product.shopifyStock !== null && product.localStock !== product.shopifyStock;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-kayan-line bg-white shadow-sm transition hover:border-[#D8D4D4] hover:shadow-md">
      {/* Image tile — image box is pinned to the tile so object-contain always
          has a bounded box and shows the whole product, never a crop. */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden border-b border-kayan-line bg-white">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-4" />
        ) : (
          <div className="grid h-full place-items-center text-kayan-ink/20">
            <BoxIcon />
          </div>
        )}
        <span
          className={`absolute end-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            product.available ? "bg-kayan-ok-tint text-kayan-ok" : "bg-kayan-red-tint text-kayan-red"
          }`}
        >
          {product.available ? "متوفر" : "غير متوفر"}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5">
        {product.englishName && (
          <div dir="ltr" className="truncate text-start font-body text-sm font-semibold text-kayan-ink">
            {product.englishName}
          </div>
        )}
        <div className="truncate text-sm text-kayan-ink-2">{product.arabicName}</div>

        <div className="mt-1.5 flex items-center gap-2 text-xs text-kayan-muted">
          {product.sku && (
            <span dir="ltr" className="rounded-md bg-kayan-bg px-1.5 py-0.5 font-mono text-[11px] text-kayan-ink-2">
              {product.sku}
            </span>
          )}
          <span className="truncate">
            {product.brand}
            {product.category ? ` · ${product.category}` : ""}
          </span>
        </div>

        {/* Price */}
        <div className="mt-3">
          <span className="tnum font-display text-lg font-bold text-kayan-ink">{formatPrice(product.price)}</span>
        </div>

        {/* Stock: warehouse vs Shopify */}
        <div className="mt-3 flex items-stretch gap-2 border-t border-kayan-line pt-3">
          <StockCell label="المخزن" value={product.localStock} highlight={mismatch} />
          <div className="w-px bg-kayan-line" />
          <StockCell label="شوبيفاي" value={product.shopifyStock} highlight={mismatch} />
        </div>
      </div>
    </article>
  );
}

function StockCell({ label, value, highlight }: { label: string; value: number | null; highlight: boolean }) {
  const color = value === 0 ? "text-kayan-red" : highlight ? "text-kayan-warn" : "text-kayan-ink";
  return (
    <div className="flex-1 text-center">
      <div className="mb-0.5 text-[11px] font-semibold text-kayan-muted">{label}</div>
      <div className={`tnum font-mono text-[17px] font-bold ${color}`}>{value === null ? "—" : value}</div>
    </div>
  );
}
