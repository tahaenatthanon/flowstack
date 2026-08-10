import { useState, useEffect, useRef } from 'react';
import { DbTask } from '@/types/project';
import {
  useUpdateTask, useDeleteTask, useSubtasks, useCreateSubtask, useDeleteSubtask, useUsers,
  useTaskDependencies, useBlockingDependencies, useCreateTaskDependency, useResolveDependency,
  useTaskHistory, useCreateTaskHistory, useTasks,
  useRecurringTask, useCreateRecurringTask, useUpdateRecurringTask, useDeleteRecurringTask,
} from '@/hooks/useProjectData';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { getStatusLabel, getPriorityLabel, getStatusColor } from '@/lib/projectUtils';
import { cn } from '@/lib/utils';
import { safeFmt } from '@/lib/dateUtils';
import { differenceInDays, parseISO, addDays, getDay } from 'date-fns';

function workingHours(start: string, end: string, hoursPerDay = 8): number {
  let d = parseISO(start);
  const e = parseISO(end);
  let h = 0;
  while (d <= e) {
    const dow = getDay(d);
    if (dow !== 0 && dow !== 6) h += hoursPerDay;
    d = addDays(d, 1);
  }
  return Math.max(hoursPerDay, h);
}
import { toast } from 'sonner';
import ProjectCombobox from '@/components/ProjectCombobox';
import UserCombobox from '@/components/UserCombobox';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar, Clock, User, Flag,
  Plus, Trash2, Check, X, Zap, LinkIcon, History, ArrowRight, ShieldAlert, RefreshCw, AlertCircle, Pencil, ArrowUpFromLine
} from 'lucide-react';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';
import CapacityWarning from '@/components/CapacityWarning';
import { useCapacityCheck } from '@/hooks/useCapacity';

// ── Date input styled like mockup (DD / MM / YYYY + calendar icon) ──────────
function DateInput({
  value, onChange, onBlur, min, disabled, className,
}: {
  value: string; onChange: (v: string) => void; onBlur?: () => void;
  min?: string; disabled?: boolean; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const formatted = value
    ? (() => {
        const [y, m, d] = value.split('-');
        return `${d} / ${m} / ${y}`;
      })()
    : 'วว / ดด / ปปปป';
  return (
    <div
      className={cn(
        'relative flex items-center h-10 px-3 rounded-md border border-input bg-background text-sm cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      onClick={() => !disabled && ref.current?.showPicker?.()}
    >
      <span className={cn('flex-1', !value && 'text-muted-foreground')}>{formatted}</span>
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
        tabIndex={-1}
      />
    </div>
  );
}

interface TaskDetailSheetProps {
  task: DbTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TaskDetailSheet({ task, open, onOpenChange }: TaskDetailSheetProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { confirm } = useConfirm();
  const createSubtask = useCreateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const createDependency = useCreateTaskDependency();
  const resolveDep = useResolveDependency();
  const createHistory = useCreateTaskHistory();
  const createRecurring = useCreateRecurringTask();
  const updateRecurring = useUpdateRecurringTask();
  const deleteRecurring = useDeleteRecurringTask();

  const { user: currentUser } = useAuth();
  const isAdmin = Number(currentUser?.is_admin) === 1;
  const { activeTaskExecutionTypes, data: settings } = useWorkTypeCatalog();
  const maxTaskHours = settings?.max_task_hours ?? 16;
  const { data: users = [] } = useUsers();
  const { data: subtasks = [], isLoading: subtasksLoading } = useSubtasks(task?.id || '');
  const { data: blockedByDeps = [] } = useTaskDependencies(task?.id || '');
  const { data: blockingDeps = [] } = useBlockingDependencies(task?.id || '');
  const { data: history = [] } = useTaskHistory(task?.id || '');
  const { data: recurringTemplate } = useRecurringTask(task?.id || '');
  const { data: projectTasks = [] } = useTasks(task?.project_id || '');

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [localStatus, setLocalStatus] = useState(task?.status || 'pending');
  const [localPriority, setLocalPriority] = useState(task?.priority || 'medium');
  const [localAssignee, setLocalAssignee] = useState(task?.assignee_user_id || '');
  const [localTaskType, setLocalTaskType] = useState(task?.task_type || 'task');
  const [localStartDate, setLocalStartDate] = useState(task?.start_date || '');
  const [localEndDate, setLocalEndDate] = useState(task?.end_date || '');
  const [localEstimatedDays, setLocalEstimatedDays] = useState(String(task?.estimated_days ?? 1));
  const [localEstimatedHours, setLocalEstimatedHours] = useState(String(task?.estimated_hours ?? 8));
  const [localActualHours, setLocalActualHours] = useState(String(task?.actual_hours ?? 0));

  const isTaskMultiDay = localStartDate && localEndDate && localStartDate !== localEndDate;
  const { data: taskCapacity } = useCapacityCheck({
    assigneeUserId: localAssignee && localAssignee !== 'none' ? localAssignee : null,
    startDate: localStartDate || '',
    endDate: localEndDate || '',
    enabled: !!isTaskMultiDay && !!localAssignee && localAssignee !== 'none' && !!localStartDate && !!localEndDate,
  });

  // Sync estimated hours from server capacity when dates/assignee change
  useEffect(() => {
    if (isTaskMultiDay && taskCapacity?.total_capacity != null && taskCapacity.total_capacity > 0) {
      setLocalEstimatedHours(String(taskCapacity.total_capacity));
    } else if (isTaskMultiDay && !taskCapacity && localStartDate && localEndDate) {
      setLocalEstimatedHours(String(workingHours(localStartDate, localEndDate)));
    }
  }, [taskCapacity?.total_capacity, localStartDate, localEndDate, isTaskMultiDay]);
  const [localProgress, setLocalProgress] = useState(String(task?.progress_percentage ?? 0));
  const [localCreatorId, setLocalCreatorId] = useState(task?.user_id || '');
  const [localProjectId, setLocalProjectId] = useState(task?.project_id || '');

  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [newSubtaskPriority, setNewSubtaskPriority] = useState('medium');
  const [newSubtaskStatus, setNewSubtaskStatus] = useState('pending');
  const [newSubtaskTaskType, setNewSubtaskTaskType] = useState('task');
  const [newSubtaskStartDate, setNewSubtaskStartDate] = useState('');
  const [newSubtaskEndDate, setNewSubtaskEndDate] = useState('');
  const [newSubtaskEstimatedHours, setNewSubtaskEstimatedHours] = useState('2');
  const [newSubtaskEstimatedHoursTouched, setNewSubtaskEstimatedHoursTouched] = useState(false);
  const [newSubtaskActualHours, setNewSubtaskActualHours] = useState('0');

  // Inline subtask editing
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubForm, setEditSubForm] = useState({
    title: '', description: '', status: 'pending', priority: 'medium',
    assignee: '', task_type: 'task', start_date: '', end_date: '',
    estimated_hours: '', actual_hours: '',
  });

  // Quick inline subtask title editing
  const [editingSubTitleId, setEditingSubTitleId] = useState<string | null>(null);
  const [editSubTitleValue, setEditSubTitleValue] = useState('');

  const [showAddDep, setShowAddDep] = useState(false);
  const [depBlockingTaskId, setDepBlockingTaskId] = useState('');
  const [depReasonCode, setDepReasonCode] = useState<'depends_on' | 'blocks'>('depends_on');

  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');
  const [recurInterval, setRecurInterval] = useState(1);
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurMaxOccurrences, setRecurMaxOccurrences] = useState<number | ''>('');

  const [showPauseForm, setShowPauseForm] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [showDelayReasonForm, setShowDelayReasonForm] = useState(false);
  const [delayReasonInput, setDelayReasonInput] = useState('');

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteProjectId, setPromoteProjectId] = useState('');

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setLocalStatus(task.status);
      setLocalPriority(task.priority);
      setLocalAssignee(task?.assignee_user_id || '');
      setLocalTaskType(task?.task_type || 'task');
      setLocalStartDate(task.start_date || '');
      setLocalEndDate(task.end_date || '');
      setLocalEstimatedDays(String(task.estimated_days ?? 1));
      setLocalEstimatedHours(String(task?.estimated_hours ?? 8));
      setLocalActualHours(String(task?.actual_hours ?? 0));
      setLocalProgress(String(task?.progress_percentage ?? 0));
      setLocalCreatorId(task?.user_id || '');
      setLocalProjectId(task.project_id || '');
    }
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setShowAddSubtask(false);
    setShowAddDep(false);
    setShowRecurringForm(false);
    setNewSubtaskTitle(''); setNewSubtaskDescription(''); setNewSubtaskAssignee('');
    setNewSubtaskPriority('medium'); setNewSubtaskStatus('pending'); setNewSubtaskTaskType('task');
    setNewSubtaskStartDate(''); setNewSubtaskEndDate('');
    setNewSubtaskEstimatedHours('2'); setNewSubtaskActualHours('0');
  }, [task]);

  if (!task) return null;

  const completedSubtasks = subtasks.filter((s: any) => s.status === 'completed').length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;
  // blockedByDeps items have depends_on_task_id = the blocking task's id
  const blockedByIds = new Set(blockedByDeps.map((d: any) => d.depends_on_task_id));
  const availableTasks = projectTasks.filter(
    (t) => t.id !== task.id && !t.parent_task_id && !blockedByIds.has(t.id)
  );


  const handleStatusChange = (v: string) => { setLocalStatus(v); };
  const handlePriorityChange = (v: string) => { setLocalPriority(v); };
  const handleAssigneeChange = (v: string) => { setLocalAssignee(v === 'none' ? '' : v); };
  const handleTaskTypeChange = (v: string) => { setLocalTaskType(v); };

  const handleSaveTitle = () => {
    if (!editTitle.trim()) return;
    setEditTitle(editTitle.trim());
    setIsEditingTitle(false);
  };

  const handleSaveDescription = () => {
    setIsEditingDescription(false);
  };

  // Save all editable detail fields in one call — always sends complete local state
  const handleSaveDetails = async () => {
    try {
      if (!localProjectId && !task.project_id) {
        toast.error('กรุณาเลือกโปรเจกต์');
        return;
      }
      const isMultiDay = localStartDate && localEndDate && localStartDate !== localEndDate;
      const update: any = {
        id: task.id,
        project_id: localProjectId || task.project_id,
        title: editTitle,
        description: editDescription,
        status: localStatus,
        priority: localPriority,
        assignee: (!localAssignee || localAssignee === 'none') ? '' : (users.find(u => u.id === localAssignee)?.display_name || ''),
        assignee_user_id: (!localAssignee || localAssignee === 'none') ? null : localAssignee,
        task_type: localTaskType,
        start_date: localStartDate || null,
        end_date: localEndDate || null,
        actual_hours: parseFloat(localActualHours) || 0,
        user_id: localCreatorId || null,
      };
      // If task has subtasks, estimated = sum of subtask estimated hours
      const activeSubtasks = (subtasks ?? []).filter((s: any) => !s.deleted_at);
      if (activeSubtasks.length > 0) {
        const subtaskSum = activeSubtasks.reduce((sum: number, s: any) => sum + (Number(s?.estimated_hours) || 0), 0);
        update.estimated_hours = subtaskSum > 0 ? subtaskSum : activeSubtasks.length * 2;
      } else if (isMultiDay) {
        update.estimated_hours = workingHours(localStartDate!, localEndDate!);
      } else {
        const eh = parseFloat(localEstimatedHours);
        update.estimated_hours = isNaN(eh) || eh <= 0 ? 2 : eh;
      }
      if (localStatus === 'completed' && !task?.completed_date) {
        update.completed_date = new Date().toISOString().split('T')[0];
      }
      // Send the timestamp we last saw so the server can detect concurrent edits
      if (task.updated_at) update._updated_at = task.updated_at;

      const result: any = await updateTask.mutateAsync(update);
      if (result?.warnings?.length) {
        result.warnings.forEach((w: string) => toast.warning(w));
      }
      toast.success('บันทึกแล้ว');
      onOpenChange(false);
    } catch (err: any) {
      // 409 conflict is already handled by useUpdateTask onError — don't double-toast
      if (!(err?.conflict || err?.status === 409)) {
        toast.error(err.message || 'ไม่สามารถบันทึกได้');
      }
    }
  };

  const handleDeleteTask = async () => {
    if (!task?.id) return;
    if (!await confirm({ title: 'ลบงาน', description: `ลบงาน "${task.title}"? การลบเป็นแบบ soft-delete`, variant: 'destructive' })) return;
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId: task.project_id });
      toast.success('ลบงานแล้ว');
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    try {
      await createSubtask.mutateAsync({
        parent_task_id: task.id, project_id: task.project_id, title: newSubtaskTitle.trim(),
        description: newSubtaskDescription,
        assignee: (!newSubtaskAssignee || newSubtaskAssignee === 'none') ? '' : (users.find(u => u.id === newSubtaskAssignee)?.display_name || ''),
        assignee_user_id: (!newSubtaskAssignee || newSubtaskAssignee === 'none') ? null : newSubtaskAssignee,
        priority: newSubtaskPriority, status: newSubtaskStatus,
        task_type: newSubtaskTaskType,
        start_date: newSubtaskStartDate || task.start_date,
        end_date: newSubtaskEndDate || task.end_date,
        estimated_hours: parseFloat(newSubtaskEstimatedHours) || 2,
        actual_hours: parseFloat(newSubtaskActualHours) || 2,
      });
      setNewSubtaskTitle(''); setNewSubtaskDescription(''); setNewSubtaskAssignee('');
      setNewSubtaskPriority('medium'); setNewSubtaskStatus('pending'); setNewSubtaskTaskType('task');
      setNewSubtaskStartDate(''); setNewSubtaskEndDate('');
      setNewSubtaskEstimatedHours(''); setNewSubtaskActualHours('');
      setShowAddSubtask(false);
      toast.success('เพิ่มงานย่อยสำเร็จ');
    } catch (err: any) { toast.error(err.message || 'ไม่สามารถเพิ่มงานย่อยได้'); }
  };

  const handleToggleSubtask = async (subtask: any) => {
    const newStatus = subtask.status === 'completed' ? 'in-progress' : 'completed';
    try {
      await updateTask.mutateAsync({ id: subtask.id, project_id: task.project_id, status: newStatus,
        completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null });
    } catch (err: any) { toast.error(err.message); }
  };

  const openEditSub = (sub) => {
    setEditingSubId(sub.id);
    setEditSubForm({
      title: sub.title || '',
      description: sub.description || '',
      status: sub.status || 'pending',
      priority: sub.priority || 'medium',
      assignee: sub.assignee || '',
      task_type: sub.task_type || 'task',
      start_date: sub.start_date || '',
      end_date: sub.end_date || '',
      estimated_hours: sub.estimated_hours?.toString() || '',
      actual_hours: sub.actual_hours?.toString() || '',
    });
  };

  const handleSaveEditSub = async (sub) => {
    if (!editSubForm.title.trim()) return;
    try {
      const subResult: any = await updateTask.mutateAsync({
        id: sub.id,
        project_id: task.project_id,
        title: editSubForm.title.trim(),
        description: editSubForm.description,
        status: editSubForm.status,
        priority: editSubForm.priority,
        assignee: (!editSubForm.assignee || editSubForm.assignee === 'none') ? '' : (users.find(u => u.id === editSubForm.assignee)?.display_name || ''),
        assignee_user_id: (!editSubForm.assignee || editSubForm.assignee === 'none') ? null : editSubForm.assignee,
        task_type: editSubForm.task_type,
        start_date: editSubForm.start_date,
        end_date: editSubForm.end_date,
        estimated_hours: parseFloat(editSubForm.estimated_hours) || 0,
        actual_hours: parseFloat(editSubForm.actual_hours) || 0,
      });
      if (subResult?.warnings?.length) {
        subResult.warnings.forEach((w: string) => toast.warning(w));
      }
      setEditingSubId(null);
      toast.success('บันทึกงานย่อยแล้ว');
    } catch (err: any) { toast.error(err.message || 'ไม่สามารถบันทึกได้'); }
  };

  const handleSaveSubTitle = async (sub) => {
    if (!editSubTitleValue.trim()) return;
    try {
      await updateTask.mutateAsync({ id: sub.id, project_id: task.project_id, title: editSubTitleValue.trim() });
      setEditingSubTitleId(null);
      toast.success('บันทึกแล้ว');
    } catch (err: any) { toast.error(err.message || 'ไม่สามารถบันทึกได้'); }
  };

  const handleDeleteSubtask = async (subtask: any) => {
    if (!await confirm({ title: 'ลบงานย่อย', description: `ลบงานย่อย "${subtask.title}"?`, variant: 'destructive' })) return;
    try {
      await deleteSubtask.mutateAsync({ id: subtask.id, project_id: task.project_id, parent_task_id: task.id });
      toast.success('ลบแล้ว');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddDependency = async () => {
    if (!depBlockingTaskId) return;
    try {
      await createDependency.mutateAsync({ task_id: task.id, depends_on_task_id: depBlockingTaskId, dependency_type: depReasonCode });
      setShowAddDep(false); setDepBlockingTaskId('');
      toast.success('เพิ่ม dependency สำเร็จ');
    } catch (err: any) { toast.error(err.message || 'ไม่สามารถเพิ่ม dependency ได้'); }
  };

  const handleResolveDep = async (depId: string) => {
    try { await resolveDep.mutateAsync(depId); toast.success('แก้ไข dependency สำเร็จ'); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleSaveRecurring = async () => {
    try {
      if (recurringTemplate?.id) {
        await updateRecurring.mutateAsync({ id: recurringTemplate.id, updates: { frequency: recurFrequency, interval_count: recurInterval, recur_end_date: recurEndDate || undefined, max_occurrences: recurMaxOccurrences ? Number(recurMaxOccurrences) : undefined } });
      } else {
        await createRecurring.mutateAsync({ project_id: task.project_id, title: task.title, description: task.description, priority: task.priority, assignee: task.assignee, estimated_days: task.estimated_days, frequency: recurFrequency, interval_count: recurInterval, start_date: task.start_date, recur_end_date: recurEndDate || undefined, max_occurrences: recurMaxOccurrences ? Number(recurMaxOccurrences) : undefined });
      }
      setShowRecurringForm(false);
      toast.success('บันทึกการทำซ้ำสำเร็จ');
    } catch (err: any) { toast.error(err.message || 'ไม่สามารถบันทึกได้'); }
  };

  const handleDeleteRecurring = async () => {
    if (!recurringTemplate?.id || !await confirm({ title: 'ลบการตั้งค่าทำซ้ำ', description: 'ลบการตั้งค่าทำซ้ำนี้?', variant: 'destructive' })) return;
    try { await deleteRecurring.mutateAsync({ id: recurringTemplate.id, projectId: task.project_id }); toast.success('ลบแล้ว'); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleSaveDelayReason = async () => {
    if (!delayReasonInput.trim()) return;
    try {
      await updateTask.mutateAsync({ id: task.id, project_id: task.project_id, delay_reason: delayReasonInput.trim() });
      createHistory.mutateAsync({ task_id: task.id, action: 'UPDATED', field_name: 'delay_reason', new_value: delayReasonInput.trim() }).catch(() => {});
      setShowDelayReasonForm(false);
      toast.success('บันทึกเหตุผลแล้ว');
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePauseTask = async () => {
    if (!pauseReason.trim()) return;
    try {
      await updateTask.mutateAsync({ id: task.id, project_id: task.project_id,
        paused_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        pause_reason: pauseReason.trim(),
      });
      createHistory.mutateAsync({ task_id: task.id, action: 'PAUSED', reason: pauseReason.trim() }).catch(() => {});
      setShowPauseForm(false); setPauseReason('');
      toast.success('พักงานแล้ว');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleResumeTask = async () => {
    try {
      await updateTask.mutateAsync({ id: task.id, project_id: task.project_id,
        paused_at: null, pause_reason: null, paused_by: null });
      createHistory.mutateAsync({ task_id: task.id, action: 'RESUMED' }).catch(() => {});
      toast.success('เริ่มงานอีกครั้งแล้ว');
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePromoteToMain = async () => {
    if (!promoteProjectId) return;
    try {
      await updateTask.mutateAsync({
        id: task.id,
        project_id: promoteProjectId,
        parent_task_id: null,
        is_subtask: 0,
      });
      toast.success('ย้ายเป็นงานหลักสำเร็จ');
      setPromoteOpen(false);
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message || 'ไม่สามารถย้ายได้'); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0" side="right">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="sr-only">รายละเอียดงาน</SheetTitle>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-base font-bold h-auto py-1"
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSaveTitle}><Check className="w-4 h-4 text-green-600" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setIsEditingTitle(false)}><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <h2 className="text-base font-bold cursor-pointer hover:text-primary transition-colors line-clamp-2" onClick={() => setIsEditingTitle(true)} title="คลิกเพื่อแก้ไข">
                  {task.title}
                </h2>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {Number(task.is_ad_hoc) === 1 && <Badge variant="outline" className="text-[10px] border-warning text-warning gap-1"><Zap className="w-3 h-3" /> งานแทรก</Badge>}
                <Badge variant="secondary" className="text-[10px]">{getPriorityLabel(task.priority)}</Badge>
                {task?.parent_task_id && (
                  <Button
                    size="sm" variant="outline"
                    className="h-6 px-2 text-[10px] gap-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={() => { setPromoteProjectId(task.project_id || ''); setPromoteOpen(true); }}
                  >
                    <ArrowUpFromLine className="w-3 h-3" />
                    ย้ายเป็นงานหลัก
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1">
          <TabsList className="grid grid-cols-5 mx-5 mt-3 mb-0 h-8">
            <TabsTrigger value="details" className="text-xs">รายละเอียด</TabsTrigger>
            <TabsTrigger value="subtasks" className="text-xs">งานย่อย{subtasks.length > 0 ? ` (${subtasks.length})` : ''}</TabsTrigger>
            <TabsTrigger value="dependencies" className="text-xs">Deps{blockedByDeps.filter((d) => !d.resolved_at).length > 0 ? ` (${blockedByDeps.filter((d) => !d.resolved_at).length})` : ''}</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">ประวัติ</TabsTrigger>
            <TabsTrigger value="recurring" className="text-xs">{recurringTemplate?.id ? '' : ''}ทำซ้ำ</TabsTrigger>
          </TabsList>

          {/* DETAILS */}
          <TabsContent value="details" className="px-5 pb-6 pt-4 space-y-4">
            {/* ประเภทงาน */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Flag className="w-3 h-3" /> ประเภทงาน</Label>
              <Select value={localTaskType} onValueChange={handleTaskTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeTaskExecutionTypes.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* รายละเอียด */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">รายละเอียด</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} className="text-sm resize-none" placeholder="รายละเอียดงาน..." />
            </div>
            {/* สถานะ */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Flag className="w-3 h-3" /> สถานะ</Label>
              <Select value={localStatus} onValueChange={handleStatusChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอดำเนินการ</SelectItem>
                  <SelectItem value="in-progress">กำลังดำเนินการ</SelectItem>
                  <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                  <SelectItem value="overdue">เกินกำหนด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* ความสำคัญ + ผู้รับผิดชอบ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Flag className="w-3 h-3" /> ความสำคัญ</Label>
                <Select value={localPriority} onValueChange={handlePriorityChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 สูง</SelectItem>
                    <SelectItem value="medium">🟡 ปานกลาง</SelectItem>
                    <SelectItem value="low">🟢 ต่ำ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> ผู้รับผิดชอบ</Label>
                <UserCombobox
                  value={localAssignee}
                  onChange={(id) => setLocalAssignee(id === 'none' ? '' : id)}
                  placeholder="ไม่ระบุ"
                  allowNone={true}
                />
              </div>
            </div>
            {/* วันเริ่มต้น + วันกำหนดส่ง */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> วันเริ่มต้น</Label>
                <DateInput value={localStartDate}
                  onChange={v => {
                    setLocalStartDate(v);
                    if (localEndDate) {
                      if (v === localEndDate) {
                        setLocalEstimatedHours('8');
                      } else if (v < localEndDate) {
                        setLocalEstimatedHours(String(workingHours(v, localEndDate)));
                      }
                    }
                  }}
                  />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> วันกำหนดส่ง</Label>
                <DateInput value={localEndDate} min={localStartDate}
                  onChange={v => {
                    setLocalEndDate(v);
                    if (localStartDate) {
                      if (v === localStartDate) {
                        setLocalEstimatedHours('8');
                      } else if (v > localStartDate) {
                        setLocalEstimatedHours(String(workingHours(localStartDate, v)));
                      }
                    }
                  }}
                  />
                {task.original_end_date && task.end_date > task.original_end_date && (
                  <p className="text-[10px] text-orange-500">เดิม: {safeFmt(task.original_end_date)}</p>
                )}
              </div>
            </div>
            {/* ชั่วโมงงาน (ประมาณ + จริง) */}
            {(() => {
              const activeSubtasks = subtasks.filter((s: any) => !s.deleted_at);
              const hasSubtasks = activeSubtasks.length > 0;
              const subtaskActual = activeSubtasks.reduce((sum: number, s: any) => sum + Number(s?.actual_hours ?? 0), 0);
              const subtaskEstimated = activeSubtasks.reduce((sum: number, s: any) => sum + Number(s?.estimated_hours ?? 0), 0);

              const isMultiDay = localStartDate && localEndDate && localStartDate !== localEndDate;
              const days = isMultiDay
                ? Math.max(1, Math.round((new Date(localEndDate).getTime() - new Date(localStartDate).getTime()) / 86400000 + 1))
                : 1;
              const currentHours = parseFloat(localEstimatedHours) || 2;
              const isInvalid = !isMultiDay && currentHours > maxTaskHours;

              const displayActual = hasSubtasks ? subtaskActual : (parseFloat(localActualHours) || 0);
              const displayEstimated = hasSubtasks ? subtaskEstimated : currentHours;
              const progressFromHours = displayEstimated > 0
                ? Math.min(100, Math.round((displayActual / displayEstimated) * 100))
                : 0;

              return (
                <div className="space-y-3">
                  {hasSubtasks ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        ชั่วโมงรวมจาก {activeSubtasks.length} งานย่อย
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">ชม.ประมาณ (รวม)</p>
                          <p className="text-lg font-bold tabular-nums text-primary">{subtaskEstimated.toFixed(2)} <span className="text-xs font-normal">ชม.</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">ชม.จริง (รวม)</p>
                          <p className="text-lg font-bold tabular-nums text-green-700">{subtaskActual.toFixed(2)} <span className="text-xs font-normal">ชม.</span></p>
                        </div>
                      </div>
                      {displayEstimated > 0 && (
                        <div className="flex items-center gap-2">
                          <Progress value={progressFromHours} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{progressFromHours}%</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className={cn("text-xs text-muted-foreground flex items-center gap-1", isInvalid && "text-destructive")}>
                          <Clock className="w-3 h-3" />
                          ชม.ประมาณ
                        </Label>
                        <Input type="number" min={0.5} step={0.5} value={localEstimatedHours}
                          className={cn(isInvalid && "border-destructive focus-visible:ring-destructive")}
                          onChange={e => setLocalEstimatedHours(e.target.value)}
                          />
                        {isInvalid
                          ? <p className="text-[9px] text-destructive leading-tight">{`ห้ามเกิน ${maxTaskHours} ชม.`}</p>
                          : <p className="text-[10px] text-muted-foreground mt-1">
                              {isMultiDay
                                ? taskCapacity
                                  ? `${taskCapacity.working_days} วันทำงาน · Capacity ${taskCapacity.total_capacity} ชม. (แก้ไขได้)`
                                  : `${days} วันปฏิทิน (แก้ไขได้)`
                                : `สูงสุด ${maxTaskHours} ชม.`}
                            </p>
                        }
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-green-600" />
                          ชม.จริง
                        </Label>
                        <Input type="number" min={0} max={999} step={0.5} value={localActualHours}
                          onChange={e => setLocalActualHours(e.target.value)}
                          />
                      </div>
                    </div>
                  )}
                  {!hasSubtasks && (displayActual > 0 || displayEstimated > 0) && (
                    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span className="text-muted-foreground text-xs">จริง / ประมาณ:</span>
                      <span className="font-semibold tabular-nums text-green-700">{displayActual.toFixed(2)}</span>
                      <span className="text-muted-foreground text-xs">/</span>
                      <span className="font-semibold tabular-nums text-primary">{displayEstimated.toFixed(2)} ชม.</span>
                      {displayEstimated > 0 && (
                        <span className="ml-auto font-medium text-muted-foreground">{progressFromHours}%</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Capacity warning — leaf tasks only, when assignee is set */}
            {subtasks.filter((s: any) => !s.deleted_at).length === 0 && localAssignee && localStartDate && localEndDate && (
              <CapacityWarning
                assigneeUserId={localAssignee}
                startDate={localStartDate}
                endDate={localEndDate}
                estimatedHours={parseFloat(localEstimatedHours) || 0}
                excludeTaskId={task.id}
              />
            )}
            {/* ผู้สร้าง */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> ผู้สร้าง</Label>
              {isAdmin ? (
                <Select value={localCreatorId || '__none__'} onValueChange={v => {
                  const val = v === '__none__' ? '' : v;
                  setLocalCreatorId(val);
                }}>
                  <SelectTrigger><SelectValue placeholder="ไม่ระบุ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{task?.user_display_name || task?.user_email || '-'}</p>
              )}
            </div>
            {/* โปรเจกต์ */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Flag className="w-3 h-3" /> โปรเจกต์ <span className="text-destructive">*</span></Label>
              {isAdmin ? (
                <ProjectCombobox
                  value={localProjectId || ''}
                  onChange={(id) => setLocalProjectId(id === 'none' ? '' : id)}
                  placeholder="เลือกโปรเจกต์"
                  includeBaseCalendar={true}
                  allowNone={false}
                />
              ) : (
                <p className="text-sm">{task?.project_name || '-'}</p>
              )}
            </div>
            {/* Pause / Resume section */}
            {task.paused_at ? (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                    <Clock className="w-4 h-4" />งานถูกพักชั่วคราว
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                    onClick={handleResumeTask} disabled={updateTask.isPending}>
                    ▶ เริ่มงานใหม่
                  </Button>
                </div>
                {task.pause_reason && <p className="text-xs text-yellow-700 dark:text-yellow-400">{task.pause_reason}</p>}
                <p className="text-[10px] text-muted-foreground">พักวันที่: {safeFmt(task.paused_at, 'd MMM yyyy')}</p>
              </div>
            ) : task.status === 'in-progress' ? (
              !showPauseForm ? (
                <Button variant="outline" size="sm" className="h-8 text-xs w-full border-yellow-400/60 text-yellow-700 hover:bg-yellow-50"
                  onClick={() => setShowPauseForm(true)}>
                  <Clock className="w-3.5 h-3.5 mr-1" />พักงานชั่วคราว
                </Button>
              ) : (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10 p-3 space-y-2">
                  <Label className="text-xs">เหตุผลที่พัก</Label>
                  <Input autoFocus placeholder="เช่น รอรับข้อมูลจากลูกค้า..."
                    value={pauseReason} onChange={e => setPauseReason(e.target.value)}
                    className="text-xs h-8"
                    onKeyDown={e => { if (e.key === 'Enter') handlePauseTask(); if (e.key === 'Escape') setShowPauseForm(false); }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-yellow-500 hover:bg-yellow-600"
                      onClick={handlePauseTask} disabled={!pauseReason.trim() || updateTask.isPending}>พักงาน</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowPauseForm(false); setPauseReason(''); }}>ยกเลิก</Button>
                  </div>
                </div>
              )
            ) : null}

            {/* Delay reason section — shown when deadline was extended */}
            {task.original_end_date && task.end_date > task.original_end_date && (
              <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-orange-400">
                    <AlertCircle className="w-4 h-4" />งานเลื่อนกำหนด
                  </div>
                  {!showDelayReasonForm && (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-orange-400 text-orange-700 hover:bg-orange-100"
                      onClick={() => { setDelayReasonInput(task.delay_reason || ''); setShowDelayReasonForm(true); }}>
                      {task.delay_reason ? 'แก้ไขเหตุผล' : 'ระบุเหตุผล'}
                    </Button>
                  )}
                </div>
                {task.delay_reason && !showDelayReasonForm && (
                  <p className="text-xs text-orange-700 dark:text-orange-400">{task.delay_reason}</p>
                )}
                {showDelayReasonForm && (
                  <div className="space-y-2">
                    <Textarea
                      autoFocus
                      placeholder="เช่น รอ requirement จากลูกค้า, ทรัพยากรติดงานอื่น..."
                      value={delayReasonInput}
                      onChange={e => setDelayReasonInput(e.target.value)}
                      rows={2}
                      className="text-xs resize-none border-orange-300 focus:border-orange-400"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600"
                        onClick={handleSaveDelayReason} disabled={!delayReasonInput.trim() || updateTask.isPending}>บันทึก</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowDelayReasonForm(false); setDelayReasonInput(''); }}>ยกเลิก</Button>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">กำหนดเดิม: {safeFmt(task.original_end_date)} → ใหม่: {safeFmt(task.end_date)}</p>
              </div>
            )}

            {/* ── Save / Cancel / Delete buttons ── */}
            <div className="pt-2 border-t flex gap-2">
              {isAdmin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteTask}
                  disabled={deleteTask.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1"
                size="sm"
                onClick={handleSaveDetails}
                disabled={updateTask.isPending}
              >
                {updateTask.isPending ? (
                  <><span className="animate-spin mr-2">⟳</span>กำลังบันทึก...</>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    บันทึก
                  </>
                )}
              </Button>
            </div>

          </TabsContent>

          {/* SUBTASKS */}
          <TabsContent value="subtasks" className="px-5 pb-6 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">งานย่อย{subtasks.length > 0 && <Badge variant="secondary" className="text-xs">{completedSubtasks}/{subtasks.length}</Badge>}</h3>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { if (!showAddSubtask) { const sd = task.start_date || ''; setNewSubtaskStartDate(sd); setNewSubtaskEndDate(sd); setNewSubtaskEstimatedHours('2'); setNewSubtaskEstimatedHoursTouched(false); setNewSubtaskActualHours('0'); } setShowAddSubtask(!showAddSubtask); }}><Plus className="w-3 h-3 mr-1" />เพิ่มงานย่อย</Button>
            </div>
            {subtasks.length > 0 && <Progress value={subtaskProgress} className="h-1.5" />}
            {showAddSubtask && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">รายละเอียดงานย่อยใหม่</p>
                {/* ชื่องาน */}
                <div className="space-y-1">
                  <Label className="text-xs">ชื่องาน <span className="text-destructive">*</span></Label>
                  <Input autoFocus placeholder="ชื่องานย่อย..." value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)} className="text-sm h-8"
                    onKeyDown={e => { if (e.key === 'Escape') setShowAddSubtask(false); }} />
                </div>
                {/* รายละเอียด */}
                <div className="space-y-1">
                  <Label className="text-xs">รายละเอียด</Label>
                  <Textarea placeholder="รายละเอียดงาน..." value={newSubtaskDescription}
                    onChange={e => setNewSubtaskDescription(e.target.value)}
                    className="text-xs resize-none" rows={2} />
                </div>
                {/* ประเภท + สถานะ */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">ประเภทงาน</Label>
                    <Select value={newSubtaskTaskType} onValueChange={setNewSubtaskTaskType}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeTaskExecutionTypes.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">สถานะ</Label>
                    <Select value={newSubtaskStatus} onValueChange={setNewSubtaskStatus}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">รอดำเนินการ</SelectItem>
                        <SelectItem value="in-progress">กำลังทำ</SelectItem>
                        <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* ผู้รับผิดชอบ + ความสำคัญ */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">ผู้รับผิดชอบ</Label>
                    <UserCombobox
                      value={newSubtaskAssignee}
                      onChange={(id) => setNewSubtaskAssignee(id === 'none' ? '' : id)}
                      placeholder="ไม่ระบุ"
                      allowNone={true}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ความสำคัญ</Label>
                    <Select value={newSubtaskPriority} onValueChange={setNewSubtaskPriority}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">สูง</SelectItem>
                        <SelectItem value="medium">ปานกลาง</SelectItem>
                        <SelectItem value="low">ต่ำ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* วันเริ่ม + วันสิ้นสุด */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">วันเริ่มต้น</Label>
                    <Input type="date" value={newSubtaskStartDate} onChange={e => {
                      const nextStart = e.target.value;
                      setNewSubtaskStartDate(nextStart);
                      if (newSubtaskEndDate && !newSubtaskEstimatedHoursTouched) {
                        if (nextStart === newSubtaskEndDate) {
                          setNewSubtaskEstimatedHours('2');
                        } else if (nextStart < newSubtaskEndDate) {
                          setNewSubtaskEstimatedHours(String(workingHours(nextStart, newSubtaskEndDate)));
                        }
                      }
                    }} className="text-xs h-7" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">วันสิ้นสุด</Label>
                    <Input type="date" value={newSubtaskEndDate} min={newSubtaskStartDate || undefined} onChange={e => {
                      const nextEnd = e.target.value;
                      setNewSubtaskEndDate(nextEnd);
                      if (newSubtaskStartDate && !newSubtaskEstimatedHoursTouched) {
                        if (nextEnd === newSubtaskStartDate) {
                          setNewSubtaskEstimatedHours('2');
                        } else if (nextEnd > newSubtaskStartDate) {
                          setNewSubtaskEstimatedHours(String(workingHours(newSubtaskStartDate, nextEnd)));
                        }
                      }
                    }} className="text-xs h-7" />
                  </div>
                </div>
                {/* ชั่วโมง */}
                {(() => {
                  const isMulti = newSubtaskStartDate && newSubtaskEndDate && newSubtaskStartDate !== newSubtaskEndDate;
                  const days = isMulti ? Math.max(1, Math.round((new Date(newSubtaskEndDate).getTime() - new Date(newSubtaskStartDate).getTime()) / 86400000 + 1)) : 1;
                  const sameDayHrs = parseFloat(newSubtaskEstimatedHours) || 8;
                  const isInv = !isMulti && sameDayHrs > maxTaskHours;
                  
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className={cn("text-xs", isInv && "text-destructive")}>
                          ชม.ประมาณ (ชม.) {isMulti && "(Auto)"}
                        </Label>
                        <Input type="number" min={0.5} max={isMulti ? 1000 : maxTaskHours} step={0.5} placeholder="2.0"
                          className={cn("text-xs h-7", isInv && "border-destructive")}
                          value={newSubtaskEstimatedHours}
                          onChange={e => {
                            setNewSubtaskEstimatedHours(e.target.value);
                            setNewSubtaskEstimatedHoursTouched(true);
                          }} />
                        {isMulti
                          ? <p className="text-[9px] text-muted-foreground leading-tight">แนะนำ: {workingHours(newSubtaskStartDate, newSubtaskEndDate)} ชม. (ข้ามเสาร์-อาทิตย์, แก้ไขได้)</p>
                          : isInv && <p className="text-[9px] text-destructive leading-tight">{`ห้ามเกิน ${maxTaskHours} ชม.`}</p>
                        }
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ชม.จริง (ชม.)</Label>
                        <Input type="number" min={0} step={0.5} placeholder="0.0" value={newSubtaskActualHours} onChange={e => setNewSubtaskActualHours(e.target.value)} className="text-xs h-7" />
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim() || createSubtask.isPending || (!newSubtaskStartDate || !newSubtaskEndDate) || (! (newSubtaskStartDate !== newSubtaskEndDate) && parseFloat(newSubtaskEstimatedHours) > maxTaskHours)}>เพิ่มงานย่อย</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddSubtask(false)}>ยกเลิก</Button>
                </div>
              </div>
            )}
            {subtasksLoading ? <p className="text-xs text-muted-foreground">กำลังโหลด...</p>
            : subtasks.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีงานย่อย</p>
            : (
              <div className="space-y-1.5">
                {subtasks.map((sub) => (
                  <div key={sub.id} className="rounded-lg border overflow-hidden">
                    {editingSubId === sub.id ? (
                      /* ── Inline edit form ── */
                      <div className="p-3 space-y-2 bg-muted/20">
                        <Input autoFocus value={editSubForm.title} onChange={e => setEditSubForm(f => ({ ...f, title: e.target.value }))}
                          className="h-7 text-xs font-medium" placeholder="ชื่องานย่อย *" />
                        <Textarea value={editSubForm.description} onChange={e => setEditSubForm(f => ({ ...f, description: e.target.value }))}
                          className="text-xs resize-none" rows={2} placeholder="รายละเอียด" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">ประเภทงาน</Label>
                            <Select value={editSubForm.task_type} onValueChange={v => setEditSubForm(f => ({ ...f, task_type: v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {activeTaskExecutionTypes.map((opt) => (
                                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">สถานะ</Label>
                            <Select value={editSubForm.status} onValueChange={v => setEditSubForm(f => ({ ...f, status: v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                                <SelectItem value="in-progress">กำลังทำ</SelectItem>
                                <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">ความสำคัญ</Label>
                            <Select value={editSubForm.priority} onValueChange={v => setEditSubForm(f => ({ ...f, priority: v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">สูง</SelectItem>
                                <SelectItem value="medium">ปานกลาง</SelectItem>
                                <SelectItem value="low">ต่ำ</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">ผู้รับผิดชอบ</Label>
                            <UserCombobox
                              value={editSubForm.assignee}
                              onChange={(id) => setEditSubForm(f => ({ ...f, assignee: id === 'none' ? '' : id }))}
                              placeholder="ไม่ระบุ"
                              allowNone={true}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">วันเริ่มต้น</Label>
                            <Input type="date" value={editSubForm.start_date} onChange={e => setEditSubForm(f => ({ ...f, start_date: e.target.value }))} className="h-7 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">วันสิ้นสุด</Label>
                            <Input type="date" value={editSubForm.end_date} min={editSubForm.start_date || undefined} onChange={e => setEditSubForm(f => ({ ...f, end_date: e.target.value }))} className="h-7 text-xs" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">ชม.ประมาณ (ชม.)</Label>
                            <Input type="number" min={0} step={0.5} placeholder="0.0" value={editSubForm.estimated_hours} onChange={e => setEditSubForm(f => ({ ...f, estimated_hours: e.target.value }))} className="h-7 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">ชม.จริง (ชม.)</Label>
                            <Input type="number" min={0} step={0.5} placeholder="0.0" value={editSubForm.actual_hours} onChange={e => setEditSubForm(f => ({ ...f, actual_hours: e.target.value }))} className="h-7 text-xs" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteSubtask(sub)} disabled={deleteSubtask.isPending}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                          <Button size="sm" className="h-7 text-xs flex-1" disabled={!editSubForm.title.trim() || updateTask.isPending}
                            onClick={() => handleSaveEditSub(sub)}>บันทึก</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingSubId(null)}>ยกเลิก</Button>
                        </div>
                      </div>
                    ) : (
                      /* ── Display row ── */
                      <div className="flex items-start gap-2 p-2 hover:bg-muted/40 group transition-colors">
                        <button className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${sub.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-primary'}`}
                          onClick={() => handleToggleSubtask(sub)}>
                          {sub.status === 'completed' && <Check className="w-3 h-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          {editingSubTitleId === sub.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                autoFocus
                                value={editSubTitleValue}
                                onChange={e => setEditSubTitleValue(e.target.value)}
                                className="h-6 text-xs font-medium px-1 py-0"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveSubTitle(sub);
                                  if (e.key === 'Escape') setEditingSubTitleId(null);
                                }}
                              />
                              <button className="p-0.5 hover:bg-muted rounded shrink-0" onClick={() => handleSaveSubTitle(sub)}>
                                <Check className="w-3 h-3 text-green-600" />
                              </button>
                              <button className="p-0.5 hover:bg-muted rounded shrink-0" onClick={() => setEditingSubTitleId(null)}>
                                <X className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </div>
                          ) : (
                            <p
                              className={cn(
                                "text-xs font-medium truncate cursor-pointer hover:text-primary transition-colors",
                                sub.status === 'completed' && 'line-through text-muted-foreground'
                              )}
                              title="คลิกเพื่อแก้ไขชื่อ"
                              onClick={() => { setEditingSubTitleId(sub.id); setEditSubTitleValue(sub.title); }}
                            >
                              {sub.title}
                            </p>
                          )}
                          {sub.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{sub.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {sub.task_type && sub.task_type !== 'task' && <span className="text-[10px] bg-muted px-1.5 rounded">{sub.task_type}</span>}
                            {sub.assignee && <span className="text-[10px] text-muted-foreground">{sub.assignee}</span>}
                            {sub.end_date && <span className="text-[10px] text-muted-foreground">{safeFmt(sub.end_date)}</span>}
                            {(sub.estimated_hours > 0 || sub.actual_hours > 0) && (
                              <span className="text-[10px] text-muted-foreground">
                                ชม.ประมาณ {Number(sub.estimated_hours || 0).toFixed(2)} / ชม.จริง {Number(sub.actual_hours || 0).toFixed(2)}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0 rounded-full ${sub.priority === 'high' ? 'bg-red-100 text-red-700' : sub.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                              {getPriorityLabel(sub.priority)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                          <button className="p-1 hover:bg-muted rounded" onClick={() => openEditSub(sub)} title="แก้ไขทั้งหมด">
                            <Pencil className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </button>
                          {isAdmin && (
                            <button className="p-1 hover:bg-destructive/10 rounded" onClick={() => handleDeleteSubtask(sub)} title="ลบ">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DEPENDENCIES */}
          <TabsContent value="dependencies" className="px-5 pb-6 pt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-orange-500" />ถูกบล็อกโดย{blockedByDeps.filter((d) => !d.resolved_at).length > 0 && <Badge variant="destructive" className="text-[10px] px-1.5">{blockedByDeps.filter((d) => !d.resolved_at).length}</Badge>}</h4>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddDep(!showAddDep)}><Plus className="w-3 h-3 mr-1" />เพิ่ม</Button>
              </div>
              {showAddDep && (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30 mb-3">
                  <div className="space-y-1"><Label className="text-xs">งานที่บล็อกงานนี้</Label>
                    <Select value={depBlockingTaskId} onValueChange={setDepBlockingTaskId}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="เลือกงาน..." /></SelectTrigger>
                      <SelectContent>{availableTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-xs">ประเภท</Label>
                      <Select value={depReasonCode} onValueChange={(v: any) => setDepReasonCode(v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="depends_on">depends on</SelectItem><SelectItem value="blocks">blocks</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={handleAddDependency} disabled={!depBlockingTaskId || createDependency.isPending}>บันทึก</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddDep(false)}>ยกเลิก</Button>
                  </div>
                </div>
              )}
              {blockedByDeps.length === 0 ? <p className="text-xs text-muted-foreground py-2 text-center">ไม่มี dependency</p> : (
                <div className="space-y-1.5">
                  {blockedByDeps.map((dep) => (
                    <div key={dep.id} className={`flex items-center gap-2 p-2 rounded-lg border ${dep.resolved_at ? 'opacity-50 bg-muted/20' : 'bg-orange-50 border-orange-200 dark:bg-orange-950/20'}`}>
                      <LinkIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${dep.resolved_at ? 'line-through' : ''}`}>{dep.depends_on_title || dep.depends_on_task_id}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1">{dep.dependency_type || 'depends_on'}</Badge>
                          {dep.resolved_at && <span className="text-[10px] text-green-600">แก้ไขแล้ว</span>}
                        </div>
                      </div>
                      {!dep.resolved_at && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-green-600 shrink-0" onClick={() => handleResolveDep(dep.id)}>แก้ไข</Button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><ArrowRight className="w-4 h-4 text-blue-500" />กำลังบล็อก</h4>
              {blockingDeps.length === 0 ? <p className="text-xs text-muted-foreground py-2 text-center">ไม่ได้บล็อกงานอื่น</p> : (
                <div className="space-y-1.5">
                  {blockingDeps.map((dep) => (
                    <div key={dep.id} className={`flex items-center gap-2 p-2 rounded-lg border ${dep.resolved_at ? 'opacity-50' : 'bg-blue-50 border-blue-200 dark:bg-blue-950/20'}`}>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{dep.task_title || dep.task_id}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1">{dep.dependency_type || 'depends_on'}</Badge>
                          {dep.resolved_at && <span className="text-[10px] text-green-600">แก้ไขแล้ว</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="px-5 pb-6 pt-4">
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><History className="w-4 h-4 text-muted-foreground" />ประวัติการเปลี่ยนแปลง</h4>
            {history.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีประวัติ</p> : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex gap-2 text-xs">
                    <div className="w-1 shrink-0 bg-border rounded-full mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{h.changed_by_name || 'ผู้ใช้'}</span>
                        <Badge variant="outline" className="text-[10px] px-1">{h.action}</Badge>
                        {h.field_name && <span className="text-muted-foreground">เปลี่ยน {h.field_name}</span>}
                      </div>
                      {h.old_value && h.new_value && (
                        <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                          <span className="line-through">{h.old_value}</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                          <span className="text-foreground font-medium">{h.new_value}</span>
                        </div>
                      )}
                      {h.reason && <p className="text-muted-foreground mt-0.5 italic">{h.reason}</p>}
                      <p className="text-muted-foreground/60 mt-0.5">{safeFmt(h.created_at, 'd MMM yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* RECURRING */}
          <TabsContent value="recurring" className="px-5 pb-6 pt-4 space-y-4">
            {recurringTemplate?.id && !showRecurringForm ? (
              <div className="border rounded-lg p-4 space-y-3 bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary" /><span className="text-sm font-semibold">การทำซ้ำที่ตั้งค่าไว้</span></div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowRecurringForm(true); const rt = recurringTemplate; setRecurFrequency(rt.frequency); setRecurInterval(rt.interval_count || 1); setRecurEndDate(rt.recur_end_date || ''); setRecurMaxOccurrences(rt.max_occurrences || ''); }}>แก้ไข</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleDeleteRecurring}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-muted-foreground">ความถี่</p><p className="font-medium mt-0.5">{{ daily: 'ทุกวัน', weekly: 'ทุกสัปดาห์', monthly: 'ทุกเดือน', quarterly: 'ทุกไตรมาส', yearly: 'ทุกปี' }[recurringTemplate.frequency] || recurringTemplate.frequency} (ทุก {recurringTemplate.interval_count} รอบ)</p></div>
                  {recurringTemplate.next_occurrence && <div><p className="text-muted-foreground">ครั้งถัดไป</p><p className="font-medium mt-0.5">{safeFmt(recurringTemplate.next_occurrence)}</p></div>}
                  {recurringTemplate.recur_end_date && <div><p className="text-muted-foreground">สิ้นสุดวันที่</p><p className="font-medium mt-0.5">{safeFmt(recurringTemplate.recur_end_date)}</p></div>}
                  <div><p className="text-muted-foreground">สร้างไปแล้ว</p><p className="font-medium mt-0.5">{recurringTemplate.instance_count || 0} ครั้ง</p></div>
                </div>
              </div>
            ) : !showRecurringForm ? (
              <div className="text-center py-6 space-y-3">
                <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">ยังไม่ได้ตั้งค่าการทำซ้ำ</p>
                <Button size="sm" onClick={() => setShowRecurringForm(true)}><Plus className="w-4 h-4 mr-1" />ตั้งค่าการทำซ้ำ</Button>
              </div>
            ) : null}
            {showRecurringForm && (
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold">{recurringTemplate?.id ? 'แก้ไขการทำซ้ำ' : 'ตั้งค่าการทำซ้ำ'}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">ความถี่</Label>
                    <Select value={recurFrequency} onValueChange={(v: any) => setRecurFrequency(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="daily">ทุกวัน</SelectItem><SelectItem value="weekly">ทุกสัปดาห์</SelectItem><SelectItem value="monthly">ทุกเดือน</SelectItem><SelectItem value="quarterly">ทุกไตรมาส</SelectItem><SelectItem value="yearly">ทุกปี</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">ทุก N รอบ</Label><Input type="number" min={1} value={recurInterval} onChange={e => setRecurInterval(Number(e.target.value))} className="h-8 text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">วันสิ้นสุดการทำซ้ำ</Label><Input type="date" value={recurEndDate} onChange={e => setRecurEndDate(e.target.value)} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">จำนวนครั้งสูงสุด</Label><Input type="number" min={1} placeholder="ไม่จำกัด" value={recurMaxOccurrences} onChange={e => setRecurMaxOccurrences(e.target.value === '' ? '' : Number(e.target.value))} className="h-8 text-xs" /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8" onClick={handleSaveRecurring} disabled={createRecurring.isPending || updateRecurring.isPending}>บันทึก</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setShowRecurringForm(false)}>ยกเลิก</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>

      {/* Promote to main task dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="w-4 h-4 text-blue-600" />
              ย้ายเป็นงานหลัก
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              ย้าย <strong className="text-foreground">{task?.title}</strong> ออกจากงานย่อย เป็นงานหลักในโปรเจกต์ที่เลือก
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">โปรเจกต์ปลายทาง</Label>
              <ProjectCombobox
                value={promoteProjectId}
                onChange={setPromoteProjectId}
                placeholder="เลือกโปรเจกต์"
                allowNone={false}
                includeBaseCalendar={true}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPromoteOpen(false)}>ยกเลิก</Button>
            <Button size="sm" disabled={!promoteProjectId || updateTask.isPending} onClick={handlePromoteToMain}>
              {updateTask.isPending ? 'กำลังย้าย...' : 'ย้ายเป็นงานหลัก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
