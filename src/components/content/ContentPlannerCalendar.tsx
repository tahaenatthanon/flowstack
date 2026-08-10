import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ContentPlan, PlanItem, CalendarView, PostingAnalyticsResponse } from '@/components/content/types';
import { BestTimeIndicator } from './BestTimeIndicator';
import { PlatformIcon } from './PlatformIcon';
import { getPlatformColors } from '@/lib/platformConfig';
import {
  generateMonthGrid,
  generateQuarterGrids,
  generateYearHeatmap,
  THAI_DAYS_SHORT,
  THAI_MONTHS_FULL,
  isToday,
  toDateKey,
  getQuarterLabel,
  getQuarterRange,
} from './calendarUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  plans: ContentPlan[];
  view: CalendarView;
  currentDate: Date;
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onDateClick: (date: Date, items: PlanItem[]) => void;
  onDateDragOver: (e: React.DragEvent, date: Date) => void;
  onDateDrop: (e: React.DragEvent, date: Date) => void;
  analytics?: PostingAnalyticsResponse;
  isLoading?: boolean;
  typeFilter?: string;
  platformFilter?: string;
}

export function ContentPlannerCalendar({
  plans,
  view,
  currentDate,
  onNavigate,
  onViewChange,
  onDateClick,
  onDateDragOver,
  onDateDrop,
  analytics,
  isLoading,
  typeFilter = 'all',
  platformFilter = 'all',
}: Props) {
  const itemsByDate = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const plan of plans) {
      for (const item of plan.items || []) {
        if (typeFilter !== 'all' && item.content_type !== typeFilter) continue;
        if (platformFilter !== 'all' && item.platform !== platformFilter) continue;
        const key = item.scheduled_date || item.day_label;
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    }
    return map;
  }, [plans, typeFilter, platformFilter]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const goPrev = useCallback(() => {
    if (view === 'month') onNavigate(new Date(year, month - 1, 1));
    else if (view === 'quarter') onNavigate(new Date(year, month - 3, 1));
    else onNavigate(new Date(year - 1, 0, 1));
  }, [view, year, month, onNavigate]);

  const goNext = useCallback(() => {
    if (view === 'month') onNavigate(new Date(year, month + 1, 1));
    else if (view === 'quarter') onNavigate(new Date(year, month + 3, 1));
    else onNavigate(new Date(year + 1, 0, 1));
  }, [view, year, month, onNavigate]);

  const goToday = useCallback(() => {
    const now = new Date();
    onNavigate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, [onNavigate]);

  const headerLabel = useMemo(() => {
    if (view === 'month') {
      return `${THAI_MONTHS_FULL[month]} ${year + 543}`;
    }
    if (view === 'quarter') {
      const q = Math.floor(month / 3) + 1;
      return `${getQuarterLabel(q)} ${year + 543}`;
    }
    return `${year + 543}`;
  }, [view, year, month]);

  const renderCell = (date: Date | null) => {
    if (!date) return <div className="min-h-[80px] bg-muted/20 rounded" />;

    const key = toDateKey(date);
    const items = itemsByDate.get(key) || [];
    const today = isToday(date);

    return (
      <div
        className={cn(
          'min-h-[80px] border rounded-lg p-1.5 transition-colors cursor-pointer',
          'hover:bg-muted/40',
          today && 'border-primary ring-1 ring-primary/20 bg-primary/5'
        )}
        onClick={() => onDateClick(date, items)}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDateDragOver(e, date); }}
        onDrop={e => { e.preventDefault(); onDateDrop(e, date); }}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn(
            'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
            today && 'bg-primary text-primary-foreground'
          )}>
            {date.getDate()}
          </span>
          {view === 'month' && (
            <BestTimeIndicator date={date} analytics={analytics} />
          )}
        </div>
        <div className="space-y-0.5">
          {items.slice(0, 3).map((item) => {
              const colors = getPlatformColors(item.platform);
              return (
                <div
                  key={item.id}
                  className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1 cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: item.id, planId: item.plan_id }));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    onDateClick(date, [item]);
                  }}
                >
                  <PlatformIcon platform={item.platform} size={10} className="shrink-0" />
                  {item.topic}
                </div>
              );
            })}
          {items.length > 3 && (
            <span className="text-[10px] text-muted-foreground px-1.5">
              +{items.length - 3} เพิ่มเติม
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const grid = generateMonthGrid(year, month);
    return (
      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1">
          {THAI_DAYS_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>
        {grid.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {row.map((date, ci) => (
              <div key={ci}>
                {renderCell(date)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderQuarterView = () => {
    const q = Math.floor(month / 3) + 1;
    const grids = generateQuarterGrids(year, q);

    return (
      <div className="space-y-4">
        {grids.map(({ month: m, grid }) => (
          <div key={m}>
            <h4 className="text-sm font-semibold mb-2">{THAI_MONTHS_FULL[m]} {year + 543}</h4>
            <div className="grid grid-cols-7 gap-0.5">
              {THAI_DAYS_SHORT.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-0.5">
                  {d}
                </div>
              ))}
              {grid.map((row, ri) =>
                row.map((date, ci) => (
                  <div key={`${ri}-${ci}`} className="min-h-[48px]">
                    {date ? (
                      <div
                        className={cn(
                          'h-full p-0.5 rounded cursor-pointer hover:bg-muted/40 text-[10px]',
                          isToday(date) && 'bg-primary/10 ring-1 ring-primary/20'
                        )}
                        onClick={() => {
                          const items = itemsByDate.get(toDateKey(date)) || [];
                          onDateClick(date, items);
                        }}
                        onDragOver={e => { e.preventDefault(); onDateDragOver(e, date); }}
                        onDrop={e => { e.preventDefault(); onDateDrop(e, date); }}
                      >
                        <span className={cn(isToday(date) && 'bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center')}>
                          {date.getDate()}
                        </span>
                      </div>
                    ) : <div className="min-h-[48px] bg-muted/10 rounded" />}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderYearView = () => {
    const heatmap = generateYearHeatmap(year);

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {heatmap.map(({ month: m }) => {
          const grid = generateMonthGrid(year, m);
          const allItems: PlanItem[] = [];
          for (const row of grid) {
            for (const d of row) {
              if (d) {
                const key = toDateKey(d);
                const items = itemsByDate.get(key) || [];
                allItems.push(...items);
              }
            }
          }
          const total = allItems.length;
          const intensity = total > 10 ? 'bg-primary/30' : total > 3 ? 'bg-primary/15' : total > 0 ? 'bg-primary/5' : 'bg-muted/20';

          return (
            <button
              key={m}
              type="button"
              className={cn('rounded-lg border p-3 text-left hover:bg-muted/30 transition-colors', intensity)}
              onClick={() => {
                onNavigate(new Date(year, m, 1));
                onViewChange('month');
              }}
            >
              <p className="text-xs font-semibold mb-1">{THAI_MONTHS_FULL[m]}</p>
              <div className="grid grid-cols-7 gap-[1px]">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, i) => (
                  <span key={i} className="text-[8px] text-muted-foreground text-center">{d}</span>
                ))}
                {generateMonthGrid(year, m).flat().map((date, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-full aspect-square rounded-[2px]',
                      date ? 'bg-muted/30' : 'bg-transparent',
                    )}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {total > 0 ? `${total} โพสต์` : 'ยังไม่มี'}
              </p>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['month', 'quarter', 'year'] as CalendarView[]).map(v => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? 'default' : 'ghost'}
              className={cn('h-7 text-xs', view === v ? '' : 'hover:bg-muted/50')}
              onClick={() => onViewChange(v)}
            >
              {v === 'month' ? 'เดือน' : v === 'quarter' ? 'ไตรมาส' : 'ปี'}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{headerLabel}</span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={goToday}>
            วันนี้
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          {view === 'month' && renderMonthView()}
          {view === 'quarter' && renderQuarterView()}
          {view === 'year' && renderYearView()}
        </>
      )}
    </div>
  );
}
