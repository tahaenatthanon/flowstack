import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PostingAnalyticsResponse } from '@/components/content/types';
import { THAI_DAYS_FULL } from './calendarUtils';
import { BarChart3, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  analytics: PostingAnalyticsResponse | undefined;
  isLoading: boolean;
  onRecalculate: () => void;
  isRecalculating: boolean;
}

function DayBar({ day, engagement, maxEngagement }: { day: number; engagement: number; maxEngagement: number }) {
  const pct = maxEngagement > 0 ? (engagement / maxEngagement) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-right text-muted-foreground shrink-0">{THAI_DAYS_FULL[day]}</span>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs">{engagement.toFixed(1)}</span>
    </div>
  );
}

function HourBar({ hour, engagement, maxEngagement }: { hour: number; engagement: number; maxEngagement: number }) {
  const pct = maxEngagement > 0 ? (engagement / maxEngagement) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-right text-muted-foreground shrink-0 font-mono">{`${String(hour).padStart(2, '0')}:00`}</span>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs">{engagement.toFixed(1)}</span>
    </div>
  );
}

export function BestTimeAnalyticsPanel({ analytics, isLoading, onRecalculate, isRecalculating }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'day' | 'hour'>('day');

  if (!open) {
    return (
      <div className="border-t bg-muted/10 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-xs text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          เวลาที่ดีที่สุดในการโพสต์
          <ChevronUp className="h-3.5 w-3.5 ml-auto" />
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border-t px-4 py-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics?.has_data) {
    return (
      <div className="border-t px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            เวลาที่ดีที่สุดในการโพสต์
          </h4>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <Card className="p-4 text-center text-sm text-muted-foreground">
          ยังไม่มีข้อมูลเพียงพอ รออย่างน้อย 10 โพสต์เพื่อเริ่มวิเคราะห์
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onRecalculate}
              disabled={isRecalculating}
            >
              {isRecalculating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />กำลังคำนวณ...</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5 mr-1" />คำนวณตอนนี้</>
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const platform = Object.keys(analytics.by_day)[0] || 'facebook';
  const byDay = analytics.by_day[platform] || {};
  const byHour = analytics.by_hour[platform] || {};

  const dayEntries = [0, 1, 2, 3, 4, 5, 6].map(d => ({ day: d, engagement: byDay[d] ?? 0 }));
  const hourEntries = Array.from({ length: 24 }, (_, h) => ({ hour: h, engagement: byHour[h] ?? 0 }));

  const maxDayEng = Math.max(...dayEntries.map(e => e.engagement), 1);
  const maxHourEng = Math.max(...hourEntries.map(e => e.engagement), 1);

  return (
    <div className="border-t px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          เวลาที่ดีที่สุดในการโพสต์
        </h4>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onRecalculate}
            disabled={isRecalculating}
            title="คำนวณใหม่"
          >
            {isRecalculating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-0.5">
        <Button
          size="sm"
          variant={tab === 'day' ? 'default' : 'ghost'}
          className={cn('h-7 text-xs flex-1', tab === 'day' ? '' : 'hover:bg-muted/50')}
          onClick={() => setTab('day')}
        >
          แยกตามวัน
        </Button>
        <Button
          size="sm"
          variant={tab === 'hour' ? 'default' : 'ghost'}
          className={cn('h-7 text-xs flex-1', tab === 'hour' ? '' : 'hover:bg-muted/50')}
          onClick={() => setTab('hour')}
        >
          แยกตามเวลา
        </Button>
      </div>

      <Separator />

      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {tab === 'day' && dayEntries.map(e => (
          <DayBar key={e.day} day={e.day} engagement={e.engagement} maxEngagement={maxDayEng} />
        ))}
        {tab === 'hour' && hourEntries.map(e => (
          <HourBar key={e.hour} hour={e.hour} engagement={e.engagement} maxEngagement={maxHourEng} />
        ))}
      </div>

      {analytics.recommendations.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium mb-2">เวลาที่แนะนำ</p>
            <div className="flex flex-wrap gap-1.5">
              {analytics.recommendations.map((rec, i) => (
                <span
                  key={i}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full border font-medium',
                    i === 0 ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {rec.platform} · {THAI_DAYS_FULL[rec.day_of_week]} {String(rec.hour_of_day).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
