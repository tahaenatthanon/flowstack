import { useState, useRef } from 'react';
import { DbTask } from '@/types/project';
import { useUpdateTask, useDeleteTask, useUsers } from '@/hooks/useProjectData';
import { getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { safeFmt } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { Trash2, ChevronDown, ChevronRight, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/hooks/useConfirm';
import CreateSubtaskDialog from './CreateSubtaskDialog';

interface CellEditState {
  taskId: string;
  field: string;
}

interface TaskSpreadsheetProps {
  tasks: DbTask[];
  projectId: string;
  onAddSubtask?: (parentTask: DbTask) => void;
  onEditTask?: (task: DbTask) => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'in-progress', label: 'กำลังดำเนินการ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'overdue', label: 'เลยกำหนด' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'สูง' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'low', label: 'ต่ำ' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500 line-through',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-slate-100 text-slate-600',
};

export default function TaskSpreadsheet({ tasks, projectId, onAddSubtask, onEditTask }: TaskSpreadsheetProps) {
  const [editingCell, setEditingCell] = useState<CellEditState | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editSubtaskOpen, setEditSubtaskOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<DbTask | null>(null);
  const [parentTaskForEdit, setParentTaskForEdit] = useState<DbTask | null>(null);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: users = [] } = useUsers();
  const { confirm } = useConfirm();

  const rootTasks = tasks.filter(t => !t.parent_task_id);
  const subtasksByParent = new Map<string, DbTask[]>();
  tasks.filter(t => t.parent_task_id).forEach(t => {
    const list = subtasksByParent.get(t.parent_task_id!) || [];
    list.push(t);
    subtasksByParent.set(t.parent_task_id!, list);
  });

  const toggleExpand = (id: string) => {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTasks(next);
  };

  const commitEdit = async (task: DbTask, field: string, value: string) => {
    if (String(task[field as keyof DbTask]) === value) {
      setEditingCell(null);
      return;
    }
    try {
      const update: any = { id: task.id, project_id: task.project_id, [field]: value };
      // Recompute estimated_days if dates changed
      if (field === 'start_date' || field === 'end_date') {
        const start = parseISO(field === 'start_date' ? value : task.start_date);
        const end = parseISO(field === 'end_date' ? value : task.end_date);
        if (isValid(start) && isValid(end)) {
          update.estimated_days = Math.max(1, differenceInDays(end, start));
        }
      }
      if (field === 'status' && value === 'completed') {
        update.completed_date = new Date().toISOString().split('T')[0];
      }
      await updateTask.mutateAsync(update);
    } catch (err: any) {
      toast.error(err.message || 'ไม่สามารถบันทึกได้');
    }
    setEditingCell(null);
  };

  const handleDelete = async (task: DbTask) => {
    if (!await confirm({ title: 'ลบงาน', description: `ลบงาน "${task.title}"?`, variant: 'destructive' })) return;
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId: task.project_id });
      toast.success('ลบงานแล้ว');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditTask = (task: DbTask) => {
    // Find parent task for the subtask
    if (task.parent_task_id) {
      const parent = tasks.find(t => t.id === task.parent_task_id);
      setParentTaskForEdit(parent || null);
    } else {
      setParentTaskForEdit(task);
    }
    setEditingSubtask(task);
    setEditSubtaskOpen(true);
  };

  const handleUpdateSubtask = async (subtask: Partial<DbTask>) => {
    try {
      await updateTask.mutateAsync({
        id: subtask.id!,
        project_id: editingSubtask!.project_id,
        title: subtask.title,
        description: subtask.description,
        status: subtask.status,
        priority: subtask.priority,
        assignee: subtask.assignee,
        start_date: subtask.start_date,
        end_date: subtask.end_date,
        estimated_hours: subtask.estimated_hours,
      });
      toast.success('อัปเดตงานย่อยแล้ว');
    } catch (err: any) {
      toast.error(err.message || 'ไม่สามารถอัปเดตได้');
    }
  };

  const isEditing = (taskId: string, field: string) =>
    editingCell?.taskId === taskId && editingCell?.field === field;

  function InlineText({ task, field }: { task: DbTask; field: string }) {
    const [val, setVal] = useState(String(task[field as keyof DbTask] || ''));
    if (!isEditing(task.id, field)) {
      return (
        <span
          className="cursor-pointer hover:bg-primary/10 rounded px-1 block w-full min-h-[1.5rem] truncate"
          onClick={() => setEditingCell({ taskId: task.id, field })}
          title={task[field as keyof DbTask] || ''}
        >
          {task[field as keyof DbTask] || <span className="text-muted-foreground/40">—</span>}
        </span>
      );
    }
    return (
      <input
        autoFocus
        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => commitEdit(task, field, val)}
        onKeyDown={e => {
          if (e.key === 'Enter') commitEdit(task, field, val);
          if (e.key === 'Escape') setEditingCell(null);
        }}
      />
    );
  }

  function InlineDate({ task, field }: { task: DbTask; field: string }) {
    const raw = task[field as keyof DbTask] || '';
    const [val, setVal] = useState(raw);
    if (!isEditing(task.id, field)) {
      return (
        <span
          className="cursor-pointer hover:bg-primary/10 rounded px-1 block min-h-[1.5rem]"
          onClick={() => setEditingCell({ taskId: task.id, field })}
        >
          {safeFmt(raw)}
        </span>
      );
    }
    return (
      <input
        autoFocus
        type="date"
        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => commitEdit(task, field, val)}
        onKeyDown={e => {
          if (e.key === 'Enter') commitEdit(task, field, val);
          if (e.key === 'Escape') setEditingCell(null);
        }}
      />
    );
  }

  function InlineSelect({ task, field, options }: { task: DbTask; field: string; options: { value: string; label: string }[] }) {
    const raw = String(task[field as keyof DbTask] ?? '');
    if (!isEditing(task.id, field)) {
      const opt = options.find(o => o.value === raw);
      const colorMap: Record<string, string> = field === 'status' ? STATUS_COLORS : PRIORITY_COLORS;
      return (
        <span
          className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[raw] || 'bg-muted'}`}
          onClick={() => setEditingCell({ taskId: task.id, field })}
        >
          {opt?.label || raw}
        </span>
      );
    }
    return (
      <select
        autoFocus
        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        defaultValue={raw}
        onChange={e => commitEdit(task, field, e.target.value)}
        onBlur={() => setEditingCell(null)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  function InlineUserSelect({ task }: { task: DbTask }) {
    const raw = task.assignee_user_id
      ? (users.find((u) => u.id === task.assignee_user_id)?.display_name || task.assignee)
      : (task.assignee || '');
    const currentUserId = task.assignee_user_id || '';
    if (!isEditing(task.id, 'assignee')) {
      return (
        <span
          className="cursor-pointer hover:bg-primary/10 rounded px-1 block min-h-[1.5rem] truncate text-xs"
          onClick={() => setEditingCell({ taskId: task.id, field: 'assignee' })}
        >
          {raw || <span className="text-muted-foreground/40">—</span>}
        </span>
      );
    }
    return (
      <select
        autoFocus
        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        defaultValue={currentUserId}
        onChange={e => {
          const uid = e.target.value;
          const userName = uid ? (users.find((u) => u.id === uid)?.display_name || '') : '';
          commitEdit(task, 'assignee', userName);
          commitEdit(task, 'assignee_user_id', uid);
        }}
        onBlur={() => setEditingCell(null)}
      >
        <option value="">ไม่ระบุ</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.display_name || u.email}
          </option>
        ))}
      </select>
    );
  }

  const renderRow = (task: DbTask, level: number) => {
    const hasChildren = (subtasksByParent.get(task.id)?.length ?? 0) > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <tr key={task.id} className="border-b hover:bg-muted/20 transition-colors group">
        {/* Title */}
        <td className="px-3 py-2" style={{ paddingLeft: 12 + level * 20 }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button onClick={() => toggleExpand(task.id)} className="p-0.5 hover:bg-muted rounded shrink-0">
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                }
              </button>
            ) : (
              <div className="w-4 shrink-0" />
            )}
            <div className="flex-1 min-w-0 text-xs">
              <InlineText task={task} field="title" />
            </div>
            {task.subtask_count > 0 && !hasChildren && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">{task.subtask_count}</Badge>
            )}
          </div>
        </td>

        {/* Assignee */}
        <td className="px-2 py-2 text-xs w-32">
          <InlineUserSelect task={task} />
        </td>

        {/* Status */}
        <td className="px-2 py-2 text-xs w-32">
          <InlineSelect task={task} field="status" options={STATUS_OPTIONS} />
        </td>

        {/* Priority */}
        <td className="px-2 py-2 text-xs w-24">
          <InlineSelect task={task} field="priority" options={PRIORITY_OPTIONS} />
        </td>

        {/* Start date */}
        <td className="px-2 py-2 text-xs w-28">
          <InlineDate task={task} field="start_date" />
        </td>

        {/* End date */}
        <td className="px-2 py-2 text-xs w-28">
          <InlineDate task={task} field="end_date" />
        </td>

        {/* Days */}
        <td className="px-2 py-2 text-xs w-20 text-center text-muted-foreground">
          {task.estimated_days}
        </td>

        {/* Progress */}
        <td className="px-2 py-2 text-xs w-20">
          <div className="flex items-center gap-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  task.status === 'completed' ? 'bg-green-500' :
                  (task.progress_percentage ?? 0) > 60 ? 'bg-primary' : 'bg-warning'
                }`}
                style={{ width: `${task.status === 'completed' ? 100 : (task.progress_percentage ?? 0)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {task.status === 'completed' ? '100%' : `${task.progress_percentage ?? 0}%`}
            </span>
          </div>
        </td>

        {/* Actions */}
        <td className="px-2 py-2 w-28">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.is_subtask ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="แก้ไข"
                onClick={() => handleEditTask(task)}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            ) : (
              onEditTask && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="แก้ไข"
                  onClick={() => onEditTask(task)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )
            )}
            {onAddSubtask && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="เพิ่มงานย่อย"
                onClick={() => onAddSubtask(task)}
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              title="ลบ"
              onClick={() => handleDelete(task)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const renderRows = (taskList: DbTask[], level: number): React.ReactNode[] => {
    return taskList.flatMap(task => {
      const rows: React.ReactNode[] = [renderRow(task, level)];
      if (expandedTasks.has(task.id)) {
        const children = subtasksByParent.get(task.id) || [];
        rows.push(...renderRows(children, level + 1));
      }
      return rows;
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b text-muted-foreground text-xs">
            <th className="px-3 py-2 text-left font-medium">ชื่องาน</th>
            <th className="px-2 py-2 text-left font-medium w-32">ผู้รับผิดชอบ</th>
            <th className="px-2 py-2 text-left font-medium w-32">สถานะ</th>
            <th className="px-2 py-2 text-left font-medium w-24">ความสำคัญ</th>
            <th className="px-2 py-2 text-left font-medium w-28">วันเริ่ม</th>
            <th className="px-2 py-2 text-left font-medium w-28">วันสิ้นสุด</th>
            <th className="px-2 py-2 text-center font-medium w-20">วัน</th>
            <th className="px-2 py-2 text-left font-medium w-20">ความคืบหน้า</th>
            <th className="px-2 py-2 w-28" />
          </tr>
        </thead>
        <tbody>
          {rootTasks.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-10 text-muted-foreground text-sm">
                ยังไม่มีงาน
              </td>
            </tr>
          ) : (
            renderRows(rootTasks, 0)
          )}
        </tbody>
      </table>
      <div className="text-xs text-muted-foreground px-3 py-2 border-t bg-muted/20">
        คลิกที่เซลล์เพื่อแก้ไขข้อมูลโดยตรง หรือคลิกไอคอนดินสอเพื่อแก้ไขในกล่องโต้ตอบ
      </div>

      {/* Edit Subtask Dialog */}
      <CreateSubtaskDialog
        open={editSubtaskOpen}
        onOpenChange={(open) => {
          setEditSubtaskOpen(open);
          if (!open) {
            setEditingSubtask(null);
            setParentTaskForEdit(null);
          }
        }}
        parentTask={parentTaskForEdit}
        editTask={editingSubtask}
        onSubmit={() => {}}
        onUpdate={handleUpdateSubtask}
      />
    </div>
  );
}
