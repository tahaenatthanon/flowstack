import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { Send, Eye, MousePointerClick, Megaphone, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PageShell from '@/components/PageShell';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', scheduled: '#60a5fa', sending: '#f59e0b',
  sent: '#22c55e', cancelled: '#f87171',
};
const STATUS_TH: Record<string, string> = {
  draft: 'ร่าง', scheduled: 'กำหนดเวลา', sending: 'กำลังส่ง',
  sent: 'ส่งแล้ว', cancelled: 'ยกเลิก',
};

function Stat({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

const TOP_SORT_OPTIONS = [
  { value: 'opens', label: 'จำนวนเปิด' },
  { value: 'clicks', label: 'จำนวนคลิก' },
  { value: 'open_rate', label: 'อัตราเปิด' },
  { value: 'click_rate', label: 'อัตราคลิก' },
];

export default function CampaignAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [topSort, setTopSort] = useState('opens');

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-analytics', range, topSort],
    queryFn: () => apiFetch(`/campaign-analytics.php?range=${range}&top_sort=${topSort}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        ไม่สามารถโหลดข้อมูลได้
      </div>
    );
  }

  const { summary, status_breakdown, trends, top_campaigns, campaigns } = data;

  return (
    <PageShell
      breadcrumbs={[
        { label: 'แคมเปญอีเมล', href: '/campaigns' },
        { label: 'วิเคราะห์แคมเปญ', isCurrent: true },
      ]}
      title="วิเคราะห์แคมเปญ"
      description="ภาพรวมประสิทธิภาพแคมเปญอีเมล อัตราการเปิดและคลิก"
      actions={
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30d">30 วันล่าสุด</SelectItem>
            <SelectItem value="90d">90 วันล่าสุด</SelectItem>
            <SelectItem value="12m">12 เดือนล่าสุด</SelectItem>
          </SelectContent>
        </Select>
      }
    >

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="แคมเปญทั้งหมด" value={summary.total_campaigns} icon={Megaphone} color="text-violet-500" />
        <Stat label="ส่งทั้งหมด" value={summary.total_sent.toLocaleString()} icon={Send} color="text-blue-500" />
        <Stat label="อัตราเปิดรวม" value={`${summary.avg_open_rate}%`} icon={Eye} color="text-green-500" />
        <Stat label="อัตราคลิกเฉลี่ย" value={`${summary.avg_click_rate}%`} icon={MousePointerClick} color="text-orange-500" />
        <Stat label="CTOR (คลิกต่อการเปิด)" value={`${summary.ctor}%`} icon={MousePointerClick} color="text-violet-500" />
      </div>

      {/* Summary funnel: ส่ง → เปิด → คลิก */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ภาพรวมแคมเปญ</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.total_sent === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ไม่มีข้อมูลในช่วงเวลานี้</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'ส่ง', value: summary.total_sent, pct: 100, color: 'bg-blue-500' },
                { label: 'เปิด', value: summary.total_opens, pct: summary.avg_open_rate, color: 'bg-green-500' },
                { label: 'คลิก', value: summary.total_clicks, pct: summary.avg_click_rate, color: 'bg-amber-500' },
              ].map((stage) => (
                <div key={stage.label} className="min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{stage.label}</span>
                    <span className="font-semibold">{stage.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', stage.color)} style={{ width: `${Math.min(stage.pct, 100)}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{stage.value.toLocaleString()} คน</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly trends - Line chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">แนวโน้มการเปิด/คลิก</CardTitle>
          </CardHeader>
          <CardContent>
            {trends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">ไม่มีข้อมูลในช่วงเวลานี้</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value: number, name: string, item: any) => {
                      const raw = name === 'เปิด' ? item.payload.opens : item.payload.clicks;
                      return [`${value}% (${raw.toLocaleString()} คน จากส่ง ${item.payload.sent.toLocaleString()})`, name];
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="open_rate" name="เปิด" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="click_rate" name="คลิก" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top campaigns - Bar chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">5 แคมเปญยอดนิยม</CardTitle>
            <Select value={topSort} onValueChange={setTopSort}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOP_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {top_campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">ไม่มีข้อมูลในช่วงเวลานี้</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={top_campaigns} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={120}
                    tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '…' : v}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_opens" name="เปิด" fill="#6366f1" />
                  <Bar dataKey="total_clicks" name="คลิก" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown - Pie chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">สถานะแคมเปญ</CardTitle>
        </CardHeader>
        <CardContent>
          {status_breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">ไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={status_breakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ status, count }) => `${STATUS_TH[status] || status} (${count})`}
                >
                  {status_breakdown.map((entry: any) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number, name: string) => [val, STATUS_TH[name] || name]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* All campaigns table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">แคมเปญทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">ไม่มีแคมเปญ</p>
          ) : (
            <>
              {/* Mobile campaign cards */}
              <div className="md:hidden space-y-3">
                {campaigns.map((c: any) => (
                  <div key={c.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm flex-1">{c.name}</div>
                      <Badge variant="outline" className="text-[11px] shrink-0">
                        {STATUS_TH[c.status] || c.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>ผู้รับ: <strong className="text-foreground">{c.total_recipients.toLocaleString()}</strong></span>
                      <span>ส่งแล้ว: <strong className="text-foreground">{c.total_sent.toLocaleString()}</strong></span>
                      <span>ส่งไม่สำเร็จ: <strong className="text-red-600">{c.total_failed.toLocaleString()}</strong></span>
                      <span>เปิด: <strong className="text-foreground">{c.total_opens.toLocaleString()}</strong></span>
                      <span>คลิก: <strong className="text-foreground">{c.total_clicks.toLocaleString()}</strong></span>
                      <span>อัตราเปิด: <strong className="text-green-600">{c.open_rate}%</strong></span>
                      <span>อัตราคลิก: <strong className="text-orange-600">{c.click_rate}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">ชื่อแคมเปญ</TableHead>
                      <TableHead className="text-xs">สถานะ</TableHead>
                      <TableHead className="text-xs text-right">ผู้รับ</TableHead>
                      <TableHead className="text-xs text-right">ส่งแล้ว</TableHead>
                      <TableHead className="text-xs text-right">ส่งไม่สำเร็จ</TableHead>
                      <TableHead className="text-xs text-right">เปิด</TableHead>
                      <TableHead className="text-xs text-right">คลิก</TableHead>
                      <TableHead className="text-xs text-right">อัตราเปิด</TableHead>
                      <TableHead className="text-xs text-right">อัตราคลิก</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px]">
                            {STATUS_TH[c.status] || c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-right">{c.total_recipients.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-right">{c.total_sent.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-right text-red-600">{c.total_failed.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-right">{c.total_opens.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-right">{c.total_clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-right">{c.open_rate}%</TableCell>
                        <TableCell className="text-sm text-right">{c.click_rate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
