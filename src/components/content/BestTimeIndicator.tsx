import { cn } from '@/lib/utils';
import type { PostingAnalyticsResponse } from '@/components/content/types';
import { THAI_DAYS_FULL } from './calendarUtils';

interface Props {
  date: Date | null;
  analytics: PostingAnalyticsResponse | undefined;
  platform?: string;
}

export function BestTimeIndicator({ date, analytics, platform = 'facebook' }: Props) {
  if (!date || !analytics?.has_data) return null;

  const dow = date.getDay();
  const byDay = analytics.by_day[platform];
  const engagement = byDay?.[dow];

  let color: string;
  if (engagement === undefined) {
    color = 'bg-muted-foreground/20';
  } else if (engagement > 2.0) {
    color = 'bg-green-500';
  } else if (engagement > 0.5) {
    color = 'bg-amber-500';
  } else {
    color = 'bg-red-400';
  }

  const label = engagement !== undefined
    ? `${THAI_DAYS_FULL[dow]}: avg engagement ${engagement.toFixed(1)}`
    : `${THAI_DAYS_FULL[dow]}: ยังไม่มีข้อมูล`;

  return (
    <span
      className={cn('inline-block w-[6px] h-[6px] rounded-full shrink-0', color)}
      title={label}
      aria-label={label}
    />
  );
}
