import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Loader2, Target, FolderOpen, Headphones, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Star } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { safeFmt } from '@/lib/dateUtils';

interface Props { companyId: string; companyName?: string; onClose: () => void; }

interface Summary {
  first_interaction: string | null;
  total_won_value: number;
  won_deals: number;
  total_deals: number;
  total_projects: number;
  total_tickets: number;
  open_tickets: number;
  renewals: number;
  sla_breaches: number;
  avg_csat: number | null;
}

interface Opp {
  id: string; name: string; stage: string; value: number;
  created_at: string; actual_close_date: string | null;
  lead_source: string; renewal_of: string | null; renewal_of_name: string | null;
  linked_project_id: string | null; linked_project_name: string | null;
  assigned_name: string;
}

interface Project {
  id: string; name: string; status: string;
  start_date: string; completed_at: string | null;
  created_at: string; opportunity_id: string | null;
  project_value: number; actual_progress: number;
  manager_name: string; ticket_count: number;
}

interface Ticket {
  id: string; ticket_number: string; title: string;
  priority: string; status: string; created_at: string;
  resolved_at: string | null; hours_elapsed: number | null;
  sla_breached: number; project_id: string | null;
  csat_score: number | null; assigned_name: string;
}

interface JourneyData {
  company: { id: string; name: string };
  summary: Summary;
  opportunities: Opp[];
  projects: Project[];
  tickets: Ticket[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700',
  qualified: 'bg-blue-100 text-blue-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-700',
};

const STATUS_COLOR: Record<string, string> = {
  'on-track': 'bg-emerald-100 text-emerald-700',
  'at-risk': 'bg-amber-100 text-amber-700',
  delayed: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const TICKET_STATUS_COLOR: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
};

function fmt(d: string | null) {
  return d ? safeFmt(d, 'd MMM yy') : '—';
}

function thb(v: number) {
  return `฿${Number(v).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function SumCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className={`text-xl font-bold ${color ?? ''}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── Timeline event ────────────────────────────────────────────────────────────

function TimelineEvent({ date, children, icon, color }: {
  date: string; children: React.ReactNode;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`rounded-full p-1.5 border-2 ${color} shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 w-px bg-border mt-1" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground mb-1">{date}</div>
        {children}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CustomerJourneySheet({ companyId, companyName, onClose }: Props) {
  const { data, isLoading } = useQuery<JourneyData>({
    queryKey: ['customer-journey', companyId],
    queryFn: () => apiFetch(`/customer-journey.php?company_id=${companyId}`),
    enabled: !!companyId,
  });

  // Build sorted timeline events
  type Event =
    | { type: 'opp';     date: string; opp: Opp }
    | { type: 'project'; date: string; proj: Project }
    | { type: 'ticket';  date: string; ticket: Ticket };

  const events: Event[] = data ? [
    ...data.opportunities.map(o => ({ type: 'opp'     as const, date: o.created_at,   opp: o })),
    ...data.projects.map(p =>      ({ type: 'project' as const, date: p.created_at,   proj: p })),
    ...data.tickets.map(t =>       ({ type: 'ticket'  as const, date: t.created_at,   ticket: t })),
  ].sort((a, b) => a.date.localeCompare(b.date)) : [];

  const s = data?.summary;

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b sticky top-0 bg-background z-10">
          <SheetTitle className="text-sm font-semibold">
            {companyName ?? data?.company.name ?? '...'} — Customer Journey
          </SheetTitle>
          {s?.first_interaction && (
            <p className="text-[10px] text-muted-foreground">
              ลูกค้าตั้งแต่ {fmt(s.first_interaction)}
            </p>
          )}
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && s && (
          <div className="p-4 space-y-5">
            {/* Summary grid */}
            <div className="grid grid-cols-3 gap-2">
              <SumCard label="Won Value" value={thb(s.total_won_value)} sub={`${s.won_deals}/${s.total_deals} deals`} color="text-emerald-600" />
              <SumCard label="Projects" value={s.total_projects} />
              <SumCard label="Tickets" value={s.total_tickets} sub={s.open_tickets > 0 ? `${s.open_tickets} เปิดอยู่` : 'ไม่มีค้าง'} color={s.open_tickets > 0 ? 'text-amber-600' : undefined} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SumCard label="Renewals" value={s.renewals} color={s.renewals > 0 ? 'text-violet-600' : undefined} />
              <SumCard label="SLA Breach" value={s.sla_breaches} color={s.sla_breaches > 0 ? 'text-red-600' : undefined} />
              <SumCard label="CSAT" value={s.avg_csat != null ? `${s.avg_csat}/5` : '—'} color={s.avg_csat && s.avg_csat >= 4 ? 'text-emerald-600' : s.avg_csat && s.avg_csat < 3 ? 'text-red-600' : undefined} />
            </div>

            {/* Timeline */}
            <div>
              <div className="text-xs font-medium mb-3 text-muted-foreground uppercase tracking-wide">ประวัติทั้งหมด</div>
              {events.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีประวัติ</p>
              )}
              <div>
                {events.map((e, i) => {
                  if (e.type === 'opp') {
                    const o = e.opp;
                    return (
                      <TimelineEvent key={`opp-${o.id}`} date={fmt(o.created_at)}
                        icon={<Target className="h-3 w-3" />}
                        color={o.stage === 'won' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : o.stage === 'lost' ? 'border-red-300 bg-red-50 text-red-600' : 'border-blue-300 bg-blue-50 text-blue-600'}
                      >
                        <div className="rounded-lg border bg-card p-2.5 text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate flex-1">{o.name}</span>
                            <Badge className={`${STAGE_COLOR[o.stage] ?? ''} border-0 text-[10px] shrink-0`}>{o.stage}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-[10px]">
                            {o.value > 0 && <span className="text-emerald-600 font-medium">{thb(o.value)}</span>}
                            {o.actual_close_date && <span>ปิด {fmt(o.actual_close_date)}</span>}
                            {o.assigned_name && <span>{o.assigned_name}</span>}
                          </div>
                          {o.renewal_of_name && (
                            <div className="flex items-center gap-1 text-[10px] text-violet-600">
                              <RefreshCw className="h-2.5 w-2.5" />
                              Renewal จาก: {o.renewal_of_name}
                            </div>
                          )}
                          {o.linked_project_name && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <FolderOpen className="h-2.5 w-2.5" />
                              {o.linked_project_name}
                            </div>
                          )}
                        </div>
                      </TimelineEvent>
                    );
                  }

                  if (e.type === 'project') {
                    const p = e.proj;
                    return (
                      <TimelineEvent key={`proj-${p.id}`} date={fmt(p.created_at)}
                        icon={<FolderOpen className="h-3 w-3" />}
                        color={p.status === 'completed' ? 'border-blue-300 bg-blue-50 text-blue-700' : p.status === 'delayed' ? 'border-red-300 bg-red-50 text-red-600' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}
                      >
                        <div className="rounded-lg border bg-card p-2.5 text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate flex-1">{p.name}</span>
                            <Badge className={`${STATUS_COLOR[p.status] ?? ''} border-0 text-[10px] shrink-0`}>{p.status}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-[10px]">
                            {p.start_date && <span>{fmt(p.start_date)} → {fmt(p.completed_at)}</span>}
                            {p.actual_progress > 0 && <span>{p.actual_progress}%</span>}
                            {p.manager_name && <span>{p.manager_name}</span>}
                          </div>
                          {p.ticket_count > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600">
                              <Headphones className="h-2.5 w-2.5" />
                              {p.ticket_count} tickets หลังส่งมอบ
                            </div>
                          )}
                        </div>
                      </TimelineEvent>
                    );
                  }

                  if (e.type === 'ticket') {
                    const t = e.ticket;
                    return (
                      <TimelineEvent key={`ticket-${t.id}`} date={fmt(t.created_at)}
                        icon={<Headphones className="h-3 w-3" />}
                        color={t.sla_breached ? 'border-red-300 bg-red-50 text-red-600' : t.status === 'resolved' || t.status === 'closed' ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-amber-300 bg-amber-50 text-amber-700'}
                      >
                        <div className="rounded-lg border bg-card p-2.5 text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground shrink-0">{t.ticket_number}</span>
                            <span className="font-medium truncate flex-1">{t.title}</span>
                            <Badge className={`${TICKET_STATUS_COLOR[t.status] ?? ''} border-0 text-[10px] shrink-0`}>{t.status}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-[10px]">
                            <Badge className={`${PRIORITY_COLOR[t.priority] ?? ''} border-0 text-[10px]`}>{t.priority}</Badge>
                            {t.hours_elapsed != null && <span>{t.hours_elapsed}h</span>}
                            {t.assigned_name && <span>{t.assigned_name}</span>}
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            {t.sla_breached ? (
                              <span className="flex items-center gap-1 text-red-600">
                                <AlertTriangle className="h-2.5 w-2.5" /> SLA breach
                              </span>
                            ) : t.status !== 'open' && (
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-2.5 w-2.5" /> ตรงเวลา
                              </span>
                            )}
                            {t.csat_score != null && (
                              <span className="flex items-center gap-1 text-amber-500">
                                <Star className="h-2.5 w-2.5 fill-amber-400" /> {t.csat_score}/5
                              </span>
                            )}
                          </div>
                        </div>
                      </TimelineEvent>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
