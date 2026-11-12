import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

interface PagerProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Page numbers with previous/next: "‹ 1 2 3 ›". With many pages, shows the first, the last and the ones
 * around the current page, with "…" between (so it fits a 320px phone).
 */
export function Pager({ page, pages, onChange, disabled }: PagerProps) {
  if (pages <= 1) return null;
  return (
    <View role="navigation" aria-label="Recipe pages" className="flex-row flex-wrap items-center justify-center gap-1 pt-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        disabled={disabled || page <= 1}
        onPress={() => onChange(page - 1)}
        accessibilityLabel="Previous page">
        <Icon as={ChevronLeft} size={18} />
      </Button>
      {pageList(page, pages).map((p, i) =>
        p === null ? (
          <Text key={`gap${i}`} aria-hidden className="text-muted-foreground w-6 text-center">…</Text>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            className={cn('h-11 min-w-11 px-3')}
            disabled={disabled}
            onPress={() => p !== page && onChange(p)}
            accessibilityLabel={`Page ${p} of ${pages}`}
            accessibilityState={{ selected: p === page }}
            aria-current={p === page ? 'page' : undefined}>
            <Text className="tabular-nums">{p}</Text>
          </Button>
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        disabled={disabled || page >= pages}
        onPress={() => onChange(page + 1)}
        accessibilityLabel="Next page">
        <Icon as={ChevronRight} size={18} />
      </Button>
    </View>
  );
}

/**
 * 1 … 4 5 6 … 12: first, last, and one either side of the current page. `null` is a gap.
 * Up to 5 pages are all shown; beyond that the compact form keeps the pager on one row at 320px.
 */
function pageList(page: number, pages: number): (number | null)[] {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}
