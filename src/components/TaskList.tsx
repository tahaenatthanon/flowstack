import { DbTask } from '@/types/project';
import { getStatusColor, getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';
import { Clock, Zap } from 'lucide-react';

interface TaskListProps {
  tasks: DbTask[];
  title: string;
  showAll?: boolean;
}

const TaskList = ({ tasks, title, showAll = false }: TaskListProps) => {
  const displayTasks = showAll ? tasks : tasks.slice(0, 5);

  return (
    <div className="bg-card rounded-xl border p-5">
      <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-muted-foreground">({tasks.length})</span>
      </h3>
      {displayTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">ไม่มีรายการ</p>
      ) : (
        <div className="space-y-2">
          {displayTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{task.title}</span>
                    {!!task.is_ad_hoc && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-warning/15 text-warning">
                        <Zap className="w-3 h-3" />
                        งานแทรก
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee}</span>}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {task.days_spent}/{task.estimated_days} วัน
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-badge ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  task.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                  task.priority === 'medium' ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {getPriorityLabel(task.priority)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskList;
