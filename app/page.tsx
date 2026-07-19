import { searchProducts } from "@/lib/matching/product-lookup.service";
import { getSessionEmail } from "@/lib/auth";
import { ProductLookupClient } from "@/components/dashboard/ProductLookupClient";
import { AppHeader } from "@/components/layout/AppHeader";

// Live, per-request, DB-backed page behind auth — never statically prerender.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initial = await searchProducts("", 1);
  const email = await getSessionEmail(); // non-null: proxy already gated this route

  return (
    <>
      <AppHeader active="dashboard" email={email ?? undefined} />
      <main className="mx-auto max-w-6xl px-5 py-6 pb-16">
        <header className="mb-5">
          <h1 className="font-display text-[22px] font-bold text-kayan-ink">بحث المنتجات</h1>
          <p className="mt-0.5 text-sm text-kayan-muted">
            ابحث عن أي منتج وتحقق من المخزون بين المخزن وشوبيفاي في أقل من دقيقة.
          </p>
        </header>
        <ProductLookupClient
          initialProducts={initial.products}
          initialTotal={initial.total}
          pageSize={initial.pageSize}
        />
      </main>
    </>
  );
}
