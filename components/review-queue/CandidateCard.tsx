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
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-kayan-red ${
        selected ? "border-kayan-ink bg-[#FCFBFB] ring-1 ring-inset ring-kayan-ink" : "border-kayan-line hover:border-[#CFCBCB]"
      }`}
    >
      <span
        className={`grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full border-2 ${
          selected ? "border-kayan-ink" : "border-kayan-line"
        }`}
        aria-hidden="true"
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-kayan-ink" />}
      </span>

      {candidate.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidate.imageUrl}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-lg border border-kayan-line object-cover"
        />
      ) : (
        <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg border border-kayan-line bg-kayan-bg text-kayan-ink/30" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
            <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
            <path d="m3 8 9 5 9-5M12 13v8" />
          </svg>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-sm font-semibold text-kayan-ink">
          {candidate.englishName ?? candidate.arabicName}
        </div>
        <div dir="rtl" className="truncate text-sm text-kayan-ink-2">
          {candidate.arabicName}
        </div>
        <div className="mt-1 text-[11px] text-kayan-muted">
          {candidate.brand} · طابَق عبر{" "}
          <span className="rounded bg-kayan-bg px-1.5 py-px font-mono">{candidate.rawExternalId}</span>
        </div>
      </div>

      <div className="flex-shrink-0 text-center">
        <div className="tnum font-mono text-[15px] font-bold text-kayan-ink">
          {Math.round(candidate.similarityScore * 100)}%
        </div>
        <div className="text-[10px] text-kayan-muted">تشابه</div>
      </div>
    </button>
  );
}
