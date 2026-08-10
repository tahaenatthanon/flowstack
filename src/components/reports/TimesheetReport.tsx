import { DbTimesheetEntry } from '@/types/project';
import { useState } from 'react';
import { safeFmt } from '@/lib/dateUtils';
import { ChevronDown, ChevronRight, Clock, FolderKanban } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TimesheetReportProps {
  entries: DbTimesheetEntry[];
}

interface TaskGroup {
  taskId: string | undefined;
  taskTitle: string;
  projectName: string;
  entries: DbTimesheetEntry[];
  totalHours: number;
}

export default function TimesheetReport({ entries }: TimesheetReportProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const totalHours = entries.reduce((sum, e) => sum + (Number(e.hours_worked) || 0), 0);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        ไม่มีข้อมูลบันทึกชั่วโมงในช่วงเวลาที่เลือก
      </div>
    );
  }

  // Group entries by parent_task_id (fallback to task_title)
  const groupMap = new Map<string, TaskGroup>();
  for (const entry of entries) {
    const key = entry.parent_task_id ?? entry.task_title ?? 'unknown';
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        taskId: entry.task_id,
        taskTitle: entry.task_title || '—',
        projectName: entry.project_name || '-',
        entries: [],
        totalHours: 0,
      });
    }
    const g = groupMap.get(key)!;
    g.entries.push(entry);
    g.totalHours += Number(entry.hours_worked) || 0;
  }
  const groups = Array.from(groupMap.values());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* Total hours summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <Clock className="w-4 h-4" />
        รวมทั้งหมด{' '}
        <span className="font-semibold text-foreground">{totalHours.toFixed(1)} ชม.</span>
        จาก {groups.length} งาน · {entries.length} รายการ
      </div>

      {/* Task groups */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8"></TableHead>
              <TableHead>งาน</TableHead>
              <TableHead>โครงการ</TableHead>
              <TableHead className="text-center">รายการ</TableHead>
              <TableHead className="text-right">รวมชั่วโมง</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const key = group.taskId ?? group.taskTitle;
              const isOpen = expanded.has(key);
              return (
                <>
                  {/* Task row (parent) */}
                  <TableRow
                    key={`task-${key}`}
                    className="cursor-pointer hover:bg-muted/40 font-medium"
                    onClick={() => toggle(key)}
                  >
                    <TableCell className="text-muted-foreground text-center">
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 inline" />
                        : <ChevronRight className="w-4 h-4 inline" />}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <FolderKanban className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {group.taskTitle}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{group.projectName}</TableCell>
                    <TableCell className="text-center text-sm">{group.entries.length}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {group.totalHours.toFixed(1)} ชม.
                    </TableCell>
                  </TableRow>

                  {/* Subtask rows (entries) */}
                  {isOpen && group.entries.map((entry) => (
                    <TableRow key={`entry-${entry.id}`} className="bg-muted/20 hover:bg-muted/30">
                      <TableCell />
                      <TableCell className="pl-8">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {entry.description || '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {safeFmt(entry.work_date ?? entry.date)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right tabular-nums text-sm">
                        {Number(entry.hours_worked).toFixed(1)} ชม.
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
