import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Eye, EyeOff } from 'lucide-react';

export function DeltaIndicator({ current, previous, label }: { current: number; previous: number; label?: string }) {
  if (previous === 0 && current === 0) return null;
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : diff > 0 ? 100 : 0;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium ml-2">
      {diff > 0 ? (
        <TrendingUp className="h-3 w-3 text-emerald-500" />
      ) : diff < 0 ? (
        <TrendingDown className="h-3 w-3 text-red-400" />
      ) : (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-400' : 'text-muted-foreground'}>
        {diff > 0 ? '+' : ''}{diff}{previous > 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}

/** Masks a string for PII display, e.g. "john@acme.com" → "j•••@a•••.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••••';
  const domParts = domain.split('.');
  const maskedLocal = local.length > 1 ? local[0] + '•••' : '•';
  const maskedDomain = domParts[0].length > 1 ? domParts[0][0] + '•••' : '•';
  return `${maskedLocal}@${maskedDomain}.${domParts.slice(1).join('.')}`;
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '•••••';
  return '•••••' + phone.slice(-4);
}

/** Click-to-reveal PII cell */
export function PIICell({ value, type }: { value: string | null | undefined; type: 'email' | 'phone' }) {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className="text-muted-foreground text-xs">—</span>;

  const masked = type === 'email' ? maskEmail(value) : maskPhone(value);

  return (
    <span className="inline-flex items-center gap-1.5 group">
      <span className={`font-mono text-xs ${!revealed ? 'text-muted-foreground' : 'text-amber-300'}`}>
        {revealed ? value : masked}
      </span>
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        title={revealed ? 'Hide' : 'Reveal'}
      >
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </span>
  );
}
