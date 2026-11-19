import { ArrowRight, TriangleAlert } from 'lucide-react';
import type { ActionReason } from '@/lib/scoring/advice';

// The out-of-limit readings of one machine — one aligned line each (value · how far over ·
// limit), then what to do, each step once — then the notes. Dashboard's Action Required list
// (`compact`: only the worst reading's step) and the Drill-down cause band (every step).
export function AdviceList({
  reason,
  compact = false,
}: {
  reason: Pick<ActionReason, 'advice' | 'notes'>;
  compact?: boolean;
}) {
  // advice comes worst first; two readings with the same step show it once
  const steps = [...new Set(reason.advice.map((r) => r.action))];
  return (
    <div className="space-y-1.5 text-[14px] text-t1">
      {reason.advice.length ? (
        <>
          {/* phone: each reading wraps on its own; wider: one grid so the values line up */}
          <div className="space-y-0.5 sm:grid sm:grid-cols-[0.5rem_auto_auto_1fr] sm:items-baseline sm:space-y-0 sm:gap-x-2 sm:gap-y-0.5">
            {reason.advice.map((r) => {
              const crit = r.level === 'crit';
              // the badge starts with the level word; the dot carries it, the screen reader still hears it
              const over = r.badge.replace(/^(วิกฤต|เฝ้าระวัง)\s*/, '');
              return (
                <div key={r.label} className="flex flex-wrap items-baseline gap-x-2 sm:contents">
                  <span
                    aria-hidden
                    className={`h-2 w-2 -translate-y-px self-center rounded-full ${crit ? 'bg-red' : 'bg-yellow'}`}
                  />
                  <span
                    className="font-medium whitespace-nowrap"
                    title={[r.short, r.meaning].filter(Boolean).join(' — ') || undefined}
                  >
                    {r.label}
                  </span>
                  <span
                    className={`text-[13px] font-semibold whitespace-nowrap ${crit ? 'text-red' : 'text-yellow'}`}
                  >
                    <span className="sr-only">{crit ? 'วิกฤต ' : 'เฝ้าระวัง '}</span>
                    {over || r.badge}
                  </span>
                  <span className="text-[13px] whitespace-nowrap text-t3">
                    {r.limit ? `(${r.limit})` : ''}
                  </span>
                </div>
              );
            })}
          </div>
          {(compact ? steps.slice(0, 1) : steps).map((s) => (
            <div key={s} className="flex items-start gap-1.5 text-[13px] text-t2">
              <ArrowRight className="mt-[3px] h-3.5 w-3.5 shrink-0 text-t3" aria-hidden />
              <span>{s}</span>
            </div>
          ))}
        </>
      ) : (
        <span className="text-t3">ไม่มีผลตรวจที่เกินเกณฑ์</span>
      )}
      {reason.notes.map((n) => (
        <div key={n} className="flex items-start gap-1.5 text-[13px] text-t3">
          <TriangleAlert className="mt-[3px] h-3.5 w-3.5 shrink-0 text-yellow" aria-hidden />
          {n}
        </div>
      ))}
    </div>
  );
}
