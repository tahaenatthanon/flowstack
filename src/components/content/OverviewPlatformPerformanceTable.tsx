import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPlatformLabel } from '@/lib/platformConfig';
import type { PlatformPerformanceRow } from '@/components/content/types';

export type PlatformPeriod = 'day' | 'week' | 'month';

// ป้ายชื่อตั้งใจให้ต่างจาก "7/30/90 วัน" ของกราฟแนวโน้ม Engagement ด้านบน แม้จะเป็น
// date-range control คล้ายกัน — เพื่อไม่ให้ผู้ใช้สับสนว่าเป็นตัวควบคุมเดียวกัน
// (ดู content-overview-social-performance spec: rolling window ไม่ใช่ปฏิทิน)
const PERIOD_OPTIONS: Array<{ value: PlatformPeriod; label: string }> = [
  { value: 'day',   label: 'วัน' },
  { value: 'week',  label: 'สัปดาห์' },
  { value: 'month', label: 'เดือน' },
];

interface Props {
  rows: PlatformPerformanceRow[];
  isLoading?: boolean;
  period: PlatformPeriod;
  onPeriodChange: (period: PlatformPeriod) => void;
}

/**
 * ตาราง "ประสิทธิภาพแต่ละแพลตฟอร์ม" — widget สุดท้ายของแท็บ "ภาพรวม"
 * แพลตฟอร์มที่ตั้งค่าไว้แต่ไม่มีโพสต์ในช่วงที่เลือกยังแสดงแถว (backend ส่งมาแล้ว
 * ไม่กรองทิ้งฝั่งนี้) เรียงลำดับตามที่ backend ส่งมา (มาก→น้อยตาม avg/โพสต์ อยู่แล้ว)
 */
export function OverviewPlatformPerformanceTable({ rows, isLoading = false, period, onPeriodChange }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">ประสิทธิภาพแต่ละแพลตฟอร์ม</span>
        </CardTitle>
        <div className="flex shrink-0 gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={opt.value === period ? 'default' : 'outline'}
              className={cn('h-7 px-2.5 text-xs')}
              onClick={() => onPeriodChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีแพลตฟอร์มที่ตั้งค่าไว้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">แพลตฟอร์ม</th>
                  <th className="py-2 px-3 font-medium text-right">โพสต์</th>
                  <th className="py-2 px-3 font-medium text-right">Engagement รวม</th>
                  <th className="py-2 pl-3 font-medium text-right">Engagement เฉลี่ย/โพสต์</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.platform} className="border-b last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{getPlatformLabel(row.platform)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{row.posts.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{row.engagement.toLocaleString()}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums font-medium">
                      {row.avg_engagement_per_post === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        row.avg_engagement_per_post.toLocaleString()
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
