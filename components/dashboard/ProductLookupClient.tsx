"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductStockRow } from "@/lib/matching/product-lookup.service";
import { ProductCard } from "./ProductCard";

interface Props {
  initialProducts: ProductStockRow[];
  initialTotal: number;
  pageSize: number;
}

export function ProductLookupClient({ initialProducts, initialTotal, pageSize }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const first = useRef(true);

  useEffect(() => {
    // Skip the very first run — server already provided page 1.
    if (first.current) {
      first.current = false;
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&page=${page}`);
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setProducts(data.products);
        setTotal(data.total);
      } catch {
        setError("تعذّر البحث. حاول مرة أخرى.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [query, page]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  function onSearch(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div>
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
          onChange={(e) => onSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الموديل…  مثال: SF-3508 أو مروحة"
          aria-label="بحث المنتجات"
          className="w-full rounded-xl border border-kayan-line bg-white px-12 py-3.5 font-ar text-[15px] text-kayan-ink shadow-sm placeholder:text-[#9A9698] focus:border-kayan-red focus:outline-none focus:ring-4 focus:ring-kayan-red-tint"
        />
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-kayan-muted">
        <span>
          {total.toLocaleString("ar-EG")} منتج
          {total > 0 && (
            <span className="text-kayan-muted/70">
              {" "}
              · عرض {rangeStart.toLocaleString("ar-EG")}–{rangeEnd.toLocaleString("ar-EG")}
            </span>
          )}
        </span>
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
            <ProductCard key={p.id} product={p} index={(page - 1) * pageSize + i} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <PagerButton disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            السابق
          </PagerButton>
          <span className="px-2 text-sm font-semibold text-kayan-ink-2">
            صفحة {page.toLocaleString("ar-EG")} من {pageCount.toLocaleString("ar-EG")}
          </span>
          <PagerButton disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
            التالي
          </PagerButton>
        </div>
      )}
    </div>
  );
}

function PagerButton({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-kayan-line bg-white px-4 py-2 text-sm font-bold text-kayan-ink-2 transition-colors hover:border-kayan-red hover:text-kayan-red disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-kayan-line disabled:hover:text-kayan-ink-2"
    >
      {children}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="جارِ التحميل">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl border border-kayan-line bg-white" />
      ))}
    </div>
  );
}
