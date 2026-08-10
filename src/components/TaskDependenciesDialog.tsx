import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DbTask, DbTaskDependency } from '@/types/project';
import { Link2, Unlink, AlertTriangle, Check, Plus, X } from 'lucide-react';

interface TaskDependenciesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: DbTask | null;
  availableTasks: DbTask[];
  dependencies: DbTaskDependency[];
  onAddDependency: (dependsOnTaskId: string, dependencyType: string) => void;
  onRemoveDependency: (dependencyId: string) => void;
  onResolveBlocker: (dependencyId: string, notes: string) => void;
}

export function TaskDependenciesDialog({
  open,
  onOpenChange,
  task,
  availableTasks,
  dependencies,
  onAddDependency,
  onRemoveDependency,
  onResolveBlocker,
}: TaskDependenciesDialogProps) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [dependencyType, setDependencyType] = useState('depends_on');
  const [showAddForm, setShowAddForm] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Get tasks that depend on this task (blocked by this task)
  const blockedByThis = dependencies.filter(d => d.depends_on_task_id === task?.id);
  // Get tasks this task depends on
  const dependsOn = dependencies.filter(d => d.task_id === task?.id);

  const handleAddDependency = () => {
    if (selectedTaskId && task) {
      onAddDependency(selectedTaskId, dependencyType);
      setSelectedTaskId('');
      setShowAddForm(false);
    }
  };

  const handleResolve = (dependencyId: string) => {
    onResolveBlocker(dependencyId, resolveNotes);
    setResolvingId(null);
    setResolveNotes('');
  };

  // Filter out current task and its subtasks from available tasks
  const filteredTasks = availableTasks.filter(t => 
    t.id !== task?.id && 
    t.project_id === task?.project_id
  );

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] sm:max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            จัดการความสัมพันธ์ของงาน
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Task Info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium">{task.title}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Status: {task.status} | Priority: {task.priority}
            </div>
          </div>

          {/* Dependencies (What this task depends on) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="text-blue-500">→</span>
              งานที่ต้องรอ (Dependencies)
            </h4>
            
            {dependsOn.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">ไม่มีงานที่ต้องรอ</p>
            ) : (
              <div className="space-y-2">
                {dependsOn.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{dep.depends_on_title || 'Task'}</span>
                      <Badge variant={dep.depends_on_status === 'completed' ? 'default' : 'outline'}>
                        {dep.depends_on_status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveDependency(dep.id)}
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blockers (What is blocked by this task) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              งานที่ถูกบล็อก (Blockers)
            </h4>
            
            {blockedByThis.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">ไม่มีงานที่ถูกบล็อก</p>
            ) : (
              <div className="space-y-2">
                {blockedByThis.map(blocker => (
                  <div key={blocker.id} className="p-2 bg-warning/10 border border-warning/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{blocker.task_title || 'Task'}</span>
                        <Badge variant="outline" className="ml-2">{blocker.task_status}</Badge>
                      </div>
                      {resolvingId === blocker.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="หมายเหตุ..."
                            value={resolveNotes}
                            onChange={(e) => setResolveNotes(e.target.value)}
                            className="h-8 w-32"
                          />
                          <Button size="sm" onClick={() => handleResolve(blocker.id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResolvingId(blocker.id)}
                        >
                          แก้ไขบล็อกเกอร์
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Dependency Form */}
          <div className="space-y-3">
            {!showAddForm ? (
              <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มความสัมพันธ์
              </Button>
            ) : (
              <div className="p-3 border rounded-lg space-y-3">
                <h4 className="text-sm font-medium">เพิ่มงานที่ต้องรอ</h4>
                
                <select
                  className="w-full p-2 border rounded-md"
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                >
                  <option value="">เลือกงาน...</option>
                  {filteredTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddDependency}
                    disabled={!selectedTaskId}
                  >
                    เพิ่ม
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setSelectedTaskId('');
                    }}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TaskDependenciesDialog;
