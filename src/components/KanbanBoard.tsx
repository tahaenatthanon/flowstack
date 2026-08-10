import { useState, useMemo } from 'react';
import { DbTask } from '@/types/project';
import { getStatusColor, getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';
import { ChevronRight, Plus, Calendar, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import ScrollableKanban from '@/components/ScrollableKanban';

interface KanbanBoardProps {
  tasks: DbTask[];
  onTaskClick?: (task: DbTask) => void;
  onAddTask?: (status: string) => void;
  onMoveTask?: (taskId: string, newStatus: string) => void;
  showSubtasks?: boolean;
  projectId?: string;
}

const STATUSES = [
  { key: 'pending', label: 'รอดำเนินการ', color: 'bg-muted' },
  { key: 'in-progress', label: 'กำลังดำเนินการ', color: 'bg-blue-500' },
  { key: 'completed', label: 'เสร็จสิ้น', color: 'bg-green-500' },
  { key: 'overdue', label: 'เลยกำหนด', color: 'bg-red-500' },
  { key: 'cancelled', label: 'ยกเลิก', color: 'bg-gray-400' },
];

export function KanbanBoard({ 
  tasks, 
  onTaskClick, 
  onAddTask, 
  onMoveTask,
  showSubtasks = true,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, DbTask[]> = {
      pending: [],
      'in-progress': [],
      completed: [],
      overdue: [],
    };
    
    // Rule: Show ALL tasks (root + subtasks) in their respective columns
    tasks.forEach(task => {
      // De-duplicate: exclude actual subtask hour logs (is_subtask=1) if present
      if (Number(task.is_subtask) === 1) return;
      
      const status = task.status || 'pending';
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped.pending.push(task);
      }
    });
    
    return grouped;
  }, [tasks]);

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (newStatus: string) => {
    if (draggedTask && onMoveTask) {
      onMoveTask(draggedTask, newStatus);
    }
    setDraggedTask(null);
  };

  const renderTaskCard = (task: DbTask) => {
    return (
      <div 
        key={task.id} 
        draggable
        onDragStart={() => handleDragStart(task.id)}
        onDragOver={handleDragOver}
        onClick={() => onTaskClick?.(task)}
        className={cn(
          "p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-all duration-200 hover:shadow-md animate-in fade-in slide-in-from-top-1",
          draggedTask === task.id && 'opacity-50'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className={cn("font-medium text-sm truncate", (task.status === 'completed' || task.status === 'cancelled') && "line-through text-muted-foreground")}>
                {task.title}
              </span>
            </div>
          </div>
          
          <Badge 
            variant="outline" 
            className={`
              text-[9px] px-1 py-0 shrink-0
              ${task.priority === 'high' ? 'border-destructive text-destructive' : 
                task.priority === 'medium' ? 'border-warning text-warning' : 
                'border-muted-foreground'}
            `}
          >
            {getPriorityLabel(task.priority)}
          </Badge>
        </div>

        {/* Parent Context for Subtasks */}
        {task.parent_task_id && (
          <p className="text-[10px] text-muted-foreground/70 truncate mb-2 flex items-center gap-1">
            <ChevronRight className="w-2.5 h-2.5" /> {task.parent_title || 'งานหลัก'}
          </p>
        )}

        {/* Progress Bar */}
        {(task.progress_percentage > 0 || task.subtask_count > 0) && (
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>ความคืบหน้า</span>
              <span>{(task.status === 'completed' || task.status === 'cancelled') ? 100 : (task.progress_percentage || 0)}%</span>
            </div>
            <Progress value={(task.status === 'completed' || task.status === 'cancelled') ? 100 : task.progress_percentage} className="h-1" />
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              {task.assignee}
            </span>
          )}
          {task.end_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(task.end_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
          {!!task.is_ad_hoc && (
            <span className="inline-flex items-center gap-0.5 px-1 rounded text-orange-600 bg-orange-50 border border-orange-100 font-medium">
              <Zap className="w-2.5 h-2.5" /> Ad-hoc
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <ScrollableKanban className="pb-4 min-h-[500px]">
      {STATUSES.map(status => (
        <div 
          key={status.key}
          className="flex-shrink-0 w-72 flex flex-col"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(status.key)}
        >
          {/* Column Header */}
          <div className={`
            flex items-center justify-between p-3 rounded-t-lg
            ${status.color} bg-opacity-10 border-b border-border/50
          `}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status.color}`} />
              <span className="font-semibold text-xs uppercase tracking-wider">{status.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shadow-none">
                {tasksByStatus[status.key]?.length || 0}
              </Badge>
              {onAddTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-background/80"
                  onClick={() => onAddTask(status.key)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Column Content */}
          <div className="bg-muted/10 rounded-b-lg p-2 flex-1 overflow-y-auto space-y-2 border-x border-b">
            {tasksByStatus[status.key]?.map(task => renderTaskCard(task))}
            
            {(!tasksByStatus[status.key] || tasksByStatus[status.key].length === 0) && (
              <div className="text-center py-12 text-muted-foreground/40 text-[11px] italic">
                ไม่มีรายการ
              </div>
            )}
          </div>
        </div>
      ))}
    </ScrollableKanban>
  );
}

export default KanbanBoard;