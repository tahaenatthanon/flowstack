import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { ImpactSimulation } from '@/types/project';
import { safeFmt } from '@/lib/dateUtils';

interface ImpactSimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simulation: ImpactSimulation | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ImpactSimulationDialog = ({
  open,
  onOpenChange,
  simulation,
  onConfirm,
  onCancel,
  isLoading = false,
}: ImpactSimulationDialogProps) => {
  if (!simulation) return null;

  const { affectedTasks, affectedProjects, totalImpact } = simulation;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && isLoading) return; onOpenChange(v); }}>
      <DialogContent className="w-full sm:max-w-3xl sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            การวิเคราะห์ผลกระทบ (Impact Simulation)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* สรุปผลกระทบ */}
          <Alert className="border-warning/30 bg-warning/5">
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-warning">
                  การรับงานแทรกนี้จะส่งผลกระทบดังนี้:
                </p>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{totalImpact.affectedTaskCount}</p>
                    <p className="text-sm text-muted-foreground">งานที่ต้องเลื่อน</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{totalImpact.affectedProjectCount}</p>
                    <p className="text-sm text-muted-foreground">โปรเจกต์ที่กระทบ</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">{totalImpact.maxDelayDays}</p>
                    <p className="text-sm text-muted-foreground">วันล่าช้าสูงสุด</p>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* รายการงานที่ถูกกระทบ */}
          {affectedTasks.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                งานที่จะต้องเลื่อน ({affectedTasks.length} รายการ)
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {affectedTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.taskTitle}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          โปรเจกต์: {task.projectName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-muted-foreground line-through">
                          {safeFmt(task.currentEndDate)}
                        </p>
                        <p className="text-sm font-semibold text-warning flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {safeFmt(task.suggestedEndDate)}
                          <span className="text-xs">({task.delayDays > 0 ? `+${task.delayDays}` : task.delayDays} วัน)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* รายการโปรเจกต์ที่ถูกกระทบ */}
          {affectedProjects.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">
                โปรเจกต์ที่ได้รับผลกระทบ ({affectedProjects.length} โปรเจกต์)
              </h4>
              <div className="space-y-2">
                {affectedProjects.map((project, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{project.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.affectedTaskCount} งานถูกกระทบ
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-destructive">
                          ล่าช้า +{project.delayDays} วัน
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {safeFmt(project.currentEndDate)} → {safeFmt(project.suggestedEndDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {affectedTasks.length === 0 && (
            <Alert>
              <AlertDescription className="text-center py-4">
                ไม่พบงานที่ถูกกระทบ - สามารถเพิ่มงานได้เลย
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            ยกเลิก
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} className="gap-2">
            {isLoading ? 'กำลังบันทึก...' : 'ยืนยันและบันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImpactSimulationDialog;
