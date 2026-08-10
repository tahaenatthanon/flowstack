import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, CheckCircle, Clock, TrendingDown, Users, Loader2, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ReportStep {
  step_id: string;
  step_name: string;
  node_type: string;
  sla_minutes: number;
  avg_cycle_minutes: number | null;
  min_cycle_minutes: number | null;
  max_cycle_minutes: number | null;
  total_runs: number;
  completed_runs: number;
  active_runs: number;
  stalled_count: number;
  heat_level: 'ok' | 'warn' | 'critical';
  sla_ratio: number | null;
}

interface ReportInstance {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  company_name?: string | null;
  status: string;
  current_step_name: string | null;
  total_minutes: number;
  current_step_minutes: number | null;
  started_at: string;
  completed_at: string | null;
}

interface FlowReport {
  definition_id: string;
  definition_name: string;
  entity_type: string;
  summary: {
    total_instances: number;
    active_instances: number;
    completed_instances: number;
    avg_total_cycle_minutes: number | null;
    on_time_rate: number | null;
  };
  bottleneck: ReportStep | null;
  steps: ReportStep[];
  instances: ReportInstance[];
}

function fmtDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${Math.round(minutes)}น.`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}ชม.`;
  return `${(minutes / 1440).toFixed(1)}วัน`;
}

function HeatBadge({ level }: { level: string }) {
  if (level === 'critical') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
      <AlertCircle className="h-3 w-3" /> เกิน SLA
    </span>
  );
  if (level === 'warn') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <AlertTriangle className="h-3 w-3" /> เสี่ยง
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
      <CheckCircle className="h-3 w-3" /> ปกติ
    </span>
  );
}

function StepWaterfall({ steps }: { steps: ReportStep[] }) {
  const stageSteps = steps.filter(s => s.node_type === 'stage' || (!s.node_type || s.node_type === ''));
  if (stageSteps.length === 0) {
    const all = steps.filter(s => s.node_type !== 'start' && s.node_type !== 'end');
    if (all.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล Step</p>;
  }
  const displaySteps = stageSteps.length > 0 ? stageSteps : steps.filter(s => s.node_type !== 'start' && s.node_type !== 'end');
  const maxSlaRatio = Math.max(...displaySteps.map(s => s.sla_ratio ?? 0), 1.0);

  return (
    <div className="space-y-2">
      {displaySteps.map((step, idx) => {
        const barPct = step.sla_ratio !== null ? Math.min(step.sla_ratio / Math.max(maxSlaRatio, 1) * 100, 100) : 0;
        const hasData = step.avg_cycle_minutes !== null;

        return (
          <div key={step.step_id} className="group">
            {/* Step header row */}
            <div className="flex items-center gap-2 mb-1">
              <div className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0',
                step.heat_level === 'critical' ? 'bg-red-100 text-red-700' :
                step.heat_level === 'warn'     ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {idx + 1}
              </div>
              <span className="text-sm font-medium text-slate-800 flex-1 truncate">{step.step_name}</span>
              <HeatBadge level={step.heat_level} />
              {step.stalled_count > 0 && (
                <span className="text-[10px] bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5 font-medium">
                  หยุดอยู่ {step.stalled_count}
                </span>
              )}
            </div>

            {/* Bar */}
            <div className="ml-8 mb-1">
              <div className="relative h-6 bg-slate-100 rounded-md overflow-hidden">
                {/* SLA marker at 80% */}
                <div className="absolute top-0 bottom-0 w-px bg-amber-400 opacity-60" style={{ left: `${(0.8 / Math.max(maxSlaRatio, 1)) * 100}%` }} />
                {/* SLA marker at 100% */}
                <div className="absolute top-0 bottom-0 w-px bg-red-400" style={{ left: `${(1.0 / Math.max(maxSlaRatio, 1)) * 100}%` }} />

                {hasData ? (
                  <div
                    className={cn(
                      'h-full rounded-md transition-all flex items-center px-2',
                      step.heat_level === 'critical' ? 'bg-red-500' :
                      step.heat_level === 'warn'     ? 'bg-amber-400' :
                      'bg-blue-500'
                    )}
                    style={{ width: `${Math.max(barPct, 4)}%` }}
                  >
                    <span className="text-[10px] text-white font-medium whitespace-nowrap">
                      {fmtDuration(step.avg_cycle_minutes)}
                    </span>
                  </div>
                ) : (
                  <div className="h-full flex items-center px-2">
                    <span className="text-[10px] text-muted-foreground">ยังไม่มีข้อมูล</span>
                  </div>
                )}
              </div>

              {/* Stats row under bar */}
              <div className="flex items-center gap-4 mt-0.5 text-[10px] text-muted-foreground">
                <span>SLA: {fmtDuration(step.sla_minutes)}</span>
                {hasData && <span>เฉลี่ย: {fmtDuration(step.avg_cycle_minutes)}</span>}
                {step.min_cycle_minutes !== null && <span>ต่ำสุด: {fmtDuration(step.min_cycle_minutes)}</span>}
                {step.max_cycle_minutes !== null && <span>สูงสุด: {fmtDuration(step.max_cycle_minutes)}</span>}
                <span className="ml-auto">รัน {step.total_runs}ครั้ง · สำเร็จ {step.completed_runs} · กำลังทำ {step.active_runs}</span>
              </div>
            </div>

            {/* Arrow connector */}
            {idx < displaySteps.length - 1 && (
              <div className="ml-10 flex items-center gap-1 text-slate-300 my-0.5">
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> เส้นเหลือง = 80% SLA</span>
        <span className="flex items-center gap-1"><span className="w-px h-3 bg-red-400 inline-block" /> เส้นแดง = เกิน SLA</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> แถบ = เวลาเฉลี่ยจริง</span>
      </div>
    </div>
  );
}

function InstanceTable({ instances, entityType }: { instances: ReportInstance[]; entityType: string }) {
  if (instances.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มี instance</p>;

  const entityLabel = (t: string) => {
    if (t === 'project')         return 'โปรเจกต์';
    if (t === 'opportunity')     return 'โอกาสการขาย';
    if (t === 'support_ticket')  return 'Helpdesk';
    if (t === 'company_journey') return 'เส้นทางลูกค้า';
    return t;
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-xs">{entityLabel(entityType)}</th>
            <th className="text-left px-3 py-2 font-medium text-xs">ขั้นตอนปัจจุบัน</th>
            <th className="text-left px-3 py-2 font-medium text-xs">เวลาในขั้นตอนนี้</th>
            <th className="text-left px-3 py-2 font-medium text-xs">เวลารวม</th>
            <th className="text-left px-3 py-2 font-medium text-xs">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {instances.map(inst => (
            <tr key={inst.id} className="border-t hover:bg-muted/40">
              <td className="px-3 py-2 max-w-[200px]">
                <div className="font-medium truncate">{inst.entity_name || '—'}</div>
                {inst.company_name && inst.company_name !== inst.entity_name && (
                  <div className="text-[10px] text-muted-foreground truncate">{inst.company_name}</div>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground text-xs">
                {inst.status === 'completed' ? (
                  <span className="text-green-600 font-medium">เสร็จสิ้น</span>
                ) : (
                  inst.current_step_name ?? '—'
                )}
              </td>
              <td className="px-3 py-2 text-xs">
                {inst.status === 'active' ? (
                  <span className={cn(
                    'font-medium',
                    (inst.current_step_minutes ?? 0) > 1440 ? 'text-red-600' :
                    (inst.current_step_minutes ?? 0) > 480  ? 'text-amber-600' : 'text-slate-700'
                  )}>
                    {fmtDuration(inst.current_step_minutes)}
                  </span>
                ) : '—'}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDuration(inst.total_minutes)}</td>
              <td className="px-3 py-2">
                {inst.status === 'completed' ? (
                  <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">เสร็จสิ้น</span>
                ) : inst.status === 'active' ? (
                  <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">กำลังทำ</span>
                ) : inst.status === 'cancelled' ? (
                  <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 font-medium">ยกเลิก</span>
                ) : inst.status === 'paused' ? (
                  <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">หยุดชั่วคราว</span>
                ) : inst.status === 'error' ? (
                  <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">ผิดพลาด</span>
                ) : (
                  <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 font-medium">{inst.status}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkflowFlowReport({ definitionId }: { definitionId: string }) {
  const { data, isLoading, isError } = useQuery<FlowReport>({
    queryKey: ['workflow-flow-report', definitionId],
    queryFn: () => apiFetch(`/workflow-analytics.php?action=report&definition_id=${definitionId}`),
    enabled: !!definitionId,
    staleTime: 0,
  });

  if (!definitionId) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-2">
        <TrendingDown className="h-10 w-10 opacity-30" />
        <p className="text-sm">เลือก Workflow เพื่อดูรายงาน</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> กำลังโหลดรายงาน...
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-red-500 p-4">โหลดรายงานไม่สำเร็จ</p>;
  }

  const { summary, bottleneck, steps, instances } = data;

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto h-full">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs"><Users className="h-3.5 w-3.5" /> ทั้งหมด</div>
          <div className="text-2xl font-bold text-slate-800">{summary.total_instances}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">กำลังทำ {summary.active_instances} · เสร็จ {summary.completed_instances}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs"><Clock className="h-3.5 w-3.5" /> เวลารวมเฉลี่ย</div>
          <div className="text-2xl font-bold text-slate-800">{fmtDuration(summary.avg_total_cycle_minutes)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">ตั้งแต่เริ่มจนจบ</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> เสร็จในเวลา</div>
          <div className="text-2xl font-bold text-slate-800">{summary.on_time_rate !== null ? `${summary.on_time_rate}%` : '—'}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">อัตราความสำเร็จ</div>
        </div>
        <div className={cn('rounded-lg border p-3', bottleneck?.heat_level === 'critical' ? 'bg-red-50 border-red-200' : bottleneck?.heat_level === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-white')}>
          <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs">
            {bottleneck?.heat_level === 'critical' ? <AlertCircle className="h-3.5 w-3.5 text-red-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
            คอขวดหลัก
          </div>
          <div className={cn('text-sm font-bold truncate', bottleneck?.heat_level === 'critical' ? 'text-red-700' : 'text-amber-700')}>
            {bottleneck ? bottleneck.step_name : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {bottleneck ? `${fmtDuration(bottleneck.avg_cycle_minutes)} / SLA ${fmtDuration(bottleneck.sla_minutes)}` : 'ทุก step ปกติ'}
          </div>
        </div>
      </div>

      {/* Bottleneck alert */}
      {bottleneck && bottleneck.heat_level !== 'ok' && (
        <div className={cn(
          'rounded-lg border px-4 py-3 flex items-start gap-3',
          bottleneck.heat_level === 'critical' ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'
        )}>
          {bottleneck.heat_level === 'critical'
            ? <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
          <div>
            <p className={cn('font-semibold text-sm', bottleneck.heat_level === 'critical' ? 'text-red-800' : 'text-amber-800')}>
              คอขวดที่ "{bottleneck.step_name}"
              {bottleneck.sla_ratio !== null && ` — ใช้เวลา ${Math.round(bottleneck.sla_ratio * 100)}% ของ SLA`}
            </p>
            <p className={cn('text-xs mt-0.5', bottleneck.heat_level === 'critical' ? 'text-red-600' : 'text-amber-600')}>
              เฉลี่ย {fmtDuration(bottleneck.avg_cycle_minutes)} (SLA: {fmtDuration(bottleneck.sla_minutes)})
              {bottleneck.stalled_count > 0 && ` · หยุดค้างอยู่ ${bottleneck.stalled_count} รายการ`}
            </p>
          </div>
        </div>
      )}

      {/* Flow waterfall */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-500 rounded-full inline-block" />
          ผลการทำงานแต่ละขั้นตอน (ตั้งแต่ต้นจนจบ)
        </h3>
        <StepWaterfall steps={steps} />
      </div>

      {/* Instance table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-purple-500 rounded-full inline-block" />
          รายการทั้งหมด ({instances.length})
        </h3>
        <InstanceTable instances={instances} entityType={data.entity_type} />
      </div>
    </div>
  );
}
