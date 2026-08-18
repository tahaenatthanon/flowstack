import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ThroughputPoint } from '@/components/content/types';

const SERIES = [
  { key: 'created',   label: 'สร้าง',      color: '#3B82F6' },
  { key: 'requested', label: 'ขออนุมัติ',  color: '#F59E0B' },
  { key: 'approved',  label: 'อนุมัติ',    color: '#8B5CF6' },
  { key: 'published', label: 'เผยแพร่',    color: '#10B981' },
] as const;

/** 'YYYY-MM' → 'ส.ค. 69' (พ.ศ. 2 หลัก) */
function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
}

interface Props {
  data: ThroughputPoint[];
  isLoading: boolean;
}

export function ContentThroughputChart({ data, isLoading }: Props) {
  // The endpoint always returns a dense 12-month axis, so "no activity" means
  // every point is zero rather than an empty array.
  const hasActivity = data.some(p => p.created + p.requested + p.approved + p.published > 0);
  const chartData = data.map(p => ({ ...p, label: formatPeriod(p.period) }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">แนวโน้ม Throughput รายเดือน</span>
        </CardTitle>
        <span className="shrink-0 text-xs text-muted-foreground">12 เดือนย้อนหลัง</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : !hasActivity ? (
          <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีความเคลื่อนไหวใน 12 เดือนที่ผ่านมา</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(l) => `เดือน ${l}`}
                formatter={(value: number, name: string) => [`${value} ชิ้น`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map(s => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
