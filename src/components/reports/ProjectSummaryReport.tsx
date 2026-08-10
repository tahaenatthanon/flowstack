import { DbProject, DbTask } from '@/types/project';
import { calculateProjectReport } from '@/lib/projectUtils';
import { getStatusLabel, getProjectStatusColor } from '@/lib/projectUtils';
import { safeFmt } from '@/lib/dateUtils';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ProjectSummaryReportProps {
  projects: DbProject[];
  allTasks: DbTask[];
}

export default function ProjectSummaryReport({ projects, allTasks }: ProjectSummaryReportProps) {
  const projectRows = projects.map((project) => {
    const tasks = allTasks.filter((t) => t.project_id === project.id);
    const report = calculateProjectReport(project, tasks);
    return { project, tasks, report };
  });

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        ไม่มีข้อมูลโครงการในช่วงเวลาที่เลือก
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[30%]">ชื่อโครงการ</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>วันเริ่ม</TableHead>
            <TableHead>วันสิ้นสุด</TableHead>
            <TableHead className="text-center">งานทั้งหมด</TableHead>
            <TableHead className="text-center">ความคืบหน้า</TableHead>
            <TableHead className="text-center">✓</TableHead>
            <TableHead className="text-center">●</TableHead>
            <TableHead className="text-center">!</TableHead>
            <TableHead className="text-right">ขยายเวลา</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projectRows.map(({ project, tasks, report }) => (
            <TableRow key={project.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                <div>
                  <p className="line-clamp-1">{project.name}</p>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className={`status-badge text-xs ${getProjectStatusColor(project.status)}`}>
                  {getStatusLabel(project.status)}
                </span>
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">{safeFmt(project.start_date)}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">{safeFmt(project.end_date)}</TableCell>
              <TableCell className="text-center text-sm">{tasks.length}</TableCell>
              <TableCell className="min-w-[120px]">
                <div className="flex items-center gap-2">
                  <Progress value={report.completionPercentage} className="h-1.5 flex-1" />
                  <span className="text-xs tabular-nums w-8 text-right">{report.completionPercentage}%</span>
                </div>
              </TableCell>
              <TableCell className="text-center text-sm text-success">{report.completedTasks.length}</TableCell>
              <TableCell className="text-center text-sm text-info">{report.inProgressTasks.length}</TableCell>
              <TableCell className={`text-center text-sm ${report.overdueTasks.length > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                {report.overdueTasks.length}
              </TableCell>
              <TableCell className="text-right text-sm">
                {report.extensionDays > 0 ? (
                  <span className="text-warning">+{report.extensionDays} วัน</span>
                ) : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
