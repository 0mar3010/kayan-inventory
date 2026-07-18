import Image from "next/image";
import Link from "next/link";

interface Props {
  active: "dashboard" | "review-queue";
  email?: string;
}

const NAV_ITEMS = [
  { key: "dashboard", label: "المنتجات", href: "/" },
  { key: "review-queue", label: "قائمة المراجعة", href: "/review-queue" },
] as const;

export function AppHeader({ active, email }: Props) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "؟";

  return (
    <header className="border-b border-kayan-line bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="كيان — الرئيسية">
          <Image src="/brand/icon.png" alt="" width={28} height={28} className="h-7 w-7" priority />
          <span className="font-display text-lg font-semibold tracking-tight text-kayan-ink">كيان</span>
          <span className="hidden font-body text-sm text-kayan-muted sm:inline">المخزون</span>
        </Link>

        <nav aria-label="التنقّل الأساسي" className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-kayan-red-tint text-kayan-red-dark"
                    : "text-kayan-ink-2 hover:bg-kayan-bg hover:text-kayan-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-kayan-bg text-xs font-semibold text-kayan-ink-2"
            title={email}
            aria-hidden="true"
          >
            {initials}
          </div>
          <Link href="/api/auth/logout" className="text-sm font-medium text-kayan-muted hover:text-kayan-ink">
            تسجيل الخروج
          </Link>
        </div>
      </div>
    </header>
  );
}
