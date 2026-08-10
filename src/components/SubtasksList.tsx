import { useState } from 'react';
import { DbTask } from '@/types/project';
import { getStatusColor, getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';
import { Clock, ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SubtasksListProps {
  tasks: DbTask[];
  parentId?: string;
  onAddSubtask?: (parentId: string) => void;
  onEditTask?: (task: DbTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onToggleComplete?: (task: DbTask) => void;
  maxLevel?: number;
}

interface TaskWithSubtasks extends Omit<DbTask, 'subtasks'> {
  subtasks?: TaskWithSubtasks[];
}

export function SubtasksList({ 
  tasks, 
  parentId, 
  onAddSubtask, 
  onEditTask, 
  onDeleteTask,
  onToggleComplete,
  maxLevel = 5 
}: SubtasksListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const toggleExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const toggleComplete = (taskId: string) => {
    const newCompleted = new Set(completedTasks);
    if (newCompleted.has(taskId)) {
      newCompleted.delete(taskId);
    } else {
      newCompleted.add(taskId);
    }
    setCompletedTasks(newCompleted);
    onToggleComplete?.(tasks.find(t => t.id === taskId) as DbTask);
  };

  const renderTask = (task: TaskWithSubtasks, level: number = 0) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const isCompleted = completedTasks.has(task.id) || task.status === 'completed';
    const indent = level * 20;

    return (
      <div key={task.id} className="animate-in fade-in slide-in-from-top-1 duration-200">
        <div 
          className={`
            flex items-center gap-2 p-3 rounded-lg transition-all
            ${level > 0 ? 'ml-4 border-l-2 border-muted' : 'bg-muted/30'}
            ${isCompleted ? 'opacity-60' : 'hover:bg-muted'}
          `}
          style={{ marginLeft: `${indent}px` }}
        >
          {/* Expand/Collapse Button */}
          {hasSubtasks ? (
            <button
              onClick={() => toggleExpanded(task.id)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Checkbox for completion */}
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={() => toggleComplete(task.id)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />

          {/* Task Title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </span>
              {(task.is_ad_hoc || task.is_ad_hoc === true) && (
                <Badge variant="outline" className="text-[10px] py-0 px-1 bg-warning/10 text-warning">
                  งานแทรก
                </Badge>
              )}
              {(task.is_subtask || task.is_subtask === true) && (
                <Badge variant="outline" className="text-[10px] py-0 px-1 bg-primary/10 text-primary">
                  งานย่อย
                </Badge>
              )}
            </div>
            
            {/* Task Meta */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {task.assignee && (
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px]">
                    {task.assignee.charAt(0).toUpperCase()}
                  </div>
                  {task.assignee}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {task.actual_hours || 0}/{task.estimated_hours || task.estimated_days || 1}
                {task.estimated_hours ? 'ชม.' : 'วัน'}
              </span>
              {task.subtask_count > 0 && (
                <span className="text-primary">
                  {task.subtask_count} งานย่อย
                </span>
              )}
              {task.progress_percentage > 0 && (
                <span className="text-primary font-medium">
                  {task.progress_percentage}%
                </span>
              )}
            </div>
          </div>

          {/* Status & Priority */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
              {getStatusLabel(task.status)}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              task.priority === 'high' ? 'bg-destructive/10 text-destructive' :
              task.priority === 'medium' ? 'bg-warning/10 text-warning' :
              'bg-muted text-muted-foreground'
            }`}>
              {getPriorityLabel(task.priority)}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {level < maxLevel && onAddSubtask && (
                <button
                  onClick={() => onAddSubtask(task.id)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="เพิ่มงานย่อย"
                >
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {onEditTask && (
                <button
                  onClick={() => onEditTask(task)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="แก้ไข"
                >
                  <Edit className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {onDeleteTask && (
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-1 hover:bg-destructive/10 rounded transition-colors"
                  title="ลบ"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subtasks */}
        {hasSubtasks && isExpanded && (
          <div className="mt-1 space-y-1">
            {task.subtasks!.map((subtask) => renderTask(subtask, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootTasks = tasks.filter(t => !t.parent_task_id);

  // Build tree structure
  const buildTree = (tasks: DbTask[]): TaskWithSubtasks[] => {
    const taskMap = new Map<string, TaskWithSubtasks>();
    const roots: TaskWithSubtasks[] = [];

    // First pass: create all tasks
    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    // Second pass: build tree
    tasks.forEach(task => {
      const taskNode = taskMap.get(task.id)!;
      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        taskMap.get(task.parent_task_id)!.subtasks!.push(taskNode);
      } else if (!task.parent_task_id) {
        roots.push(taskNode);
      }
    });

    return roots;
  };

  const taskTree = buildTree(tasks);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">ไม่มีรายการงาน</p>
        {onAddSubtask && parentId && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => onAddSubtask(parentId)}
          >
            <Plus className="w-4 h-4 mr-1" />
            เพิ่มงานย่อย
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {taskTree.map(task => renderTask(task, 0))}
    </div>
  );
}

// Progress Bar Component for Tasks
interface TaskProgressBarProps {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function TaskProgressBar({ progress, size = 'md', showLabel = true }: TaskProgressBarProps) {
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colors = progress >= 100 
    ? 'bg-green-500' 
    : progress >= 75 
      ? 'bg-primary' 
      : progress >= 50 
        ? 'bg-warning' 
        : 'bg-destructive';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-muted rounded-full overflow-hidden ${heights[size]}`}>
        <div 
          className={`${colors} ${heights[size]} transition-all duration-500 rounded-full`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground w-10 text-right">
          {progress}%
        </span>
      )}
    </div>
  );
}

export default SubtasksList;
