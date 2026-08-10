import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProjects, useOpportunities, useQuotations, useCompanies, useAllTasks } from '@/hooks/useProjectData';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import PageShell from '@/components/PageShell';
import {
  Loader2, Briefcase, TrendingUp, FileText, Building2, ArrowRight,
  CheckCircle, Clock, AlertCircle, DollarSign, BarChart3, Target,
  Award, ListTodo, CalendarDays, AlertTriangle, HeadphonesIcon,
  CheckCircle2, XCircle, Activity, TrendingDown, RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { addDays, endOfYear, format, isAfter, isBefore, isValid, parseISO, startOfDay, startOfYear } from 'date-fns';

const STATUS_COLORS = { 'on-track': '#10B981', 'at-risk': '#F59E0B', 'delayed': '#EF4444', 'completed': '#6366F1' };
const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8', qualified: '#60a5fa', proposal: '#f59e0b',
  negotiation: '#8b5cf6', won: '#10b981', lost: '#ef4444',
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} ล้าน ฿`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ฿`;
  return `${n.toLocaleString()} ฿`;
}

// ── Mini KPI Card ──────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, iconColor, title, value, sub, subColor, onClick }: {
  icon: React.ElementType; iconColor: string; title: string; value: React.ReactNode;
  sub?: React.ReactNode; subColor?: string; onClick?: () => void;
}) {
  return (
    <Card
      className={cn('transition-shadow', onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30')}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className={cn('text-xs mt-0.5', subColor ?? 'text-muted-foreground')}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Core data ────────────────────────────────────────────────────────────
  const { data: projects = [],      isLoading: projectsLoading }      = useProjects();
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useOpportunities();
  const { data: quotations = [],    isLoading: quotationsLoading }    = useQuotations();
  const { data: companies = [],     isLoading: companiesLoading }     = useCompanies();
  const { data: tasksPage }                                            = useAllTasks({ my: true, per_page: 200, parent_only: true });
  const myTasks = tasksPage?.data ?? [];

  // ── KPI grade ────────────────────────────────────────────────────────────
  const kpiYear = new Date().getFullYear();
  const { data: kpiData } = useQuery({
    queryKey: ['impactos-dev', kpiYear, user?.id],
    queryFn:  () => apiFetch(`/impactos.php?view=dev&year=${kpiYear}&user_id=${user?.id}`),
    enabled:  !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // ── Support tickets ───────────────────────────────────────────────────────
  const { data: ticketsRaw = [] } = useQuery<any[]>({
    queryKey: ['support-tickets-dashboard'],
    queryFn:  () => apiFetch('/support-tickets.php?per_page=200'),
    staleTime: 30_000,
  });

  // ── Goals ─────────────────────────────────────────────────────────────────
  const { data: goalsRaw = [] } = useQuery<any[]>({
    queryKey: ['goals-dashboard'],
    queryFn:  () => apiFetch('/goals.php?status=active'),
    staleTime: 60_000,
  });

  const isLoading = projectsLoading || opportunitiesLoading || quotationsLoading || companiesLoading;

  // ── Date filters ──────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate]   = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate]       = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));

  const handleYearChange = (year: string) => {
    setYearFilter(year);
    if (year === '__all__') { setStartDate(''); setEndDate(''); }
    else {
      const y = parseInt(year, 10);
      setStartDate(format(startOfYear(new Date(y, 0, 1)), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(new Date(y, 0, 1)), 'yyyy-MM-dd'));
    }
  };

  const resetFilters = () => {
    setYearFilter(String(currentYear));
    setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  };

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!startDate && !endDate) return projects;
    const s = startDate ? parseISO(startDate) : null;
    const e = endDate   ? parseISO(endDate)   : null;
    return projects.filter((p: any) => {
      const ps = p.start_date ? parseISO(p.start_date) : null;
      const pe = p.end_date   ? parseISO(p.end_date)   : null;
      if (!ps || !pe) return false;
      if (s && pe < s) return false;
      if (e && ps > e) return false;
      return true;
    });
  }, [projects, startDate, endDate]);

  const filteredOpportunities = useMemo(() => {
    if (!startDate && !endDate) return opportunities;
    const s = startDate ? parseISO(startDate) : null;
    const e = endDate   ? parseISO(endDate)   : null;
    return opportunities.filter((o: any) => {
      const isClosed = o.stage === 'won' || o.stage === 'lost';
      const dateStr  = isClosed ? (o.actual_close_date || o.expected_close_date) : o.expected_close_date;
      if (!dateStr) return isClosed;
      const d = parseISO(dateStr);
      if (!isValid(d)) return isClosed;
      if (s && d < s) return false;
      if (e && d > e) return false;
      return true;
    });
  }, [opportunities, startDate, endDate]);

  const filteredQuotations = useMemo(() => {
    if (!startDate && !endDate) return quotations;
    const s = startDate ? parseISO(startDate) : null;
    const e = endDate   ? parseISO(endDate)   : null;
    return quotations.filter((q: any) => {
      if (!q.issue_date) return false;
      const d = parseISO(q.issue_date);
      if (!isValid(d)) return false;
      if (s && d < s) return false;
      if (e && d > e) return false;
      return true;
    });
  }, [quotations, startDate, endDate]);

  // ── Computed stats (must be before any early return) ─────────────────────
  const taskStats = useMemo(() => {
    const overdue    = myTasks.filter((t: any) => t.status === 'overdue');
    const inProgress = myTasks.filter((t: any) => t.status === 'in-progress');
    const pending    = myTasks.filter((t: any) => t.status === 'pending');
    return { overdue, inProgress, pending, total: myTasks.length };
  }, [myTasks]);

  const projectStats = useMemo(() => ({
    total:     filteredProjects.length,
    active:    filteredProjects.filter((p: any) => p.status !== 'completed').length,
    completed: filteredProjects.filter((p: any) => p.status === 'completed').length,
    onTrack:   filteredProjects.filter((p: any) => p.status === 'on-track').length,
    atRisk:    filteredProjects.filter((p: any) => p.status === 'at-risk').length,
    delayed:   filteredProjects.filter((p: any) => p.status === 'delayed').length,
  }), [filteredProjects]);

  const salesStats = useMemo(() => {
    const won    = filteredOpportunities.filter((o: any) => o.stage === 'won');
    const lost   = filteredOpportunities.filter((o: any) => o.stage === 'lost');
    const active = filteredOpportunities.filter((o: any) => !['won', 'lost'].includes(o.stage));
    const closed = won.length + lost.length;
    const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : null;
    return {
      total:       filteredOpportunities.length,
      won:         won.length,
      lost:        lost.length,
      active:      active.length,
      totalValue:  filteredOpportunities.reduce((s: number, o: any) => s + (o.value || 0), 0),
      wonValue:    won.reduce((s: number, o: any) => s + (o.value || 0), 0),
      activeValue: active.reduce((s: number, o: any) => s + (o.value || 0), 0),
      winRate,
    };
  }, [filteredOpportunities]);

  const quotationStats = useMemo(() => ({
    total:          filteredQuotations.length,
    approved:       filteredQuotations.filter((q: any) => q.status === 'approved').length,
    pending:        filteredQuotations.filter((q: any) => q.status === 'sent').length,
    approvedValue:  filteredQuotations.filter((q: any) => q.status === 'approved').reduce((s: number, q: any) => s + (q.grand_total || 0), 0),
  }), [filteredQuotations]);

  const ticketStats = useMemo(() => {
    const open   = ticketsRaw.filter((t: any) => !['resolved', 'closed'].includes(t.status));
    const critical = open.filter((t: any) => t.priority === 'critical');
    const high     = open.filter((t: any) => t.priority === 'high');
    return {
      total:    ticketsRaw.length,
      open:     open.length,
      critical: critical.length,
      high:     high.length,
      byPriority: [
        { name: 'วิกฤต',   count: critical.length,                                    color: PRIORITY_COLORS.critical },
        { name: 'สูง',      count: high.length,                                        color: PRIORITY_COLORS.high },
        { name: 'ปานกลาง', count: open.filter((t: any) => t.priority === 'medium').length, color: PRIORITY_COLORS.medium },
        { name: 'ต่ำ',      count: open.filter((t: any) => t.priority === 'low').length,    color: PRIORITY_COLORS.low },
      ].filter(x => x.count > 0),
    };
  }, [ticketsRaw]);

  const goalStats = useMemo(() => {
    const active  = goalsRaw.filter((g: any) => g.status === 'active');
    const atRisk  = active.filter((g: any) => (g.progress_percentage ?? 0) < 50);
    return { active: active.slice(0, 5), atRiskCount: atRisk.length };
  }, [goalsRaw]);

  const upcomingDeadlines = useMemo(() => {
    const today   = startOfDay(new Date());
    const nextWeek = addDays(today, 7);
    const upcomingProjects = filteredProjects
      .filter((p: any) => {
        if (!p.end_date || p.status === 'completed') return false;
        const e = parseISO(p.end_date);
        return isValid(e) && !isBefore(e, today) && !isAfter(e, nextWeek);
      })
      .sort((a: any, b: any) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime())
      .slice(0, 5);
    const upcomingTasks = myTasks
      .filter((t: any) => {
        if (!t.end_date || ['completed', 'cancelled'].includes(t.status)) return false;
        const e = parseISO(t.end_date);
        return isValid(e) && !isBefore(e, today) && !isAfter(e, nextWeek);
      })
      .sort((a: any, b: any) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime())
      .slice(0, 5);
    return { projects: upcomingProjects, tasks: upcomingTasks };
  }, [filteredProjects, myTasks]);

  // ── Sales funnel chart data ───────────────────────────────────────────────
  const salesFunnelData = useMemo(() => {
    const stages = ['lead', 'qualified', 'proposal', 'negotiation'];
    return stages.map(stage => ({
      stage,
      label: { lead: 'ลีด', qualified: 'คัดกรองแล้ว', proposal: 'เสนอราคา', negotiation: 'เจรจา' }[stage]!,
      count: filteredOpportunities.filter((o: any) => o.stage === stage).length,
      value: filteredOpportunities.filter((o: any) => o.stage === stage).reduce((s: number, o: any) => s + (o.value || 0), 0),
      fill:  STAGE_COLORS[stage],
    }));
  }, [filteredOpportunities]);

  const projectStatusData = useMemo(() => [
    { name: 'ตามแผน',    value: projectStats.onTrack,   color: STATUS_COLORS['on-track'] },
    { name: 'มีความเสี่ยง', value: projectStats.atRisk,    color: STATUS_COLORS['at-risk'] },
    { name: 'ล่าช้า',     value: projectStats.delayed,   color: STATUS_COLORS['delayed'] },
    { name: 'เสร็จแล้ว',  value: projectStats.completed, color: STATUS_COLORS['completed'] },
  ].filter(d => d.value > 0), [projectStats]);

  const recentProjects = filteredProjects.slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell
      breadcrumbs={[{ label: 'หน้าหลัก', isCurrent: true }]}
      title={`สวัสดี, ${user?.display_name?.split(' ')[0] ?? 'ยินดีต้อนรับ'} 👋`}
      description="ภาพรวมการจัดการโครงการและธุรกิจ"
      actions={
        kpiData ? (
          <button
            type="button"
            onClick={() => navigate('/impactos?tab=dev')}
            className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <Award className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground group-hover:text-foreground">KPI</span>
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full border',
              kpiData.grade === 'A+' ? 'bg-violet-100 text-violet-700 border-violet-300' :
              kpiData.grade === 'A'  ? 'bg-green-100 text-green-700 border-green-300' :
              kpiData.grade === 'B+' ? 'bg-blue-100 text-blue-700 border-blue-300' :
              kpiData.grade === 'B'  ? 'bg-sky-100 text-sky-700 border-sky-300' :
              kpiData.grade === 'C'  ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
              'bg-red-100 text-red-700 border-red-300'
            )}>
              {kpiData.grade || '—'}
            </span>
            <span className="text-xs font-semibold tabular-nums">{kpiData.total_score ?? '—'}</span>
          </button>
        ) : undefined
      }
    >

      {/* ── Date Filter ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={yearFilter} onValueChange={handleYearChange}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue placeholder="ปี" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทุกปี</SelectItem>
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 h-8 text-sm" />
          <span className="text-muted-foreground text-sm">—</span>
          <Input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className="w-36 h-8 text-sm" />
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs">
            <RefreshCw className="h-3 w-3" /> รีเซ็ต
          </Button>
        </div>
      </div>

      {/* ── KPI Cards Row 1 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <KpiCard
          icon={Briefcase} iconColor="text-blue-500"
          title="โปรเจกต์" value={projectStats.total}
          sub={`${projectStats.active} กำลังดำเนินการ`}
          onClick={() => navigate('/projects')}
        />
        <KpiCard
          icon={ListTodo} iconColor={taskStats.overdue.length > 0 ? 'text-red-500' : 'text-slate-500'}
          title="งานของฉัน" value={taskStats.total}
          sub={taskStats.overdue.length > 0 ? `⚠ ${taskStats.overdue.length} เลยกำหนด` : `${taskStats.inProgress.length} กำลังทำ`}
          subColor={taskStats.overdue.length > 0 ? 'text-red-600 font-medium' : undefined}
          onClick={() => navigate('/task-hours')}
        />
        <KpiCard
          icon={TrendingUp} iconColor="text-violet-500"
          title="ไปป์ไลน์" value={fmt(salesStats.activeValue)}
          sub={`${salesStats.active} โอกาส`}
          onClick={() => navigate('/sales')}
        />
        <KpiCard
          icon={CheckCircle2} iconColor="text-green-500"
          title="ปิดการขาย" value={fmt(salesStats.wonValue)}
          sub={salesStats.winRate !== null ? `อัตราชนะ ${salesStats.winRate}%` : `${salesStats.won} ดีล`}
          onClick={() => navigate('/sales')}
        />
        <KpiCard
          icon={FileText} iconColor="text-amber-500"
          title="ใบเสนอราคา" value={quotationStats.total}
          sub={`อนุมัติ ${quotationStats.approved} · รอ ${quotationStats.pending}`}
          onClick={() => navigate('/quotations')}
        />
        <KpiCard
          icon={HeadphonesIcon} iconColor={ticketStats.critical > 0 ? 'text-red-500' : ticketStats.open > 0 ? 'text-amber-500' : 'text-green-500'}
          title="ซัพพอร์ต" value={ticketStats.open}
          sub={ticketStats.critical > 0 ? `🔴 ${ticketStats.critical} วิกฤต` : ticketStats.high > 0 ? `🟠 ${ticketStats.high} สูง` : 'รอดำเนินการ'}
          subColor={ticketStats.critical > 0 ? 'text-red-600 font-medium' : undefined}
          onClick={() => navigate('/support')}
        />
        <KpiCard
          icon={Building2} iconColor="text-slate-500"
          title="ลูกค้า" value={companies.length}
          sub="บริษัทที่ดูแล"
          onClick={() => navigate('/companies')}
        />
        <KpiCard
          icon={Target} iconColor="text-indigo-500"
          title="เป้าหมาย" value={goalsRaw.filter((g: any) => g.status === 'active').length}
          sub={goalStats.atRiskCount > 0 ? `⚠ ${goalStats.atRiskCount} ต่ำกว่า 50%` : 'กำลังดำเนินการ'}
          subColor={goalStats.atRiskCount > 0 ? 'text-orange-500' : undefined}
          onClick={() => navigate('/goals')}
        />
      </div>

      {/* ── Main Content: 3 panels ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sales Funnel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-500" />
                  ไปป์ไลน์การขาย
                </CardTitle>
                <CardDescription>จำนวนและมูลค่าตามขั้นตอน</CardDescription>
              </div>
              <Link to="/sales">
                <Button variant="ghost" size="sm" className="text-xs gap-1">ดูทั้งหมด <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {salesFunnelData.map(s => {
                const maxCount = Math.max(...salesFunnelData.map(x => x.count), 1);
                const pct = Math.round((s.count / maxCount) * 100);
                return (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{s.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, 4)}%`, background: s.fill }}
                      >
                        {s.count > 0 && <span className="text-[10px] text-white font-medium">{s.count}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-medium w-24 text-right shrink-0 tabular-nums">{fmt(s.value)}</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t flex justify-between text-xs text-muted-foreground">
                <span>ปิดแล้ว: {salesStats.won} ดีล · {fmt(salesStats.wonValue)}</span>
                {salesStats.winRate !== null && (
                  <span className={cn('font-medium', salesStats.winRate >= 50 ? 'text-green-600' : 'text-amber-600')}>
                    อัตราชนะ {salesStats.winRate}%
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Tickets */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <HeadphonesIcon className="h-4 w-4 text-amber-500" />
                ซัพพอร์ต
              </CardTitle>
              <Link to="/support">
                <Button variant="ghost" size="sm" className="text-xs gap-1">ดูทั้งหมด <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Status summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'เปิดทั้งหมด', val: ticketStats.open,     color: 'text-amber-600' },
                { label: 'วิกฤต',       val: ticketStats.critical,  color: 'text-red-600' },
                { label: 'สูง',          val: ticketStats.high,      color: 'text-orange-500' },
              ].map(x => (
                <div key={x.label} className="rounded-lg bg-muted/50 p-2">
                  <div className={cn('text-lg font-bold', x.color)}>{x.val}</div>
                  <div className="text-[10px] text-muted-foreground">{x.label}</div>
                </div>
              ))}
            </div>
            {/* Priority breakdown */}
            {ticketStats.byPriority.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">ตามความสำคัญ (เปิดอยู่)</p>
                {ticketStats.byPriority.map(p => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-xs w-16 shrink-0">{p.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((p.count / Math.max(ticketStats.open, 1)) * 100, 100)}%`, background: p.color }} />
                    </div>
                    <span className="text-xs font-medium w-4 text-right">{p.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-sm text-green-600 font-medium">
                <CheckCircle className="h-5 w-5 mx-auto mb-1" />
                ไม่มีคำร้องค้างอยู่
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Project Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500" />
              สถานะโปรเจกต์
            </CardTitle>
            <CardDescription>{projectStats.total} โปรเจกต์ทั้งหมด</CardDescription>
          </CardHeader>
          <CardContent>
            {projectStatusData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">ยังไม่มีโปรเจกต์</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={projectStatusData} cx="50%" cy="50%" outerRadius={70} innerRadius={30} dataKey="value">
                      {projectStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {projectStatusData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                      <span className="text-xs font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goals Progress */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" />
                  เป้าหมายที่กำลังดำเนินการ
                </CardTitle>
                <CardDescription>{goalStats.active.length} เป้าหมาย</CardDescription>
              </div>
              <Link to="/goals">
                <Button variant="ghost" size="sm" className="text-xs gap-1">ดูทั้งหมด <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {goalStats.active.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
                ยังไม่มีเป้าหมาย
                <div className="mt-2">
                  <Link to="/goals"><Button variant="outline" size="sm">เพิ่มเป้าหมาย</Button></Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {goalStats.active.map((g: any) => {
                  const pct = Math.min(100, Math.round(g.progress_percentage ?? 0));
                  const isAtRisk = pct < 50;
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate flex-1 mr-2">{g.title}</span>
                        <span className={cn('text-xs font-bold shrink-0', isAtRisk ? 'text-orange-500' : 'text-green-600')}>
                          {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className={cn('h-1.5', isAtRisk ? '[&>div]:bg-orange-400' : '[&>div]:bg-green-500')} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Deadlines + Overdue ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-orange-500" />
              กำหนดส่งภายใน 7 วัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.projects.length === 0 && upcomingDeadlines.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีงานที่ใกล้ครบกำหนด</p>
            ) : (
              <div className="space-y-4">
                {upcomingDeadlines.projects.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">โปรเจกต์</p>
                    <div className="space-y-1.5">
                      {upcomingDeadlines.projects.map((p: any) => {
                        const daysLeft = Math.max(0, Math.ceil((parseISO(p.end_date).getTime() - Date.now()) / 86400000));
                        return (
                          <Link key={p.id} to={`/project/${p.id}`} className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{format(parseISO(p.end_date), 'dd/MM/yyyy')}</p>
                            </div>
                            <Badge variant={daysLeft <= 2 ? 'destructive' : 'secondary'} className="text-xs ml-2 shrink-0">
                              {daysLeft === 0 ? 'วันนี้' : `${daysLeft} วัน`}
                            </Badge>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                {upcomingDeadlines.tasks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">งาน</p>
                    <div className="space-y-1.5">
                      {upcomingDeadlines.tasks.map((t: any) => {
                        const daysLeft = Math.max(0, Math.ceil((parseISO(t.end_date).getTime() - Date.now()) / 86400000));
                        return (
                          <Link key={t.id} to={`/project/${t.project_id}`} className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{t.title}</p>
                              <p className="text-xs text-muted-foreground">{t.project_name && `${t.project_name} · `}{format(parseISO(t.end_date), 'dd/MM/yyyy')}</p>
                            </div>
                            <Badge variant={daysLeft <= 2 ? 'destructive' : 'secondary'} className="text-xs ml-2 shrink-0">
                              {daysLeft === 0 ? 'วันนี้' : `${daysLeft} วัน`}
                            </Badge>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                งานเลยกำหนด
                {taskStats.overdue.length > 0 && (
                  <Badge variant="destructive" className="text-xs">{taskStats.overdue.length}</Badge>
                )}
              </CardTitle>
              <Link to="/task-hours">
                <Button variant="ghost" size="sm" className="text-xs gap-1">จัดการ <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {taskStats.overdue.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-70" />
                <p className="text-sm text-green-600 font-medium">ไม่มีงานเลยกำหนด</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {taskStats.overdue.slice(0, 8).map((t: any) => {
                  const daysOver = t.end_date
                    ? Math.max(0, Math.ceil((Date.now() - parseISO(t.end_date).getTime()) / 86400000))
                    : 0;
                  return (
                    <Link key={t.id} to={t.project_id ? `/project/${t.project_id}` : '/task-hours'}
                      className="flex items-center justify-between p-2 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-red-800">{t.title}</p>
                        <p className="text-xs text-red-500">{t.project_name ?? 'ไม่ระบุโปรเจกต์'}</p>
                      </div>
                      <Badge variant="destructive" className="text-xs ml-2 shrink-0">
                        เกิน {daysOver} วัน
                      </Badge>
                    </Link>
                  );
                })}
                {taskStats.overdue.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    และอีก {taskStats.overdue.length - 8} งาน
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Projects + Quotation Stats ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  โปรเจกต์ล่าสุด
                </CardTitle>
                <CardDescription>5 โปรเจกต์ที่อัพเดทล่าสุด</CardDescription>
              </div>
              <Link to="/projects">
                <Button variant="ghost" size="sm" className="text-xs gap-1">ดูทั้งหมด <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">ยังไม่มีโปรเจกต์</p>
            ) : (
              <div className="space-y-2">
                {recentProjects.map((p: any) => (
                  <Link key={p.id} to={`/project/${p.id}`} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.company_name ?? p.description ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {p.progress_percentage != null && (
                        <div className="flex items-center gap-1.5 w-20">
                          <Progress value={p.progress_percentage} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground w-7 text-right">{p.progress_percentage}%</span>
                        </div>
                      )}
                      <Badge variant={
                        p.status === 'on-track'  ? 'default' :
                        p.status === 'at-risk'   ? 'outline' :
                        p.status === 'delayed'   ? 'destructive' : 'secondary'
                      } className="text-xs">
                        {p.status === 'on-track'  ? 'ตามแผน' :
                         p.status === 'at-risk'   ? 'มีความเสี่ยง' :
                         p.status === 'delayed'   ? 'ล่าช้า' : 'เสร็จแล้ว'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary: Sales + Quotations */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                สรุปการขาย
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'ไปป์ไลน์ทั้งหมด',  val: salesStats.active,  color: 'text-blue-600' },
                { label: 'ปิดแล้ว (ชนะ)',    val: salesStats.won,     color: 'text-green-600' },
                { label: 'ไม่ปิด (แพ้)',     val: salesStats.lost,    color: 'text-red-500' },
              ].map(x => (
                <div key={x.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{x.label}</span>
                  <span className={cn('font-semibold text-sm', x.color)}>{x.val}</span>
                </div>
              ))}
              {salesStats.winRate !== null && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">อัตราชนะ</span>
                    <span className={cn('text-xs font-bold', salesStats.winRate >= 50 ? 'text-green-600' : 'text-amber-600')}>
                      {salesStats.winRate}%
                    </span>
                  </div>
                  <Progress value={salesStats.winRate} className={cn('h-1.5', salesStats.winRate >= 50 ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500')} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                ใบเสนอราคา
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'ทั้งหมด',     val: quotationStats.total,    color: '' },
                { label: 'อนุมัติแล้ว', val: quotationStats.approved,  color: 'text-green-600' },
                { label: 'รอตอบกลับ',  val: quotationStats.pending,   color: 'text-amber-600' },
              ].map(x => (
                <div key={x.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{x.label}</span>
                  <span className={cn('font-semibold text-sm', x.color)}>{x.val}</span>
                </div>
              ))}
              <div className="pt-1 border-t">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">มูลค่าอนุมัติ</span>
                  <span className="text-xs font-bold text-green-600">{fmt(quotationStats.approvedValue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </PageShell>
  );
}
