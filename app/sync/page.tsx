import { getSessionEmail } from "@/lib/auth";
import { UploadClient } from "@/components/sync/UploadClient";
import { AppHeader } from "@/components/layout/AppHeader";

// Behind auth (proxy-gated); writes to the DB — never prerender.
export const dynamic = "force-dynamic";

export default async function SyncPage() {
  const email = await getSessionEmail();

  return (
    <>
      <AppHeader active="sync" email={email ?? undefined} />
      <main className="mx-auto max-w-3xl px-5 py-6 pb-16">
        <header className="mb-5">
          <h1 className="font-display text-[22px] font-bold text-kayan-ink">مزامنة المخزون</h1>
          <p className="mt-0.5 text-sm text-kayan-muted">
            ارفع كشف المخزون من المخزن. النظام يطابق كل صنف مع الكتالوج، يُحدّث المطابق تماماً، ويحوّل المشكوك فيه لقائمة المراجعة.
          </p>
        </header>
        <UploadClient />
      </main>
    </>
  );
}
