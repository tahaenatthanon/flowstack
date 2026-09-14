import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EngagementTrendPoint } from '@/components/content/types';

export type TrendRange = '7' | '30' | '90';

const RANGE_OPTIONS: Array<{ value: TrendRange; label: string; granularityLabel: string }> = [
  { value: '7',  label: '7 วัน',  granularityLabel: 'รายวัน' },
  { value: '30', label: '30 วัน', granularityLabel: 'รายสัปดาห์' },
  { value: '90', label: '90 วัน', granularityLabel: 'รายเดือน' },
];

/** 'YYYY-MM-DD' → 'DD ส.ค.' (แสดงวันที่สิ้นสุดของแต่ละ bucket) */
function formatBucketLabel(bucket: string): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

interface Props {
  data: EngagementTrendPoint[];
  isLoading?: boolean;
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
}

/**
 * กราฟแนวโน้ม Engagement เส้นเดียวของแท็บ "ภาพรวม" — ควบคุมด้วย 7/30/90 วัน
 * granularity ของแกน x auto ตามช่วงที่เลือก (กำหนดฝั่ง backend แล้ว ไม่มี toggle
 * แยกให้เลือกเอง — ดู content-overview-social-performance spec)
 *
 * ไม่มีเส้น views แยก และไม่มี engagement rate (%) — Facebook feed post คืน views=0
 * เสมอ การหาร/แสดงเส้นนั้นจะทำให้เข้าใจผิดว่าไม่มีคนดู (ดู AnalyticsSocialTab.tsx)
 */
export function OverviewEngagementTrendChart({ data, isLoading = false, range, onRangeChange }: Props) {
  const hasActivity = data.some(p => p.engagement > 0);
  const chartData = data.map(p => ({ ...p, label: formatBucketLabel(p.bucket_label) }));
  const activeOption = RANGE_OPTIONS.find(o => o.value === range) ?? RANGE_OPTIONS[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">แนวโน้ม Engagement</span>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">({activeOption.granularityLabel})</span>
        </CardTitle>
        <div className="flex shrink-0 gap-1">
          {RANGE_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={opt.value === range ? 'default' : 'outline'}
              className={cn('h-7 px-2.5 text-xs')}
              onClick={() => onRangeChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : !hasActivity ? (
          <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มี engagement ในช่วงเวลาที่เลือก</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number) => [`${value.toLocaleString()}`, 'Engagement']}
              />
              <Line
                type="monotone"
                dataKey="engagement"
                name="Engagement"
                stroke="#EC4899"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
