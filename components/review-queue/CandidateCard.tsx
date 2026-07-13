import type { CandidateDTO } from "@/lib/matching/review-queue.service";

interface Props {
  candidate: CandidateDTO;
  selected: boolean;
  onSelect: (productId: string) => void;
}

export function CandidateCard({ candidate, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate.productId)}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500 ${
        selected ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {candidate.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidate.imageUrl}
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded-md border border-slate-200 object-cover"
        />
      ) : (
        <div className="h-14 w-14 flex-shrink-0 rounded-md border border-slate-200 bg-slate-100" aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">
          {candidate.englishName ?? candidate.arabicName}
        </div>
        <div dir="rtl" className="truncate text-sm text-slate-600">
          {candidate.arabicName}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {candidate.brand} · matched via <span className="font-mono">{candidate.rawExternalId}</span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-semibold text-slate-900">
          {Math.round(candidate.similarityScore * 100)}%
        </div>
        <div className="text-xs text-slate-500">similarity</div>
      </div>
    </button>
  );
}
