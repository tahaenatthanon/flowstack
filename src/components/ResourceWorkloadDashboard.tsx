import { useResourceWorkload } from '@/hooks/useProjectData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertTriangle, Pencil, Briefcase } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ResourceWorkloadDashboardProps {
  year?: number;
  startDate?: string;
  endDate?: string;
}

const ResourceWorkloadDashboard = ({ year, startDate, endDate }: ResourceWorkloadDashboardProps) => {
  const currentYear = new Date().getFullYear();
  const selectedYear = year ?? currentYear;
  
  const { data: workload = [], isLoading } = useResourceWorkload(undefined, selectedYear, startDate || undefined, endDate || undefined);
  const navigate = useNavigate();

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          กำลังโหลดข้อมูล Workload...
        </CardContent>
      </Card>
    );
  }

  // จัดกลุ่มตาม assignee
  const groupedByAssignee = workload.reduce((acc, item) => {
    if (!acc[item.assignee]) {
      acc[item.assignee] = [];
    }
    acc[item.assignee].push(item);
    return acc;
  }, {} as Record<string, typeof workload>);

  const assignees = Object.keys(groupedByAssignee);

  if (assignees.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          ไม่มีข้อมูล Workload
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* สรุปรวม */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">ทรัพยากรทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{assignees.length}</p>
            <p className="text-sm text-muted-foreground">คน</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">งานทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{workload.reduce((sum, w) => sum + w.active_task_count, 0)}</p>
            <p className="text-sm text-muted-foreground">งาน</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">โปรเจกต์ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {new Set(workload.flatMap(w => (w.project_names || '').split(', '))).size}
            </p>
            <p className="text-sm text-muted-foreground">โปรเจกต์</p>
          </CardContent>
        </Card>
      </div>

      {/* Workload แต่ละคน */}
      <div className="space-y-4">
        {assignees.map(assignee => {
          const personWorkload = groupedByAssignee[assignee];
          const totalTasks = personWorkload.reduce((sum, w) => sum + Number(w.active_task_count), 0);
          const totalProjects = personWorkload.reduce((sum, w) => sum + Number(w.project_count), 0);
          const totalEstimatedDays = personWorkload.reduce((sum, w) => sum + Number(w.total_estimated_days), 0);
          const isOverloaded = totalTasks > 5 || totalProjects > 3;

          return (
            <Card key={assignee} className={isOverloaded ? 'border-warning' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {assignee}
                    </CardTitle>
                    {(() => {
                      const info = personWorkload[0];
                      const sub = info?.role_label || info?.position;
                      return sub ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                      ) : null;
                    })()}
                    <p className="text-sm text-muted-foreground mt-1">
                      {totalProjects} โปรเจกต์ · {totalTasks} งาน · รวม {totalEstimatedDays} วัน
                    </p>
                  </div>
                  {isOverloaded && (
                    <div className="flex items-center gap-1 text-warning text-sm font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      Overloaded
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isOverloaded && (
                  <Alert className="mb-4 border-warning/30 bg-warning/5">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <AlertDescription>
                      <strong>คำเตือน:</strong> ทรัพยากรคนนี้มี Workload สูง อาจส่งผลต่อประสิทธิภาพการทำงาน
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  {personWorkload.map((w, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {w.work_date ? format(parseISO(w.work_date), 'd MMM yyyy', { locale: th }) : 'ไม่มีวันที่'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-md">
                            {w.project_names}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-sm font-semibold">
                            {w.active_task_count} งาน
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {w.total_estimated_days} วัน
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/task-hours?user=${encodeURIComponent(assignee)}`)}
                          title="ดูรายละเอียดงาน"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ResourceWorkloadDashboard;
