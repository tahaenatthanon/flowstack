import { TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlatformLabel } from '@/lib/platformConfig';
import type { ContentOverview } from '@/components/content/types';
import { ScopeTag, SectionHeading } from './shared';
import { fmtNumber } from './format';

/**
 * 3. ผลลัพธ์ — Engagement Trend รายเดือนตั้งแต่เดือนแรกที่มีข้อมูล (ตามเดือนที่เผยแพร่) + Platform Performance จากข้อมูลทั้งหมด
 * ตารางแพลตฟอร์มคำนวณจากแถวชุดเดียวกับ Global KPI ผลรวมจึงเท่ากับ KPI เสมอ
 */

/** 'YYYY-MM' → 'ก.ย. 69' */
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
}

interface Props {
  data?: ContentOverview;
  isLoading?: boolean;
}

export function ResultsSection({ data, isLoading = false }: Props) {
  const trend = (data?.engagement_trend ?? []).map(p => ({ ...p, label: monthLabel(p.month) }));
  const hasTrend = trend.some(p => p.engagement !== null);
  const rows = data?.platform_performance ?? [];

  return (
    <section className="space-y-3">
      <SectionHeading index={3} title="ผลลัพธ์" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Engagement Trend</span>
            </CardTitle>
            <ScopeTag>รายเดือน</ScopeTag>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : !hasTrend ? (
              <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีโพสต์ที่วัดผลได้</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: number | null, _name, item) => [
                        value === null ? '—' : `${value.toLocaleString('th-TH')} (${item?.payload?.posts ?? 0} โพสต์)`,
                        'Engagement',
                      ]}
                    />
                    {/* connectNulls=false: เดือนที่ไม่มีโพสต์ที่วัดได้เป็นช่องว่าง ไม่ใช่ 0 */}
                    <Line type="monotone" dataKey="engagement" stroke="#EC4899" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-1 text-xs text-muted-foreground">Reaction + Comment + Share + Click ตามเดือนที่เผยแพร่ · เดือนที่เว้นว่าง = ไม่มีโพสต์ที่วัดผลได้</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Platform Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : rows.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลแพลตฟอร์ม</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Platform</th>
                      <th className="px-3 py-2 text-right font-medium">Posts</th>
                      <th className="px-3 py-2 text-right font-medium">Engagement</th>
                      <th className="px-3 py-2 text-right font-medium">Avg/Post</th>
                      <th className="py-2 pl-3 text-right font-medium">Followers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.platform} className="border-b last:border-0">
                        <td className="py-2 pr-3">{getPlatformLabel(r.platform)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(r.posts)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(r.engagement)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(r.avg_per_post, 1)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{fmtNumber(r.followers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!isLoading && rows.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Followers = ผู้ติดตามเพจ มีข้อมูลเฉพาะ Facebook</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
