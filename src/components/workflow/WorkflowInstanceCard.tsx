import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GitBranch, ChevronRight, CheckCircle2, Loader2, Link, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import type { WorkflowDefinition, WorkflowEntityType } from '@/types/workflow';

interface Props {
  entityType: WorkflowEntityType;
  entityId: string;
}

export function WorkflowInstanceCard({ entityType, entityId }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [selectedDefId, setSelectedDefId] = useState('');

  const { data: instance, isLoading } = useQuery({
    queryKey: ['workflow-instance', entityType, entityId],
    queryFn: () => apiFetch<any>(`/workflow-instances.php?entity_type=${entityType}&entity_id=${entityId}`),
  });

  const { data: definitionsRaw } = useQuery<WorkflowDefinition[]>({
    queryKey: ['workflow-definitions', entityType],
    queryFn: () => apiFetch(`/workflows.php?entity_type=${entityType}`),
    enabled: instance === null,
  });
  const definitions = definitionsRaw ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['workflow-instance', entityType, entityId] });
    qc.invalidateQueries({ queryKey: ['workflow-global-analytics'] });
  };

  const linkMutation = useMutation({
    mutationFn: () => apiFetch('/workflow-instances.php', {
      method: 'POST',
      body: JSON.stringify({ workflow_definition_id: selectedDefId, entity_type: entityType, entity_id: entityId }),
    }),
    onSuccess: () => { invalidate(); toast({ title: 'ผูก Workflow เรียบร้อย' }); },
    onError: () => toast({ title: 'ผูกไม่สำเร็จ', variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: (instanceId: string) => apiFetch(`/workflow-instances.php?id=${instanceId}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast({ title: 'ยกเลิก Workflow แล้ว' }); },
    onError: () => toast({ title: 'ยกเลิกไม่สำเร็จ', variant: 'destructive' }),
  });

  const advanceMutation = useMutation({
    mutationFn: (payload: { instance_id: string; step_id: string; next_step_id: string | null }) =>
      apiFetch('/workflow-instances.php?action=advance', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => { invalidate(); toast({ title: 'ขยับขั้นตอนเรียบร้อย' }); },
    onError: () => toast({ title: 'ไม่สามารถ advance ได้', variant: 'destructive' }),
  });

  if (isLoading) return (
    <div className="rounded-xl border p-3 flex items-center gap-2 text-muted-foreground text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด Workflow...
    </div>
  );

  // ── State A: no instance ──────────────────────────────────────────────
  if (!instance) return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <GitBranch className="h-4 w-4 text-slate-400" />
        Workflow
      </div>
      <p className="text-xs text-muted-foreground">ยังไม่มี workflow ผูกอยู่</p>
      {definitions.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedDefId} onValueChange={setSelectedDefId}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="เลือก workflow..." />
            </SelectTrigger>
            <SelectContent>
              {definitions.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs shrink-0"
            disabled={!selectedDefId || linkMutation.isPending}
            onClick={() => linkMutation.mutate()}>
            {linkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link className="h-3 w-3 mr-1" />}
            ผูก Workflow
          </Button>
        </div>
      )}
      {definitions.length === 0 && (
        <p className="text-xs text-muted-foreground">ยังไม่มี workflow definition สำหรับ {entityType}</p>
      )}
    </div>
  );

  const stages = (instance.definition?.nodes ?? []).filter((n: any) => n.type === 'stage');
  const currentStepId: string | null = instance.current_step_id ?? null;
  const currentIdx = stages.findIndex((n: any) => n.id === currentStepId);
  const nextStage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  // ── State C: completed ────────────────────────────────────────────────
  if (instance.status === 'completed') return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{instance.definition_name}</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✅ เสร็จสิ้น</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {stages.map((stage: any, i: number) => (
          <div key={stage.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 border border-green-300 text-green-700">
              <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />{stage.data.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── State B: active ───────────────────────────────────────────────────
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium text-slate-700">{instance.definition_name}</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">กำลังดำเนินการ</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {stages.map((stage: any, i: number) => {
          const done = currentIdx >= 0 && i < currentIdx;
          const current = stage.id === currentStepId;
          return (
            <div key={stage.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                done    ? 'bg-green-100 border-green-300 text-green-700' :
                current ? 'bg-blue-100 border-blue-400 text-blue-700 ring-1 ring-blue-400' :
                          'bg-white border-slate-200 text-slate-400'
              }`}>
                {done && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />}
                {stage.data.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-1">
        {currentStepId && (
          <Button size="sm" className="h-7 text-xs"
            disabled={advanceMutation.isPending}
            onClick={() => advanceMutation.mutate({ instance_id: instance.id, step_id: currentStepId, next_step_id: nextStage?.id ?? null })}>
            {advanceMutation.isPending
              ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
              : <ChevronRight className="h-3 w-3 mr-1" />}
            {nextStage ? `→ ${nextStage.data.label}` : 'ปิด Workflow'}
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 text-xs"
          onClick={() => navigate(`/workflow?entity=${entityType}&entity_id=${entityId}`)}>
          <GitBranch className="h-3 w-3 mr-1" /> ดู BPM
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
          disabled={cancelMutation.isPending}
          onClick={async () => {
            const ok = await confirm({ title: 'ยกเลิก Workflow?', description: 'ประวัติขั้นตอนจะยังคงอยู่ แต่จะไม่สามารถ advance ต่อได้', confirmLabel: 'ยกเลิก Workflow', variant: 'destructive' });
            if (ok && instance?.id) cancelMutation.mutate(instance.id);
          }}>
          {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}
