import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Save, GitBranch, Loader2, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle, CheckCircle, BarChart3, Link, Search, X as XIcon, FileBarChart2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import PageShell from '@/components/PageShell';
import { apiFetch } from '@/lib/api';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, WorkflowEntityType, StepAnalytics, WorkflowAnalytics } from '@/types/workflow';
import { WorkflowNodePalette } from '@/components/workflow/WorkflowNodePalette';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { WorkflowSidePanel } from '@/components/workflow/WorkflowSidePanel';
import { WorkflowFlowReport } from '@/components/workflow/WorkflowFlowReport';
import { WorkflowAlertBar }     from '@/components/workflow/WorkflowAlertBar';
import { WorkflowJourneyList }   from '@/components/workflow/WorkflowJourneyList';
import { WorkflowJourneyDetail } from '@/components/workflow/WorkflowJourneyDetail';
import { useJourneys, useCreateJourney } from '@/hooks/useJourneys';
import { useCompanies } from '@/hooks/useSales';
import { cn } from '@/lib/utils';

interface UnlinkedRecord { id: string; name: string; status: string; company_name: string; year_label?: string; }

const STAGE_THAI: Record<string, string> = {
  lead: 'ลีด', qualified: 'คัดกรอง', proposal: 'เสนอราคา',
  negotiation: 'เจรจา', won: 'ชนะ', lost: 'แพ้',
  active: 'กำลังทำ', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
  'in-progress': 'กำลังทำ', open: 'เปิด', closed: 'ปิดแล้ว',
};

function LinkDialog({ definitionId, entityType, definitionName, onClose }: {
  definitionId: string; entityType: WorkflowEntityType; definitionName: string; onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: unlinkedRaw, isLoading } = useQuery<UnlinkedRecord[]>({
    queryKey: ['workflow-unlinked', entityType],
    queryFn: () => apiFetch(`/workflow-instances.php?entity_type=${entityType}&unlinked=1`),
  });
  const unlinked = unlinkedRaw ?? [];
  const filtered = unlinked.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(selected.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id)));

  const linkMutation = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      const errors: string[] = [];
      for (const entityId of ids) {
        try {
          await apiFetch('/workflow-instances.php', {
            method: 'POST',
            body: JSON.stringify({ workflow_definition_id: definitionId, entity_type: entityType, entity_id: entityId }),
          });
        } catch { errors.push(entityId); }
      }
      return { total: ids.length, errors };
    },
    onSuccess: ({ total, errors }) => {
      qc.invalidateQueries({ queryKey: ['workflow-unlinked', entityType] });
      qc.invalidateQueries({ queryKey: ['workflow-global-analytics'] });
      if (errors.length === 0) {
        toast({ title: `ผูก ${total} รายการเรียบร้อย` });
        onClose();
      } else {
        toast({ title: `ผูก ${total - errors.length}/${total} รายการ`, description: `ล้มเหลว ${errors.length} รายการ`, variant: 'destructive' });
        setSelected(new Set());
      }
    },
  });

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>ผูกรายการกับ {definitionName}</DialogTitle>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหา..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isLoading && <div className="text-center py-6 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />กำลังโหลด...</div>}
        {!isLoading && filtered.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">ไม่มีรายการที่ยังไม่ผูก Workflow</p>}
        {!isLoading && filtered.length > 0 && (
          <div className="border rounded-md overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                  </th>
                  <th className="text-left px-3 py-2 font-medium">ชื่อ</th>
                  <th className="text-left px-3 py-2 font-medium">ปี</th>
                  <th className="text-left px-3 py-2 font-medium">สถานะ</th>
                  <th className="text-left px-3 py-2 font-medium">บริษัท</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => toggle(r.id)}>
                    <td className="px-3 py-2">
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.year_label || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{STAGE_THAI[r.status] ?? r.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.company_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={selected.size === 0 || linkMutation.isPending} onClick={() => linkMutation.mutate()}>
            {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link className="h-4 w-4 mr-2" />}
            ผูก ({selected.size} รายการ)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GlobalBottleneckStep {
  step_id: string;
  step_name: string;
  avg_cycle_minutes: number;
  queue_depth: number;
  sla_minutes: number;
  heat_level: 'ok' | 'warn' | 'critical';
}

interface GlobalBottleneckRow {
  definition_id: string;
  definition_name: string;
  entity_type: string;
  total_instances: number;
  bottleneck_step: { step_id: string; step_name: string; avg_cycle_minutes: number; sla_minutes: number; heat_level: string; ratio: number } | null;
  critical_count: number;
  warn_count: number;
  ok_count: number;
  steps: GlobalBottleneckStep[];
}

function heatIcon(level: string) {
  if (level === 'critical') return <AlertCircle className="h-4 w-4 text-red-500" />;
  if (level === 'warn')     return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <CheckCircle className="h-4 w-4 text-green-500" />;
}

function entityLabel(t: string) {
  if (t === 'project')        return 'โปรเจกต์';
  if (t === 'opportunity')    return 'โอกาสการขาย';
  if (t === 'support_ticket') return 'Helpdesk';
  if (t === 'company_journey') return 'เส้นทางลูกค้า';
  return t;
}

function fmtHours(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)}น.`;
  return `${(minutes / 60).toFixed(1)}ชม.`;
}

// ── Global Bottleneck Panel ────────────────────────────────────────────────
function GlobalBottleneckPanel({ onSelectDef }: { onSelectDef: (id: string) => void }) {
  const { data: rows = [], isLoading } = useQuery<GlobalBottleneckRow[]>({
    queryKey: ['workflow-global-analytics'],
    queryFn: () => apiFetch('/workflow-analytics.php?action=global'),
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> กำลังโหลด...
      </div>
    );
  }

  const allCritical = rows.flatMap(r =>
    r.steps.filter(s => s.heat_level === 'critical').map(s => ({ ...s, definition_name: r.definition_name, entity_type: r.entity_type, definition_id: r.definition_id }))
  );
  const allWarn = rows.flatMap(r =>
    r.steps.filter(s => s.heat_level === 'warn').map(s => ({ ...s, definition_name: r.definition_name, entity_type: r.entity_type, definition_id: r.definition_id }))
  );

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{allCritical.length}</div>
          <div className="text-xs text-red-500 mt-0.5">คอขวดวิกฤต</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{allWarn.length}</div>
          <div className="text-xs text-amber-500 mt-0.5">เสี่ยงเกิน SLA</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{rows.reduce((a, r) => a + r.ok_count, 0)}</div>
          <div className="text-xs text-green-500 mt-0.5">ปกติ</div>
        </div>
      </div>

      {/* Critical steps */}
      {allCritical.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">⚠ คอขวดวิกฤต — เกิน SLA</p>
          <div className="space-y-2">
            {allCritical.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 cursor-pointer hover:bg-red-100 transition-colors"
                   onClick={() => onSelectDef(s.definition_id)}>
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-red-800 truncate block">{s.step_name}</span>
                  <span className="text-xs text-red-500">{s.definition_name} · {entityLabel(s.entity_type)}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-red-700">{fmtHours(s.avg_cycle_minutes)}</div>
                  <div className="text-[10px] text-red-400">SLA {fmtHours(s.sla_minutes)}</div>
                </div>
                {s.queue_depth > 0 && (
                  <span className="text-[10px] bg-red-200 text-red-700 rounded-full px-1.5 py-0.5 font-medium shrink-0">
                    คิว {s.queue_depth}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warn steps */}
      {allWarn.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">เสี่ยงเกิน SLA (&gt;80%)</p>
          <div className="space-y-2">
            {allWarn.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 cursor-pointer hover:bg-amber-100 transition-colors"
                   onClick={() => onSelectDef(s.definition_id)}>
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-amber-800 truncate block">{s.step_name}</span>
                  <span className="text-xs text-amber-500">{s.definition_name} · {entityLabel(s.entity_type)}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-amber-700">{fmtHours(s.avg_cycle_minutes)}</div>
                  <div className="text-[10px] text-amber-400">SLA {fmtHours(s.sla_minutes)}</div>
                </div>
                {s.queue_depth > 0 && (
                  <span className="text-[10px] bg-amber-200 text-amber-700 rounded-full px-1.5 py-0.5 font-medium shrink-0">
                    คิว {s.queue_depth}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-workflow summary table */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">สรุปตาม Workflow</p>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.definition_id}
                 className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                 onClick={() => onSelectDef(r.definition_id)}>
              <GitBranch className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700 truncate block">{r.definition_name}</span>
                <span className="text-xs text-slate-400">{entityLabel(r.entity_type)} · {r.total_instances} รายการ</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.critical_count > 0 && <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-medium">{r.critical_count} วิกฤต</span>}
                {r.warn_count > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-medium">{r.warn_count} เสี่ยง</span>}
                {r.ok_count > 0 && <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-medium">{r.ok_count} ปกติ</span>}
              </div>
              {r.bottleneck_step && (
                <div className="shrink-0 text-right">
                  {heatIcon(r.bottleneck_step.heat_level)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {allCritical.length === 0 && allWarn.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-400" />
          <p className="text-sm">ทุก step อยู่ในเกณฑ์ปกติ</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function WorkflowPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const entityType = searchParams.get('entity') as WorkflowEntityType | null;
  const entityId = searchParams.get('entity_id');

  const { confirm } = useConfirm();
  const [activeTab, setActiveTab]         = useState<'journey' | 'editor' | 'bottleneck' | 'report'>('journey');
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [journeyFilter, setJourneyFilter] = useState<'all' | 'active' | 'sla'>('all');
  const [mobileView, setMobileView]       = useState<'list' | 'detail'>('list');

  // โหลด journeys และ auto-select อันแรก
  const { data: journeys = [] } = useJourneys();
  useEffect(() => {
    if (journeys.length > 0 && !selectedJourneyId) {
      setSelectedJourneyId(journeys[0].id);
    }
  }, [journeys, selectedJourneyId]);
  const [selectedDefId, setSelectedDefId] = useState<string>('');
  const [selectedNode, setSelectedNode]   = useState<WorkflowNode | null>(null);
  const [nodes, setNodes]                 = useState<WorkflowNode[]>([]);
  const [edges, setEdges]                 = useState<WorkflowEdge[]>([]);
  const [showCreate, setShowCreate]       = useState(false);
  const [showLink, setShowLink]           = useState(false);
  const [showJourneyCreate, setShowJourneyCreate] = useState(false);
  const [newName, setNewName]             = useState('');
  const [newEntityType, setNewEntityType] = useState<WorkflowEntityType>('project');
  const [useTemplate, setUseTemplate]     = useState(true);

  const { data: definitions = [] } = useQuery<WorkflowDefinition[]>({
    queryKey: ['workflow-definitions'],
    queryFn: () => apiFetch('/workflows.php'),
  });

  // Auto-select first definition when list loads and nothing is selected yet
  useEffect(() => {
    if (definitions.length > 0 && !selectedDefId) {
      const first = definitions[0];
      setSelectedDefId(first.id);
      setNodes(first.definition.nodes);
      setEdges(first.definition.edges);
    }
  }, [definitions, selectedDefId]);

  const { data: templates } = useQuery<Record<WorkflowEntityType, { nodes: WorkflowNode[]; edges: WorkflowEdge[] }>>({
    queryKey: ['workflow-templates'],
    queryFn: () => apiFetch('/workflows.php?templates=1'),
  });

  const { data: analytics } = useQuery<WorkflowAnalytics>({
    queryKey: ['workflow-analytics', selectedDefId],
    queryFn: () => apiFetch(`/workflow-analytics.php?definition_id=${selectedDefId}`),
    enabled: !!selectedDefId,
  });

  const selectedDef = definitions.find(d => d.id === selectedDefId);
  // เส้นทางลูกค้า (company_journey) ใช้ 5 stage คงที่ ออกแบบในผังไม่ได้ — จัดการที่แท็บเส้นทางลูกค้า
  const editorDefs = definitions.filter(d => d.entity_type !== 'company_journey');
  const isJourneyDef = selectedDef?.entity_type === 'company_journey';

  // When a definition is selected, load its raw nodes/edges (no analytics enrichment here).
  // ใช้เมื่อเลือก definition จาก editor tab (เปลี่ยนไป editor)
  const handleSelectDef = useCallback((id: string) => {
    setSelectedDefId(id);
    const def = definitions.find(d => d.id === id);
    if (def) {
      setNodes(def.definition.nodes);
      setEdges(def.definition.edges);
    }
    setSelectedNode(null);
    setActiveTab('editor');
  }, [definitions]);

  // ใช้เมื่อเลือก definition จาก report/bottleneck tab (ไม่เปลี่ยน tab)
  const handleSelectDefNoNav = useCallback((id: string) => {
    setSelectedDefId(id);
    const def = definitions.find(d => d.id === id);
    if (def) {
      setNodes(def.definition.nodes);
      setEdges(def.definition.edges);
    }
    setSelectedNode(null);
  }, [definitions]);

  // When analytics loads for the selected definition, enrich nodes with heat/cycle data.
  useEffect(() => {
    if (!analytics?.steps?.length) return;
    setNodes(ns => ns.map(n => {
      const stat = analytics.steps.find(s => s.step_id === n.id);
      if (!stat) return n;
      return { ...n, data: { ...n.data, avgCycleMinutes: stat.avg_cycle_minutes, queueDepth: stat.queue_depth, heatLevel: stat.heat_level } };
    }));
  }, [analytics]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef) return Promise.reject();
      // Strip runtime analytics fields — these must never be persisted to the definition
      const runtimeFields = ['avgCycleMinutes', 'queueDepth', 'heatLevel'];
      const cleanNodes = nodes.map(n => {
        const cleanData = { ...n.data };
        runtimeFields.forEach(f => delete (cleanData as Record<string, unknown>)[f]);
        return { ...n, data: cleanData };
      });
      return apiFetch(`/workflows.php?id=${selectedDefId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: selectedDef.name, entity_type: selectedDef.entity_type, definition: { nodes: cleanNodes, edges }, is_template: selectedDef.is_template }),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] }); toast({ title: 'บันทึก workflow สำเร็จ' }); },
    onError: () => toast({ title: 'ไม่สามารถบันทึกได้', variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const def = useTemplate && templates ? (templates[newEntityType] ?? { nodes: [], edges: [] }) : { nodes: [], edges: [] };
      return apiFetch('/workflows.php', {
        method: 'POST',
        body: JSON.stringify({ name: newName, entity_type: newEntityType, definition: def, is_template: 0 }),
      });
    },
    onSuccess: (data: WorkflowDefinition) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] });
      setShowCreate(false);
      setNewName('');
      handleSelectDef(data.id);
      toast({ title: 'สร้าง workflow สำเร็จ' });
    },
    onError: () => toast({ title: 'ไม่สามารถสร้าง workflow ได้', variant: 'destructive' }),
  });

  // Instance view — when opened from Project/Opportunity detail
  const { data: instance, refetch: refetchInstance } = useQuery({
    queryKey: ['workflow-instance', entityType, entityId],
    queryFn: () => apiFetch<any>(`/workflow-instances.php?entity_type=${entityType}&entity_id=${entityId}`),
    enabled: !!(entityType && entityId),
  });

  const advanceMutation = useMutation({
    mutationFn: (payload: { instance_id: string; step_id: string; next_step_id: string | null; notes?: string }) =>
      apiFetch('/workflow-instances.php?action=advance', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { refetchInstance(); toast({ title: 'ขยับขั้นตอนเรียบร้อย' }); },
    onError: () => toast({ title: 'ไม่สามารถ advance ได้', variant: 'destructive' }),
  });

  const cancelInstanceMutation = useMutation({
    mutationFn: (instanceId: string) => apiFetch(`/workflow-instances.php?id=${instanceId}`, { method: 'DELETE' }),
    onSuccess: () => { refetchInstance(); toast({ title: 'ยกเลิก Workflow แล้ว' }); },
    onError: () => toast({ title: 'ยกเลิกไม่สำเร็จ', variant: 'destructive' }),
  });

  const selectedStepAnalytics: StepAnalytics | null = selectedNode
    ? analytics?.steps?.find(s => s.step_id === selectedNode.id) ?? null
    : null;

  const handleLabelChange = (nodeId: string, label: string) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
  };
  const handleSlaChange = (nodeId: string, slaMinutes: number) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, slaMinutes } } : n));
  };

  // Instance view panel — shown when entity params present
  const InstanceView = () => {
    if (!entityType || !entityId) return null;
    const inst = instance as any;
    const def: { nodes: any[]; edges: any[] } | undefined = inst?.definition;
    const allNodes: any[] = def?.nodes ?? [];
    const allEdges: any[] = def?.edges ?? [];
    const currentStepId: string | null = inst?.current_step_id ?? null;

    // Build adjacency map
    const nodeMap: Record<string, any> = {};
    allNodes.forEach((n: any) => { nodeMap[n.id] = n; });
    const adj: Record<string, string[]> = {};
    allNodes.forEach((n: any) => { adj[n.id] = []; });
    allEdges.forEach((e: any) => { if (e.source && e.target && adj[e.source]) adj[e.source].push(e.target); });

    // Topological sort for display order (Kahn's algorithm)
    const inDeg: Record<string, number> = {};
    allNodes.forEach((n: any) => { inDeg[n.id] = 0; });
    allEdges.forEach((e: any) => { if (e.target) inDeg[e.target] = (inDeg[e.target] ?? 0) + 1; });
    const topoQueue = Object.keys(inDeg).filter(k => inDeg[k] === 0);
    const topoOrder: string[] = [];
    while (topoQueue.length > 0) {
      const cur = topoQueue.shift()!;
      topoOrder.push(cur);
      (adj[cur] ?? []).forEach(nxt => { inDeg[nxt]--; if (inDeg[nxt] === 0) topoQueue.push(nxt); });
    }
    // Nodes the user must manually advance (stage + decision), in topological order
    const actionTypes = new Set(['stage', 'decision']);
    const stages = topoOrder.map(id => nodeMap[id]).filter((n: any) => n && actionTypes.has(n.type));

    // Find next user-action step via BFS, skipping automated nodes (notify/delay)
    const findNextActionStep = (fromId: string): any | null => {
      const visited = new Set<string>();
      const q = [...(adj[fromId] ?? [])];
      while (q.length > 0) {
        const nid = q.shift()!;
        if (visited.has(nid)) continue;
        visited.add(nid);
        const n = nodeMap[nid];
        if (!n) continue;
        if (actionTypes.has(n.type)) return n;
        if (n.type === 'notify' || n.type === 'delay') q.push(...(adj[nid] ?? []));
      }
      return null;
    };

    const currentIdx = stages.findIndex((n: any) => n.id === currentStepId);
    const nextStage = currentStepId ? findNextActionStep(currentStepId) : null;

    if (!inst) return (
      <div className="p-6 text-center text-muted-foreground">
        <GitBranch size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">ยังไม่มี Workflow ผูกอยู่กับ {entityType} นี้</p>
        <p className="text-xs mt-1">สร้าง Workflow definition ใน BPM แล้วระบบจะ auto-link เมื่อสร้างรายการใหม่</p>
      </div>
    );

    return (
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch size={16} className="text-purple-600" />
          <span className="font-semibold text-sm text-slate-700">{inst.definition_name}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
            inst.status === 'completed' ? 'bg-green-100 text-green-700' :
            inst.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
            'bg-blue-100 text-blue-700'
          }`}>
            {inst.status === 'completed' ? 'เสร็จสิ้น' : inst.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'กำลังดำเนินการ'}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {stages.map((stage: any, i: number) => {
            const done = currentIdx >= 0 ? i < currentIdx : false;
            const current = stage.id === currentStepId;
            return (
              <div key={stage.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                  done ? 'bg-green-100 border-green-300 text-green-700' :
                  current ? 'bg-blue-100 border-blue-400 text-blue-700 ring-1 ring-blue-400' :
                  'bg-white border-slate-200 text-slate-400'
                }`}>
                  {done && <CheckCircle2 size={10} className="inline mr-1" />}
                  {stage.data.label}
                </span>
              </div>
            );
          })}
        </div>
        {inst.status !== 'completed' && currentStepId && (
          <div className="mt-3 flex gap-2 items-center">
            <button
              onClick={() => advanceMutation.mutate({ instance_id: inst.id, step_id: currentStepId, next_step_id: nextStage?.id ?? null })}
              disabled={advanceMutation.isPending}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {advanceMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
              {nextStage ? `ไปขั้นตอน: ${nextStage.data.label}` : 'ปิด Workflow'}
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({ title: 'ยกเลิก Workflow?', description: 'ประวัติขั้นตอนจะยังคงอยู่', confirmLabel: 'ยกเลิก Workflow', variant: 'destructive' });
                if (ok) cancelInstanceMutation.mutate(inst.id);
              }}
              disabled={cancelInstanceMutation.isPending}
              className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-1 ml-auto"
            >
              {cancelInstanceMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <XIcon size={12} />}
              ยกเลิก Workflow
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageShell title="Workflow BPM" description="ออกแบบและวิเคราะห์กระบวนการทำงาน">
      {entityType && entityId && <InstanceView />}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0 overflow-x-auto">
        {/* Mobile back button when viewing detail */}
        {activeTab === 'journey' && mobileView === 'detail' && (
          <button
            onClick={() => setMobileView('list')}
            className="sm:hidden flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0 mr-1"
          >
            <ArrowLeft size={14} /> รายการ
          </button>
        )}
        {/* Tab switcher */}
        <div className={cn('flex rounded-md border overflow-hidden shrink-0', activeTab === 'journey' && mobileView === 'detail' && 'hidden sm:flex')}>
          {([
            { key: 'journey',     icon: '🗺',            label: 'เส้นทางลูกค้า' },
            { key: 'report',      icon: <FileBarChart2 size={13} />, label: 'รายงาน Flow' },
            { key: 'bottleneck',  icon: <BarChart3 size={13} />,    label: 'คอขวดทั้งหมด' },
            { key: 'editor',      icon: <GitBranch size={13} />,    label: 'ออกแบบ' },
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setMobileView('list'); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'editor' && (
          <>
            <Select value={isJourneyDef ? '' : selectedDefId} onValueChange={handleSelectDef}>
              <SelectTrigger className="w-36 sm:w-60">
                <SelectValue placeholder="เลือก Workflow..." />
              </SelectTrigger>
              <SelectContent>
                {editorDefs.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name} — {entityLabel(d.entity_type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
              <Plus size={14} /><span className="hidden sm:inline ml-1">สร้างใหม่</span>
            </Button>
            {selectedDefId && !isJourneyDef && (
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span className="hidden sm:inline ml-1">บันทึก</span>
              </Button>
            )}
            {selectedDefId && selectedDef && !isJourneyDef && (
              <Button size="sm" variant="outline" onClick={() => setShowLink(true)}>
                <Link size={14} /><span className="hidden sm:inline ml-1">ผูกรายการ</span>
              </Button>
            )}
          </>
        )}
      </div>

      {/* Workflow selector shown in report tab */}
      {activeTab === 'report' && (
        <div className="px-4 py-2 border-b bg-background shrink-0 flex items-center gap-2">
          <Select value={selectedDefId} onValueChange={handleSelectDefNoNav}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="เลือก Workflow เพื่อดูรายงาน..." />
            </SelectTrigger>
            <SelectContent>
              {definitions.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} — {entityLabel(d.entity_type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Alert bar — always visible */}
      <WorkflowAlertBar onViewAll={() => { setJourneyFilter('sla'); setActiveTab('journey'); }} />

      {/* Content */}
      {activeTab === 'journey' && (
        <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
          {/* List — full width on mobile, fixed sidebar on desktop */}
          <div className={cn(mobileView === 'detail' ? 'hidden sm:block' : 'block', 'w-full sm:w-52 sm:flex-shrink-0 h-full overflow-hidden')}>
            <WorkflowJourneyList
              selectedId={selectedJourneyId}
              onSelect={id => { setSelectedJourneyId(id); setMobileView('detail'); }}
              onNew={() => setShowJourneyCreate(true)}
              filter={journeyFilter}
              onFilterChange={setJourneyFilter}
            />
          </div>
          {/* Detail — full width on mobile, flex-1 on desktop */}
          <div className={cn(mobileView === 'list' ? 'hidden sm:flex' : 'flex', 'flex-1 overflow-hidden')}>
            {selectedJourneyId
              ? <WorkflowJourneyDetail
                    journeyId={selectedJourneyId}
                    onDeleted={() => {
                      const remaining = journeys.filter(j => j.id !== selectedJourneyId);
                      setSelectedJourneyId(remaining.length > 0 ? remaining[0].id : null);
                      setMobileView('list');
                    }}
                  />
              : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="text-4xl">🗺</span>
                  <p className="text-sm font-medium">เลือก Journey จากรายการทางซ้าย</p>
                  <p className="text-xs">หรือสร้าง Journey ใหม่ด้วยปุ่ม +</p>
                </div>
              )
            }
          </div>
        </div>
      )}
      {activeTab === 'bottleneck' ? (
        <div className="flex-1 overflow-hidden">
          <GlobalBottleneckPanel onSelectDef={(id) => { handleSelectDef(id); setActiveTab('editor'); }} />
        </div>
      ) : activeTab === 'report' ? (
        <div className="flex-1 overflow-hidden">
          <WorkflowFlowReport definitionId={selectedDefId} />
        </div>
      ) : activeTab === 'editor' ? (
        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
          <WorkflowNodePalette />
          {isJourneyDef ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
              <div className="text-center max-w-sm">
                <span className="text-4xl">🗺</span>
                <p className="mt-2 font-medium text-slate-600">เส้นทางลูกค้าออกแบบในผังไม่ได้</p>
                <p className="text-xs mt-1">ใช้ 5 ขั้นตอนคงที่ (การตลาด → การขาย → โปรเจค → ซัพพอร์ต → ต่ออายุ) — จัดการแต่ละ Journey ได้ที่แท็บ "เส้นทางลูกค้า"</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { setActiveTab('journey'); setMobileView('list'); }}>
                  ไปที่เส้นทางลูกค้า
                </Button>
              </div>
            </div>
          ) : selectedDefId ? (
            <WorkflowCanvas
              key={selectedDefId}
              initialNodes={nodes}
              initialEdges={edges}
              onNodeClick={setSelectedNode}
              onChange={(n, e) => { setNodes(n); setEdges(e); }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
                <p>เลือก Workflow หรือสร้างใหม่</p>
                <p className="text-xs mt-1">หรือดูคอขวดทั้งหมดใน tab "คอขวดทั้งหมด"</p>
              </div>
            </div>
          )}
          <WorkflowSidePanel
            selectedNode={selectedNode}
            stepAnalytics={selectedStepAnalytics}
            definitionId={selectedDefId}
            onLabelChange={handleLabelChange}
            onSlaChange={handleSlaChange}
          />
        </div>
      ) : null}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>สร้าง Workflow ใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>ชื่อ Workflow</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="เช่น Project Delivery Process" className="mt-1" />
            </div>
            <div>
              <Label>Entity Type</Label>
              <Select value={newEntityType} onValueChange={v => setNewEntityType(v as WorkflowEntityType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">โปรเจกต์</SelectItem>
                  <SelectItem value="opportunity">Sales / โอกาสขาย</SelectItem>
                  <SelectItem value="support_ticket">Support Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="use-template" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} className="rounded" />
              <label htmlFor="use-template" className="text-sm text-slate-600 cursor-pointer">ใช้ template สำเร็จรูป</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>ยกเลิก</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null} สร้าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showLink && selectedDef && (
        <LinkDialog
          definitionId={selectedDefId}
          entityType={selectedDef.entity_type}
          definitionName={selectedDef.name}
          onClose={() => setShowLink(false)}
        />
      )}

      {showJourneyCreate && (
        <CreateJourneyDialog
          onClose={() => setShowJourneyCreate(false)}
          onCreated={id => { setSelectedJourneyId(id); setShowJourneyCreate(false); setActiveTab('journey'); setMobileView('detail'); }}
        />
      )}
    </PageShell>
  );
}

// ── Create Journey Dialog ─────────────────────────────────────────────────────
function CreateJourneyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies(false);
  const createJourney = useCreateJourney();
  const [name, setName]       = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companySearch, setCompanySearch] = useState('');

  const filtered = companies.filter((c: any) =>
    !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!companyId || !name.trim()) return;
    createJourney.mutate(
      { company_id: companyId, journey_name: name.trim() },
      {
        onSuccess: (data: any) => {
          toast({ title: 'สร้าง Journey สำเร็จ' });
          onCreated(data.id);
        },
        onError: () => toast({ title: 'ไม่สามารถสร้าง Journey ได้', variant: 'destructive' }),
      }
    );
  };

  const selectedCompany = companies.find((c: any) => c.id === companyId);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>สร้าง Journey ใหม่</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs">ชื่อ Journey</Label>
            <Input
              className="mt-1"
              placeholder="เช่น บริษัท ABC - วงจรลูกค้า 2026"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">บริษัท</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="ค้นหาบริษัท..."
                value={companySearch}
                onChange={e => { setCompanySearch(e.target.value); setCompanyId(''); }}
              />
            </div>
            {selectedCompany && (
              <div className="mt-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-2 py-1">
                เลือก: <span className="font-semibold">{selectedCompany.name}</span>
              </div>
            )}
            {(companySearch || !companyId) && filtered.length > 0 && !selectedCompany && (
              <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                {filtered.slice(0, 20).map((c: any) => (
                  <div
                    key={c.id}
                    onClick={() => { setCompanyId(c.id); setCompanySearch(c.name); }}
                    className="px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50 border-b last:border-b-0"
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!name.trim() || !companyId || createJourney.isPending} onClick={handleSubmit}>
            {createJourney.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}สร้าง Journey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
