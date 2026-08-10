import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useDeleteTask, useUpdateTask, useAllTasks, useTaskChildren, useUsers, useTasks, useProjects, useCreateSubtask } from '@/hooks/useProjectData';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { apiFetch } from '@/lib/api';
import type { DbTask } from '@/types/project';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RowsPerPageSelector from '@/components/RowsPerPageSelector';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import { calculateProjectReport, getStatusColor, getStatusLabel, getProjectStatusColor } from '@/lib/projectUtils';
import { ChevronRight, ChevronDown, Pencil, Trash2, CheckCircle, AlertTriangle, CheckCircle2, Search, X, ChevronLeft, Plus, Link2, Loader2, List, FileText, Filter, ArrowUpFromLine, FolderKanban, ListTodo } from 'lucide-react';
import { format, parseISO, isValid, isBefore, differenceInDays } from 'date-fns';
import { safeParseISO, safeFmt } from '@/lib/dateUtils';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';

const GANTT_DAY_WIDTH = 28;

import { TASK_TYPE_CONFIG, getTaskTypeCfg } from '@/lib/taskTypes';

export function Paginator({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = pages.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  return (
    <div className="flex items-center justify-center gap-1 py-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="h-7 w-7 flex items-center justify-center rounded border text-xs disabled:opacity-30 hover:bg-muted transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      {visible.reduce<React.ReactNode[]>((acc, p, i, arr) => {
        if (i > 0 && p - (arr[i - 1] as number) > 1) {
          acc.push(<span key={`gap-${p}`} className="text-xs text-muted-foreground px-1">…</span>);
        }
        acc.push(
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-7 min-w-[28px] px-1.5 rounded border text-xs transition-colors ${
              p === page ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
            }`}
          >{p}</button>
        );
        return acc;
      }, [])}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="h-7 w-7 flex items-center justify-center rounded border text-xs disabled:opacity-30 hover:bg-muted transition-colors"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <span className="text-xs text-muted-foreground ml-1">{((page-1)*pageSize)+1}–{Math.min(page*pageSize, total)} / {total}</span>
    </div>
  );
}

export const GanttRow = React.memo(({
  project,
  range,
  timelineWidth,
  onOpen,
  isExpanded,
  onToggle,
  selectedTaskId,
  onSelectTask,
  onEditTask,
  onEdit,
  onDelete,
  onDependencies,
  onReport,
}: {
  project: any;
  range: { minStart: Date; maxEnd: Date; totalDays: number };
  timelineWidth: number;
  onOpen: (projectId: string) => void;
  isExpanded: boolean;
  onToggle: (projectId: string) => void;
  selectedTaskId?: string | null;
  onSelectTask: (payload: { task: any; projectId: string }) => void;
  onEditTask?: (task: any) => void;
  onEdit: (project: any) => void;
  onDelete: (project: any) => void;
  onDependencies?: (task: any) => void;
  onReport: (project: any) => void;
}) => {
  const { data: tasks = [] } = useTasks(project.id);
  const report = calculateProjectReport(project, tasks);
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a: any, b: any) => {
      const aTime = safeParseISO(a.start_date)?.getTime() ?? 0;
      const bTime = safeParseISO(b.start_date)?.getTime() ?? 0;
      return aTime - bTime;
    });
  }, [tasks]);
  const rangeStart = range.minStart;
  const rangeEnd = range.maxEnd;
  const start = safeParseISO(project.start_date) ?? rangeStart;
  const end = safeParseISO(project.end_date) ?? rangeEnd;
  const clampedStart = start > rangeStart ? start : rangeStart;
  const clampedEnd = end < rangeEnd ? end : rangeEnd;
  const offset = Math.max(0, differenceInDays(clampedStart, rangeStart));
  const duration = Math.max(1, differenceInDays(clampedEnd, clampedStart) + 1);
  const left = (offset / range.totalDays) * 100;
  const width = (duration / range.totalDays) * 100;
  const progressWidth = Math.min(100, Math.max(0, report.completionPercentage));
  const selectedTask = sortedTasks.find((task: any) => task.id === selectedTaskId) || null;
  const gridBackground = `repeating-linear-gradient(to right, hsl(var(--border) / 0.3) 0, hsl(var(--border) / 0.3) 1px, transparent 1px, transparent ${GANTT_DAY_WIDTH}px)`;

  return (
    <div className="border rounded-lg bg-card">
      {/* Project header row */}
      <div className="flex items-center gap-0">
        <div className="w-52 sm:w-72 shrink-0 flex items-center gap-1.5 px-3 py-2.5 border-r bg-muted/30">
          <button type="button" onClick={() => onToggle(project.id)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => onOpen(project.id)} className="flex-1 text-left min-w-0">
            <div className="text-sm font-semibold truncate">{project.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{project.company_name}</div>
          </button>
           <div className="flex items-center gap-0.5 shrink-0">
             <button type="button" title="สรุปรายงาน" onClick={() => onReport(project)}
               className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
               <FileText className="h-3 w-3" />
             </button>
             <button type="button" title="แก้ไข" onClick={() => onEdit(project)}
               className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
               <Pencil className="h-3 w-3" />
             </button>
             <button type="button" title="ลบ" onClick={() => onDelete(project)}
               className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
               <Trash2 className="h-3 w-3" />
             </button>
           </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-10 bg-muted/50" style={{ width: timelineWidth, backgroundImage: gridBackground }}>
            <div className="absolute top-1/2 -translate-y-1/2 h-8 rounded border border-border bg-card/90 shadow-sm overflow-hidden"
              style={{ left: `${left}%`, width: `${width}%` }}>
              <div className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${progressWidth}%` }} />
              <div className="relative flex items-center gap-1.5 h-full px-2 text-[11px]">
                <span className="font-medium truncate">{project.name}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${getProjectStatusColor(project.status)}`}>
                  {getStatusLabel(project.status)}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{report.completionPercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded task rows */}
      {isExpanded && (
        <div className="border-t">
          {sortedTasks.length === 0 ? (
            <div className="text-xs text-muted-foreground px-4 py-3">ไม่มีงานในโปรเจกต์นี้</div>
          ) : (
            sortedTasks
              .filter((task: any) => {
                const taskStart = safeParseISO(task.start_date) ?? rangeStart;
                const taskEnd = safeParseISO(task.end_date) ?? rangeEnd;
                return taskStart <= rangeEnd && taskEnd >= rangeStart;
              })
              .map((task: any) => {
                const taskStart = safeParseISO(task.start_date) ?? rangeStart;
                const taskEnd = safeParseISO(task.end_date) ?? rangeEnd;
                const taskClampedStart = taskStart > rangeStart ? taskStart : rangeStart;
                const taskClampedEnd = taskEnd < rangeEnd ? taskEnd : rangeEnd;
                const taskOffset = Math.max(0, differenceInDays(taskClampedStart, rangeStart));
                const taskDuration = Math.max(1, differenceInDays(taskClampedEnd, taskClampedStart) + 1);
                const taskLeft = (taskOffset / range.totalDays) * 100;
                const taskWidth = (taskDuration / range.totalDays) * 100;
                const isSelected = selectedTaskId === task.id;
                const tc = getTaskTypeCfg(task.task_type);

                return (
                  <div key={task.id} className="flex items-center gap-0 border-t border-border/50">
                    <button type="button" onClick={() => onSelectTask({ task, projectId: project.id })}
                      className="w-52 sm:w-72 shrink-0 text-left px-3 pl-10 py-2 bg-muted/10 hover:bg-muted/20 transition-colors border-r">
                      <div className={`text-xs font-medium truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{task.assignee || 'ไม่ระบุ'}</div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="relative h-8 bg-muted/30" style={{ width: timelineWidth, backgroundImage: gridBackground }}>
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-6 rounded px-2 flex items-center gap-1.5 text-[10px] overflow-hidden ${isSelected ? 'ring-2 ring-primary/60' : ''}`}
                          style={{ left: `${taskLeft}%`, width: `${taskWidth}%`, backgroundColor: tc.bg, borderColor: tc.border, borderWidth: 1, color: tc.text }}
                        >
                          <span className="font-medium truncate">{task.title}</span>
                          <span className="shrink-0">{getStatusLabel(task.status)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
          )}

          {/* Selected task detail */}
          {selectedTask && (
            <div className="border-t bg-muted/20 px-4 py-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{selectedTask.title}</span>
                <div className="flex items-center gap-2">
                  {onEditTask && (
                    <Button variant="outline" size="sm" onClick={() => onEditTask(selectedTask)}>แก้ไข</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onDependencies?.(selectedTask)}>
                    <Link2 className="h-3.5 w-3.5 mr-1" />ความสัมพันธ์
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onOpen(project.id)}>เปิดโปรเจกต์</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-muted-foreground">
                <div>สถานะ: {getStatusLabel(selectedTask.status)}</div>
                <div>ผู้รับผิดชอบ: {selectedTask.assignee || 'ไม่ระบุ'}</div>
                <div>ความสำคัญ: {selectedTask.priority || '-'}</div>
                <div>ประเภท: {getTaskTypeCfg(selectedTask.task_type).label}</div>
                <div>เริ่ม: {safeFmt(selectedTask.start_date)}</div>
                <div>สิ้นสุด: {safeFmt(selectedTask.end_date)}</div>
                <div>ประมาณ {selectedTask.estimated_days} วัน · ใช้ไป {selectedTask.days_spent} วัน</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
GanttRow.displayName = 'GanttRow';

// ─── Shared helpers for All-Tasks list view ──────────────────────────────────
function isTaskOverdue(t: any) {
  if (t.status === 'completed') return false;
  const end = t.end_date ? parseISO(t.end_date) : null;
  return end && isValid(end) && isBefore(end, new Date());
}

// Div-based expanded child list (replaces <tr>-based ExpandedChildRows)
function ExpandedChildList({ parentId, onEditTask, onDelete }: {
  parentId: string;
  onEditTask: (t: any) => void;
  onDelete: (t: any) => void;
}) {
  const { data: children = [], isLoading } = useTaskChildren(parentId);
  const updateTask = useUpdateTask();
  const { toast } = useToast();
  const { data: allProjects = [] } = useProjects();
  const [promoteTask, setPromoteTask] = useState<any>(null);
  const [promoteProjectId, setPromoteProjectId] = useState('');

  const handleStatusChange = async (sub: any, newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: sub.id, project_id: sub.project_id, status: newStatus });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  const handlePromote = async () => {
    if (!promoteTask || !promoteProjectId) return;
    try {
      await updateTask.mutateAsync({ id: promoteTask.id, project_id: promoteProjectId, parent_task_id: null, is_subtask: 0 });
      toast({ title: 'ย้ายงานสำเร็จ' });
      setPromoteTask(null);
      setPromoteProjectId('');
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="pl-14 py-2 text-xs text-muted-foreground border-t">กำลังโหลด...</div>;
  }
  if (children.length === 0) {
    return <div className="pl-14 py-2 text-xs text-muted-foreground italic border-t">ไม่มีงานย่อย</div>;
  }
  return (
    <>
      {children.map((sub: any) => {
        const sc = getTaskTypeCfg(sub.task_type);
        return (
          <div key={`child-${sub.id}`} className="flex items-center gap-3 pl-12 pr-4 py-2.5 bg-muted/10 hover:bg-muted/25 transition-colors group border-t border-border/50">
            <span className="text-muted-foreground/50 text-xs shrink-0">↳</span>
            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium truncate">{sub.title}</span>
                <span className="text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_STATUS_COLORS[sub.status] || 'bg-muted text-muted-foreground'}`}>{getStatusLabel(sub.status)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {[sub.assignee || null, safeFmt(sub.end_date) !== '-' ? safeFmt(sub.end_date) : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            {(sub.actual_hours > 0 || sub.estimated_hours > 0) && (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
                {Number(sub.estimated_hours || 0).toFixed(1)} / {Number(sub.actual_hours || 0).toFixed(1)} ชม.
              </span>
            )}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button type="button" title="แก้ไข" onClick={() => onEditTask(sub)}
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Pencil className="w-3 h-3" />
              </button>
              <button type="button" title="ย้ายเป็นงานหลัก" onClick={() => { setPromoteTask(sub); setPromoteProjectId(sub.project_id || ''); }}
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                <ArrowUpFromLine className="w-3 h-3" />
              </button>
              <button type="button" title="ลบ" onClick={() => onDelete(sub)}
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}

      <Dialog open={!!promoteTask} onOpenChange={(v) => { if (!v) { setPromoteTask(null); setPromoteProjectId(''); } }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">ย้ายเป็นงานหลัก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">ย้าย <strong>{promoteTask?.title}</strong> ออกจากงานย่อย เป็นงานหลักในโปรเจกต์ที่เลือก</p>
            <div className="space-y-1.5">
              <Label>โปรเจกต์ปลายทาง</Label>
              <Select value={promoteProjectId} onValueChange={setPromoteProjectId}>
                <SelectTrigger><SelectValue placeholder="เลือกโปรเจกต์" /></SelectTrigger>
                <SelectContent>
                  {allProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPromoteTask(null); setPromoteProjectId(''); }}>ยกเลิก</Button>
              <Button disabled={!promoteProjectId || updateTask.isPending} onClick={handlePromote}>
                {updateTask.isPending ? 'กำลังย้าย...' : 'ย้ายเป็นงานหลัก'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── All-Tasks Tab ────────────────────────────────────────────────────────────
const TASK_STATUS_COLORS: Record<string, string> = {
  pending:     'bg-slate-100 text-slate-700',
  'in-progress':'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  overdue:     'bg-red-100 text-red-700',
};
const TASK_PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-slate-100 text-slate-600',
};
const PRIORITY_LABELS: Record<string, string> = { high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' };

const ALL_TASK_STATUS_OPTS = [
  { value: '__all__', label: 'ทุกสถานะ' },
  { value: 'pending',     label: 'รอดำเนินการ' },
  { value: 'in-progress', label: 'กำลังดำเนินการ' },
  { value: 'completed',   label: 'เสร็จสิ้น' },
  { value: 'overdue',     label: 'เลยกำหนด' },
];
// ─── Inline expanded child rows (on-demand fetch) ────────────────────────────
function ExpandedChildRows({ parentId, onEditTask, onDelete }: {
  parentId: string;
  onEditTask: (t: any) => void;
  onDelete: (t: any) => void;
}) {
  const { data: children = [], isLoading } = useTaskChildren(parentId);
  const updateTask = useUpdateTask();
  const { toast } = useToast();
  const { data: allProjects = [] } = useProjects();
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [promoteTask, setPromoteTask] = useState<any>(null);
  const [promoteProjectId, setPromoteProjectId] = useState('');

  const handleStatusChange = async (sub: any, newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: sub.id, project_id: sub.project_id, status: newStatus });
      setEditingStatusId(null);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  const handlePromote = async () => {
    if (!promoteTask || !promoteProjectId) return;
    try {
      await updateTask.mutateAsync({ id: promoteTask.id, project_id: promoteProjectId, parent_task_id: null, is_subtask: 0 });
      toast({ title: 'ย้ายงานสำเร็จ' });
      setPromoteTask(null);
      setPromoteProjectId('');
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <tr><td colSpan={9} className="pl-14 py-1.5 text-xs text-muted-foreground">กำลังโหลด...</td></tr>;
  }
  if (children.length === 0) {
    return <tr><td colSpan={9} className="pl-14 py-1.5 text-xs text-muted-foreground italic">ไม่มีงานย่อย</td></tr>;
  }
  return (
    <>
      {children.map((sub: any) => {
        const sc = getTaskTypeCfg(sub.task_type);
        return (
          <tr key={`child-${sub.id}`} className="border-b bg-muted/10 hover:bg-muted/25 transition-colors group">
            <td className="pl-9 pr-3 py-1.5 max-w-[200px]">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/50 text-xs shrink-0">↳</span>
                <span className="text-xs truncate block" title={sub.title}>{sub.title}</span>
              </div>
            </td>
            <td className="px-2 py-1.5 text-xs text-muted-foreground truncate max-w-[140px]">{sub.project_name || '-'}</td>
            <td className="px-2 py-1.5">
              <span className="text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
            </td>
            <td className="px-2 py-1.5 text-xs truncate max-w-[120px]">{sub.assignee || <span className="text-muted-foreground/40">—</span>}</td>
            <td className="px-2 py-1.5">
              {editingStatusId === sub.id ? (
                <Select value={sub.status} onValueChange={(v) => handleStatusChange(sub, v)}>
                  <SelectTrigger className="h-6 text-[11px] w-28 px-2 py-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">รอดำเนินการ</SelectItem>
                    <SelectItem value="in-progress">กำลังทำ</SelectItem>
                    <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                    <SelectItem value="overdue">เลยกำหนด</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <button onClick={() => setEditingStatusId(sub.id)} className="text-left">
                  <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium cursor-pointer hover:opacity-80 ${TASK_STATUS_COLORS[sub.status] || 'bg-muted text-muted-foreground'}`}>
                    {getStatusLabel(sub.status)}
                  </span>
                </button>
              )}
            </td>
            <td className="px-2 py-1.5">
              <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_PRIORITY_COLORS[sub.priority] || 'bg-muted text-muted-foreground'}`}>{PRIORITY_LABELS[sub.priority] || sub.priority || '-'}</span>
            </td>
            <td className="px-2 py-1.5 text-xs text-muted-foreground">{safeFmt(sub.end_date)}</td>
            <td className="px-2 py-1.5 text-xs text-muted-foreground tabular-nums">
              {sub.actual_hours > 0 || sub.estimated_hours > 0
                ? <>{Number(sub.estimated_hours || 0).toFixed(1)} / {Number(sub.actual_hours || 0).toFixed(1)}</>
                : <span className="text-muted-foreground/40">—</span>}
            </td>
            <td className="px-2 py-1.5">
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" title="แก้ไข" onClick={() => onEditTask(sub)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-orange-600 hover:text-orange-700" title="ย้ายเป็นงานหลัก" onClick={() => { setPromoteTask(sub); setPromoteProjectId(sub.project_id || ''); }}>
                  <ArrowUpFromLine className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="ลบ" onClick={() => onDelete(sub)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </td>
          </tr>
        );
      })}

      <Dialog open={!!promoteTask} onOpenChange={(v) => { if (!v) { setPromoteTask(null); setPromoteProjectId(''); } }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">ย้ายเป็นงานหลัก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">ย้าย <strong>{promoteTask?.title}</strong> ออกจากงานย่อย เป็นงานหลักในโปรเจกต์ที่เลือก</p>
            <div className="space-y-1.5">
              <Label>โปรเจกต์ปลายทาง</Label>
              <Select value={promoteProjectId} onValueChange={setPromoteProjectId}>
                <SelectTrigger><SelectValue placeholder="เลือกโปรเจกต์" /></SelectTrigger>
                <SelectContent>
                  {allProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPromoteTask(null); setPromoteProjectId(''); }}>ยกเลิก</Button>
              <Button disabled={!promoteProjectId || updateTask.isPending} onClick={handlePromote}>
                {updateTask.isPending ? 'กำลังย้าย...' : 'ย้ายเป็นงานหลัก'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AllTasksTab({ onEditTask, companies = [], projectCompanyMap, yearFilter = '__all__' }: {
  onEditTask: (task: any) => void;
  companies?: any[];
  projectCompanyMap?: Map<string, string>;
  yearFilter?: string;
}) {
  const [tasksPerPage, setTasksPerPage] = useState(50);
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const canDelete = Number(user?.is_admin) === 1 || Number(user?.is_superadmin) === 1;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkUpdate = async () => {
    if (!bulkStatus && !bulkPriority) return;
    setIsBulkSaving(true);
    try {
      const fields: any = {};
      if (bulkStatus) fields.status = bulkStatus;
      if (bulkPriority) fields.priority = bulkPriority;
      await Promise.all([...selectedIds].map(id => {
        const task = allTasks.find((t: any) => t.id === id);
        return updateTask.mutateAsync({ id, project_id: task?.project_id ?? '', ...fields });
      }));
      toast({ title: `อัปเดต ${selectedIds.size} งานสำเร็จ` });
      setSelectedIds(new Set());
      setBulkStatus('');
      setBulkPriority('');
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: `ลบ ${selectedIds.size} งานที่เลือก`,
      description: `ต้องการลบ ${selectedIds.size} งานที่เลือกใช่หรือไม่? การดำเนินการนี้ไม่สามารถเรียกคืนได้`,
      variant: 'destructive',
    });
    if (!ok) return;
    setIsBulkSaving(true);
    try {
      await Promise.all([...selectedIds].map(id => {
        const task = allTasks.find((t: any) => t.id === id);
        return deleteTask.mutateAsync({ id, projectId: task?.project_id ?? '' });
      }));
      toast({ title: `ลบ ${selectedIds.size} งานสำเร็จ` });
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleDeleteTask = async (task: any) => {
    const ok = await confirm({ title: 'ลบงาน', description: `ต้องการลบงาน "${task.title}" ใช่หรือไม่?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId: task.project_id });
      toast({ title: 'ลบงานสำเร็จ' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleReplaceWithSingleChild = async (parentTask: any) => {
    try {
      const children = await apiFetch<DbTask[]>(`/tasks.php?parent_id=${parentTask.id}`);
      const child = children?.[0];
      if (!child || children.length !== 1) {
        toast({ title: 'ไม่พบงานย่อย', description: 'ต้องมีงานย่อยเพียง 1 รายการ', variant: 'destructive' });
        return;
      }
      const ok = await confirm({
        title: 'แทนที่ด้วยงานย่อย',
        description: `ย้าย "${child.title}" ขึ้นเป็นงานหลัก และลบ "${parentTask.title}"?`,
        variant: 'destructive',
      });
      if (!ok) return;
      const targetProjectId = child.project_id || parentTask.project_id;
      await updateTask.mutateAsync({
        id: child.id, parent_task_id: null, is_subtask: 0, project_id: targetProjectId,
      });
      await deleteTask.mutateAsync({ id: parentTask.id, projectId: parentTask.project_id });
      toast({ title: 'แทนที่งานหลักด้วยงานย่อยสำเร็จ' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleBulkReplace = async () => {
    // For each selected task, check if it has exactly 1 child (via subtask_count)
    const eligible: { parent: any; childTitle: string }[] = [];
    const skipped: string[] = [];

    for (const id of selectedIds) {
      const task = allTasks.find((t: any) => t.id === id);
      if (!task) { skipped.push(id); continue; }
      if (Number(task.subtask_count ?? 0) !== 1) {
        skipped.push(task.title || id);
        continue;
      }
      try {
        const children = await apiFetch<DbTask[]>(`/tasks.php?parent_id=${id}`);
        if (children && children.length === 1) {
          eligible.push({ parent: task, childTitle: children[0].title });
        } else {
          skipped.push(task.title || id);
        }
      } catch {
        skipped.push(task.title || id);
      }
    }

    if (eligible.length === 0) {
      toast({ title: 'ไม่มีงานที่เข้าเงื่อนไข', description: 'ต้องเลือกงานที่มีงานย่อย 1 รายการเท่านั้น', variant: 'destructive' });
      return;
    }

    const names = eligible.map(e => `"${e.childTitle}" แทนที่ "${e.parent.title}"`).slice(0, 10).join('\n');
    const more = eligible.length > 10 ? `\n...และอีก ${eligible.length - 10} รายการ` : '';
    if (!await confirm({
      title: `แทนที่งานหลัก ${eligible.length} รายการ`,
      description: `${names}${more}${skipped.length ? `\n\nข้าม ${skipped.length} รายการ (ไม่มีงานย่อย 1 รายการ)` : ''}`,
      variant: 'destructive',
      confirmLabel: 'แทนที่',
    })) return;

    setIsBulkSaving(true);
    try {
      let done = 0;
      for (const { parent } of eligible) {
        const children = await apiFetch<DbTask[]>(`/tasks.php?parent_id=${parent.id}`);
        const child = children?.[0];
        if (!child) continue;
        const targetProjectId = child.project_id || parent.project_id;
        await updateTask.mutateAsync({
          id: child.id, parent_task_id: null, is_subtask: 0, project_id: targetProjectId,
        });
        await deleteTask.mutateAsync({ id: parent.id, projectId: parent.project_id });
        done++;
      }
      toast({ title: `แทนที่ ${done} งานสำเร็จ` + (skipped.length ? ` (ข้าม ${skipped.length})` : '') });
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  // ── Create task dialog state ──
  const createSubtask = useCreateSubtask();
  const { data: allProjects = [] } = useProjects();
  const { data: allUsers = [] } = useUsers();
  const { activeTaskExecutionTypes, taskTypes } = useWorkTypeCatalog();

  const allTaskTypeOpts = useMemo(() => {
    const opts = [{ value: '__all__', label: 'ทุกประเภท' as string }];
    for (const t of taskTypes) {
      opts.push({ value: t.key, label: t.label });
    }
    return opts;
  }, [taskTypes]);

  // ── Inline add-subtask state ──
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDescription, setNewSubDescription] = useState('');
  const [newSubAssignee, setNewSubAssignee] = useState('');
  const [newSubPriority, setNewSubPriority] = useState('medium');
  const [newSubStatus, setNewSubStatus] = useState('pending');
  const [newSubTaskType, setNewSubTaskType] = useState('task');
  const [newSubStartDate, setNewSubStartDate] = useState('');
  const [newSubEndDate, setNewSubEndDate] = useState('');
  const [newSubEstimatedHours, setNewSubEstimatedHours] = useState('8');
  const [newSubEstimatedHoursTouched, setNewSubEstimatedHoursTouched] = useState(false);
  const [newSubActualHours, setNewSubActualHours] = useState('');

  const openAddSub = (task: any) => {
    setAddingSubFor(task.id);
    setNewSubTitle('');
    setNewSubDescription('');
    setNewSubAssignee(task.assignee || '');
    setNewSubPriority('medium');
    setNewSubStatus('pending');
    setNewSubTaskType('task');
    setNewSubStartDate(task.start_date || '');
    setNewSubEndDate(task.end_date || '');
    {
      const sd = task.start_date || '';
      const ed = task.end_date || '';
      const isMulti = sd && ed && sd !== ed;
      const days = isMulti ? Math.max(1, Math.round((new Date(ed).getTime() - new Date(sd).getTime()) / 86400000 + 1)) : 1;
      setNewSubEstimatedHours(isMulti ? String(days * 8) : '8');
    }
    setNewSubEstimatedHoursTouched(false);
    setNewSubActualHours('');
    // auto-expand subtasks
    setExpandedSubtasks(prev => { const n = new Set(prev); n.add(task.id); return n; });
  };

  const handleAddInlineSubtask = async (task: any) => {
    if (!newSubTitle.trim()) return;
    const sd = newSubStartDate || task.start_date;
    const ed = newSubEndDate || task.end_date;
    const isMultiDay = sd && ed && sd !== ed;
    const days = isMultiDay
      ? Math.max(1, Math.round((new Date(ed).getTime() - new Date(sd).getTime()) / 86400000 + 1))
      : 1;
    const estHours = isMultiDay ? days * 8 : (parseFloat(newSubEstimatedHours) || 8);
    try {
      await createSubtask.mutateAsync({
        parent_task_id: task.id,
        project_id: task.project_id,
        title: newSubTitle.trim(),
        description: newSubDescription,
        assignee: newSubAssignee === '__none__' ? '' : newSubAssignee,
        priority: newSubPriority,
        status: newSubStatus,
        task_type: newSubTaskType,
        start_date: sd,
        end_date: ed,
        estimated_hours: estHours,
        actual_hours: parseFloat(newSubActualHours) || 0,
      });
      toast({ title: 'เพิ่มงานย่อยสำเร็จ' });
      setAddingSubFor(null);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };
  const [createOpen, setCreateOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState('__all__');
  const [typeFilter, setTypeFilter] = useState('__all__');
  const [assigneeFilter, setAssigneeFilter] = useState('__all__');
  const [companyFilter, setCompanyFilter] = useState('__all__');
  const [tasksPage, setTasksPage] = useState(1);
  const [subtaskFilter, setSubtaskFilter] = useState<'__all__' | 'subtask_only'>('__all__');
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['overdue', 'in-progress', 'pending']));
  const toggleSubtasks = (taskId: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };
  const toggleGroup = (key: string) => setOpenGroups(prev => {
    const n = new Set(prev);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });


  // Debounce search before sending to server
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setTasksPage(1); }, [debouncedSearch, statusFilter, typeFilter, assigneeFilter, companyFilter, yearFilter, subtaskFilter, tasksPerPage]);

  // Year filter → date range for API
  const yearDateRange = useMemo(() => {
    if (!yearFilter || yearFilter === '__all__') return {};
    const y = parseInt(yearFilter);
    return { year_from: `${y}-01-01`, year_to: `${y}-12-31` };
  }, [yearFilter]);

  const { data: pageResult, isLoading } = useAllTasks({
    page: tasksPage,
    per_page: tasksPerPage,
    search: debouncedSearch,
    status: statusFilter !== '__all__' ? statusFilter : '',
    type: typeFilter !== '__all__' ? typeFilter : '',
    assignee: assigneeFilter !== '__all__' ? assigneeFilter : '',
    parent_only: subtaskFilter !== 'subtask_only',
    subtask_only: subtaskFilter === 'subtask_only',
    ...yearDateRange,
  });

  const allTasks = useMemo(() => pageResult?.data ?? [], [pageResult]);
  const serverTotal = pageResult?.total ?? 0;

  // Company filter is still client-side (no company info in tasks endpoint)
  const filtered = useMemo(() => {
    if (companyFilter === '__all__') return allTasks;
    return allTasks.filter((t: any) => projectCompanyMap?.get(t.project_id) === companyFilter);
  }, [allTasks, companyFilter, projectCompanyMap]);

  // subtaskMap and parentTaskMap built from current page data only
  const subtaskMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    allTasks.forEach((t: any) => {
      if (t.parent_task_id && !(t.is_subtask === 1 || t.is_subtask === '1')) {
        if (!map[t.parent_task_id]) map[t.parent_task_id] = [];
        map[t.parent_task_id].push(t);
      }
    });
    return map;
  }, [allTasks]);

  const parentTaskMap = useMemo(() => {
    const map: Record<string, any> = {};
    allTasks.forEach((t: any) => { map[t.id] = t; });
    return map;
  }, [allTasks]);

  // Build grouped structure: root tasks with their matching subtasks
  const taskGroups = useMemo(() => {
    const childMap: Record<string, any[]> = {};
    const roots: any[] = [];
    filtered.forEach((t: any) => {
      if (t.parent_task_id) {
        if (!childMap[t.parent_task_id]) childMap[t.parent_task_id] = [];
        childMap[t.parent_task_id].push(t);
      } else {
        roots.push(t);
      }
    });
    // Orphan subtasks whose parent isn't in filtered set
    const orphanSubs: any[] = [];
    filtered.forEach((t: any) => {
      if (t.parent_task_id && !roots.find((r: any) => r.id === t.parent_task_id)) {
        orphanSubs.push(t);
      }
    });
    return { roots, childMap, orphanSubs };
  }, [filtered]);

  const displayTotal = companyFilter !== '__all__' ? filtered.length : serverTotal;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />ตัวกรอง
            <span className="text-xs text-muted-foreground font-normal">{displayTotal} งาน</span>
          </div>
          <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            สร้างงาน
          </Button>
          <CreateTaskDialog externalOpen={createOpen} onExternalOpenChange={setCreateOpen} />
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหางาน / โปรเจกต์..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-full"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_TASK_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allTaskTypeOpts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-36 h-8 text-xs"><SelectValue placeholder="ทุกคน" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">ทุกคน</SelectItem>
                {allUsers.map((u) => {
                  const val = u.display_name || u.email;
                  return <SelectItem key={u.id} value={val}>{val}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-32 h-8 text-xs"><SelectValue placeholder="ทุกบริษัท" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">ทุกบริษัท</SelectItem>
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subtaskFilter} onValueChange={(v) => setSubtaskFilter(v)}>
              <SelectTrigger className="flex-1 sm:flex-none sm:w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">ทุกงาน</SelectItem>
                <SelectItem value="subtask_only">เฉพาะงานย่อย</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== '__all__' || typeFilter !== '__all__' || assigneeFilter !== '__all__' || companyFilter !== '__all__' || subtaskFilter !== '__all__') && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('__all__'); setTypeFilter('__all__'); setAssigneeFilter('__all__'); setCompanyFilter('__all__'); setSubtaskFilter('__all__'); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />ล้าง
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List view */}
      {isLoading ? (
        <div className="flex justify-center items-center gap-2 py-12 text-muted-foreground rounded-lg border">
          <ListTodo className="h-5 w-5 animate-pulse" />กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground rounded-lg border">
          <ListTodo className="h-8 w-8 opacity-30" />
          <p>ไม่พบงานตามตัวกรองที่เลือก</p>
        </div>
      ) : (
        /* Nested list with expand/collapse for subtasks */
        <div className="space-y-2">
          {selectedIds.size > 0 && (
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
              <span className="text-sm font-medium text-primary">เลือก {selectedIds.size} งาน</span>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="h-7 flex-1 sm:flex-none sm:w-36 text-xs"><SelectValue placeholder="เปลี่ยนสถานะ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">รอดำเนินการ</SelectItem>
                    <SelectItem value="in-progress">กำลังดำเนินการ</SelectItem>
                    <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                    <SelectItem value="on-hold">พักไว้ก่อน</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bulkPriority} onValueChange={setBulkPriority}>
                  <SelectTrigger className="h-7 flex-1 sm:flex-none sm:w-32 text-xs"><SelectValue placeholder="เปลี่ยน Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">ต่ำ</SelectItem>
                    <SelectItem value="medium">กลาง</SelectItem>
                    <SelectItem value="high">สูง</SelectItem>
                    <SelectItem value="urgent">เร่งด่วน</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-7 text-xs" disabled={isBulkSaving || (!bulkStatus && !bulkPriority)} onClick={handleBulkUpdate}>
                  {isBulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}บันทึก
                </Button>
                <Button size="sm" variant="default" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" disabled={isBulkSaving} onClick={handleBulkReplace}>
                  <ArrowUpFromLine className="h-3 w-3 mr-1" />
                  แทนที่ ({selectedIds.size})
                </Button>
                {canDelete && (
                  <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" disabled={isBulkSaving} onClick={handleBulkDelete}>
                    <Trash2 className="h-3 w-3" />
                    ลบ ({selectedIds.size})
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSelectedIds(new Set()); setBulkStatus(''); setBulkPriority(''); }}>ยกเลิก</Button>
              </div>
            </div>
          )}
        <div className="rounded-lg border divide-y">
          {/* Column headers */}
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-muted/40 text-xs font-semibold text-muted-foreground">
            <Checkbox
              checked={filtered.length > 0 && filtered.every((t: any) => selectedIds.has(t.id))}
              onCheckedChange={(v) => setSelectedIds(v ? new Set(filtered.map((t: any) => t.id)) : new Set())}
              className="shrink-0"
            />
            <span className="w-4 shrink-0" />
            <span className="w-4 shrink-0 hidden sm:block" />
            <span className="flex-1 min-w-0">ชื่องาน</span>
            <span className="w-24 shrink-0 text-right hidden sm:block">ชั่วโมง</span>
            <span className="w-[120px] shrink-0 hidden md:block" />
          </div>
          {taskGroups.roots.map((task: any) => {
            const tc = getTaskTypeCfg(task.task_type);
            const overdue = isTaskOverdue(task);
            const subtaskCount = Number(task.subtask_count ?? 0);
            const matchedChildren = taskGroups.childMap[task.id] || [];
            const hasSubtasks = matchedChildren.length > 0 || subtaskCount > 0;
            const isExpanded = expandedSubtasks.has(task.id);
            const displayActual = hasSubtasks
              ? Number(task.subtask_actual_hours ?? 0)
              : Number(task.actual_hours ?? 0);
            const displayEstimated = hasSubtasks
              ? Number(task.subtask_estimated_hours ?? 0)
              : Number(task.estimated_hours ?? 0);
            const isAddingSub = addingSubFor === task.id;
            return (
              <React.Fragment key={task.id}>
                {/* Root task row */}
                <div className={`group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-muted/30 transition-colors ${overdue && task.status !== 'completed' ? 'bg-destructive/5' : ''} ${task.status === 'completed' ? 'opacity-55' : ''} ${selectedIds.has(task.id) ? 'bg-primary/5' : ''}`}>
                  <Checkbox checked={selectedIds.has(task.id)} onCheckedChange={() => toggleSelect(task.id)} className="shrink-0" />
                  {hasSubtasks ? (
                    <button type="button" onClick={() => toggleSubtasks(task.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title={isExpanded ? 'ซ่อนงานย่อย' : `แสดง ${matchedChildren.length || subtaskCount} งานย่อย`}>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button type="button" onClick={() => onEditTask(task)}
                        className={`text-sm font-medium text-left hover:underline truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </button>
                      {task.is_ad_hoc ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Ad-hoc</span> : null}
                      {hasSubtasks && <span className="text-[10px] text-primary/80">{matchedChildren.length || subtaskCount} งานย่อย</span>}
                      <span className="hidden sm:inline text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>{tc.label}</span>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_STATUS_COLORS[overdue && task.status !== 'completed' ? 'overdue' : task.status] || 'bg-muted text-muted-foreground'}`}>
                        {overdue && task.status !== 'completed' ? 'เกินกำหนด' : getStatusLabel(task.status)}
                      </span>
                      <span className={`hidden sm:inline text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_PRIORITY_COLORS[task.priority] || 'bg-muted text-muted-foreground'}`}>{PRIORITY_LABELS[task.priority] || '-'}</span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${overdue && task.status !== 'completed' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {[task.project_name || null, task.assignee || null, safeFmt(task.end_date) !== '-' ? safeFmt(task.end_date) : null, overdue && task.status !== 'completed' ? 'เกินกำหนด' : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {(displayActual > 0 || displayEstimated > 0) && (
                    <div className="text-right shrink-0 hidden sm:block">
                      <span className="text-sm font-semibold tabular-nums text-green-700">{displayActual.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground"> / </span>
                      <span className="text-sm font-semibold tabular-nums text-primary">{displayEstimated.toFixed(1)} ชม.</span>
                      {hasSubtasks && <p className="text-[10px] text-muted-foreground">รวม subtask</p>}
                    </div>
                  )}
                  {subtaskCount === 1 && (
                    <button type="button" title="แทนที่ด้วยงานย่อย (1 รายการ)" onClick={() => handleReplaceWithSingleChild(task)}
                      className="h-7 px-2 flex items-center gap-1 rounded text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 transition-colors shrink-0">
                      <ArrowUpFromLine className="h-3.5 w-3.5" />
                      แทนที่
                    </button>
                  )}
                  <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <button type="button" title="เพิ่มงานย่อย" onClick={() => openAddSub(task)}
                      className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="แก้ไข" onClick={() => onEditTask(task)}
                      className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="ลบ" onClick={() => handleDeleteTask(task)}
                      className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline add-subtask form */}
                {isAddingSub && (
                  <div className="bg-primary/5 px-4 py-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-xs font-medium text-primary mb-1">
                        <span>↳</span> เพิ่มงานย่อยใน "{task.title}"
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input autoFocus placeholder="ชื่องานย่อย *" value={newSubTitle}
                          onChange={e => setNewSubTitle(e.target.value)}
                          className="h-7 text-xs w-52 shrink-0"
                          onKeyDown={e => { if (e.key === 'Escape') setAddingSubFor(null); }} />
                        <Select value={newSubTaskType} onValueChange={setNewSubTaskType}>
                          <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="ประเภท" /></SelectTrigger>
                          <SelectContent>
                            {activeTaskExecutionTypes.map((opt) => (
                              <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={newSubStatus} onValueChange={setNewSubStatus}>
                          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">รอดำเนินการ</SelectItem>
                            <SelectItem value="in_progress">กำลังทำ</SelectItem>
                            <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                            <SelectItem value="cancelled">ยกเลิก</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={newSubPriority} onValueChange={setNewSubPriority}>
                          <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">🔴 สูง</SelectItem>
                            <SelectItem value="medium">🟡 ปานกลาง</SelectItem>
                            <SelectItem value="low">🟢 ต่ำ</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={newSubAssignee || '__none__'} onValueChange={v => setNewSubAssignee(v === '__none__' ? '' : v)}>
                          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="ผู้รับผิดชอบ" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                            {allUsers.map((u) => <SelectItem key={u.id} value={u.display_name || u.email}>{u.display_name || u.email}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">เริ่ม</span>
                          <Input type="date" value={newSubStartDate} onChange={e => {
                            const nextStart = e.target.value;
                            setNewSubStartDate(nextStart);
                            if (newSubEndDate && !newSubEstimatedHoursTouched) {
                              if (nextStart === newSubEndDate) {
                                setNewSubEstimatedHours('8');
                              } else if (nextStart < newSubEndDate) {
                                const days = Math.max(1, Math.round((new Date(newSubEndDate).getTime() - new Date(nextStart).getTime()) / 86400000 + 1));
                                setNewSubEstimatedHours(String(days * 8));
                              }
                            }
                          }} className="h-7 text-xs w-32 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">สิ้นสุด</span>
                          <Input type="date" value={newSubEndDate} min={newSubStartDate || undefined} onChange={e => {
                            const nextEnd = e.target.value;
                            setNewSubEndDate(nextEnd);
                            if (newSubStartDate && !newSubEstimatedHoursTouched) {
                              if (nextEnd === newSubStartDate) {
                                setNewSubEstimatedHours('8');
                              } else if (nextEnd > newSubStartDate) {
                                const days = Math.max(1, Math.round((new Date(nextEnd).getTime() - new Date(newSubStartDate).getTime()) / 86400000 + 1));
                                setNewSubEstimatedHours(String(days * 8));
                              }
                            }
                          }} className="h-7 text-xs w-32 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">ชม.ประมาณ</span>
                          {newSubStartDate && newSubEndDate && newSubStartDate !== newSubEndDate ? (
                            <div className="flex items-center gap-1">
                              <Input type="number" min={0.5} max={1000} step={0.5} value={newSubEstimatedHours}
                                onChange={e => {
                                  setNewSubEstimatedHours(e.target.value);
                                  setNewSubEstimatedHoursTouched(true);
                                }} className="h-7 text-xs w-16 shrink-0" />
                            </div>
                          ) : (
                            <Input type="number" min={0.5} max={24} step={0.5} value={newSubEstimatedHours}
                              onChange={e => {
                                setNewSubEstimatedHours(e.target.value);
                                setNewSubEstimatedHoursTouched(true);
                              }} className="h-7 text-xs w-16 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">ชม.จริง</span>
                          <Input type="number" min={0} step={0.5} placeholder="0" value={newSubActualHours}
                            onChange={e => setNewSubActualHours(e.target.value)} className="h-7 text-xs w-16 shrink-0" />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Textarea placeholder="รายละเอียดงานย่อย (ไม่จำเป็น)" value={newSubDescription}
                          onChange={e => setNewSubDescription(e.target.value)}
                          className="text-xs resize-none flex-1 min-h-[48px]" rows={2} />
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button size="sm" className="h-7 text-xs px-4" onClick={() => handleAddInlineSubtask(task)}
                            disabled={!newSubTitle.trim() || createSubtask.isPending}>
                            {createSubtask.isPending ? 'กำลังเพิ่ม...' : 'เพิ่มงานย่อย'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setAddingSubFor(null)}>ยกเลิก</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expanded subtask rows */}
                {isExpanded && matchedChildren.map((sub: any) => {
                  const sc = getTaskTypeCfg(sub.task_type);
                  const subOverdue = isTaskOverdue(sub);
                  return (
                    <div key={`sub-${sub.id}`}
                      className={`group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-muted/10 hover:bg-muted/25 transition-colors border-t border-border/50 ${subOverdue && sub.status !== 'completed' ? 'bg-destructive/5' : ''} ${sub.status === 'completed' ? 'opacity-55' : ''}`}>
                      <span className="text-muted-foreground/50 text-xs shrink-0 pl-4 sm:pl-6">↳</span>
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 hidden sm:block" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button type="button" onClick={() => onEditTask(sub)}
                            className={`text-xs font-medium text-left hover:underline truncate ${sub.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {sub.title}
                          </button>
                          {sub.is_ad_hoc ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Ad-hoc</span> : null}
                          <span className="hidden sm:inline text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                          <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_STATUS_COLORS[subOverdue && sub.status !== 'completed' ? 'overdue' : sub.status] || 'bg-muted text-muted-foreground'}`}>
                            {subOverdue && sub.status !== 'completed' ? 'เกินกำหนด' : getStatusLabel(sub.status)}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 truncate ${subOverdue && sub.status !== 'completed' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {[sub.assignee || null, safeFmt(sub.end_date) !== '-' ? safeFmt(sub.end_date) : null, subOverdue && sub.status !== 'completed' ? 'เกินกำหนด' : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {(sub.actual_hours > 0 || sub.estimated_hours > 0) && (
                        <div className="text-right shrink-0 hidden sm:block">
                          <span className="text-xs font-semibold tabular-nums text-primary">{Number(sub.estimated_hours || 0).toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground"> / </span>
                          <span className="text-xs font-semibold tabular-nums text-green-700">{Number(sub.actual_hours || 0).toFixed(1)} ชม.</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button type="button" title="แก้ไข" onClick={() => onEditTask(sub)}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" title="ลบ" onClick={() => handleDeleteTask(sub)}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Expanded children fetched from API (tasks with subtasks not in current filter) */}
                {isExpanded && matchedChildren.length === 0 && subtaskCount > 0 && (
                  <ExpandedChildList parentId={task.id} onEditTask={onEditTask} onDelete={handleDeleteTask} />
                )}
              </React.Fragment>
            );
          })}

          {/* Orphan subtasks (parent not in filtered set) */}
          {taskGroups.orphanSubs.map((sub: any) => {
            const sc = getTaskTypeCfg(sub.task_type);
            const subOverdue = isTaskOverdue(sub);
            const parentTitle = sub.parent_title || parentTaskMap[sub.parent_task_id]?.title || '-';
            return (
              <div key={`orphan-${sub.id}`}
                className={`group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-muted/10 hover:bg-muted/25 transition-colors ${subOverdue && sub.status !== 'completed' ? 'bg-destructive/5' : ''} ${sub.status === 'completed' ? 'opacity-55' : ''}`}>
                <span className="text-muted-foreground/50 text-xs shrink-0 pl-4 sm:pl-6">↳</span>
                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 hidden sm:block" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => onEditTask(sub)}
                      className={`text-xs font-medium text-left hover:underline truncate ${sub.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {sub.title}
                    </button>
                    <span className="hidden sm:inline text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                    <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_STATUS_COLORS[subOverdue && sub.status !== 'completed' ? 'overdue' : sub.status] || 'bg-muted text-muted-foreground'}`}>
                      {subOverdue && sub.status !== 'completed' ? 'เกินกำหนด' : getStatusLabel(sub.status)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[`↳ ${parentTitle}`, sub.project_name || null, sub.assignee || null, safeFmt(sub.end_date) !== '-' ? safeFmt(sub.end_date) : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {(sub.actual_hours > 0 || sub.estimated_hours > 0) && (
                  <div className="text-right shrink-0 hidden sm:block">
                    <span className="text-xs font-semibold tabular-nums text-primary">{Number(sub.estimated_hours || 0).toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground"> / </span>
                    <span className="text-xs font-semibold tabular-nums text-green-700">{Number(sub.actual_hours || 0).toFixed(1)} ชม.</span>
                  </div>
                )}
                <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <button type="button" title="แก้ไข" onClick={() => onEditTask(sub)}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button type="button" title="ลบ" onClick={() => handleDeleteTask(sub)}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 font-semibold text-sm">
            <span className="flex items-center gap-1.5"><Filter className="h-4 w-4 text-primary" />รวมทั้งหมด</span>
            <span className="text-primary tabular-nums">{displayTotal} งาน</span>
          </div>
        </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <RowsPerPageSelector value={tasksPerPage} onChange={setTasksPerPage} />
        <Paginator page={tasksPage} total={displayTotal} pageSize={tasksPerPage} onChange={setTasksPage} />
      </div>
    </div>
  );
}

