import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Target, Mail, BarChart3, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

interface SourceRow {
  source: string; total_leads: number; won: number; lost: number;
  won_value: number; projects: number; tickets: number; avg_days_to_close: number | null;
}
interface CampaignRow {
  campaign_id: string; campaign_name: string; campaign_status: string;
  sent_at: string | null; total_sent: number; total_opens: number; total_clicks: number;
  leads: number; won: number; won_value: number; win_rate: number | null;
}
interface TrendRow { month: string; source: string; leads: number; won: number; }

interface AttributionData {
  period: number;
  summary: { total_leads: number; total_won: number; total_lost: number; total_won_value: number; source_count: number };
  by_source: SourceRow[];
  by_campaign: CampaignRow[];
  trend: TrendRow[];
}

function thb(v: number) {
  return `฿${Number(v).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

const PALETTE = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];

// ── Source funnel table ───────────────────────────────────────────────────────

function SourceTable({ rows }: { rows: SourceRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูล</p>;

  const maxValue = Math.max(...rows.map(r => r.won_value), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">แหล่งที่มา</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Leads</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Won</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Win Rate</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Revenue</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">โปรเจกต์</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Tickets</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Avg Close</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Revenue Bar</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => {
            const winRate = r.total_leads > 0 ? Math.round(r.won / r.total_leads * 100) : 0;
            const barPct  = maxValue > 0 ? Math.min(100, r.won_value / maxValue * 100) : 0;
            return (
              <tr key={r.source} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                    <span className="font-medium">{r.source}</span>
                    {i === 0 && <Trophy className="h-3 w-3 text-amber-400" />}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">{r.total_leads}</td>
                <td className="px-3 py-2 text-right text-emerald-600 font-medium">{r.won}</td>
                <td className="px-3 py-2 text-right">
                  <span className={winRate >= 50 ? 'text-emerald-600 font-medium' : winRate >= 20 ? 'text-amber-600' : 'text-red-500'}>
                    {winRate}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium">{r.won_value > 0 ? thb(r.won_value) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.projects}</td>
                <td className="px-3 py-2 text-right">
                  {r.tickets > 0
                    ? <span className="text-amber-600">{r.tickets}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {r.avg_days_to_close != null ? `${r.avg_days_to_close}d` : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="h-2 rounded-full bg-muted overflow-hidden w-24">
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Campaign attribution table ────────────────────────────────────────────────

function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  if (!rows.length) return (
    <p className="text-sm text-muted-foreground text-center py-6">
      ยังไม่มี Campaign ที่ลิงก์กับ Deal — เมื่อสร้าง Deal ให้เลือก Campaign ที่นำมา
    </p>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Campaign</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">ส่งแล้ว</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Opens</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Clicks</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Leads</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Won</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Win Rate</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(r => (
            <tr key={r.campaign_id} className="hover:bg-muted/30">
              <td className="px-3 py-2 max-w-[180px]">
                <div className="font-medium truncate">{r.campaign_name}</div>
                {r.sent_at && <div className="text-[10px] text-muted-foreground">{r.sent_at.slice(0,10)}</div>}
              </td>
              <td className="px-3 py-2 text-right">{r.total_sent.toLocaleString()}</td>
              <td className="px-3 py-2 text-right">
                {r.total_sent > 0
                  ? <>{r.total_opens} <span className="text-muted-foreground">({Math.round(r.total_opens/r.total_sent*100)}%)</span></>
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                {r.total_sent > 0
                  ? <>{r.total_clicks} <span className="text-muted-foreground">({Math.round(r.total_clicks/r.total_sent*100)}%)</span></>
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right">{r.leads}</td>
              <td className="px-3 py-2 text-right text-emerald-600 font-medium">{r.won}</td>
              <td className="px-3 py-2 text-right">
                {r.win_rate != null
                  ? <span className={r.win_rate >= 30 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>{r.win_rate}%</span>
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right font-medium">
                {r.won_value > 0 ? thb(r.won_value) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Monthly trend chart ───────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: TrendRow[] }) {
  // Aggregate by month (all sources combined)
  const byMonth: Record<string, { month: string; leads: number; won: number }> = {};
  trend.forEach(r => {
    if (!byMonth[r.month]) byMonth[r.month] = { month: r.month, leads: 0, won: 0 };
    byMonth[r.month].leads += r.leads;
    byMonth[r.month].won   += r.won;
  });
  const data = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 6 }}
          formatter={(v: number, name: string) => [v, name === 'leads' ? 'Leads ทั้งหมด' : 'Won']}
        />
        <Bar dataKey="leads" fill="#6366f1" opacity={0.5} radius={[2,2,0,0]} name="leads" />
        <Bar dataKey="won"   fill="#10b981" radius={[2,2,0,0]} name="won" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Source pie summary ────────────────────────────────────────────────────────

function SourcePie({ rows }: { rows: SourceRow[] }) {
  const top5 = rows.slice(0, 5);
  const total = top5.reduce((s, r) => s + r.total_leads, 0) || 1;

  return (
    <div className="space-y-2">
      {top5.map((r, i) => {
        const pct = Math.round(r.total_leads / total * 100);
        return (
          <div key={r.source} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <span className="truncate max-w-[120px]">{r.source}</span>
              </div>
              <span className="text-muted-foreground">{r.total_leads} ({pct}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AttributionTab() {
  const [period, setPeriod] = useState('365');

  const { data, isLoading } = useQuery<AttributionData>({
    queryKey: ['marketing-attribution', period],
    queryFn: () => apiFetch(`/marketing-attribution.php?period=${period}`),
  });

  const s = data?.summary;

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-violet-500" />
          Marketing Attribution
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 วัน</SelectItem>
            <SelectItem value="90">90 วัน</SelectItem>
            <SelectItem value="180">6 เดือน</SelectItem>
            <SelectItem value="365">1 ปี</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}

      {data && s && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Leads ทั้งหมด', value: s.total_leads.toLocaleString(), icon: Target, color: 'text-blue-600' },
              { label: 'Won Deals',      value: s.total_won.toLocaleString(),   icon: Trophy, color: 'text-emerald-600' },
              { label: 'Win Rate',
                value: s.total_leads > 0 ? `${Math.round(s.total_won / s.total_leads * 100)}%` : '—',
                icon: TrendingUp, color: 'text-violet-600' },
              { label: 'Revenue (Won)', value: thb(s.total_won_value), icon: BarChart3, color: 'text-amber-600' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <kpi.icon className="h-3.5 w-3.5" />
                  {kpi.label}
                </div>
                <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Trend + Source breakdown side by side */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 rounded-lg border bg-card p-4">
              <div className="text-xs font-medium mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                Leads รายเดือน (12 เดือนล่าสุด)
              </div>
              <TrendChart trend={data.trend} />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs font-medium mb-3 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                Top Sources
              </div>
              <SourcePie rows={data.by_source} />
            </div>
          </div>

          {/* Lead source full journey table */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Lead Source — Full Journey Funnel</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{data.by_source.length} sources</Badge>
            </div>
            <SourceTable rows={data.by_source} />
          </div>

          {/* Campaign attribution */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Email Campaign → Deal Attribution</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{data.by_campaign.length} campaigns</Badge>
            </div>
            <CampaignTable rows={data.by_campaign} />
          </div>
        </>
      )}
    </div>
  );
}
