import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button as KitButton, buttonVariants as kitButtonVariants } from '@/components/ui/button';
import {
  healthColor,
  statusBadgeClass,
  statusFromHealth,
  statusLabelTh,
} from '@/lib/scoring/health';
import type { AssetStatus } from '@/lib/types';
import { readableText } from '@/lib/color';

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-[14px] border border-border bg-bg2 shadow-card',
        // cn doesn't merge classes, so a caller's own padding (p-0, py-2.5…) replaces the default instead of fighting it
        !/(^|\s)p[xytrbl]?-/.test(className ?? '') && 'p-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('badge', className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <Badge className={statusBadgeClass(status)}>
      <span
        className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle"
        aria-hidden
      />
      {statusLabelTh(status)}
    </Badge>
  );
}

// The one way to show a machine's Health Score: a unitless 0–100 number, its
// status word, and the status colour — identical on every page.
export function HealthBadge({
  score,
  size = 'md',
}: {
  score: number;
  size?: 'md' | 'lg' | 'tile';
}) {
  const status = statusFromHealth(score);
  // "tile": a square block for ranked lists — the score large, the status word under it.
  if (size === 'tile') {
    return (
      <span
        className={cn(
          statusBadgeClass(status),
          'flex h-14 w-14 flex-col items-center justify-center rounded-xl tabular-nums'
        )}
      >
        <span className="font-mono text-[20px] leading-none font-bold">{score}</span>
        <span className="mt-1 text-[11px] leading-none font-semibold">{statusLabelTh(status)}</span>
      </span>
    );
  }
  return (
    <Badge
      className={cn(
        statusBadgeClass(status),
        'tabular-nums',
        size === 'lg' && 'px-2.5 py-1 text-[14px]'
      )}
    >
      <span className="font-mono">{score}</span>
      <span aria-hidden>·</span>
      {statusLabelTh(status)}
    </Badge>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'ok' | 'critical';
type ButtonSize = 'md' | 'sm' | 'xs';

// The app's button API on the kit's ui/button (DESIGN.md §10): each app variant maps to
// the sanctioned kit variant with the same meaning, sizes to the rebased kit scale.
const KIT_VARIANT = {
  primary: { variant: 'default', className: '' },
  ghost: { variant: 'outline', className: '' },
  // reject-style action: outline red (never solid destructive — that is "delete")
  danger: {
    variant: 'outline',
    className:
      'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive',
  },
  ok: { variant: 'success', className: '' },
  critical: { variant: 'destructive', className: '' },
} as const;
const KIT_SIZE = { md: 'default', sm: 'sm', xs: 'xs' } as const;

function kitClasses(variant: ButtonVariant, size: ButtonSize, className?: string) {
  const v = KIT_VARIANT[variant];
  return cn(
    kitButtonVariants({ variant: v.variant, size: KIT_SIZE[size] }),
    'tap',
    v.className,
    className
  );
}

export function Button({
  children,
  variant = 'ghost',
  size = 'md',
  className,
  ...props
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = KIT_VARIANT[variant];
  return (
    <KitButton
      variant={v.variant}
      size={KIT_SIZE[size]}
      className={cn('tap', v.className, className)}
      {...props}
    >
      {children}
    </KitButton>
  );
}

/**
 * A link that looks like <Button>. Use it instead of <Link><Button/></Link>: a
 * button inside a link is invalid HTML and gives keyboard users two Tab stops
 * for one action. `disabled` renders a non-focusable span (a link can't be disabled).
 */
export function ButtonLink({
  href,
  children,
  variant = 'ghost',
  size = 'md',
  className,
  disabled,
  ...props
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
} & Omit<ComponentProps<typeof Link>, 'href' | 'children'>) {
  const cls = kitClasses(variant, size, className);
  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(cls, 'cursor-not-allowed opacity-50')}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} {...props}>
      {children}
    </Link>
  );
}

export function HealthBar({ score }: { score: number }) {
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-t3">Score</span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: healthColor(score) }}
          />
          <span
            className="font-mono text-[14px] font-bold"
            style={{ color: readableText(healthColor(score)) }}
          >
            {score}
          </span>
        </span>
      </div>
      <div
        className="hbar-track mt-[3px]"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`คะแนนสุขภาพ ${score} (${statusLabelTh(statusFromHealth(score))})`}
      >
        <div className="hbar-fill" style={{ width: `${score}%`, background: healthColor(score) }} />
      </div>
    </div>
  );
}

const accentByTone = {
  cyan: 'before:bg-cyan',
  red: 'before:bg-red',
  yellow: 'before:bg-yellow',
  green: 'before:bg-green',
} as const;
const iconByTone = {
  cyan: 'text-cyan',
  red: 'text-red',
  yellow: 'text-yellow',
  green: 'text-green',
} as const;

// "ไทย (English)" → the Thai label, with the English on its own line, smaller
// and lighter: the UI is Thai-first with English labels (AGENTS.md), and the
// English shouldn't compete with it. Text without "(…)" renders as is.
export function BiLabel({ text }: { text: string }) {
  const m = text.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <span className="block text-[12px] font-normal text-t3">{m[2]}</span>
    </>
  );
}

export function KpiCard({
  label,
  value,
  note,
  tone = 'cyan',
  icon,
  valueClassName,
  className,
  backdrop,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: keyof typeof accentByTone;
  icon?: ReactNode;
  valueClassName?: string;
  className?: string;
  /** Absolutely positioned decoration painted behind the card's content. */
  backdrop?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-[14px] border border-border bg-bg2 p-4 shadow-card before:absolute before:inset-x-0 before:top-0 before:h-[3px]',
        accentByTone[tone],
        className
      )}
    >
      {backdrop}
      <div className="kpi-lbl mb-1 pr-7 text-[14px] leading-snug font-semibold text-t3">
        <BiLabel text={label} />
      </div>
      <div
        className={cn(
          'truncate font-sans text-[33px] leading-none font-bold tracking-tight',
          valueClassName
        )}
      >
        {value}
      </div>
      {note ? <div className="mt-1 text-[13px] text-t3">{note}</div> : null}
      {icon ? (
        <div
          className={cn(
            'absolute top-3 right-3 opacity-60 [&>svg]:h-5 [&>svg]:w-5',
            iconByTone[tone]
          )}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
    </div>
  );
}
