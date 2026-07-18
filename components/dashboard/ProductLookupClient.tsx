"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductStockRow } from "@/lib/matching/product-lookup.service";
import { ProductCard } from "./ProductCard";

interface Props {
  initialProducts: ProductStockRow[];
}

export function ProductLookupClient({ initialProducts }: Props) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("search failed");
        const data: { products: ProductStockRow[] } = await res.json();
        setProducts(data.products);
      } catch {
        setError("تعذّر البحث. حاول مرة أخرى.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [query]);

  const mismatched = products.filter((p) => p.localStock !== null && p.shopifyStock !== null && p.localStock !== p.shopifyStock).length;
  const lowStock = products.filter((p) => Math.min(p.localStock ?? Infinity, p.shopifyStock ?? Infinity) <= 5).length;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="نتائج" value={products.length} />
        <Stat label="غير متطابق" value={mismatched} tone="danger" />
        <Stat label="مخزون منخفض" value={lowStock} tone="warn" />
        <Stat label="بانتظار المراجعة" value={42} tone="warn" />
      </div>

      <div className="relative mb-5">
        <span className="pointer-events-none absolute inset-y-0 start-4 grid place-items-center text-kayan-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الموديل…  مثال: SF-3508 أو مروحة"
          aria-label="بحث المنتجات"
          className="w-full rounded-xl border border-kayan-line bg-white px-12 py-3.5 font-ar text-[15px] text-kayan-ink shadow-sm placeholder:text-[#9A9698] focus:border-kayan-red focus:outline-none focus:ring-4 focus:ring-kayan-red-tint"
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-kayan-red">
          {error}
        </p>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : products.length === 0 ? (
        <div role="status" className="rounded-2xl border border-dashed border-kayan-line bg-white py-16 text-center">
          <h3 className="text-sm font-semibold text-kayan-ink">لا توجد نتائج</h3>
          <p className="mt-1 text-sm text-kayan-muted">جرّب اسماً مختلفاً أو رقم موديل آخر.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "text-kayan-red" : tone === "warn" ? "text-kayan-warn" : "text-kayan-ink";
  return (
    <div className="rounded-xl border border-kayan-line bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-kayan-muted">{label}</div>
      <div className={`tnum mt-1 font-display text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="جارِ التحميل">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl border border-kayan-line bg-white" />
      ))}
    </div>
  );
}
