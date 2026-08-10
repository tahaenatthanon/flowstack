import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  TrendingUp, Users, Zap, Clock, Target, Award, DollarSign,
  CheckCircle2, AlertTriangle, BarChart3, Layers, RefreshCw,
  FolderKanban, LifeBuoy, Edit2, Save, X, Building2, Ticket,
  Sparkles, Lightbulb, FileText, ShieldCheck, Smile, HelpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import PageShell from '@/components/PageShell';
import { cn } from '@/lib/utils';
import { STAGE_LABELS } from '@/lib/labels';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

// Axis-B label: Project Managers see the PM Goal Score; everyone else sees BD/Lead.
const bAxisLabel = (position?: string, full = false): string =>
  position === 'Project Manager' ? 'เป้า PM' : (full ? 'BD (Lead)' : 'BD');

// ─── year helpers ───────────────────────────────────────────────────────────
function yearOptions() {
  const currentYear = new Date().getFullYear();
  const opts = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: String(y) };
  });
  return [{ value: 'all', label: 'ทั้งหมด' }, ...opts];
}

// ─── Grade badge ─────────────────────────────────────────────────────────────
function GradeBadge({ grade }: { grade: string }) {
  const color: Record<string, string> = {
    'A+': 'bg-violet-100 text-violet-700 border-violet-300',
    'A':  'bg-green-100 text-green-700 border-green-300',
    'B+': 'bg-blue-100 text-blue-700 border-blue-300',
    'B':  'bg-sky-100 text-sky-700 border-sky-300',
    'C':  'bg-yellow-100 text-yellow-700 border-yellow-300',
    'D':  'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <span className={cn('text-xs font-bold px-2 py-0.5 rounded border', color[grade] ?? 'bg-muted text-muted-foreground')}>
      {grade}
    </span>
  );
}

// ─── KPI ring ────────────────────────────────────────────────────────────────
function KpiRing({ score, label, color }: { score: number | null; label: string; color: string }) {
  const r = 40; const circ = 2 * Math.PI * r;
  const effective = score ?? 0;
  const dash = (effective / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
          {score !== null ? score : 'N/A'}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function Stat({ label, value, icon: Icon, sub, color = '' }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const STAGE_TH: Record<string, string> = { ...STAGE_LABELS };
const STAGE_COLOR: Record<string, string> = {
  lead: '#94a3b8', qualified: '#60a5fa', proposal: '#a78bfa',
  negotiation: '#f59e0b', won: '#22c55e', lost: '#f87171',
};
const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#f87171', '#38bdf8', '#e879f9'];

// ─── CEO DASHBOARD ───────────────────────────────────────────────────────────
function CeoDashboard({ month }: { month: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['impactos-ceo', month],
    queryFn: () => apiFetch(`/impactos.php?view=ceo&year=${month.substring(0, 4)}`),
  });

  if (isLoading) return <Spinner />;
  if (!data) return <Empty />;

  const fmt = (v: number | string) => {
    const n = Number(v) || 0;
    return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `฿${(n / 1_000).toFixed(0)}K`
      : `฿${n.toFixed(0)}`;
  };
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Revenue วันนี้"    value={fmt(data.revenue_today)}   icon={DollarSign}   color="text-green-500" sub="จากดีลที่ปิดวันนี้" />
        <Stat label="Revenue ปีนี้"    value={fmt(data.revenue_month)}   icon={TrendingUp}   color="text-blue-500"  sub={`Pipeline: ${fmt(data.pipeline_value)}`} />
        <Stat label="Active Users"       value={data.active_users}          icon={Users}        color="text-violet-500" sub="คนที่ log งาน" />
        <Stat label="งานเสร็จปีนี้"  value={data.tasks_done}            icon={CheckCircle2} color="text-teal-500"  sub={`เฉลี่ย ${data.avg_delivery_days} วัน/งาน`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue trend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue Trend (6 เดือน)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4,4,0,0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Summary ring stats */}
        <Card>
          <CardHeader><CardTitle className="text-sm">ภาพรวมองค์กรปีนี้</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 py-4">
              <KpiRing score={Math.min(100, Math.round(data.active_users * 5))} label="Active Rate" color="#6366f1" />
              <KpiRing score={Math.min(100, data.tasks_done)} label="Delivery" color="#22c55e" />
              <KpiRing score={data.avg_delivery_days > 0 ? Math.max(0, Math.round(100 - data.avg_delivery_days * 5)) : 0} label="Speed" color="#f59e0b" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Active Projects</p>
                <p className="text-xl font-bold">{data.active_projects}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total Hours</p>
                <p className="text-xl font-bold">{data.total_hours.toFixed(0)} ชม.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
function Leaderboard({ month }: { month: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['impactos-leaderboard', month],
    queryFn: () => apiFetch(`/impactos.php?view=leaderboard&year=${month.substring(0, 4)}`),
  });

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showKpiInfo, setShowKpiInfo] = useState(false);

  if (isLoading) return <Spinner />;
  if (!data?.length) return <Empty text="ไม่มีข้อมูล KPI ปีนี้" />;

  const selectedUser = data.find((u: any) => u.user_id === selectedUserId) ?? data[0];
  const hasBdLb = (selectedUser.kpi_weights?.b ?? 0) > 0;
  const radarData = [
    { subject: 'Speed',  value: selectedUser.speed_score },
    { subject: 'Impact', value: selectedUser.impact_score },
    { subject: 'AI',     value: selectedUser.ai_score },
    { subject: 'Collab', value: selectedUser.collab_score ?? 0 },
    ...(hasBdLb ? [{ subject: bAxisLabel(selectedUser.position), value: selectedUser.bd_score ?? 0 }] : []),
  ];

  const medal = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-6">
      {/* KPI Explanation */}
      <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
        <button
          type="button"
          onClick={() => setShowKpiInfo(!showKpiInfo)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            คะแนนแต่ละช่องคืออะไร? ดูอันดับจากอะไร?
          </span>
          <span className="text-xs text-muted-foreground">{showKpiInfo ? 'ซ่อน' : 'แสดง'}</span>
        </button>
        {showKpiInfo && (
          <div className="px-4 pb-4 space-y-3 text-sm border-t pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 p-3">
                <p className="font-semibold text-violet-700 dark:text-violet-400">⚡ Speed (ความเร็ว)</p>
                <p className="text-xs text-muted-foreground mt-1">คะแนนจากการส่งงานตรงเวลา ยิ่งส่งก่อนหรือตรง deadline ยิ่งได้คะแนนสูง คิดจากสัดส่วนงานที่เสร็จทันกำหนด vs งานทั้งหมด</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3">
                <p className="font-semibold text-green-700 dark:text-green-400">💪 Impact (ผลงาน)</p>
                <p className="text-xs text-muted-foreground mt-1">คะแนนจากปริมาณชั่วโมงทำงานจริง ยิ่งลงเวลามากและปิดงานได้มาก ยิ่งมี Impact สูง สะท้อน productivity โดยรวม</p>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3">
                <p className="font-semibold text-amber-700 dark:text-amber-400">🤖 AI Usage</p>
                <p className="text-xs text-muted-foreground mt-1">คะแนนจากการนำ AI มาใช้ในงาน — แชท AI, สร้างคอนเทนต์ด้วย AI, วิเคราะห์ข้อมูลด้วย AI ยิ่งใช้ AI ช่วยงานบ่อย ยิ่งได้คะแนนสูง</p>
              </div>
              <div className="rounded-lg bg-sky-50 dark:bg-sky-950/20 p-3">
                <p className="font-semibold text-sky-700 dark:text-sky-400">🤝 Collab (ความร่วมมือ)</p>
                <p className="text-xs text-muted-foreground mt-1">คะแนนจากการทำงานร่วมกับผู้อื่น — จำนวนงานที่ทำร่วมกับทีม, การช่วยแก้ปัญหา, การเสนอแนวทางแก้ไข (Proposed Solutions)</p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-semibold mb-1">📐 สูตรคำนวณอันดับ</p>
              <p className="text-xs text-muted-foreground font-mono">
                Total = (P×Impact) + (Q×Speed) + (A×AI) + (S×Collab)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                น้ำหนักแต่ละแกนปรับตามตำแหน่งงาน (Admin → KPI Weights) | คะแนนเต็ม 100
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                เกรด: <strong>A+</strong> (90+), <strong>A</strong> (80+), <strong>B+</strong> (70+), <strong>B</strong> (60+), <strong>C</strong> (50+), <strong>D</strong> (&lt;50)
              </p>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="font-semibold mb-1">💡 วิธีเพิ่มคะแนน</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>บันทึกเวลาทำงาน (Time Sheet) สม่ำเสมอและแม่นยำ — ลงรายละเอียดกิจกรรมให้ชัดเจน</li>
                <li>ส่งงานให้ตรงหรือก่อนกำหนด — อัปเดตสถานะงานสม่ำเสมอ ไม่ปล่อยให้งานค้าง</li>
                <li>ใช้ AI Chat ช่วยวิเคราะห์งาน สร้างคอนเทนต์ หรือแสกนนามบัตร — ทุกการใช้งานมีผลต่อคะแนน AI</li>
                <li>ทำงานร่วมกับทีม — เสนอแนวทางแก้ไขใน Ticket, มีส่วนร่วมในโปรเจกต์ร่วมกับผู้อื่น</li>
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* All members cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4" />
            KPI Ranking — {data.length} คน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {data.map((u: any, i: number) => (
              <button
                key={u.user_id}
                onClick={() => setSelectedUserId(u.user_id)}
                className={cn(
                  'relative rounded-lg border p-3 text-center transition-all cursor-pointer',
                  'hover:shadow-md hover:border-primary/50',
                  selectedUser.user_id === u.user_id
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                    : 'bg-card'
                )}
              >
                {i < 3 && <span className="absolute top-1.5 left-1.5 text-lg">{medal[i]}</span>}
                <Avatar className="h-10 w-10 mx-auto mb-1.5">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {u.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="font-semibold text-xs truncate">{u.name}</p>
                <p className="text-[10px] text-muted-foreground mb-1.5">{u.position || '—'}</p>
                <div className="text-xl font-bold text-primary">{u.total_score}</div>
                <GradeBadge grade={u.grade} />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart for selected user */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">KPI Profile — {selectedUser.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-2 mb-4 ${hasBdLb ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-indigo-600">{selectedUser.speed_score}</div>
                <div className="text-[10px] text-muted-foreground">Speed (Q)</div>
                {selectedUser.kpi_weights && <div className="text-[10px] text-muted-foreground/60">{Math.round(selectedUser.kpi_weights.q * 100)}%</div>}
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-emerald-600">{selectedUser.impact_score}</div>
                <div className="text-[10px] text-muted-foreground">Impact (P)</div>
                {selectedUser.kpi_weights && <div className="text-[10px] text-muted-foreground/60">{Math.round(selectedUser.kpi_weights.p * 100)}%</div>}
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-amber-600">{selectedUser.ai_score}</div>
                <div className="text-[10px] text-muted-foreground">AI (A)</div>
                {selectedUser.kpi_weights && <div className="text-[10px] text-muted-foreground/60">{Math.round(selectedUser.kpi_weights.a * 100)}%</div>}
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="text-lg font-bold text-violet-600">{selectedUser.collab_score !== null ? selectedUser.collab_score : 'N/A'}</div>
                <div className="text-[10px] text-muted-foreground">Collab (S)</div>
                {selectedUser.kpi_weights && <div className="text-[10px] text-muted-foreground/60">{Math.round(selectedUser.kpi_weights.s * 100)}%</div>}
              </div>
              {hasBdLb && (
                <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="text-lg font-bold text-blue-600">{selectedUser.bd_score ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground">{bAxisLabel(selectedUser.position)} (B)</div>
                  {selectedUser.kpi_weights && <div className="text-[10px] text-muted-foreground/60">{Math.round(selectedUser.kpi_weights.b * 100)}%</div>}
                </div>
              )}
            </div>
            {selectedUser.kpi_weights && (
              <div className="mb-3 rounded bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-mono">
                Total = ({Math.round(selectedUser.kpi_weights.p*100)}%×Impact) + ({Math.round(selectedUser.kpi_weights.q*100)}%×Speed) + ({Math.round(selectedUser.kpi_weights.a*100)}%×AI) + ({Math.round(selectedUser.kpi_weights.s*100)}%×Collab){hasBdLb ? ` + (${Math.round(selectedUser.kpi_weights.b*100)}%×BD)` : ''} = <strong className="text-foreground">{selectedUser.total_score}</strong>
              </div>
            )}
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Full table */}
        <Card>
          <CardHeader><CardTitle className="text-sm">KPI Ranking ทั้งหมด</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">ชื่อ</th>
                    <th className="px-4 py-2 text-right">Speed</th>
                    <th className="px-4 py-2 text-right">Impact</th>
                    <th className="px-4 py-2 text-right">AI</th>
                    <th className="px-4 py-2 text-right">Collab</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((u: any) => {
                    const rev = u.revenue_contribution ?? 0;
                    const revFmt = rev >= 1_000_000 ? `฿${(rev/1_000_000).toFixed(1)}M` : rev >= 1_000 ? `฿${(rev/1_000).toFixed(0)}K` : rev > 0 ? `฿${rev.toFixed(0)}` : '—';
                    return (
                    <tr
                      key={u.user_id}
                      className={cn(
                        'border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer',
                        selectedUser.user_id === u.user_id && 'bg-primary/5'
                      )}
                      onClick={() => setSelectedUserId(u.user_id)}
                    >
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{u.rank}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.tasks_done} งาน · {u.hours.toFixed(0)} ชม.</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">{u.speed_score}</td>
                      <td className="px-4 py-2.5 text-right">{u.impact_score}</td>
                      <td className="px-4 py-2.5 text-right">{u.ai_score}</td>
                      <td className="px-4 py-2.5 text-right">{u.collab_score ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary">{u.total_score}</td>
                      <td className="px-4 py-2.5 text-right text-green-600 font-medium text-xs">{revFmt}</td>
                      <td className="px-4 py-2.5 text-right"><GradeBadge grade={u.grade} /></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── DEV DASHBOARD ───────────────────────────────────────────────────────────
function DevDashboard({ month }: { month: string }) {
  const { user } = useAuth();
  const [aiEnabled, setAiEnabled] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['impactos-dev', month, user?.id],
    queryFn: () => apiFetch(`/impactos.php?view=dev&year=${month.substring(0, 4)}&user_id=${user?.id}`),
    enabled: !!user?.id,
  });

  const { data: aiData, isLoading: aiLoading, isError: aiError } = useQuery({
    queryKey: ['impactos-ai-analysis', month, user?.id],
    queryFn: () => apiFetch(`/impactos.php?view=ai_analysis&year=${month.substring(0, 4)}&user_id=${user?.id}`),
    enabled: !!user?.id && aiEnabled,
    staleTime: 1000 * 60 * 10,  // cache 10 min
  });

  if (isLoading) return <Spinner />;
  if (!data) return <Empty />;

  const fmt = (v: number | string) => {
    const n = Number(v) || 0;
    return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `฿${(n / 1_000).toFixed(0)}K`
      : `฿${n.toFixed(0)}`;
  };
  const hasBd = (data.kpi_weights?.b ?? 0) > 0;
  const radarData = [
    { subject: 'Speed',  value: data.speed_score },
    { subject: 'Impact', value: data.impact_score },
    { subject: 'AI',     value: data.ai_score },
    { subject: 'Collab', value: data.collab_score ?? 0 },
    ...(hasBd ? [{ subject: bAxisLabel(data.position), value: data.bd_score ?? 0 }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Revenue contribution banner */}
      {data.revenue_contribution > 0 && (
        <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 dark:border-green-800 p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revenue ที่คุณมีส่วนร่วม (Dev → Revenue)</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(data.revenue_contribution)}</p>
            <p className="text-xs text-muted-foreground">คำนวณจากโปรเจกต์ที่คุณทำงาน × สัดส่วนงาน × มูลค่าดีลที่ปิดได้</p>
          </div>
        </div>
      )}

      {/* My KPI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            KPI Score ของคุณ — {month}
            <GradeBadge grade={data.grade} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-6 py-2">
            <KpiRing score={data.speed_score}  label="Speed"        color="#6366f1" />
            <KpiRing score={data.impact_score} label="Impact"       color="#22c55e" />
            <KpiRing score={data.ai_score}     label="AI Usage"     color="#f59e0b" />
            <KpiRing score={data.collab_score} label="Collaboration" color="#38bdf8" />
            {hasBd && <KpiRing score={data.bd_score ?? 0} label={bAxisLabel(data.position, true)} color="#3b82f6" />}
            <KpiRing score={data.total_score}  label="KPI Total"    color="#e879f9" />
          </div>
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-medium mb-1">🧠 สูตรคำนวณ (weights ตามตำแหน่งงาน)</p>
            {data.kpi_weights ? (
              <p className="text-xs text-muted-foreground font-mono">
                Total = ({Math.round(data.kpi_weights.p*100)}%×Impact) + ({Math.round(data.kpi_weights.q*100)}%×Speed) + ({Math.round(data.kpi_weights.a*100)}%×AI) + ({Math.round(data.kpi_weights.s*100)}%×Collab){hasBd ? ` + (${Math.round(data.kpi_weights.b*100)}%×BD)` : ''} = <strong>{data.total_score}</strong>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">
                Total = (25%×Impact) + (25%×Speed) + (25%×AI) + (25%×Collab) = <strong>{data.total_score}</strong>
              </p>
            )}
          </div>

          {/* Improvement Recommendations */}
          {(() => {
            const scores = [
              { key: 'Speed',  score: data.speed_score  ?? 0, color: '#6366f1', icon: '⚡', label: 'ความเร็ว' },
              { key: 'Impact', score: data.impact_score ?? 0, color: '#22c55e', icon: '💪', label: 'ผลงาน' },
              { key: 'AI',     score: data.ai_score     ?? 0, color: '#f59e0b', icon: '🤖', label: 'AI' },
              { key: 'Collab', score: data.collab_score ?? 0, color: '#38bdf8', icon: '🤝', label: 'ความร่วมมือ' },
            ];
            const sorted = [...scores].sort((a, b) => a.score - b.score);
            const lowest = sorted[0];
            const secondLowest = sorted[1];
            const isAllHigh = lowest.score >= 70;

            const tips: Record<string, string[]> = {
              Speed: [
                'อัปเดตสถานะงานสม่ำเสมอ — อย่าปล่อยให้งานค้างเป็น pending นานๆ',
                'ตรวจสอบ deadline ของงาน — ถ้าใกล้กำหนดให้รีบดำเนินการ',
                'ถ้างานมีแนวโน้มจะไม่ทัน — เจรจาขอขยายเวลา (Shift) ล่วงหน้า',
                'แบ่งงานใหญ่เป็นงานย่อย — ทำให้เสร็จทีละส่วนได้เร็วขึ้น',
              ],
              Impact: [
                'บันทึกเวลา (Time Sheet) ทุกวัน — ลงรายละเอียดกิจกรรมให้ชัดเจน',
                'ทำ subtask ให้เสร็จทีละอัน — แต่ละ subtask ที่เสร็จเพิ่ม Impact',
                'รับงานเพิ่มตามกำลัง — งานยิ่งเยอะ ยิ่งมีโอกาสเพิ่ม Impact',
                'ตรวจสอบว่างานที่ทำเสร็จแล้วถูกบันทึกครบถ้วนหรือไม่',
              ],
              AI: [
                'ใช้ AI Chat ถามคำถามหรือให้ช่วยวิเคราะห์งาน — ได้คะแนนทุกครั้งที่ใช้',
                'ลองใช้ AI สร้างคอนเทนต์ — แม้แต่ครั้งเดียวก็เพิ่มคะแนน AI ได้',
                'ใช้ Business Card Scanner แสกนนามบัตรลูกค้า',
                'ใช้ AI ช่วยตั้งน้ำหนักแบบสอบถาม หรือวิเคราะห์ Ticket',
              ],
              Collab: [
                'มีส่วนร่วมในโปรเจกต์ที่มีเพื่อนร่วมทีม — ทำงานข้ามทีมเพิ่มคะแนน',
                'เสนอแนวทางแก้ไข (Proposed Solution) ใน Ticket แทนการรายงานปัญหาเปล่าๆ',
                'ช่วยเหลือเพื่อนร่วมทีมในงานที่ติดขัด — การทำงานร่วมกันเพิ่มคะแนน',
                'เข้าร่วมประชุมทีมและมีส่วนร่วมในการตัดสินใจ',
              ],
            };

            if (isAllHigh) return (
              <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">🎉 ยอดเยี่ยม! ทุกด้านอยู่ในเกณฑ์ดี</p>
                <p className="text-xs text-muted-foreground mt-1">คะแนนทุกด้านสูงกว่า 70 — รักษามาตรฐานนี้ต่อไป</p>
              </div>
            );

            return (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold">🎯 จุดที่ควรปรับปรุงเพื่อเพิ่มคะแนน</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[lowest, secondLowest].map((item) => {
                    const itemTips = tips[item.key] ?? [];
                    const scoreColor = item.score < 30 ? 'text-red-600' : item.score < 50 ? 'text-orange-600' : item.score < 70 ? 'text-amber-600' : 'text-green-600';
                    const bgColor = item.score < 30 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                      : item.score < 50 ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                      : item.score < 70 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                      : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800';
                    return (
                      <div key={item.key} className={`rounded-lg border p-3 ${bgColor}`}>
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <span>{item.icon}</span> {item.key}
                          <span className={`ml-auto text-lg font-bold ${scoreColor}`}>{item.score}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                          ควรเพิ่มจาก <strong>{item.score}</strong> เป็นอย่างน้อย <strong>{Math.min(item.score + 15, 85)}</strong>
                        </p>
                        <ul className="space-y-1">
                          {itemTips.slice(0, 3).map((tip, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                              <span className="shrink-0 mt-0.5">→</span>{tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI trend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">KPI Trend (6 เดือน)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.kpi_trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line dataKey="total"  stroke="#6366f1" strokeWidth={2} dot name="Total KPI" />
                <Line dataKey="speed"  stroke="#22c55e" strokeWidth={1.5} dot={false} name="Speed" />
                <Line dataKey="impact" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Impact" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Radar */}
        <Card>
          <CardHeader><CardTitle className="text-sm">KPI Profile</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hours by project */}
        {data.hours_by_project?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">ชั่วโมงแยกตาม Project</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.hours_by_project} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="project_name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#6366f1" radius={[0,4,4,0]} name="ชั่วโมง" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent tasks */}
        <Card>
          <CardHeader><CardTitle className="text-sm">งานที่เสร็จปีนี้</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-64 overflow-y-auto">
            {data.tasks?.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">ไม่มีงานเสร็จปีนี้</p>
              : data.tasks?.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.project_name} · {t.completed_date}</p>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis section */}
      <Card className="border-dashed border-violet-300 dark:border-violet-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-500" />
              AI วิเคราะห์ประสิทธิภาพ
              <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600">Powered by AI</Badge>
            </CardTitle>
            {!aiEnabled && (
              <Button size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950"
                onClick={() => setAiEnabled(true)}>
                <Zap className="h-3.5 w-3.5 mr-1.5" />วิเคราะห์ฉัน
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!aiEnabled && (
            <p className="text-sm text-muted-foreground text-center py-6">
              กด "วิเคราะห์ฉัน" เพื่อให้ AI วิเคราะห์ KPI และแนะนำแนวทางพัฒนาตัวเอง
            </p>
          )}
          {aiEnabled && aiLoading && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin text-violet-500" />
              <p className="text-sm">AI กำลังวิเคราะห์ข้อมูล KPI ของคุณ...</p>
            </div>
          )}
          {aiEnabled && aiError && (
            <p className="text-sm text-destructive text-center py-6">เกิดข้อผิดพลาด — ตรวจสอบการตั้งค่า AI Provider</p>
          )}
          {aiData && (
            <div className="space-y-4">
              {aiData.summary && (
                <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800 p-4">
                  <p className="text-sm font-medium text-violet-800 dark:text-violet-300 mb-1">📊 สรุป</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{aiData.summary}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiData.strengths?.length > 0 && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-800 p-3">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">✅ จุดแข็ง</p>
                    <ul className="space-y-1">
                      {aiData.strengths.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-green-500 shrink-0">•</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiData.weaknesses?.length > 0 && (
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-800 p-3">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">⚠️ ต้องพัฒนา</p>
                    <ul className="space-y-1">
                      {aiData.weaknesses.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-orange-500 shrink-0">•</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiData.recommendations?.length > 0 && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800 p-3">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">💡 คำแนะนำ</p>
                    <ul className="space-y-1">
                      {aiData.recommendations.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-blue-500 shrink-0">→</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SALES DASHBOARD ─────────────────────────────────────────────────────────
function SalesDashboard({ month }: { month: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['impactos-sales', month],
    queryFn: () => apiFetch(`/impactos.php?view=sales&year=${month.substring(0, 4)}`),
  });

  if (isLoading) return <Spinner />;
  if (!data) return <Empty />;

  const fmt = (v: number | string) => {
    const n = Number(v) || 0;
    return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `฿${(n / 1_000).toFixed(0)}K`
        : `฿${n.toFixed(0)}`;
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Revenue ปิดได้"    value={fmt(data.revenue_won)}    icon={DollarSign}   color="text-green-500" />
        <Stat label="Pipeline (weighted)" value={fmt(data.pipeline_value)} icon={TrendingUp}   color="text-blue-500" />
        <Stat label="Deals Won"          value={data.deals_won}           icon={CheckCircle2} color="text-green-500" sub={`Lost: ${data.deals_lost}`} />
        <Stat label="Conversion Rate"    value={`${data.conversion_rate}%`} icon={Target}     color="text-violet-500" sub={`Open: ${data.deals_open}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel by stage */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Sales Funnel (จำนวนดีล)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.by_stage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="stage" tickFormatter={(s) => STAGE_TH[s] ?? s} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(s) => STAGE_TH[s as string] ?? s} />
                <Bar dataKey="count" radius={[4,4,0,0]} name="ดีล">
                  {data.by_stage.map((s: any) => (
                    <Cell key={s.stage} fill={STAGE_COLOR[s.stage] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by stage */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue แยกตาม Stage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.by_stage.filter((s: any) => s.value > 0)} dataKey="value"
                  nameKey="stage" cx="50%" cy="50%" outerRadius={80}
                  label={({ stage, percent }: any) => `${STAGE_TH[stage] ?? stage} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.by_stage.map((s: any) => (
                    <Cell key={s.stage} fill={STAGE_COLOR[s.stage] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(s) => STAGE_TH[s as string] ?? s} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top salespeople */}
        {data.top_salespeople?.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">🏆 Top Salespeople ปีนี้</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.top_salespeople.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg w-6">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{s.display_name}</span>
                        <span className="text-sm font-bold text-green-600">{fmt(s.revenue)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${Math.min((s.revenue / (data.top_salespeople[0]?.revenue || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{s.deals} ดีล</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* BD Leaderboard — who found the leads */}
        {data.bd_leaderboard?.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">🎯 BD Leaderboard — ผู้หา Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.bd_leaderboard.map((b: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg w-6">{['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][i]}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{b.display_name}</span>
                        <span className="text-sm font-bold text-blue-600">{fmt(b.revenue_won)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.min((b.revenue_won / (data.bd_leaderboard[0]?.revenue_won || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium">{b.leads_won}/{b.leads_total} lead</div>
                      {b.pipeline_value > 0 && (
                        <div className="text-xs text-muted-foreground">pipeline {fmt(b.pipeline_value)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── SUPPORT DASHBOARD ───────────────────────────────────────────────────────
function SupportDashboard({ month }: { month: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['impactos-support', month],
    queryFn: () => apiFetch(`/impactos.php?view=support&year=${month.substring(0, 4)}`),
  });

  if (isLoading) return <Spinner />;
  if (!data) return <Empty />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Tickets ทั้งหมด"    value={data.total_tickets}            icon={Layers}       />
        <Stat label="Resolved"           value={data.resolved}                  icon={CheckCircle2} color="text-green-500" sub={`Rate: ${data.resolution_rate}%`} />
        <Stat label="Avg Response Time"  value={`${data.avg_response_days} วัน`} icon={Clock}        color="text-blue-500" />
        <Stat label="CSAT (on-time %)"   value={`${data.csat_score}%`}          icon={Award}        color={data.csat_score >= 80 ? 'text-green-500' : 'text-orange-500'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Ticket Trend (6 เดือน)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total"    fill="#94a3b8" radius={[4,4,0,0]} name="ทั้งหมด" />
                <Bar dataKey="resolved" fill="#22c55e" radius={[4,4,0,0]} name="Resolved" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By assignee */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Tickets แยกตามทีม</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-72 overflow-y-auto">
            {data.by_assignee?.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">ไม่มีข้อมูล</p>
              : data.by_assignee?.map((a: any) => (
                <div key={a.assignee} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {a.assignee.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.assignee}</p>
                    <div className="h-1 rounded bg-muted mt-1 overflow-hidden">
                      <div className="h-full rounded bg-blue-500"
                        style={{ width: `${a.tickets > 0 ? (a.resolved / a.tickets) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{a.tickets}</p>
                    <p className="text-xs text-muted-foreground">{a.resolved} done</p>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── SYSTEM OVERVIEW ─────────────────────────────────────────────────────────
function SystemOverview({ month }: { month: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['impactos-overview', month],
    queryFn: () => apiFetch(`/impactos.php?view=overview&year=${month.substring(0, 4)}`),
  });

  if (isLoading) return <Spinner />;
  if (!data)     return <Empty />;
  const fmt = (v: number | string) => {
    const n = Number(v) || 0;
    return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `฿${(n / 1_000).toFixed(0)}K`
      : `฿${n.toFixed(0)}`;
  };
  const PROJ_COLOR: Record<string, string> = {
    'on-track': '#22c55e', 'at-risk': '#f59e0b',
    'delayed':  '#f87171', 'completed': '#6366f1',
  };
  const PROJ_TH: Record<string, string> = {
    'on-track': 'ตามแผน', 'at-risk': 'มีความเสี่ยง',
    'delayed': 'ล่าช้า', 'completed': 'เสร็จแล้ว',
  };
  const TASK_COLOR: Record<string, string> = {
    'pending': '#94a3b8', 'in-progress': '#60a5fa',
    'completed': '#22c55e', 'overdue': '#f87171',
  };
  const TASK_TH: Record<string, string> = {
    'pending': 'รอดำเนินการ', 'in-progress': 'กำลังทำ',
    'completed': 'เสร็จแล้ว', 'overdue': 'เลยกำหนด',
  };
  const STAGE_TH2: Record<string, string> = { ...STAGE_LABELS };
  const STAGE_COLOR2: Record<string, string> = {
    lead: '#94a3b8', qualified: '#60a5fa', proposal: '#a78bfa',
    negotiation: '#f59e0b', won: '#22c55e', lost: '#f87171',
  };
  const GOAL_TH: Record<string, string> = {
    draft: 'ร่าง', active: 'ดำเนินการ', completed: 'เสร็จ',
    cancelled: 'ยกเลิก', at_risk: 'มีความเสี่ยง', on_hold: 'หยุดพัก',
  };
  const GOAL_COLOR: Record<string, string> = {
    draft: '#94a3b8', active: '#6366f1', completed: '#22c55e',
    cancelled: '#f87171', at_risk: '#f59e0b', on_hold: '#e879f9',
  };
  const ST_TH: Record<string, string> = {
    open: 'Open', 'in-progress': 'กำลังแก้', pending: 'รอ',
    resolved: 'แก้แล้ว', closed: 'ปิด',
  };
  const ST_COLOR: Record<string, string> = {
    open: '#f87171', 'in-progress': '#f59e0b', pending: '#94a3b8',
    resolved: '#22c55e', closed: '#6366f1',
  };

  const projChart  = Object.entries(data.projects.by_status as Record<string, number>).map(([k, v]) => ({ name: PROJ_TH[k] ?? k, value: v, color: PROJ_COLOR[k] ?? '#94a3b8' }));
  const taskChart  = Object.entries(data.tasks.by_status   as Record<string, number>).map(([k, v]) => ({ name: TASK_TH[k] ?? k, value: v, fill: TASK_COLOR[k] ?? '#94a3b8' }));
  const salesChart = Object.entries(data.sales.by_stage as Record<string, { count: number; value: number }>).map(([k, v]) => ({ stage: STAGE_TH2[k] ?? k, count: v.count, value: v.value, fill: STAGE_COLOR2[k] ?? '#94a3b8' }));
  const goalChart  = Object.entries(data.goals.by_status as Record<string, number>).map(([k, v]) => ({ name: GOAL_TH[k] ?? k, value: v, color: GOAL_COLOR[k] ?? '#94a3b8' }));
  const stChart    = Object.entries(data.support.by_status as Record<string, number>).map(([k, v]) => ({ name: ST_TH[k] ?? k, value: v, fill: ST_COLOR[k] ?? '#94a3b8' }));
  const deptChart  = (data.departments as { position: string; headcount: number }[]).map(d => ({ name: d.position, value: d.headcount }));

  const budgetPct = data.budget.planned > 0 ? Math.round((data.budget.actual / data.budget.planned) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">โปรเจกต์</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.projects.total}</div>
            <p className="text-xs text-muted-foreground">Active: {data.projects.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">งานทั้งหมด</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.tasks.total}</div>
            <p className="text-xs text-muted-foreground">เสร็จปีนี้: {data.tasks.completed_month}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">Sales Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{fmt(data.sales.total_value)}</div>
            <p className="text-xs text-muted-foreground">Won ปีนี้: {fmt(data.sales.won_month_value)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">Support Tickets</CardTitle>
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.support.total}</div>
            <p className="text-xs text-muted-foreground">ปีนี้: +{data.support.created_month}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">Goals & OKR</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.goals.total}</div>
            <p className="text-xs text-muted-foreground">Progress avg: {data.goals.avg_progress}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">ชั่วโมงปีนี้</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.hours_month.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">ชั่วโมง (จากงานย่อยปลายทาง)</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Projects by status */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" />โปรเจกต์แยกตามสถานะ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={projChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {projChart.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tasks by status */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" />งานแยกตามสถานะ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={taskChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4,4,0,0]} name="งาน">
                  {taskChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales pipeline */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" />Sales Pipeline แยก Stage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => name === 'value' ? fmt(v) : v} />
                <Bar dataKey="count" radius={[4,4,0,0]} name="ดีล">
                  {salesChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Support tickets */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-orange-500" />Support Tickets แยกสถานะ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4,4,0,0]} name="Ticket">
                  {stChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Goals & OKR */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-violet-500" />Goals & OKR แยกสถานะ</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 py-2">
              {goalChart.map((g) => (
                <div key={g.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{g.name}</span>
                    <span className="font-semibold">{g.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${data.goals.total > 0 ? Math.round(g.value / data.goals.total * 100) : 0}%`, backgroundColor: g.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" />งบประมาณ (Planned vs Actual)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Planned</p>
                  <p className="text-xl font-bold text-blue-600">{fmt(data.budget.planned)}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Actual</p>
                  <p className="text-xl font-bold text-green-600">{fmt(data.budget.actual)}</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>การใช้จ่าย</span><span>{budgetPct}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(budgetPct, 100)}%`, backgroundColor: budgetPct > 100 ? '#f87171' : budgetPct > 80 ? '#f59e0b' : '#22c55e' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department headcount */}
      {deptChart.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />จำนวนพนักงานแยกฝ่าย</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={deptChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[0,4,4,0]} name="คน" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── DEPARTMENT TARGETS ───────────────────────────────────────────────────────

// Position → ImpactOS department mapping (aligns with docs/kpi-config.md)
const POSITION_DEPT: Record<string, { dept: string; kpiWeights: string }> = {
  'Programmer':             { dept: 'Development',       kpiWeights: 'P=40% Q=30% A=10% S=20%' },
  'Tester':                 { dept: 'Development',       kpiWeights: 'P=40% Q=30% A=10% S=20%' },
  'Senior Techical Support':{ dept: 'Support',           kpiWeights: 'P=30% Q=30% A=10% S=30%' },
  'Techical Support':       { dept: 'Support',           kpiWeights: 'P=30% Q=30% A=10% S=30%' },
  'Project Manager':        { dept: 'Management/Admin',  kpiWeights: 'P=20% Q=20% A=30% S=30%' },
  'Manager':                { dept: 'Management/Admin',  kpiWeights: 'P=20% Q=20% A=30% S=30%' },
  'Project Coordinator':    { dept: 'Management/Admin',  kpiWeights: 'P=20% Q=20% A=30% S=30%' },
  'Administrative':         { dept: 'Management/Admin',  kpiWeights: 'P=20% Q=20% A=30% S=30%' },
};

// KPI-aligned default targets per ImpactOS department
const DEPT_DEFAULTS: Record<string, { tasks_per_person: number; hours_per_person: number }> = {
  'Development':      { tasks_per_person: 15, hours_per_person: 160 },
  'Sales':            { tasks_per_person: 20, hours_per_person: 120 },
  'Support':          { tasks_per_person: 25, hours_per_person: 160 },
  'Management/Admin': { tasks_per_person: 12, hours_per_person: 160 },
};

const DEPT_TARGET_DEFAULTS = { tasks_per_person: 10, hours_per_person: 160 };

function getDeptInfo(position: string) {
  return POSITION_DEPT[position] ?? { dept: 'Other', kpiWeights: 'Default' };
}

function getDeptDefaults(position: string) {
  const info = getDeptInfo(position);
  return DEPT_DEFAULTS[info.dept] ?? DEPT_TARGET_DEFAULTS;
}

interface DeptTarget { tasks_per_person: number; hours_per_person: number }
type DeptTargetsMap = Record<string, DeptTarget>;

function ProgressBar({ value, max, color = '#6366f1' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{value.toFixed(0)} / {max}</span><span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : color }} />
      </div>
    </div>
  );
}

function DepartmentTargets({ month }: { month: string }) {
  const [targets, setTargets] = useState<DeptTargetsMap>(() => {
    try { return JSON.parse(localStorage.getItem('impactos_dept_targets') || '{}'); }
    catch { return {}; }
  });
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ headcount: number; tasks_per_person: number; hours_per_person: number }>({ headcount: 1, tasks_per_person: 10, hours_per_person: 160 });
  const [customHeadcount, setCustomHeadcount] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('impactos_dept_headcount') || '{}'); }
    catch { return {}; }
  });

  const { data: deptData = [], isLoading } = useQuery<any[]>({
    queryKey: ['impactos-departments', month],
    queryFn: () => apiFetch(`/impactos.php?view=departments&year=${month.substring(0, 4)}`),
  });

  const saveTarget = (position: string) => {
    const newTargets: DeptTargetsMap = { ...targets, [position]: { tasks_per_person: editValues.tasks_per_person, hours_per_person: editValues.hours_per_person } };
    const newHc = { ...customHeadcount, [position]: editValues.headcount };
    setTargets(newTargets);
    setCustomHeadcount(newHc);
    localStorage.setItem('impactos_dept_targets', JSON.stringify(newTargets));
    localStorage.setItem('impactos_dept_headcount', JSON.stringify(newHc));
    setEditingDept(null);
  };

  const openEdit = (dept: any) => {
    const t = targets[dept.position] ?? getDeptDefaults(dept.position);
    const hc = customHeadcount[dept.position] ?? dept.headcount;
    setEditValues({ headcount: hc, tasks_per_person: t.tasks_per_person, hours_per_person: t.hours_per_person });
    setEditingDept(dept.position);
  };

  if (isLoading) return <Spinner />;
  if (!deptData.length) return <Empty text="ไม่มีข้อมูลพนักงาน" />;

  const totalTarget = deptData.reduce((acc, d) => {
    const hc = customHeadcount[d.position] ?? d.headcount;
    const t  = targets[d.position] ?? getDeptDefaults(d.position);
    return { tasks: acc.tasks + hc * t.tasks_per_person, hours: acc.hours + hc * t.hours_per_person };
  }, { tasks: 0, hours: 0 });
  const totalActual = deptData.reduce((acc, d) => ({ tasks: acc.tasks + d.total_tasks, hours: acc.hours + d.total_hours }), { tasks: 0, hours: 0 });

  return (
    <div className="space-y-6">
      {/* Org summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">พนักงานทั้งหมด</p>
            <p className="text-3xl font-bold text-primary">{deptData.reduce((a, d) => a + (customHeadcount[d.position] ?? d.headcount), 0)}<span className="text-sm font-normal text-muted-foreground ml-1">คน</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">เป้างานรวม (ปีนี้)</p>
            <p className="text-3xl font-bold">{totalTarget.tasks}<span className="text-sm font-normal text-muted-foreground ml-1">งาน</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">งานจริงปีนี้</p>
            <p className="text-3xl font-bold text-green-600">{totalActual.tasks}<span className="text-sm font-normal text-muted-foreground ml-1">งาน</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">ชั่วโมงจริงปีนี้</p>
            <p className="text-3xl font-bold text-blue-600">{totalActual.hours.toFixed(0)}<span className="text-sm font-normal text-muted-foreground ml-1">ชม.</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Department cards — grouped by ImpactOS category */}
      {(() => {
        const DEPT_COLORS: Record<string, string> = {
          'Development': 'bg-blue-50 text-blue-700 border-blue-200',
          'Sales': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Support': 'bg-amber-50 text-amber-700 border-amber-200',
          'Management/Admin': 'bg-purple-50 text-purple-700 border-purple-200',
          'Other': 'bg-slate-50 text-slate-700 border-slate-200',
        };
        const grouped: Record<string, any[]> = {};
        deptData.forEach((d: any) => {
          const cat = getDeptInfo(d.position).dept;
          (grouped[cat] ??= []).push(d);
        });
        const catOrder = ['Development', 'Sales', 'Support', 'Management/Admin', 'Other'];
        const sorted = Object.entries(grouped).sort(([a], [b]) => {
          const ai = catOrder.indexOf(a); const bi = catOrder.indexOf(b);
          return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99);
        });

        return sorted.map(([category, positions]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <FolderKanban className="h-4 w-4" />
                {category}
              </h3>
              <Badge className={cn('text-[10px] border', DEPT_COLORS[category] ?? DEPT_COLORS.Other)}>
                {getDeptInfo(positions[0].position).kpiWeights}
              </Badge>
              <span className="text-xs text-muted-foreground/60">
                {positions.reduce((a: number, d: any) => a + (customHeadcount[d.position] ?? d.headcount), 0)} คน
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {positions.map((dept: any) => {
                const t   = targets[dept.position]      ?? getDeptDefaults(dept.position);
                const hc  = customHeadcount[dept.position] ?? dept.headcount;
                const taskTarget  = hc * t.tasks_per_person;
                const hoursTarget = hc * t.hours_per_person;
                const isEditing   = editingDept === dept.position;

                return (
                  <Card key={dept.position} className={cn('relative', isEditing && 'ring-2 ring-primary')}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm">{dept.position}</CardTitle>
                          <Badge variant="outline" className="text-xs">{hc} คน</Badge>
                        </div>
                        {!isEditing ? (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(dept)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => saveTarget(dept.position)}>
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setEditingDept(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
              <CardContent className="space-y-3">
                {isEditing ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">จำนวนพนักงาน</label>
                      <Input type="number" min={1} className="h-8 mt-1" value={editValues.headcount}
                        onChange={e => setEditValues(v => ({ ...v, headcount: +e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">เป้างาน/คน/เดือน</label>
                      <Input type="number" min={0} className="h-8 mt-1" value={editValues.tasks_per_person}
                        onChange={e => setEditValues(v => ({ ...v, tasks_per_person: +e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">เป้าชั่วโมง/คน/เดือน</label>
                      <Input type="number" min={0} className="h-8 mt-1" value={editValues.hours_per_person}
                        onChange={e => setEditValues(v => ({ ...v, hours_per_person: +e.target.value }))} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>เป้างาน: <strong className="text-foreground">{t.tasks_per_person} งาน/คน</strong></span>
                    <span>เป้าชั่วโมง: <strong className="text-foreground">{t.hours_per_person} ชม./คน</strong></span>
                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium mb-1">งานที่เสร็จ (รวมทั้งฝ่าย)</p>
                    <ProgressBar value={dept.total_tasks} max={taskTarget} color="#6366f1" />
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">ชั่วโมงที่บันทึก (ปีนี้)</p>
                    <ProgressBar value={dept.total_hours} max={hoursTarget} color="#22c55e" />
                  </div>
                </div>

                {/* Member breakdown */}
                {dept.members?.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    {dept.members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 text-xs">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-muted-foreground">{m.name}</span>
                        <span className="font-medium">{m.tasks} งาน</span>
                        <span className="text-muted-foreground">{m.hours.toFixed(0)} ชม.</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
              })}
            </div>
          </div>
        ));
      })()}
    </div>
  );
}

// ─── BENCHMARK TAB ───────────────────────────────────────────────────────────
function BenchmarkTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['benchmark'],
    queryFn: () => apiFetch('/benchmark.php'),
  });

  const benchmarks: any[] = data?.benchmarks ?? [];
  const meta: any         = data?.meta ?? {};
  const betterCount = benchmarks.filter((b: any) =>
    b.better === 'higher' ? b.yours >= b.industry : b.yours <= b.industry
  ).length;
  const score = benchmarks.length > 0 ? Math.round(betterCount / benchmarks.length * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">เปรียบเทียบประสิทธิภาพกับค่าเฉลี่ยอุตสาหกรรม</p>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />รีเฟรช
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <Award className={cn('h-10 w-10 mx-auto mb-2', score >= 70 ? 'text-amber-400' : 'text-muted-foreground')} />
            <p className="text-3xl font-bold text-primary">{score}%</p>
            <p className="text-xs text-muted-foreground mt-1">คะแนนรวม Benchmark</p>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-5 text-center"><p className="text-3xl font-bold text-green-500">{betterCount}</p><p className="text-xs text-muted-foreground mt-1">ดีกว่าค่าเฉลี่ย</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><p className="text-3xl font-bold text-amber-500">{benchmarks.length - betterCount}</p><p className="text-xs text-muted-foreground mt-1">ต้องปรับปรุง</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><p className="text-3xl font-bold text-blue-500">{meta.tasks_completed ?? 0}</p><p className="text-xs text-muted-foreground mt-1">งานที่เสร็จแล้ว</p></CardContent></Card>
      </div>
      {isLoading ? <Spinner /> : (
        <Card>
          <CardHeader><CardTitle className="text-sm">เปรียบเทียบรายละเอียด</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {benchmarks.map((b: any) => {
              const good = b.better === 'higher' ? b.yours >= b.industry : b.yours <= b.industry;
              const pct  = b.industry > 0 ? Math.abs(b.yours - b.industry) / b.industry * 100 : 0;
              return (
                <div key={b.metric} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.label ?? b.metric}</p>
                    <p className="text-xs text-muted-foreground">อุตสาหกรรม: {b.industry}{b.unit ?? ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-bold', good ? 'text-green-600' : 'text-red-500')}>{b.yours}{b.unit ?? ''}</p>
                    <p className="text-xs text-muted-foreground">{good ? '+' : '-'}{pct.toFixed(0)}%</p>
                  </div>
                  {good
                    ? <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                    : <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
                </div>
              );
            })}
            {benchmarks.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">ไม่มีข้อมูล Benchmark</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── AI INSIGHTS TAB ─────────────────────────────────────────────────────────
const AI_ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle, TrendingUp, Lightbulb, BarChart3, Clock, FileText, Sparkles,
};
const AI_COLOR_MAP: Record<string, { card: string; icon: string; bg: string }> = {
  red:    { card: 'border-red-200',    icon: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/20' },
  orange: { card: 'border-orange-200', icon: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20' },
  amber:  { card: 'border-amber-200',  icon: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/20' },
  green:  { card: 'border-green-200',  icon: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/20' },
  blue:   { card: 'border-blue-200',   icon: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/20' },
};

function AiInsightsTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => apiFetch('/ai-insights.php'),
  });

  const insights: any[] = data?.insights ?? [];
  const summary: any    = data?.summary  ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">ข้อมูลเชิงลึกจากการวิเคราะห์ข้อมูลธุรกิจของคุณ</p>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />รีเฟรช
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">โปรเจกต์ทั้งหมด</p><p className="text-3xl font-bold text-primary">{summary.total_projects ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">งานเกินกำหนด</p><p className="text-3xl font-bold text-red-500">{summary.overdue_tasks ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Ticket เปิดอยู่</p><p className="text-3xl font-bold text-amber-500">{summary.open_tickets ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Pipeline มูลค่า</p><p className="text-3xl font-bold text-green-500">{((summary.pipeline_value ?? 0) / 1000).toFixed(0)}K</p></CardContent></Card>
      </div>
      {isLoading ? <Spinner /> : insights.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>ไม่พบข้อมูลเชิงลึกในขณะนี้ ระบบทำงานได้ดีปกติ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins: any, i: number) => {
            const Icon  = AI_ICON_MAP[ins.icon] ?? Sparkles;
            const color = AI_COLOR_MAP[ins.color] ?? AI_COLOR_MAP.blue;
            return (
              <Card key={i} className={`border ${color.card}`}>
                <CardContent className={`pt-5 rounded-lg ${color.bg}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color.icon}`} />
                    <div>
                      <p className="font-semibold text-sm mb-1">{ins.title}</p>
                      <p className="text-sm text-muted-foreground">{ins.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-violet-500" />AI สรุปภาพรวม</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>เสร็จสิ้น <strong className="text-foreground">{summary.completed_this_month ?? 0} งาน</strong> ในเดือนนี้
            {(summary.overdue_tasks ?? 0) > 0 && <> · มี <strong className="text-red-600">{summary.overdue_tasks} งานเกินกำหนด</strong></>}
            {(summary.delayed_projects ?? 0) > 0 && <> · โปรเจกต์ล่าช้า <strong className="text-orange-600">{summary.delayed_projects} รายการ</strong></>}
          </p>
          {(summary.expiring_contracts ?? 0) > 0 && (
            <p>สัญญาใกล้หมดอายุ <strong className="text-amber-600">{summary.expiring_contracts} ฉบับ</strong> ควรติดต่อลูกค้าเพื่อต่ออายุ</p>
          )}
          {(summary.leads_no_proposal ?? 0) > 0 && (
            <p>มี <strong className="text-blue-600">{summary.leads_no_proposal} leads</strong> ที่ยังไม่ได้รับ proposal — ควรติดตามเพื่อเพิ่มโอกาสปิดดีล</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Quality Dashboard ─────────────────────────────────────────────────────────
function QualityDashboard({ month }: { month: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['impactos-quality', month],
    queryFn: () => apiFetch(`/impactos.php?view=quality&year=${month.substring(0, 4)}`),
  });
  if (isLoading) return <Spinner />;
  if (!data) return <Empty />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="งานเสร็จสิ้น"      value={data.total_completed}               icon={CheckCircle2} />
        <Stat label="Defect Rate"       value={`${data.defect_rate}%`}            icon={AlertTriangle} color={data.defect_rate < 10 ? 'text-green-500' : 'text-red-500'} sub={`${data.rework_count} rework`} />
        <Stat label="On-Time Delivery"  value={`${data.on_time_rate}%`}           icon={Clock}         color={data.on_time_rate >= 80 ? 'text-green-500' : 'text-orange-500'} />
        <Stat label="On-Time จำนวน"     value={data.on_time_count}                icon={Target} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Defect Rate Trend (6 เดือน)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line dataKey="defect_rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Defect Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Rework แยกตามโปรเจกต์</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-72 overflow-y-auto">
            {!data.by_project?.length
              ? <p className="text-sm text-muted-foreground text-center py-8">ไม่มีข้อมูล</p>
              : data.by_project.map((p: any) => (
                <div key={p.project} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.project}</p>
                    <div className="h-1 rounded bg-muted mt-1 overflow-hidden">
                      <div className="h-full rounded bg-red-400"
                        style={{ width: `${p.defect_rate}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{p.defect_rate}%</p>
                    <p className="text-xs text-muted-foreground">{p.rework}/{p.total}</p>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Customer Dashboard ────────────────────────────────────────────────────────
function CustomerDashboard({ month }: { month: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['impactos-customer', month],
    queryFn: () => apiFetch(`/impactos.php?view=customer&year=${month.substring(0, 4)}`),
  });
  if (isLoading) return <Spinner />;
  if (!data) return <Empty />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="NPS"                value={data.csat.nps}                    icon={Smile}         color={data.csat.nps >= 30 ? 'text-green-500' : data.csat.nps >= 0 ? 'text-yellow-500' : 'text-red-500'} sub={`เฉลี่ย ${data.csat.avg_score}/5`} />
        <Stat label="SLA Hit Rate"       value={`${data.sla.sla_rate}%`}          icon={CheckCircle2}  color={data.sla.sla_rate >= 80 ? 'text-green-500' : 'text-orange-500'} sub={`${data.sla.sla_met}/${data.sla.total_tickets} tickets`} />
        <Stat label="Avg First Response" value={`${data.sla.avg_frt_hours} ชม.`} icon={Clock}        color="text-blue-500" />
        <Stat label="Repeat Business"    value={`${data.repeat_business.repeat_rate}%`} icon={Target} color={data.repeat_business.repeat_rate >= 20 ? 'text-green-500' : 'text-orange-500'} sub={`${data.repeat_business.repeat_companies}/${data.repeat_business.total_companies} บริษัท`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">CSAT/NPS Trend (6 เดือน)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[-100, 100]} />
                <Tooltip />
                <Line dataKey="nps" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="NPS" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 ลูกค้า (Revenue All-Time)</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-72 overflow-y-auto">
            {!data.top_customers?.length
              ? <p className="text-sm text-muted-foreground text-center py-8">ไม่มีข้อมูล</p>
              : data.top_customers.map((c: any, i: number) => (
                <div key={c.name} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.deals} ดีล</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums">{Number(c.revenue).toLocaleString()} ฿</p>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Util components ─────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <RefreshCw className="h-5 w-5 animate-spin mr-2" />กำลังคำนวณ KPI...
    </div>
  );
}
function Empty({ text = 'ไม่มีข้อมูล' }: { text?: string }) {
  return <div className="text-center py-20 text-muted-foreground">{text}</div>;
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function ImpactOSPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState(format(new Date(), 'yyyy'));
  const month = year === 'all' ? '0000-01' : `${year}-01`;
  const years = useMemo(() => yearOptions(), []);
  const activeTab = searchParams.get('tab') || 'overview';

  return (
    <PageShell
      breadcrumbs={[{ label: 'ImpactOS', isCurrent: true }]}
      title="ImpactOS"
      description="วัดผล · เชื่อม Dev→Revenue · AI-Driven Performance"
      actions={<><Badge variant="outline" className="text-xs">KPI Engine</Badge>
<Select value={year} onValueChange={setYear}>
<SelectTrigger className="w-28">
<SelectValue />
</SelectTrigger>
<SelectContent>
{years.map((y) => (
<SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
))}
</SelectContent>
</Select></>}
    >

      {/* KPI Formula banner */}
      <div className="rounded-xl border bg-primary/5 border-primary/20 px-4 py-3 flex flex-wrap gap-4 text-sm">
        <span className="font-medium text-primary">⚙️ KPI Formula:</span>
        <span className="text-muted-foreground font-mono text-xs">
          Total = (0.3 × <span className="text-violet-600">Speed</span>) +
                  (0.3 × <span className="text-green-600">Impact</span>) +
                  (0.2 × <span className="text-amber-600">AI Usage</span>) +
                  (0.2 × <span className="text-sky-600">Collaboration</span>)
        </span>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pb-1">
          <TabsList className="flex h-auto gap-1 w-max sm:w-full">
            <TabsTrigger value="overview"    className="gap-1.5 shrink-0 px-2 sm:px-3"><Layers className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">ภาพรวมระบบ</span></TabsTrigger>
            <TabsTrigger value="targets"     className="gap-1.5 shrink-0 px-2 sm:px-3"><Building2 className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">ตั้งเป้าหมาย</span></TabsTrigger>
            <TabsTrigger value="ceo"         className="gap-1.5 shrink-0 px-2 sm:px-3"><BarChart3 className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">CEO Dashboard</span></TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5 shrink-0 px-2 sm:px-3"><Award className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">KPI Ranking</span></TabsTrigger>
            <TabsTrigger value="dev"         className="gap-1.5 shrink-0 px-2 sm:px-3"><Zap className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Dev</span></TabsTrigger>
            <TabsTrigger value="sales"       className="gap-1.5 shrink-0 px-2 sm:px-3"><TrendingUp className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">การขาย</span></TabsTrigger>
            <TabsTrigger value="support"     className="gap-1.5 shrink-0 px-2 sm:px-3"><LifeBuoy className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Support</span></TabsTrigger>
            <TabsTrigger value="quality"     className="gap-1.5 shrink-0 px-2 sm:px-3"><ShieldCheck className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">คุณภาพ</span></TabsTrigger>
            <TabsTrigger value="customer"    className="gap-1.5 shrink-0 px-2 sm:px-3"><Smile className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">ลูกค้า</span></TabsTrigger>
            <TabsTrigger value="benchmark"   className="gap-1.5 shrink-0 px-2 sm:px-3"><BarChart3 className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Benchmark</span></TabsTrigger>
            <TabsTrigger value="ai-insights" className="gap-1.5 shrink-0 px-2 sm:px-3"><Sparkles className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">AI วิเคราะห์</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"    className="mt-6"><ErrorBoundary section="ภาพรวมระบบ"><SystemOverview      month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="targets"     className="mt-6"><ErrorBoundary section="ตั้งเป้าหมาย"><DepartmentTargets   month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="ceo"         className="mt-6"><ErrorBoundary section="CEO Dashboard"><CeoDashboard        month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="leaderboard" className="mt-6"><ErrorBoundary section="KPI Ranking"><Leaderboard         month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="dev"         className="mt-6"><ErrorBoundary section="Dev Dashboard"><DevDashboard        month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="sales"       className="mt-6"><ErrorBoundary section="การขาย"><SalesDashboard      month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="support"     className="mt-6"><ErrorBoundary section="Support"><SupportDashboard    month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="quality"     className="mt-6"><ErrorBoundary section="คุณภาพ"><QualityDashboard    month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="customer"    className="mt-6"><ErrorBoundary section="ลูกค้า"><CustomerDashboard   month={month} /></ErrorBoundary></TabsContent>
        <TabsContent value="benchmark"   className="mt-6"><ErrorBoundary section="Benchmark"><BenchmarkTab /></ErrorBoundary></TabsContent>
        <TabsContent value="ai-insights" className="mt-6"><ErrorBoundary section="AI วิเคราะห์"><AiInsightsTab /></ErrorBoundary></TabsContent>
      </Tabs>
    </PageShell>
  );
}
