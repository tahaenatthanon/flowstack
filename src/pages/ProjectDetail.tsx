import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useTasks, useUpdateProject, useCreateSubtask, useUpdateTask, useProjectDependencies, useUsers, useProjects, useDeleteTask } from '@/hooks/useProjectData';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import type { DbTask } from '@/types/project';
import { calculateProjectReport, getStatusLabel, getProjectStatusColor, getPriorityLabel } from '@/lib/projectUtils';
import StatCards from '@/components/StatCards';
import TaskList from '@/components/TaskList';
import ProgressBar from '@/components/ProgressBar';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import AITaskGeneratorDialog from '@/components/AITaskGeneratorDialog';
import EditProjectDialog from '@/components/EditProjectDialog';
import TaskRowActions from '@/components/TaskRowActions';
import TaskGanttChart from '@/components/TaskGanttChart';
import TaskSpreadsheet from '@/components/TaskSpreadsheet';
import TaskCalendarView from '@/components/TaskCalendarView';
import TaskDetailSheet from '@/components/TaskDetailSheet';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, AlertCircle, Zap, Clock, CalendarPlus, Edit, TrendingDown, TrendingUp, LayoutGrid, List, GanttChart, Table2, ChevronDown, ChevronRight, CalendarDays, Search, Pencil, Plus, Trash2, ArrowUpFromLine, FolderKanban, Filter, ArrowLeft } from 'lucide-react';
import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
import { format, isValid, isBefore, parseISO, eachDayOfInterval } from 'date-fns';
import { th } from 'date-fns/locale';
import { safeFmt } from '@/lib/dateUtils';
import KanbanBoard from '@/components/KanbanBoard';
import CreateSubtaskDialog from '@/components/CreateSubtaskDialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { PRIORITY_LABELS } from '@/lib/labels';
import { DbProject } from '@/types/project';
import { TASK_TYPE_CONFIG, getTaskTypeCfg } from '@/lib/taskTypes';

type ViewMode = 'list' | 'kanban' | 'gantt' | 'calendar' | 'spreadsheet';
const TASK_STATUS_COLORS: Record<string, string> = {
  pending:      'bg-slate-100 text-slate-700',
  'in-progress':'bg-blue-100 text-blue-700',
  completed:    'bg-green-100 text-green-700',
  overdue:      'bg-red-100 text-red-700',
};
const TASK_PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-slate-100 text-slate-600',
};

function isTaskOverdue(t: any) {
  if (t.status === 'completed') return false;
  const end = t.end_date ? parseISO(t.end_date) : null;
  return end && isValid(end) && isBefore(end, new Date());
}

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading: pLoading } = useProject(id || '') as { data: DbProject | undefined; isLoading: boolean };
  const { data: tasks = [], isLoading: tLoading } = useTasks(id || '') as { data: DbTask[]; isLoading: boolean };
  const updateProject = useUpdateProject();
  const createSubtask = useCreateSubtask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: allProjects = [] } = useProjects();
  const { data: projectDeps = [] } = useProjectDependencies(id || '');
  const { data: users = [] } = useUsers();
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [extendOpen, setExtendOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newEndDate, setNewEndDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [createTaskExternalOpen, setCreateTaskExternalOpen] = useState(false);
  const [createSubtaskOpen, setCreateSubtaskOpen] = useState(false);
  const [selectedParentTask, setSelectedParentTask] = useState<DbTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<DbTask | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [promoteTask, setPromoteTask] = useState<DbTask | null>(null);
  const [promoteProjectId, setPromoteProjectId] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((task: DbTask) =>
        task.title?.toLowerCase().includes(search) ||
        task.description?.toLowerCase().includes(search) ||
        task.assignee?.toLowerCase().includes(search) ||
        task.status?.toLowerCase().includes(search) ||
        task.priority?.toLowerCase().includes(search)
      );
    }
    if (activeTab === 'mine' && user) {
      result = result.filter((task: DbTask) =>
        task.assignee_user_id === user.id || task.assigned_to === user.id
      );
    }
    return result;
  }, [tasks, searchTerm, activeTab, user]);

  useEffect(() => {
    if (!project) return;
    setNewEndDate(project.end_date || '');
    setExtensionReason(project.extension_reason || '');
  }, [project]);

  const handlePromoteSingleAndDeleteParent = async (parentTask: DbTask, childTask: DbTask) => {
    if (!await confirm({
      title: 'แทนที่ด้วยงานย่อย',
      description: `ย้าย "${childTask.title}" ขึ้นเป็นงานหลัก และลบ "${parentTask.title}"?`,
      variant: 'destructive',
    })) return;
    try {
      const targetProjectId = childTask.project_id || parentTask.project_id;
      await updateTask.mutateAsync({
        id: childTask.id,
        parent_task_id: null,
        is_subtask: 0,
        project_id: targetProjectId,
      });
      await deleteTask.mutateAsync({ id: parentTask.id, projectId: parentTask.project_id });
      toast({ title: 'แทนที่งานหลักด้วยงานย่อยสำเร็จ' });
      setExpandedTasks(prev => { const next = new Set(prev); next.delete(parentTask.id); return next; });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkStatus && !bulkPriority) return;
    setIsBulkSaving(true);
    try {
      const fields: any = {};
      if (bulkStatus) fields.status = bulkStatus;
      if (bulkPriority) fields.priority = bulkPriority;
      await Promise.all([...selectedTaskIds].map(id => {
        const task = tasks.find((t: DbTask) => t.id === id);
        return updateTask.mutateAsync({
          id,
          project_id: task?.project_id ?? project?.id ?? '',
          ...fields,
        });
      }));
      toast({ title: `อัปเดต ${selectedTaskIds.size} งานสำเร็จ` });
      setSelectedTaskIds(new Set());
      setBulkStatus('');
      setBulkPriority('');
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkReplace = async () => {
    // Build child map from all loaded tasks
    const childrenByParent = new Map<string, DbTask[]>();
    tasks.forEach((t: DbTask) => {
      const pid = t.parent_task_id;
      if (pid) {
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid)!.push(t);
      }
    });

    // Find selected tasks that qualify (exactly 1 child)
    const eligible: { parent: DbTask; child: DbTask }[] = [];
    const skipped: string[] = [];
    for (const id of selectedTaskIds) {
      const parent = tasks.find((t: DbTask) => t.id === id);
      if (!parent) { skipped.push(id); continue; }
      const children = childrenByParent.get(id) || [];
      if (children.length === 1) {
        eligible.push({ parent, child: children[0] });
      } else if (Number(parent.subtask_count ?? 0) === 1) {
        // subtask not in local cache — fetch on demand
        try {
          const fetched = await apiFetch<DbTask[]>(`/tasks.php?parent_id=${id}`);
          if (fetched && fetched.length === 1) {
            eligible.push({ parent, child: fetched[0] });
          } else {
            skipped.push(parent.title || id);
          }
        } catch {
          skipped.push(parent.title || id);
        }
      } else {
        skipped.push(parent.title || id);
      }
    }

    if (eligible.length === 0) {
      toast({ title: 'ไม่มีงานที่เข้าเงื่อนไข', description: 'ต้องเลือกงานที่มีงานย่อย 1 รายการเท่านั้น', variant: 'destructive' });
      return;
    }

    const names = eligible.map(e => `"${e.child.title}" แทนที่ "${e.parent.title}"`).join('\n');
    if (!await confirm({
      title: `แทนที่งานหลัก ${eligible.length} รายการ`,
      description: `${names}${skipped.length ? `\n\nข้าม ${skipped.length} รายการ (ไม่มีงานย่อย 1 รายการ)` : ''}`,
      variant: 'destructive',
      confirmLabel: 'แทนที่',
    })) return;

    setIsBulkSaving(true);
    try {
      let done = 0;
      for (const { parent, child } of eligible) {
        const targetProjectId = child.project_id || parent.project_id;
        await updateTask.mutateAsync({
          id: child.id,
          parent_task_id: null,
          is_subtask: 0,
          project_id: targetProjectId,
        });
        await deleteTask.mutateAsync({ id: parent.id, projectId: parent.project_id });
        done++;
      }
      toast({ title: `แทนที่ ${done} งานสำเร็จ` + (skipped.length ? ` (ข้าม ${skipped.length})` : '') });
      setSelectedTaskIds(new Set());
      setExpandedTasks(prev => { const next = new Set(prev); eligible.forEach(e => next.delete(e.parent.id)); return next; });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!await confirm({
      title: 'ลบงานที่เลือก',
      description: `ต้องการลบ ${selectedTaskIds.size} งานที่เลือกใช่หรือไม่? การดำเนินการนี้ไม่สามารถเรียกคืนได้`,
      variant: 'destructive',
    })) return;
    try {
      await Promise.all([...selectedTaskIds].map(id => {
        const task = tasks.find((t: DbTask) => t.id === id);
        return deleteTask.mutateAsync({ id, projectId: task?.project_id ?? '' });
      }));
      toast({ title: `ลบ ${selectedTaskIds.size} งานสำเร็จ` });
      setSelectedTaskIds(new Set());
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  if (pLoading || tLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">ไม่พบ Project</p>
      </div>
    );
  }

  const report = calculateProjectReport(project, tasks);

  const handleExtendSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project) return;
    if (!extensionReason.trim()) {
      toast({ title: 'กรุณาระบุเหตุผล', description: 'จำเป็นต้องระบุเหตุผลในการขยายเวลา', variant: 'destructive' });
      return;
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        end_date: newEndDate,
        original_end_date: project.original_end_date ?? project.end_date,
        extension_reason: extensionReason.trim(),
      });
      toast({ title: 'ขยายเวลาโครงการสำเร็จ' });
      setExtendOpen(false);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button variant="ghost" size="icon" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/projects')} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-heading truncate">
                {project.name}
              </h1>
              <span className={`status-badge shrink-0 ${getProjectStatusColor(project.status)}`}>
                {getStatusLabel(project.status)}
              </span>
              {project.kind === 'base_calendar' && (
                <span className="shrink-0 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  ปฏิทินทีม — ระบบกลาง
                </span>
              )}
            </div>
            {/* Date meta */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{safeFmt(project.start_date)} – {safeFmt(project.end_date)}</span>
              </span>
              {report.extensionDays > 0 && (
                <span className="flex items-center gap-1 text-warning font-medium" title={project.extension_reason || undefined}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  ขยายเวลา +{report.extensionDays} วัน
                  {project.extension_reason && (
                    <span className="font-normal text-muted-foreground">— {project.extension_reason}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 sm:mt-0">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="text-xs sm:text-sm px-2 sm:px-3">
              <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />แก้ไข
            </Button>
            {project.kind !== 'base_calendar' && (
              <Button variant="outline" size="sm" onClick={() => setExtendOpen(true)} className="text-xs sm:text-sm px-2 sm:px-3">
                <CalendarPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />ขยายเวลา
              </Button>
            )}
            <CreateTaskDialog projectId={project.id} />
            <AITaskGeneratorDialog projectId={project.id} projectDescription={project.description} />
          </div>
        </div>
      </div>

      {/* Workflow card */}
      <WorkflowInstanceCard entityType="project" entityId={project.id} />

      {/* Description + Progress */}
      <div className="bg-card rounded-xl border p-4 sm:p-6 space-y-4">
        {/* Description */}
        {project.description ? (
          <div className="rounded-lg bg-muted/40 border border-border/50 px-4 py-3 overflow-y-auto" style={{ maxHeight: '10lh' }}>
            <p className="text-sm sm:text-base text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
              {project.description}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">ไม่มีคำอธิบาย</p>
        )}

        {/* Progress bar — hide for Base Calendar */}
        {project.kind !== 'base_calendar' && (
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
              <span>ความคืบหน้า</span>
              <span className="font-medium text-foreground">{report.completionPercentage}%</span>
            </div>
            <ProgressBar percentage={report.completionPercentage} size="lg" />
          </div>
        )}
      </div>

      {/* Stats — hide for Base Calendar */}
      {project.kind !== 'base_calendar' && (
        <div>
          <StatCards report={report} />
        </div>
      )}

      {/* Burndown Chart — hide for Base Calendar */}
      {project.kind !== 'base_calendar' && tasks.length > 0 && (
        <div className="bg-card rounded-xl border p-4 sm:p-5">
          <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-purple-500" />
            Burndown Chart
          </h3>
          {(() => {
            const startDate = project?.start_date ? parseISO(project.start_date) : null;
            const endDate = project?.end_date ? parseISO(project.end_date) : null;
            
            if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
              return <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูลวันที่เริ่ม-สิ้นสุดโปรเจกต์</p>;
            }
            
            const days = eachDayOfInterval({ start: startDate, end: endDate });
            const totalTasks = tasks.length;
            
            // Calculate remaining tasks for each day
            const burndownData = days.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              // Count tasks completed by this day
              const completedByDay = tasks.filter((t: any) => 
                t.status === 'completed' && t.completed_at && t.completed_at <= dayStr
              ).length;
              const remaining = totalTasks - completedByDay;
              // Ideal burndown line
              const idealRemaining = Math.round(totalTasks - (totalTasks / days.length) * (idx + 1));
              
              return {
                date: format(day, 'd MMM'),
                remaining,
                ideal: Math.max(0, idealRemaining),
              };
            });
            
            const today = format(new Date(), 'yyyy-MM-dd');
            const todayData = burndownData.find(d => d.date === format(new Date(), 'd MMM'));
            const isAhead = todayData && todayData.remaining <= todayData.ideal;
            
            return (
              <div>
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    งานคงเหลือจริง
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/50"></div>
                    เส้นอุดมคติ
                  </span>
                  <span className={`ml-auto flex items-center gap-1 ${isAhead ? 'text-green-600' : 'text-red-600'}`}>
                    {isAhead ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    {isAhead ? 'นำหน้า' : 'ตามหลัง'}ตาราง
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={burndownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.max(1, Math.floor(burndownData.length / 10))} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="ideal" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} dot={false} name="เส้นอุดมคติ" />
                    <Line type="monotone" dataKey="remaining" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 3 }} name="งานคงเหลือ" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}

      {/* Ad-hoc tasks banner */}
      {report.adHocTasks.length > 0 && (
        <div className="p-4 rounded-xl border border-warning/30 bg-warning/5">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-warning" />
            งานแทรก ({report.adHocTasks.length} รายการ)
          </h4>
          <div className="flex flex-wrap gap-2">
            {report.adHocTasks.map(t => (
              <span key={t.id} className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
                {t.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="bg-card rounded-xl border">
        <div className="flex items-center justify-between p-4 border-b flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tab buttons */}
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => { setActiveTab('all'); setSelectedTaskIds(new Set()); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                งานทั้งหมด ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('mine'); setSelectedTaskIds(new Set()); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'mine' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                งานของฉัน ({tasks.filter((t: DbTask) => user && (t.assignee_user_id === user.id || t.assigned_to === user.id)).length})
              </button>
            </div>
            {selectedTaskIds.size > 0 && (
              <span className="text-xs bg-primary/10 text-primary font-medium px-2.5 py-1 rounded-full">
                เลือก {selectedTaskIds.size} รายการ
              </span>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ค้นหางาน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const rootIds = filteredTasks.filter((t: DbTask) => !t.parent_task_id).map((t: DbTask) => t.id);
              if (rootIds.length > 0 && rootIds.every(id => selectedTaskIds.has(id))) {
                setSelectedTaskIds(new Set());
              } else {
                setSelectedTaskIds(new Set(rootIds));
              }
            }}>
              {selectedTaskIds.size > 0 ? 'ยกเลิกเลือก' : 'เลือกทั้งหมด'}
            </Button>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" /> <span className="hidden sm:inline">รายการ</span>
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" /> <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button variant={viewMode === 'gantt' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('gantt')} className="text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              <GanttChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" /> <span className="hidden sm:inline">Gantt</span>
            </Button>
            <Button variant={viewMode === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" /> <span className="hidden sm:inline">ปฏิทิน</span>
            </Button>
            <Button variant={viewMode === 'spreadsheet' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('spreadsheet')} className="text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              <Table2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" /> <span className="hidden sm:inline">Spreadsheet</span>
            </Button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedTaskIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-primary/5 border-b border-primary/20 overflow-x-auto">
            <span className="text-sm font-medium text-primary shrink-0">เลือก {selectedTaskIds.size} งาน</span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="เปลี่ยนสถานะ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="in-progress">กำลังดำเนินการ</SelectItem>
                <SelectItem value="completed">เสร็จแล้ว</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bulkPriority} onValueChange={setBulkPriority}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="ความสำคัญ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">ต่ำ</SelectItem>
                <SelectItem value="medium">กลาง</SelectItem>
                <SelectItem value="high">สูง</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs" disabled={isBulkSaving || (!bulkStatus && !bulkPriority)} onClick={handleBulkUpdate}>
              {isBulkSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
            <Button size="sm" variant="default" className="h-8 text-xs bg-amber-600 hover:bg-amber-700" disabled={isBulkSaving} onClick={handleBulkReplace}>
              <ArrowUpFromLine className="h-3 w-3 mr-1" />
              แทนที่ ({selectedTaskIds.size})
            </Button>
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleBulkDelete}>
              ลบ ({selectedTaskIds.size})
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSelectedTaskIds(new Set()); setBulkStatus(''); setBulkPriority(''); }}>
              ยกเลิก
            </Button>
          </div>
        )}

        <div className="p-4">
          {viewMode === 'kanban' && (
            <KanbanBoard
              tasks={filteredTasks}
              projectId={project.id}
              showSubtasks={true}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setTaskDetailOpen(true);
              }}
              onAddTask={(status) => {
                // Open create task dialog with pre-selected status (future enhancement)
                document.querySelector<HTMLButtonElement>('[data-create-task-btn]')?.click();
              }}
              onMoveTask={async (taskId, newStatus) => {
                const task = tasks.find((t: DbTask) => t.id === taskId);
                if (!task) return;
                try {
                  await updateTask.mutateAsync({
                    id: taskId,
                    project_id: project.id,
                    status: newStatus,
                    ...(newStatus === 'completed' ? { completed_date: new Date().toISOString().split('T')[0] } : (newStatus === 'cancelled' ? { completed_date: null } : {})),
                  });
                  toast({ title: `ย้ายงานเป็น "${newStatus === 'pending' ? 'รอดำเนินการ' : newStatus === 'in-progress' ? 'กำลังดำเนินการ' : newStatus === 'completed' ? 'เสร็จแล้ว' : newStatus === 'cancelled' ? 'ยกเลิก' : 'เกินกำหนด'}" สำเร็จ` });
                } catch (err: any) {
                  toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
                }
              }}
            />
          )}

          {viewMode === 'gantt' && (
            <TaskGanttChart
              tasks={filteredTasks}
              dependencies={projectDeps}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setTaskDetailOpen(true);
              }}
            />
          )}

          {viewMode === 'calendar' && (
            <>
              <CreateTaskDialog
                projectId={project.id}
                externalOpen={createTaskExternalOpen}
                onExternalOpenChange={setCreateTaskExternalOpen}
              />
              <TaskCalendarView
                projectId={project.id}
                onCreateTask={() => setCreateTaskExternalOpen(true)}
              />
            </>
          )}

          {viewMode === 'spreadsheet' && (
            <TaskSpreadsheet
              tasks={filteredTasks}
              projectId={project.id}
              onAddSubtask={(task) => {
                setSelectedParentTask(task);
                setCreateSubtaskOpen(true);
              }}
              onEditTask={(task) => {
                setSelectedTask(task);
                setTaskDetailOpen(true);
              }}
            />
          )}

          {viewMode === 'list' && (() => {
            const rootTasks = filteredTasks.filter((t: DbTask) => !t.parent_task_id);
            const subtasksByParent = new Map<string, DbTask[]>();
            tasks.forEach((t: DbTask) => {
              const pid = t.parent_task_id;
              if (pid) {
                if (!subtasksByParent.has(pid)) subtasksByParent.set(pid, []);
                subtasksByParent.get(pid)!.push(t);
              }
            });

            const toggleExpand = (taskId: string) => {
              setExpandedTasks(prev => {
                const next = new Set(prev);
                if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
                return next;
              });
            };

            if (rootTasks.length === 0) {
              return <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีงาน — กดปุ่ม "เพิ่มงาน" เพื่อเริ่มต้น</p>;
            }

            return (
              <div className="rounded-lg border divide-y">
                {/* Column headers */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <span className="w-4 shrink-0" />
                  <span className="w-4 shrink-0" />
                  <span className="w-4 shrink-0" />
                  <span className="flex-1 min-w-0">ชื่องาน</span>
                  <span className="w-24 shrink-0 text-right hidden sm:block">ชั่วโมง</span>
                  <span className="w-[120px] shrink-0 hidden md:block" />
                </div>
                {rootTasks.map((task: any) => {
                  const tc = getTaskTypeCfg(task.task_type);
                  const overdue = isTaskOverdue(task);
                  const childTasks = subtasksByParent.get(task.id) || [];
                  const hasSubtasks = childTasks.length > 0 || task.subtask_count > 0;
                  const isExpanded = expandedTasks.has(task.id);
                  const displayActual = hasSubtasks
                    ? Number(task.subtask_actual_hours ?? 0)
                    : Number(task.actual_hours ?? 0);
                  const displayEstimated = hasSubtasks
                    ? Number(task.subtask_estimated_hours ?? 0)
                    : Number(task.estimated_hours ?? 0);
                  return (
                    <div key={task.id}>
                      {/* Root task row */}
                      <div className={`group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${overdue && task.status !== 'completed' ? 'bg-destructive/5' : ''} ${task.status === 'completed' ? 'opacity-55' : ''}`}>
                        <input type="checkbox" checked={selectedTaskIds.has(task.id)}
                          onChange={() => {
                            setSelectedTaskIds(prev => {
                              const next = new Set(prev);
                              if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                              return next;
                            });
                          }}
                          className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                        {hasSubtasks ? (
                          <button type="button" onClick={() => toggleExpand(task.id)}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            title={isExpanded ? 'ซ่อนงานย่อย' : `แสดง ${childTasks.length || task.subtask_count} งานย่อย`}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button type="button" onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}
                              className={`text-sm font-medium text-left hover:underline truncate ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </button>
                            {task.is_ad_hoc ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Ad-hoc</span> : null}
                            {hasSubtasks && <span className="text-[10px] text-primary/80">{childTasks.length || task.subtask_count} งานย่อย</span>}
                            <span className="text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>{tc.label}</span>
                            <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_STATUS_COLORS[overdue && task.status !== 'completed' ? 'overdue' : task.status] || 'bg-muted text-muted-foreground'}`}>
                              {overdue && task.status !== 'completed' ? 'เกินกำหนด' : getStatusLabel(task.status)}
                            </span>
                            <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_PRIORITY_COLORS[task.priority] || 'bg-muted text-muted-foreground'}`}>{PRIORITY_LABELS[task.priority] || '-'}</span>
                          </div>
                          <p className={`text-xs mt-0.5 truncate ${overdue && task.status !== 'completed' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {[task.assignee || null, safeFmt(task.start_date, 'd MMM') !== '-' ? `${safeFmt(task.start_date, 'd MMM')} - ${safeFmt(task.end_date, 'd MMM yyyy')}` : null, overdue && task.status !== 'completed' ? 'เกินกำหนด' : null].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {(displayActual > 0 || displayEstimated > 0) && (
                          <div className="text-right shrink-0">
                            <span className="text-sm font-semibold tabular-nums text-green-700">{displayActual.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground"> / </span>
                            <span className="text-sm font-semibold tabular-nums text-primary">{displayEstimated.toFixed(1)} ชม.</span>
                            {hasSubtasks && <p className="text-[10px] text-muted-foreground">รวม subtask</p>}
                          </div>
                        )}
                        {(childTasks.length === 1 || Number(task.subtask_count ?? 0) === 1) && (
                          <button type="button" title="แทนที่ด้วยงานย่อย (1 รายการ)" onClick={async () => {
                            if (childTasks.length === 1) {
                              handlePromoteSingleAndDeleteParent(task, childTasks[0]);
                            } else {
                              // subtask not in local cache — fetch on demand
                              try {
                                const children = await apiFetch<DbTask[]>(`/tasks.php?parent_id=${task.id}`);
                                if (children && children.length === 1) {
                                  handlePromoteSingleAndDeleteParent(task, children[0]);
                                } else {
                                  toast({ title: 'ไม่พบงานย่อย', description: 'ต้องมีงานย่อยเพียง 1 รายการ', variant: 'destructive' });
                                }
                              } catch (err: any) {
                                toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
                              }
                            }
                          }}
                            className="h-7 px-2 flex items-center gap-1 rounded text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 transition-colors shrink-0">
                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                            แทนที่
                          </button>
                        )}
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                          <button type="button" title="เพิ่มงานย่อย" onClick={() => { setSelectedParentTask(task); setCreateSubtaskOpen(true); }}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" title="แก้ไข" onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" title="ลบ" onClick={async () => {
                            if (!await confirm({ title: 'ลบงาน', description: `ลบงาน "${task.title}"?`, variant: 'destructive' })) return;
                            try { await deleteTask.mutateAsync({ id: task.id, projectId: task.project_id }); toast({ title: 'ลบงานแล้ว' }); }
                            catch (err: any) { toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' }); }
                          }}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded subtask rows */}
                      {isExpanded && childTasks.map((sub: any) => {
                        const sc = getTaskTypeCfg(sub.task_type);
                        const subOverdue = isTaskOverdue(sub);
                        return (
                          <div key={`sub-${sub.id}`}
                            className={`group flex items-center gap-3 px-4 py-2.5 bg-muted/10 hover:bg-muted/25 transition-colors border-t border-border/50 ${subOverdue && sub.status !== 'completed' ? 'bg-destructive/5' : ''} ${sub.status === 'completed' ? 'opacity-55' : ''}`}>
                            <span className="text-muted-foreground/50 text-xs shrink-0 pl-6">↳</span>
                            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button type="button" onClick={() => { setSelectedTask(sub); setTaskDetailOpen(true); }}
                                  className={`text-xs font-medium text-left hover:underline truncate ${sub.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                  {sub.title}
                                </button>
                                {sub.is_ad_hoc ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Ad-hoc</span> : null}
                                <span className="text-[11px] rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                                <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${TASK_STATUS_COLORS[subOverdue && sub.status !== 'completed' ? 'overdue' : sub.status] || 'bg-muted text-muted-foreground'}`}>
                                  {subOverdue && sub.status !== 'completed' ? 'เกินกำหนด' : getStatusLabel(sub.status)}
                                </span>
                              </div>
                              <p className={`text-xs mt-0.5 truncate ${subOverdue && sub.status !== 'completed' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                {[sub.assignee || null, safeFmt(sub.end_date) !== '-' ? safeFmt(sub.end_date) : null, subOverdue && sub.status !== 'completed' ? 'เกินกำหนด' : null].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            {(sub.actual_hours > 0 || sub.estimated_hours > 0) && (
                              <div className="text-right shrink-0">
                                <span className="text-xs font-semibold tabular-nums text-green-700">{Number(sub.actual_hours || 0).toFixed(1)}</span>
                                <span className="text-[10px] text-muted-foreground"> / </span>
                                <span className="text-xs font-semibold tabular-nums text-primary">{Number(sub.estimated_hours || 0).toFixed(1)} ชม.</span>
                              </div>
                            )}
                            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                              <button type="button" title="แก้ไข" onClick={() => { setSelectedTask(sub); setTaskDetailOpen(true); }}
                                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button type="button" title="ย้ายเป็นงานหลัก" onClick={() => { setPromoteTask(sub); setPromoteProjectId(sub.project_id || ''); }}
                                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-orange-600 hover:bg-orange-50 transition-colors">
                                <ArrowUpFromLine className="h-3 w-3" />
                              </button>
                              <button type="button" title="ลบ" onClick={async () => {
                                if (!await confirm({ title: 'ลบงานย่อย', description: `ลบงานย่อย "${sub.title}"?`, variant: 'destructive' })) return;
                                try { await deleteTask.mutateAsync({ id: sub.id, projectId: sub.project_id }); toast({ title: 'ลบงานย่อยแล้ว' }); }
                                catch (err: any) { toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' }); }
                              }}
                                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 font-semibold text-sm">
                  <span className="flex items-center gap-1.5"><Filter className="h-4 w-4 text-primary" />รวมทั้งหมด</span>
                  <span className="text-primary tabular-nums">{filteredTasks.length} งาน</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <Dialog open={extendOpen} onOpenChange={(v) => { setExtendOpen(v); if (!v) { setNewEndDate(''); setExtensionReason(''); } }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">ขยายเวลาโครงการ</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExtendSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>วันสิ้นสุดใหม่</Label>
              <Input
                type="date"
                value={newEndDate}
                min={project.original_end_date || project.end_date}
                onChange={(event) => setNewEndDate(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                วันสิ้นสุดเดิม: {safeFmt(project.original_end_date || project.end_date)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>
                เหตุผลการขยายเวลา <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="ระบุเหตุผล เช่น ลูกค้าขอเพิ่ม scope, รอ requirement, ทรัพยากรไม่เพียงพอ..."
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                rows={3}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExtendOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={updateProject.isPending || !extensionReason.trim()}>
                {updateProject.isPending ? 'กำลังบันทึก...' : 'บันทึกการขยายเวลา'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />

      {/* Create Subtask Dialog */}
      <CreateSubtaskDialog
        open={createSubtaskOpen}
        onOpenChange={setCreateSubtaskOpen}
        parentTask={selectedParentTask}
        onSubmit={async (subtask) => {
          try {
            await createSubtask.mutateAsync(subtask);
            toast({ title: 'สร้างงานย่อยสำเร็จ' });
            setCreateSubtaskOpen(false);
          } catch (error: any) {
            toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
          }
        }}
      />

      {/* Promote subtask to main task dialog */}
      <Dialog open={!!promoteTask} onOpenChange={(open) => { if (!open) { setPromoteTask(null); setPromoteProjectId(''); } }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">ย้ายเป็นงานหลัก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ย้าย <strong>{promoteTask?.title}</strong> ออกจากงานย่อย เป็นงานหลักในโปรเจกต์ที่เลือก
            </p>
            <div className="space-y-1.5">
              <Label>โปรเจกต์ปลายทาง</Label>
              <Select value={promoteProjectId} onValueChange={setPromoteProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกโปรเจกต์" />
                </SelectTrigger>
                <SelectContent>
                  {allProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPromoteTask(null); setPromoteProjectId(''); }}>ยกเลิก</Button>
              <Button
                disabled={!promoteProjectId || updateTask.isPending}
                onClick={async () => {
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
                  } catch (error: any) {
                    toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
                  }
                }}
              >
                {updateTask.isPending ? 'กำลังย้าย...' : 'ย้ายเป็นงานหลัก'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={taskDetailOpen}
        onOpenChange={(open) => {
          setTaskDetailOpen(open);
          if (!open) setSelectedTask(null);
        }}
      />
    </div>
  );
};

export default ProjectDetail;
