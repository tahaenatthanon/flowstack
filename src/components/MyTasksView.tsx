import React, { useMemo, useState, useEffect } from 'react';
import { useAllTasks, useUpdateTask, useDeleteTask, useTaskChildren } from '@/hooks/useProjectData';
import ProjectCombobox from '@/components/ProjectCombobox';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CheckCircle2, Clock, AlertTriangle, Circle,
  Search, X, CalendarDays, FolderKanban, ChevronUp, ChevronDown, ChevronRight,
  MoreHorizontal, Play, CheckCheck, RotateCcw, Timer, Eye, Trash2, Filter,
  Pencil, ArrowUpFromLine, Loader2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { isBefore, isAfter, parseISO, isValid, addDays, format } from 'date-fns';
import { safeFmt } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import TaskDetailSheet from '@/components/TaskDetailSheet';
import CreateTaskHoursEntryDialog from '@/components/CreateTaskHoursEntryDialog';
import { DbTask } from '@/types/project';

// ─── helpers ──────────────────────────────────────────────────────────────────
const taskFmt = (s?: string | null) => safeFmt(s, 'd MMM yy') || '—';

function isOverdue(task: any) {
  if (task.status === 'completed') return false;
  const end = task.end_date ? parseISO(task.end_date) : null;
  return end && isValid(end) && isBefore(end, new Date());
}

function isDueSoon(task: any) {
  if (task.status === 'completed' || isOverdue(task)) return false;
  const end = task.end_date ? parseISO(task.end_date) : null;
  return end && isValid(end) && !isAfter(end, addDays(new Date(), 3));
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:      { label: 'รอดำเนินการ', icon: Circle,        color: 'text-muted-foreground' },
  'in-progress':{ label: 'กำลังทำ',    icon: Clock,         color: 'text-blue-600' },
  completed:    { label: 'เสร็จแล้ว',  icon: CheckCircle2,  color: 'text-green-600' },
  overdue:      { label: 'เกินกำหนด',  icon: AlertTriangle, color: 'text-destructive' },
};

const PRIORITY_CONFIG: Record<string, { label: string; badge: string }> = {
  high:   { label: 'สูง',      badge: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'ปานกลาง', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:    { label: 'ต่ำ',      badge: 'bg-green-100 text-green-700 border-green-200' },
};

const TASK_TYPE_LABEL: Record<string, string> = {
  meeting: 'ประชุม', onsite: 'งานลูกค้า (Onsite)', ot: 'OT', leave: 'ลา', holiday: 'หยุด',
};

// ─── Subtask rows (fetched on demand) ────────────────────────────────────────
function SubtaskRows({
  parentId,
  onStatusChange,
  onViewDetail,
  onLogTime,
  onEdit,
  onPromote,
  onDelete,
}: {
  parentId: string;
  onStatusChange: (id: string, status: string) => void;
  onViewDetail: (task: any) => void;
  onLogTime: (task: any) => void;
  onEdit: (task: any) => void;
  onPromote: (task: any) => void;
  onDelete: (task: any) => void;
}) {
  const { data: children = [], isLoading } = useTaskChildren(parentId);

  if (isLoading) {
    return (
      <div className="pl-12 pr-4 py-2 text-xs text-muted-foreground border-t border-border/50">
        กำลังโหลดงานย่อย...
      </div>
    );
  }
  if (children.length === 0) {
    return (
      <div className="pl-12 pr-4 py-2 text-xs text-muted-foreground italic border-t border-border/50">
        ไม่มีงานย่อย
      </div>
    );
  }
  return (
    <>
      {children.map((sub: any) => {
        const subOverdue = isOverdue(sub);
        const subDone = sub.status === 'completed';
        const subStatusKey = subOverdue && !subDone ? 'overdue' : sub.status;
        const subCfg = STATUS_CONFIG[subStatusKey] ?? STATUS_CONFIG.pending;
        const SubIcon = subCfg.icon;
        return (
          <div
            key={sub.id}
            className={cn(
              'group flex items-center gap-3 pl-10 pr-4 py-2.5 border-t border-border/50 transition-colors hover:bg-muted/20',
              subDone && 'opacity-55',
              subOverdue && !subDone && 'bg-destructive/5',
            )}
          >
            <span className="text-muted-foreground/40 text-xs shrink-0">↳</span>
            <button
              type="button"
              title={`สถานะ: ${subCfg.label}`}
              onClick={() => {
                const next: Record<string, string> = {
                  pending: 'in-progress', 'in-progress': 'completed',
                  completed: 'pending', overdue: 'in-progress',
                };
                onStatusChange(sub.id, next[subStatusKey] ?? 'pending');
              }}
              className={cn('shrink-0 transition-transform hover:scale-110', subCfg.color)}
            >
              <SubIcon className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onViewDetail(sub)}
                  className={cn('text-xs font-medium text-left hover:underline', subDone && 'line-through text-muted-foreground')}
                >
                  {sub.title}
                </button>
                {sub.task_type && TASK_TYPE_LABEL[sub.task_type] && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground border">{TASK_TYPE_LABEL[sub.task_type]}</span>
                )}
              </div>
              <p className={cn(
                'text-[11px] text-muted-foreground mt-0.5 truncate',
                subOverdue && !subDone && 'text-destructive font-medium',
              )}>
                {[
                  sub.assignee || null,
                  safeFmt(sub.end_date) !== '-' ? safeFmt(sub.end_date) : null,
                  subOverdue && !subDone ? 'เกินกำหนด' : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            {(sub.actual_hours > 0 || sub.estimated_hours > 0) && (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
                {Number(sub.actual_hours || 0).toFixed(1)} / {Number(sub.estimated_hours || 0).toFixed(1)} ชม.
              </span>
            )}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button type="button" title="แก้ไข" onClick={() => onEdit(sub)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                <Pencil className="h-3 w-3" />
              </button>
              <button type="button" title="ย้ายเป็นงานหลัก" onClick={() => onPromote(sub)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-orange-600 hover:bg-orange-50 transition-colors">
                <ArrowUpFromLine className="h-3 w-3" />
              </button>
              {!subDone && (
                <button type="button" title="บันทึกเวลา" onClick={() => onLogTime(sub)}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Timer className="h-3 w-3" />
                </button>
              )}
              {!subDone && (
                <button type="button" title="ทำเครื่องหมายว่าเสร็จแล้ว" onClick={() => onStatusChange(sub.id, 'completed')}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors">
                  <CheckCheck className="h-3 w-3" />
                </button>
              )}
              <button type="button" title="ลบงานย่อย" onClick={() => onDelete(sub)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────
function TaskRow({
  task,
  onStatusChange,
  onViewDetail,
  onDelete,
  onLogTime,
  onPromote,
  onReplaceWithSingleChild,
  selected = false,
  onToggleSelect,
}: {
  task: any;
  onStatusChange: (id: string, status: string) => void;
  onViewDetail: (task: any) => void;
  onDelete: (task: any) => void;
  onLogTime: (task: any) => void;
  onPromote: (task: any) => void;
  onReplaceWithSingleChild?: (task: any) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const overdue   = isOverdue(task);
  const dueSoon   = isDueSoon(task);
  const statusKey = overdue && task.status !== 'completed' ? 'overdue' : task.status;
  const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const done = task.status === 'completed';
  const subtaskCount = Number(task.subtask_count ?? 0);
  const hasSubtasks = subtaskCount > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30',
        done && 'opacity-55',
        overdue && !done && 'bg-destructive/5',
        selected && 'bg-primary/5',
      )}>
        {/* Checkbox for bulk selection */}
        {onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(task.id)}
            className="shrink-0"
          />
        )}
        {/* Expand/collapse subtasks */}
        {hasSubtasks ? (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title={expanded ? 'ซ่อนงานย่อย' : `แสดง ${subtaskCount} งานย่อย`}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Status toggle */}
        <button
          type="button"
          title={`สถานะ: ${cfg.label} — คลิกเพื่อเปลี่ยน`}
          onClick={() => {
            const next: Record<string, string> = {
              pending: 'in-progress', 'in-progress': 'completed',
              completed: 'pending', overdue: 'in-progress',
            };
            onStatusChange(task.id, next[statusKey] ?? 'pending');
          }}
          className={cn('shrink-0 transition-transform hover:scale-110', cfg.color)}
        >
          <Icon className="h-4 w-4" />
        </button>

        {/* Two-line content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onViewDetail(task)}
              className={cn('text-sm font-medium text-left hover:underline', done && 'line-through text-muted-foreground')}
            >
              {task.title}
            </button>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', pri.badge)}>{pri.label}</span>
            {task.is_ad_hoc === 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Ad-hoc</span>
            )}
            {task.task_type && TASK_TYPE_LABEL[task.task_type] && (
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">{TASK_TYPE_LABEL[task.task_type]}</span>
            )}
            {hasSubtasks && (
              <span className="text-[10px] text-primary/80">{subtaskCount} งานย่อย</span>
            )}
          </div>
          <p className={cn(
            'text-xs text-muted-foreground mt-0.5 truncate',
            overdue && !done && 'text-destructive font-medium',
            dueSoon && !overdue && 'text-orange-600 font-medium',
          )}>
            {[
              task.project_name,
              task.parent_task_id && task.parent_title ? `↳ ${task.parent_title}` : null,
              safeFmt(task.end_date) !== '-' ? safeFmt(task.end_date) : null,
              overdue && !done ? 'เกินกำหนด' : dueSoon && !overdue ? 'ใกล้ครบกำหนด' : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Right: hours + actions */}
        <div className="flex items-center gap-1 shrink-0">
          {(task.actual_hours > 0 || task.estimated_hours > 0) ? (
            <span className="hidden sm:inline text-sm font-semibold tabular-nums text-primary mr-1">
              {task.actual_hours > 0
                ? `${Number(task.actual_hours).toFixed(1)} ชม.`
                : `${Number(task.estimated_hours).toFixed(1)} ชม.`}
            </span>
          ) : task.estimated_days > 0 ? (
            <span className="hidden sm:inline text-sm font-semibold tabular-nums text-primary mr-1">{task.estimated_days} วัน</span>
          ) : null}

          {onReplaceWithSingleChild && Number(task.subtask_count ?? 0) === 1 && (
            <button type="button" title="แทนที่ด้วยงานย่อย (1 รายการ)" onClick={() => onReplaceWithSingleChild(task)}
              className="h-7 px-2 flex items-center gap-1 rounded text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 transition-colors shrink-0">
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              แทนที่
            </button>
          )}

          <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {!done && (
              <button type="button" title="บันทึกเวลา" onClick={() => onLogTime(task)}
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors">
                <Timer className="h-3.5 w-3.5" />
              </button>
            )}
            {!done && (
              <button type="button" title="ทำเครื่องหมายว่าเสร็จแล้ว" onClick={() => onStatusChange(task.id, 'completed')}
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors">
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onViewDetail(task)}><Eye className="h-3.5 w-3.5 mr-2" />ดูรายละเอียด</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLogTime(task)}><Timer className="h-3.5 w-3.5 mr-2" />บันทึกเวลา</DropdownMenuItem>
              <DropdownMenuSeparator />
              {task.status !== 'pending' && (
                <DropdownMenuItem onClick={() => onStatusChange(task.id, 'pending')}><Circle className="h-3.5 w-3.5 mr-2 text-muted-foreground" />ตั้งเป็น: รอดำเนินการ</DropdownMenuItem>
              )}
              {task.status !== 'in-progress' && (
                <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in-progress')}><Play className="h-3.5 w-3.5 mr-2 text-blue-600" />ตั้งเป็น: กำลังทำ</DropdownMenuItem>
              )}
              {task.status !== 'completed' && (
                <DropdownMenuItem onClick={() => onStatusChange(task.id, 'completed')}><CheckCheck className="h-3.5 w-3.5 mr-2 text-green-600" />ตั้งเป็น: เสร็จแล้ว</DropdownMenuItem>
              )}
              {task.status === 'completed' && (
                <DropdownMenuItem onClick={() => onStatusChange(task.id, 'pending')}><RotateCcw className="h-3.5 w-3.5 mr-2" />เปิดงานอีกครั้ง</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5 mr-2" />ลบงาน
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Subtask rows */}
      {expanded && hasSubtasks && (
        <SubtaskRows
          parentId={task.id}
          onStatusChange={onStatusChange}
          onViewDetail={onViewDetail}
          onLogTime={onLogTime}
          onEdit={onViewDetail}
          onPromote={onPromote}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

// ─── Collapsible group — renders as fragment inside a divide-y container ────────
function TaskGroup({
  label, tasks, count, icon: Icon, iconClass, onStatusChange, onViewDetail, onDelete, onLogTime, onPromote, onReplaceWithSingleChild, defaultOpen = true,
  selectedIds, onToggleSelect,
}: {
  label: string; tasks: any[]; count: number;
  icon: React.ElementType; iconClass: string;
  onStatusChange: (id: string, status: string) => void;
  onViewDetail: (task: any) => void;
  onDelete: (task: any) => void;
  onLogTime: (task: any) => void;
  onPromote: (task: any) => void;
  onReplaceWithSingleChild?: (task: any) => void;
  defaultOpen?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left bg-muted/20 hover:bg-muted/30 transition-colors group/hdr"
      >
        <span className="text-muted-foreground shrink-0">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <Icon className={cn('h-4 w-4 shrink-0', iconClass)} />
        <span className="text-sm font-semibold flex-1 text-left">{label}</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{count}</span>
      </button>
      {open && tasks.map((t) => (
        <React.Fragment key={t.id}>
          <TaskRow task={t} onStatusChange={onStatusChange} onViewDetail={onViewDetail} onDelete={onDelete} onLogTime={onLogTime} onPromote={onPromote}
            onReplaceWithSingleChild={onReplaceWithSingleChild}
            selected={selectedIds?.has(t.id) ?? false}
            onToggleSelect={onToggleSelect}
          />
        </React.Fragment>
      ))}
    </>
  );
}

// ─── Stat badge ────────────────────────────────────────────────────────────────
function StatBadge({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border p-3', className)}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'due_asc',  label: 'วันสิ้นสุด (เร็ว→ช้า)' },
  { value: 'due_desc', label: 'วันสิ้นสุด (ช้า→เร็ว)' },
  { value: 'priority', label: 'ความสำคัญ' },
  { value: 'created',  label: 'วันที่สร้าง (ล่าสุด)' },
];
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function MyTasksView({ yearFilter = '__all__', onYearChange }: { yearFilter?: string; onYearChange?: (year: string) => void }) {
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [sortBy, setSortBy]             = useState('due_desc');

  // TaskDetailSheet state
  const [detailTask, setDetailTask]     = useState<DbTask | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);

  // บันทึกชั่วโมง dialog state
  const [taskHoursTask, setTimesheetTask] = useState<any | null>(null);
  const [taskHoursOpen, setTimesheetOpen] = useState(false);

  // Promote dialog state
  const [promoteTask, setPromoteTask] = useState<any>(null);
  const [promoteProjectId, setPromoteProjectId] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Year filter → date range for API
  const yearDateRange = useMemo(() => {
    if (!yearFilter || yearFilter === '__all__') return {};
    const y = parseInt(yearFilter);
    return { year_from: `${y}-01-01`, year_to: `${y}-12-31` };
  }, [yearFilter]);

  // Server-side: my tasks only (root + subtasks, excluding is_subtask=1 บันทึกชั่วโมง entries)
  const { data: pageResult, isLoading } = useAllTasks({
    my: true,
    search: debouncedSearch,
    status: statusFilter !== '__all__' && statusFilter !== 'overdue' && statusFilter !== 'due_soon' ? statusFilter : '',
    per_page: 200,
    ...yearDateRange,
  });

  const allTasks: any[] = useMemo(() => pageResult?.data ?? [], [pageResult]);

  // De-duplicate: if both a parent task and its subtask are returned (both assigned to me),
  // avoid showing the subtask twice (once nested, once standalone).
  // Strategy: flat list — show every task returned by the server as its own item.
  // Parent tasks and subtasks are both first-class items in "งานของฉัน".
  // For subtasks, TaskRow will show parent_title as context.
  const filtered = useMemo(() => {
    let list = allTasks;

    if (statusFilter === 'overdue') list = list.filter(isOverdue);
    else if (statusFilter === 'due_soon') list = list.filter(isDueSoon);

    return list.sort((a: any, b: any) => {
      if (sortBy === 'due_asc')  return (a.end_date ?? '').localeCompare(b.end_date ?? '');
      if (sortBy === 'due_desc') return (b.end_date ?? '').localeCompare(a.end_date ?? '');
      if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [allTasks, statusFilter, sortBy]);

  const counts = useMemo(() => ({
    total:      allTasks.length,
    pending:    allTasks.filter((t: any) => t.status === 'pending' && !isOverdue(t)).length,
    inProgress: allTasks.filter((t: any) => t.status === 'in-progress' && !isOverdue(t)).length,
    completed:  allTasks.filter((t: any) => t.status === 'completed').length,
    overdue:    allTasks.filter(isOverdue).length,
    dueSoon:    allTasks.filter(isDueSoon).length,
  }), [allTasks]);

  const groups = useMemo(() => ({
    overdue:    filtered.filter(isOverdue),
    inProgress: filtered.filter((t: any) => t.status === 'in-progress' && !isOverdue(t)),
    pending:    filtered.filter((t: any) => t.status === 'pending' && !isOverdue(t)),
    completed:  filtered.filter((t: any) => t.status === 'completed'),
  }), [filtered]);

  const handleStatusChange = async (id: string, status: string) => {
    const task = allTasks.find((t: any) => t.id === id);
    try {
      await updateTask.mutateAsync({
        id,
        project_id: task?.project_id ?? '',
        status,
        completed_date: status === 'completed' ? format(new Date(), 'yyyy-MM-dd') : null,
      });
      toast({ title: status === 'completed' ? '✅ เสร็จแล้ว' : 'อัปเดตสถานะแล้ว' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (task: any) => {
    if (!await confirm({ title: 'ลบงาน', description: `ต้องการลบงาน "${task.title}" ใช่หรือไม่?`, variant: 'destructive' })) return;
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId: task.project_id });
      toast({ title: 'ลบงานสำเร็จ' });
      if (detailTask?.id === task.id) setDetailOpen(false);
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
      if (!await confirm({
        title: 'แทนที่ด้วยงานย่อย',
        description: `ย้าย "${child.title}" ขึ้นเป็นงานหลัก และลบ "${parentTask.title}"?`,
        variant: 'destructive',
      })) return;
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

  const handleViewDetail = (task: any) => {
    setDetailTask(task as DbTask);
    setDetailOpen(true);
  };

  const handleLogTime = (task: any) => {
    setTimesheetTask(task);
    setTimesheetOpen(true);
  };

  const handlePromote = async () => {
    if (!promoteTask || !promoteProjectId) return;
    try {
      await updateTask.mutateAsync({
        id: promoteTask.id,
        project_id: promoteProjectId,
        parent_task_id: null,
        is_subtask: 0,
      });
      toast({ title: 'ย้ายเป็นงานหลักสำเร็จ' });
      setPromoteTask(null);
      setPromoteProjectId('');
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus]   = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleBulkUpdate = async () => {
    if (!bulkStatus && !bulkPriority) return;
    setIsBulkSaving(true);
    try {
      await Promise.all([...selectedIds].map(id => {
        const task = allTasks.find((t: any) => t.id === id);
        return updateTask.mutateAsync({
          id,
          project_id: task?.project_id ?? '',
          ...(bulkStatus   ? { status: bulkStatus }     : {}),
          ...(bulkPriority ? { priority: bulkPriority } : {}),
        });
      }));
      toast({ title: `อัปเดต ${selectedIds.size} งานสำเร็จ` });
      setBulkStatus('');
      setBulkPriority('');
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkReplace = async () => {
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

  const hasFilters = search || statusFilter !== '__all__' || (yearFilter !== '__all__');
  const clearFilters = () => { setSearch(''); setStatusFilter('__all__'); };
  const currentYear = new Date().getFullYear();

  const groupProps = { onStatusChange: handleStatusChange, onViewDetail: handleViewDetail, onDelete: handleDelete, onLogTime: handleLogTime, onPromote: (task: any) => { setPromoteTask(task); setPromoteProjectId(task.project_id || ''); }, onReplaceWithSingleChild: handleReplaceWithSingleChild, selectedIds, onToggleSelect: toggleSelect };

  return (
    <>
      <div className="space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatBadge label="งานทั้งหมด"  value={counts.total}      className="col-span-2 sm:col-span-1" />
          <StatBadge label="รอดำเนินการ" value={counts.pending}    className="border-muted-foreground/20" />
          <StatBadge label="กำลังทำ"     value={counts.inProgress} className="border-blue-200 bg-blue-50/50" />
          <StatBadge label="เสร็จแล้ว"   value={counts.completed}  className="border-green-200 bg-green-50/50" />
          <StatBadge
            label={counts.overdue > 0 ? '⚠ เกินกำหนด' : 'เกินกำหนด'}
            value={counts.overdue}
            className={counts.overdue > 0 ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-muted-foreground/20'}
          />
        </div>

        {/* Due-soon banner */}
        {counts.dueSoon > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            มี <strong>{counts.dueSoon} งาน</strong> ที่จะครบกำหนดภายใน 3 วัน
          </div>
        )}

        {/* Filters */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" />ตัวกรอง
            </div>
            <CreateTaskDialog />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหางาน หรือโปรเจกต์..."
                className="pl-8 h-8 text-xs w-full"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 sm:flex-none sm:w-40 h-8 text-xs">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทุกสถานะ</SelectItem>
                  <SelectItem value="pending">รอดำเนินการ</SelectItem>
                  <SelectItem value="in-progress">กำลังทำ</SelectItem>
                  <SelectItem value="overdue">เกินกำหนด</SelectItem>
                  <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                </SelectContent>
              </Select>
              <Select value={yearFilter !== '__all__' ? yearFilter : '__all__'} onValueChange={(v) => onYearChange?.(v)}>
                <SelectTrigger className="flex-1 sm:flex-none sm:w-28 h-8 text-xs">
                  <CalendarDays className="h-3 w-3 mr-1" /> <SelectValue placeholder="ปี" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทุกปี</SelectItem>
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 sm:flex-none sm:w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />ล้าง
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Task list — flat divide-y container matching บันทึกชั่วโมง style */}
        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground rounded-lg border">
            <Clock className="h-5 w-5 animate-spin mr-2" />
            กำลังโหลดงาน...
          </div>
        ) : counts.total === 0 ? (
          <div className="text-center py-20 text-muted-foreground rounded-lg border">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">ไม่มีงานที่มอบหมายให้คุณ</p>
            <p className="text-sm mt-1">งานที่มอบหมายให้ "{user?.display_name}" จะปรากฏที่นี่</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-lg border">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>ไม่พบงานตามตัวกรองที่เลือก</p>
            <Button variant="link" onClick={clearFilters} className="mt-1">ล้างตัวกรอง</Button>
          </div>
        ) : (
          <>
            {/* Bulk toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-sm font-medium text-primary shrink-0">เลือก {selectedIds.size} งาน</span>
                <div className="flex flex-wrap gap-2 ml-auto items-center">
                  <Select value={bulkStatus || '__none__'} onValueChange={v => setBulkStatus(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="เปลี่ยนสถานะ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— สถานะ —</SelectItem>
                      <SelectItem value="pending">รอดำเนินการ</SelectItem>
                      <SelectItem value="in-progress">กำลังทำ</SelectItem>
                      <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={bulkPriority || '__none__'} onValueChange={v => setBulkPriority(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="ความสำคัญ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— ความสำคัญ —</SelectItem>
                      <SelectItem value="high">สูง</SelectItem>
                      <SelectItem value="medium">ปานกลาง</SelectItem>
                      <SelectItem value="low">ต่ำ</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={handleBulkUpdate}
                    disabled={isBulkSaving || (!bulkStatus && !bulkPriority)}>
                    {isBulkSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                    บันทึก
                  </Button>
                  <Button size="sm" variant="default" className="h-8 text-xs gap-1 bg-amber-600 hover:bg-amber-700" disabled={isBulkSaving} onClick={handleBulkReplace}>
                    <ArrowUpFromLine className="h-3 w-3" />
                    แทนที่ ({selectedIds.size})
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSelectedIds(new Set()); setBulkStatus(''); setBulkPriority(''); }}>
                    ยกเลิก
                  </Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border divide-y">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/40 text-xs font-semibold text-muted-foreground">
                <Checkbox
                  checked={filtered.length > 0 && filtered.every((t: any) => selectedIds.has(t.id))}
                  onCheckedChange={(v) => setSelectedIds(v ? new Set(filtered.map((t: any) => t.id)) : new Set())}
                  className="shrink-0"
                />
                <span className="w-4 shrink-0" />
                <span className="w-4 shrink-0" />
                <span className="flex-1 min-w-0">ชื่องาน</span>
                <span className="w-24 shrink-0 text-right hidden sm:block">ชั่วโมง</span>
                <span className="w-[140px] shrink-0 hidden md:block" />
              </div>
              <TaskGroup label="เกินกำหนด"      tasks={groups.overdue}    count={groups.overdue.length}    icon={AlertTriangle} iconClass="text-destructive"      defaultOpen={true}  {...groupProps} />
              <TaskGroup label="กำลังดำเนินการ" tasks={groups.inProgress} count={groups.inProgress.length} icon={Clock}         iconClass="text-blue-600"         defaultOpen={true}  {...groupProps} />
              <TaskGroup label="รอดำเนินการ"    tasks={groups.pending}    count={groups.pending.length}    icon={Circle}        iconClass="text-muted-foreground" defaultOpen={true}  {...groupProps} />
              <TaskGroup label="เสร็จแล้ว"      tasks={groups.completed}  count={groups.completed.length}  icon={CheckCircle2}  iconClass="text-green-600"        defaultOpen={false} {...groupProps} />
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 text-sm font-semibold">
                <div className="flex items-center gap-2">
                  {filtered.length > 0 && (
                    <Checkbox
                      checked={selectedIds.size === filtered.length}
                      onCheckedChange={(v) => setSelectedIds(v ? new Set(filtered.map((t: any) => t.id)) : new Set())}
                    />
                  )}
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" />รวมทั้งหมด</span>
                </div>
                <span className="text-primary tabular-nums">{filtered.length} งาน</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={detailTask}
        open={detailOpen}
        onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailTask(null); }}
      />

      {/* บันทึกชั่วโมง entry dialog — pre-filled with task context */}
      {taskHoursTask && (
        <CreateTaskHoursEntryDialog
          hideTrigger
          open={taskHoursOpen}
          onOpenChange={(v) => { setTimesheetOpen(v); if (!v) setTimesheetTask(null); }}
          defaultProjectId={taskHoursTask.project_id}
          defaultTaskId={taskHoursTask.id}
          defaultDate={format(new Date(), 'yyyy-MM-dd')}
          defaultHours="8"
          onSuccess={() => toast({ title: '✅ บันทึกชั่วโมง สำเร็จ' })}
        />
      )}

      {/* Promote subtask dialog with project selector */}
      <Dialog open={!!promoteTask} onOpenChange={(v) => { if (!v) { setPromoteTask(null); setPromoteProjectId(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ย้ายเป็นงานหลัก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              ย้าย <strong>{promoteTask?.title}</strong> ออกจากงานย่อย เปลี่ยนเป็นงานหลัก
            </p>
            <div className="space-y-2">
              <Label>เลือกโปรเจกต์ปลายทาง</Label>
              <ProjectCombobox
                value={promoteProjectId}
                onChange={setPromoteProjectId}
                placeholder="เลือกโปรเจกต์"
                allowNone={false}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setPromoteTask(null); setPromoteProjectId(''); }}>ยกเลิก</Button>
            <Button onClick={handlePromote} disabled={!promoteProjectId}>ยืนยันย้าย</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
