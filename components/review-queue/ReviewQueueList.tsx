import type { ReviewQueueSummary } from "@/lib/matching/review-queue.service";

interface Props {
  items: ReviewQueueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function confidenceLabel(score: number | null) {
  if (score === null) return { text: "No score", tone: "text-slate-500" };
  if (score >= 0.8) return { text: `${Math.round(score * 100)}% confident`, tone: "text-amber-700" };
  return { text: `${Math.round(score * 100)}% confident`, tone: "text-red-700" };
}

export function ReviewQueueList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div role="status" className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h3 className="text-sm font-medium text-slate-900">Queue is empty</h3>
        <p className="mt-1 text-sm text-slate-500">No rows are waiting on a human decision right now.</p>
      </div>
    );
  }

  return (
    <ul role="list" className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {items.map((item) => {
        const confidence = confidenceLabel(item.confidenceScore);
        const isSelected = item.id === selectedId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isSelected ? "true" : undefined}
              className={`w-full px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500 ${
                isSelected ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-slate-900">{item.rawModelNumber}</span>
                <span className={`text-xs font-medium ${confidence.tone}`}>{confidence.text}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {item.brand} · qty {item.quantity} · row {item.fileRowNumber}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
