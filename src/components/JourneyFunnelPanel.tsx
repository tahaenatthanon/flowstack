import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Target, Rocket, FolderOpen, Bug, Headphones, RefreshCw,
  ArrowRight, ChevronRight, ExternalLink, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';

interface StageDetail {
  late_count?: number; lost_count?: number; win_rate?: number;
  slow_count?: number; delayed_count?: number; completed_count?: number;
  projects_with_tickets?: number; avg_days_to_ticket?: number;
  sla_breach_count?: number; sla_breach_rate?: number; avg_sla_hours?: number;
  won_renewals?: number; avg_value?: number;
}

interface Stage {
  id: string; label: string; icon: string;
  metric: number; unit: string; description: string; count: number;
  heat_level: 'ok' | 'warn' | 'critical';
  bench_warn: number; bench_crit: number;
  lower_is_better?: boolean; higher_is_better?: boolean;
  detail: StageDetail; won_count?: number;
}

interface JourneyData {
  period: number;
  funnel: { leads: number; won: number; projects: number; tickets: number; renewals: number };
  stages: Stage[];
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  target: Target, rocket: Rocket, folder: FolderOpen,
  bug: Bug, headphones: Headphones, refresh: RefreshCw,
};

const HEAT = {
  ok:       { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warn:     { dot: 'bg-amber-400',   bar: 'bg-amber-400',   text: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  critical: { dot: 'bg-red-500',     bar: 'bg-red-500',     text: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200' },
};

const HEAT_LABELS = { ok: 'ปกติ', warn: 'เฝ้าระวัง', critical: 'คอขวด' };

// ── Drill-down table ──────────────────────────────────────────────────────────

function DrillTable({ stageId, period }: { stageId: string; period: string }) {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['journey-drill', stageId, period],
    queryFn: () => apiFetch(`/journey-analytics.php?drill=${stageId}&period=${period}&limit=50`),
  });

  if (isLoading) return (
    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  );
  if (!data.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">ไม่มีข้อมูลในช่วงเวลานี้</p>
  );

  const cols: Record<string, { heads: string[]; row: (r: any) => React.ReactNode[] }> = {
    lead_to_won: {
      heads: ['Deal', 'บริษัท', 'Stage', 'วันที่ใช้', 'มูลค่า'],
      row: r => [
        r.name,
        r.company_name || '—',
        <Badge key="s" variant="outline" className="text-[10px]">{r.stage}</Badge>,
        <span key="d" className={r.days_elapsed > 60 ? 'text-red-600 font-medium' : ''}>{r.days_elapsed} วัน</span>,
        r.value ? `฿${Number(r.value).toLocaleString()}` : '—',
      ],
    },
    won_to_project: {
      heads: ['Deal', 'โปรเจกต์', 'บริษัท', 'Gap'],
      row: r => [
        r.opp_name,
        r.project_name || '—',
        r.company_name || '—',
        <span key="g" className={r.gap_days > 21 ? 'text-red-600 font-medium' : ''}>{r.gap_days ?? '?'} วัน</span>,
      ],
    },
    project_delivery: {
      heads: ['โปรเจกต์', 'บริษัท', 'Status', 'จริง', 'แผน'],
      row: r => [
        r.name,
        r.company_name || '—',
        <Badge key="s" variant="outline" className={`text-[10px] ${r.status === 'delayed' ? 'border-red-300 text-red-600' : ''}`}>{r.status}</Badge>,
        <span key="d" className={r.duration_days > 90 ? 'text-red-600 font-medium' : ''}>{r.duration_days} วัน</span>,
        r.planned_days ? `${r.planned_days} วัน` : '—',
      ],
    },
    project_to_ticket: {
      heads: ['โปรเจกต์', 'บริษัท', 'Tickets', 'วันแรก'],
      row: r => [
        r.project_name,
        r.company_name || '—',
        <span key="t" className={r.ticket_count > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>{r.ticket_count}</span>,
        r.days_to_first_ticket != null
          ? <span key="d" className={r.days_to_first_ticket < 7 ? 'text-red-600 font-medium' : ''}>{r.days_to_first_ticket} วัน</span>
          : <span key="ok" className="text-emerald-600 text-xs">ไม่มี Ticket</span>,
      ],
    },
    ticket_resolution: {
      heads: ['Ticket', 'Priority', 'ใช้เวลา', 'SLA', 'Breach'],
      row: r => [
        <span key="t" className="font-mono text-[10px]">{r.ticket_number}</span>,
        <Badge key="p" variant="outline" className="text-[10px]">{r.priority}</Badge>,
        <span key="h" className={r.sla_breached ? 'text-red-600 font-medium' : ''}>{r.hours_elapsed}h</span>,
        `${r.sla_hours}h`,
        r.sla_breached
          ? <AlertTriangle key="b" className="h-3.5 w-3.5 text-red-500" />
          : <CheckCircle2 key="b" className="h-3.5 w-3.5 text-emerald-500" />,
      ],
    },
    renew_upsell: {
      heads: ['Renewal Deal', 'Deal เดิม', 'บริษัท', 'Stage', 'วันที่'],
      row: r => [
        r.name,
        r.original_deal || '—',
        r.company_name || '—',
        <Badge key="s" variant="outline" className="text-[10px]">{r.stage}</Badge>,
        r.days_since_close != null ? `${r.days_since_close} วันหลัง close` : '—',
      ],
    },
  };

  const def = cols[stageId];
  if (!def) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            {def.heads.map(h => <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {def.row(r).map((cell, j) => (
                <td key={j} className="px-2 py-1.5 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stage card ────────────────────────────────────────────────────────────────

function StageCard({ stage, maxMetric, onDrill }: {
  stage: Stage; maxMetric: number; onDrill: (id: string, label: string) => void;
}) {
  const heat = HEAT[stage.heat_level];
  const Icon = ICONS[stage.icon] ?? Target;
  const barPct = maxMetric > 0 ? Math.min(100, (stage.metric / maxMetric) * 100) : 0;

  return (
    <div
      className="rounded-lg border bg-card p-3 cursor-pointer hover:shadow-sm transition-shadow group"
      onClick={() => onDrill(stage.id, stage.label)}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 rounded-md p-1.5 ${heat.badge} border shrink-0`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium truncate">{stage.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-xs font-bold ${heat.text}`}>
                {stage.metric.toLocaleString('th-TH', { maximumFractionDigits: 1 })} {stage.unit}
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stage.description}</p>

          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${heat.bar}`} style={{ width: `${barPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">{stage.count.toLocaleString()} รายการ</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${heat.badge}`}>
              {HEAT_LABELS[stage.heat_level]}
            </span>
          </div>
        </div>
      </div>

      {/* Inline detail rows */}
      <div className="mt-2 pt-2 border-t space-y-0.5">
        {stage.detail.win_rate !== undefined && (
          <DetailRow label="Win Rate" value={`${stage.detail.win_rate}%`} />
        )}
        {!!stage.detail.late_count && (
          <DetailRow label="เกิน Expected Close" value={`${stage.detail.late_count} deal`} warn />
        )}
        {!!stage.detail.lost_count && (
          <DetailRow label="Deal หาย" value={`${stage.detail.lost_count} deal`} />
        )}
        {!!stage.detail.slow_count && (
          <DetailRow label="Gap > 21 วัน" value={`${stage.detail.slow_count} โปรเจกต์`} warn />
        )}
        {!!stage.detail.delayed_count && (
          <DetailRow label="ล่าช้า" value={`${stage.detail.delayed_count} โปรเจกต์`} warn />
        )}
        {stage.detail.completed_count !== undefined && (
          <DetailRow label="เสร็จแล้ว" value={`${stage.detail.completed_count} โปรเจกต์`} />
        )}
        {stage.detail.projects_with_tickets !== undefined && (
          <DetailRow label="โปรเจกต์ที่มี Ticket" value={`${stage.detail.projects_with_tickets}`} warn={!!stage.detail.projects_with_tickets} />
        )}
        {!!stage.detail.avg_days_to_ticket && (
          <DetailRow label="วันแรกที่มี Ticket" value={`${stage.detail.avg_days_to_ticket} วัน`} />
        )}
        {stage.detail.sla_breach_rate !== undefined && (
          <DetailRow label="SLA Breach" value={`${stage.detail.sla_breach_rate}%`} warn={stage.detail.sla_breach_rate > 10} />
        )}
        {stage.detail.avg_sla_hours !== undefined && (
          <DetailRow label="เฉลี่ย SLA" value={`${stage.detail.avg_sla_hours}h`} />
        )}
        {stage.detail.won_renewals !== undefined && (
          <DetailRow label="Renewals ที่ปิดได้" value={`${stage.detail.won_renewals}`} />
        )}
        {!!stage.detail.avg_value && (
          <DetailRow label="มูลค่าเฉลี่ย" value={`฿${Number(stage.detail.avg_value).toLocaleString()}`} />
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={warn ? 'text-amber-600 font-medium' : 'text-foreground'}>{value}</span>
    </div>
  );
}

// ── Funnel bar ────────────────────────────────────────────────────────────────

function FunnelBar({ data }: { data: JourneyData['funnel'] }) {
  const steps = [
    { label: 'Leads',    value: data.leads,    color: 'bg-blue-400' },
    { label: 'Won',      value: data.won,       color: 'bg-violet-400' },
    { label: 'Projects', value: data.projects,  color: 'bg-emerald-400' },
    { label: 'Tickets',  value: data.tickets,   color: 'bg-amber-400' },
    { label: 'Renewals', value: data.renewals,  color: 'bg-pink-400' },
  ];
  const max = Math.max(...steps.map(s => s.value), 1);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs font-medium mb-2.5">Conversion Funnel</div>
      <div className="flex items-end gap-1 h-14">
        {steps.map((s, i) => (
          <div key={s.label} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="text-[9px] text-muted-foreground font-medium">{s.value}</div>
            <div
              className={`w-full rounded-t ${s.color} opacity-80`}
              style={{ height: `${Math.max(3, (s.value / max) * 44)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {steps.map(s => (
          <div key={s.label} className="flex-1 text-center text-[9px] text-muted-foreground truncate">{s.label}</div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground flex-wrap">
        {data.leads > 0 && <><span className="font-medium text-foreground">{Math.round(data.won / data.leads * 100)}%</span> win rate</>}
        {data.won > 0 && <><ArrowRight className="h-2.5 w-2.5 mx-0.5" /><span className="font-medium text-foreground">{Math.round(data.projects / Math.max(data.won, 1) * 100)}%</span> → project</>}
        {data.projects > 0 && <><ArrowRight className="h-2.5 w-2.5 mx-0.5" /><span className="font-medium text-foreground">{Math.round(data.renewals / Math.max(data.projects, 1) * 100)}%</span> renew</>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function JourneyFunnelPanel() {
  const [period, setPeriod]   = useState('365');
  const [drillStage, setDrillStage] = useState<{ id: string; label: string } | null>(null);

  const { data, isLoading } = useQuery<JourneyData>({
    queryKey: ['journey-analytics', period],
    queryFn: () => apiFetch(`/journey-analytics.php?period=${period}`),
  });

  const criticalCount = data?.stages.filter(s => s.heat_level === 'critical').length ?? 0;
  const warnCount     = data?.stages.filter(s => s.heat_level === 'warn').length ?? 0;
  const maxMetric     = data ? Math.max(...data.stages.map(s => s.metric), 1) : 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Customer Journey</span>
          {!isLoading && data && (
            <div className="flex gap-1">
              {criticalCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                  {criticalCount} คอขวด
                </span>
              )}
              {warnCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  {warnCount} เฝ้าระวัง
                </span>
              )}
            </div>
          )}
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 วัน</SelectItem>
            <SelectItem value="90">90 วัน</SelectItem>
            <SelectItem value="180">6 เดือน</SelectItem>
            <SelectItem value="365">1 ปี</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && (
          <>
            <FunnelBar data={data.funnel} />

            {/* Summary badges */}
            <div className="grid grid-cols-3 gap-1.5">
              {(['ok', 'warn', 'critical'] as const).map(level => {
                const count = data.stages.filter(s => s.heat_level === level).length;
                const h = HEAT[level];
                return (
                  <div key={level} className={`rounded border px-2 py-1.5 text-center ${h.badge}`}>
                    <div className="text-base font-bold">{count}</div>
                    <div className="text-[9px]">{HEAT_LABELS[level]}</div>
                  </div>
                );
              })}
            </div>

            {/* Stage cards — critical first */}
            {[...data.stages]
              .sort((a, b) => ({ critical: 0, warn: 1, ok: 2 }[a.heat_level] - { critical: 0, warn: 1, ok: 2 }[b.heat_level]))
              .map(stage => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  maxMetric={maxMetric}
                  onDrill={(id, label) => setDrillStage({ id, label })}
                />
              ))
            }
          </>
        )}
      </div>

      {/* Drill-down sheet */}
      <Sheet open={!!drillStage} onOpenChange={open => { if (!open) setDrillStage(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">{drillStage?.label} — รายการ</SheetTitle>
          </SheetHeader>
          {drillStage && (
            <div className="mt-4">
              <DrillTable stageId={drillStage.id} period={period} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
