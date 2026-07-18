import type { ReviewQueueSummary } from "@/lib/matching/review-queue.service";

interface Props {
  items: ReviewQueueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function confidence(score: number | null) {
  if (score === null) return { pct: null, tone: "text-kayan-muted", bar: "bg-kayan-line" };
  const pct = Math.round(score * 100);
  return score >= 0.8
    ? { pct, tone: "text-kayan-warn", bar: "bg-kayan-warn" }
    : { pct, tone: "text-kayan-red", bar: "bg-kayan-red" };
}

export function ReviewQueueList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div role="status" className="rounded-2xl border border-kayan-line bg-white p-8 text-center shadow-sm">
        <h3 className="text-sm font-semibold text-kayan-ink">القائمة فارغة</h3>
        <p className="mt-1 text-sm text-kayan-muted">لا توجد صفوف تنتظر قراراً بشرياً الآن.</p>
      </div>
    );
  }

  return (
    <ul role="list" className="divide-y divide-kayan-line overflow-hidden rounded-2xl border border-kayan-line bg-white shadow-sm">
      {items.map((item) => {
        const c = confidence(item.confidenceScore);
        const isSelected = item.id === selectedId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isSelected ? "true" : undefined}
              className={`w-full px-4 py-3 text-start transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-kayan-red ${
                isSelected ? "bg-kayan-red-tint" : "hover:bg-kayan-bg"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-mono text-sm font-bold ${isSelected ? "text-kayan-red-dark" : "text-kayan-ink"}`}>
                  {item.rawModelNumber}
                </span>
                {c.pct !== null && (
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold ${c.tone}`}>
                    {c.pct}%
                    <span className="h-1 w-8 overflow-hidden rounded-full bg-kayan-line">
                      <i className={`block h-full ${c.bar}`} style={{ width: `${c.pct}%` }} />
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-kayan-muted">
                {item.brand} · كمية {item.quantity} · صف {item.fileRowNumber}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
