import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { X } from 'lucide-react';

interface ReportDateFilterProps {
  startDate: string;
  endDate: string;
  onDateRangeChange: (start: string, end: string) => void;
  onReset?: () => void;
  summary?: string;
}

export default function ReportDateFilter({
  startDate,
  endDate,
  onDateRangeChange,
  onReset,
  summary,
}: ReportDateFilterProps) {
  const today = new Date();

  const presets = [
    {
      label: 'เดือนนี้',
      start: format(startOfMonth(today), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd'),
    },
    {
      label: 'เดือนที่แล้ว',
      start: format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
      end: format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
    },
    {
      label: '3 เดือนล่าสุด',
      start: format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd'),
    },
    {
      label: 'ปีนี้',
      start: format(startOfYear(today), 'yyyy-MM-dd'),
      end: format(endOfYear(today), 'yyyy-MM-dd'),
    },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant={startDate === preset.start && endDate === preset.end ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => onDateRangeChange(preset.start, preset.end)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Date inputs + reset */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onDateRangeChange(e.target.value, endDate)}
            className="w-full sm:w-[160px]"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onDateRangeChange(startDate, e.target.value)}
            className="w-full sm:w-[160px]"
          />
          {onReset && (
            <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
              <X className="w-3.5 h-3.5" />
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        {/* Summary */}
        {summary && (
          <p className="text-xs text-muted-foreground">{summary}</p>
        )}
    </div>
  );
}
