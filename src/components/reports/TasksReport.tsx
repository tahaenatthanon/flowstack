import { DbTask, DbProject } from '@/types/project';
import { getStatusLabel, getStatusColor, getPriorityLabel } from '@/lib/projectUtils';
import { Zap } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { safeFmt } from '@/lib/dateUtils';

interface TasksReportProps {
  tasks: DbTask[];
  projects: DbProject[];
}

export default function TasksReport({ tasks, projects }: TasksReportProps) {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        ไม่มีข้อมูลงานในช่วงเวลาที่เลือก
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[28%]">ชื่องาน</TableHead>
            <TableHead>โครงการ</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>ความสำคัญ</TableHead>
            <TableHead>ผู้รับผิดชอบ</TableHead>
            <TableHead>วันเริ่ม</TableHead>
            <TableHead>วันสิ้นสุด</TableHead>
            <TableHead className="text-right">วันใช้/ประมาณ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                <span className="flex items-center gap-1.5 line-clamp-2">
                  {!!task.is_ad_hoc && <Zap className="w-3.5 h-3.5 shrink-0 text-warning" />}
                  {task.title}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {projectMap.get(task.project_id) || '-'}
              </TableCell>
              <TableCell>
                <span className={`status-badge text-xs ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
              </TableCell>
              <TableCell>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  task.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                  task.priority === 'medium' ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {getPriorityLabel(task.priority)}
                </span>
              </TableCell>
              <TableCell className="text-sm">{task.assignee || '—'}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">{safeFmt(task.start_date)}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">{safeFmt(task.end_date)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {task.days_spent || 0}/{task.estimated_days || 0} วัน
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
