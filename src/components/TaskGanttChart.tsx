import { useState, useMemo, useRef } from 'react';
import { DbTask } from '@/types/project';
import { getStatusColor, getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';
import { ChevronDown, ChevronRight, Calendar, Clock, User } from 'lucide-react';
import { differenceInDays, eachDayOfInterval, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';
import { th } from 'date-fns/locale';
import { safeParseISO, safeFmt } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
const DAY_WIDTH = 32;
const ROW_HEIGHT = 40;

interface TaskGanttProps {
  tasks: DbTask[];
  onTaskClick?: (task: DbTask) => void;
  dependencies?: any[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-400',
  'in-progress': 'bg-blue-500',
  completed: 'bg-green-500',
  overdue: 'bg-red-500',
};

export default function TaskGanttChart({ tasks, onTaskClick, dependencies = [] }: TaskGanttProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month');
  const containerRef = useRef<HTMLDivElement>(null);

  // Build tree structure
  const rootTasks = useMemo(() => tasks.filter(t => !t.parent_task_id), [tasks]);
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, DbTask[]>();
    tasks.filter(t => t.parent_task_id).forEach(t => {
      const list = map.get(t.parent_task_id!) || [];
      list.push(t);
      map.set(t.parent_task_id!, list);
    });
    return map;
  }, [tasks]);

  // Compute date range
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const dates = tasks.flatMap(t => [safeParseISO(t.start_date), safeParseISO(t.end_date)]).filter(Boolean) as Date[];
    if (dates.length === 0) {
      const today = new Date();
      return { rangeStart: startOfMonth(today), rangeEnd: endOfMonth(today), totalDays: 30 };
    }
    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    // Add padding
    const start = addDays(startOfMonth(minD), 0);
    const end = addDays(endOfMonth(maxD), 0);
    return { rangeStart: start, rangeEnd: end, totalDays: Math.max(1, differenceInDays(end, start) + 1) };
  }, [tasks]);

  // Build day headers and month groups
  const allDays = useMemo(() => eachDayOfInterval({ start: rangeStart, end: rangeEnd }), [rangeStart, rangeEnd]);
  const today = new Date();
  const todayOffset = differenceInDays(today, rangeStart);

  // Month segments for header
  const monthSegments = useMemo(() => {
    const segs: { label: string; days: number }[] = [];
    let cursor = startOfMonth(rangeStart);
    while (cursor <= rangeEnd) {
      const mStart = cursor < rangeStart ? rangeStart : cursor;
      const mEnd = endOfMonth(cursor) > rangeEnd ? rangeEnd : endOfMonth(cursor);
      const days = differenceInDays(mEnd, mStart) + 1;
      segs.push({ label: format(cursor, 'MMM yyyy', { locale: th }), days });
      cursor = addDays(endOfMonth(cursor), 1);
    }
    return segs;
  }, [rangeStart, rangeEnd]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTasks(next);
  };

  const timelineWidth = totalDays * DAY_WIDTH;

  // Flat list of visible rows (for rendering)
  const visibleRows = useMemo(() => {
    const rows: { task: DbTask; level: number }[] = [];
    function addRows(taskList: DbTask[], level: number) {
      taskList.forEach(t => {
        rows.push({ task: t, level });
        if (expandedTasks.has(t.id)) {
          const children = subtasksByParent.get(t.id) || [];
          addRows(children, level + 1);
        }
      });
    }
    addRows(rootTasks, 0);
    return rows;
  }, [rootTasks, expandedTasks, subtasksByParent]);

  function getBarStyle(task: DbTask) {
    const start = safeParseISO(task.start_date);
    const end = safeParseISO(task.end_date);
    if (!start || !end) return null;

    const startOffset = Math.max(0, differenceInDays(start, rangeStart));
    const endOffset = Math.min(totalDays - 1, differenceInDays(end, rangeStart));
    const width = Math.max(DAY_WIDTH, (endOffset - startOffset + 1) * DAY_WIDTH);
    const left = startOffset * DAY_WIDTH;
    return { left, width };
  }

  const LABEL_COL = 240;

  // Map task id → row index (for dependency arrow placement)
  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleRows.forEach(({ task }, i) => map.set(task.id, i));
    return map;
  }, [visibleRows]);

  // Build dependency arrows
  const depArrows = useMemo(() => {
    if (!dependencies.length) return [];
    return dependencies.flatMap((dep: any) => {
      const srcIdx = rowIndexMap.get(dep.depends_on_task_id);
      const tgtIdx = rowIndexMap.get(dep.task_id);
      if (srcIdx === undefined || tgtIdx === undefined) return [];
      const srcTask = tasks.find(t => t.id === dep.depends_on_task_id);
      const tgtTask = tasks.find(t => t.id === dep.task_id);
      if (!srcTask || !tgtTask) return [];
      const srcBar = getBarStyle(srcTask);
      const tgtBar = getBarStyle(tgtTask);
      if (!srcBar || !tgtBar) return [];
      const x1 = srcBar.left + srcBar.width;
      const y1 = srcIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x2 = tgtBar.left;
      const y2 = tgtIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const color = dep.resolved_at ? '#9ca3af' : dep.dependency_type === 'blocks' ? '#ef4444' : '#f97316';
      const markerColor = dep.resolved_at ? 'gray' : dep.dependency_type === 'blocks' ? 'red' : 'orange';
      return [{ id: dep.id, x1, y1, x2, y2, color, markerColor }];
    });
  }, [dependencies, rowIndexMap, tasks]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {safeFmt(rangeStart, 'd MMM yyyy')} – {safeFmt(rangeEnd, 'd MMM yyyy')} ({totalDays} วัน)
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setExpandedTasks(new Set(rootTasks.filter(t => (subtasksByParent.get(t.id)?.length ?? 0) > 0).map(t => t.id)));
            }}
          >
            ขยายทั้งหมด
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpandedTasks(new Set())}>
            ยุบทั้งหมด
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div ref={containerRef} className="overflow-x-auto">
          <div style={{ minWidth: LABEL_COL + timelineWidth }}>
            {/* Header */}
            <div className="flex border-b bg-muted/40 sticky top-0 z-20">
              {/* Label header */}
              <div
                className="shrink-0 flex items-center px-3 py-2 font-medium text-xs text-muted-foreground border-r bg-muted/40 sticky left-0 z-30"
                style={{ width: LABEL_COL }}
              >
                งาน
              </div>
              {/* Month headers */}
              <div className="flex text-xs text-muted-foreground" style={{ width: timelineWidth }}>
                {monthSegments.map((seg, i) => (
                  <div
                    key={i}
                    className="border-l border-border/50 text-center py-1 font-medium overflow-hidden"
                    style={{ width: seg.days * DAY_WIDTH }}
                  >
                    {seg.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Day header */}
            <div className="flex border-b bg-muted/20">
              <div
                className="shrink-0 border-r bg-muted/20 sticky left-0 z-20"
                style={{ width: LABEL_COL }}
              />
              <div className="flex" style={{ width: timelineWidth }}>
                {allDays.map((day, i) => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  return (
                    <div
                      key={i}
                      className={`text-[10px] text-center py-1 border-l border-border/20 leading-none
                        ${isWeekend ? 'bg-muted/40 text-muted-foreground/50' : 'text-muted-foreground'}
                        ${isToday ? 'bg-primary/10 font-bold text-primary' : ''}
                      `}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    >
                      {format(day, 'd')}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task rows + dependency arrow overlay */}
            <div className="relative">
            {visibleRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">ไม่มีงาน</div>
            ) : (
              visibleRows.map(({ task, level }) => {
                const hasChildren = (subtasksByParent.get(task.id)?.length ?? 0) > 0;
                const isExpanded = expandedTasks.has(task.id);
                const bar = getBarStyle(task);
                const isWeekendCols = allDays.map(d => d.getDay() === 0 || d.getDay() === 6);

                return (
                  <div
                    key={task.id}
                    className="flex border-b hover:bg-muted/20 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Label column */}
                    <div
                      className="shrink-0 flex items-center gap-1 px-2 border-r bg-card sticky left-0 z-10"
                      style={{ width: LABEL_COL, paddingLeft: 8 + level * 20 }}
                    >
                      {hasChildren ? (
                        <button
                          onClick={() => toggleExpand(task.id)}
                          className="p-0.5 hover:bg-muted rounded shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      ) : (
                        <div className="w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-xs font-medium truncate cursor-pointer hover:text-primary"
                          onClick={() => onTaskClick?.(task)}
                        >
                          {task.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {task.assignee && (
                            <span className="text-[10px] text-muted-foreground truncate">{task.assignee}</span>
                          )}
                          {task.subtask_count > 0 && (
                            <span className="text-[10px] text-primary">{task.subtask_count} งานย่อย</span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ml-1 shrink-0 ${
                          task.priority === 'high' ? 'border-destructive/60 text-destructive' :
                          task.priority === 'medium' ? 'border-warning/60 text-warning' :
                          'border-muted-foreground/40'
                        }`}
                      >
                        {getPriorityLabel(task.priority)}
                      </Badge>
                    </div>

                    {/* Timeline */}
                    <div className="relative flex-1 overflow-hidden" style={{ width: timelineWidth }}>
                      {/* Column backgrounds */}
                      <div className="absolute inset-0 flex">
                        {allDays.map((day, i) => {
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                          return (
                            <div
                              key={i}
                              className={`border-l border-border/15 h-full
                                ${isWeekend ? 'bg-muted/25' : ''}
                                ${isToday ? 'bg-primary/5' : ''}
                              `}
                              style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                            />
                          );
                        })}
                      </div>

                      {/* Today marker */}
                      {todayOffset >= 0 && todayOffset < totalDays && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-10"
                          style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                        />
                      )}

                      {/* Task bar */}
                      {bar && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded flex items-center px-2 text-white text-[11px] font-medium overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                          style={{
                            left: bar.left,
                            width: bar.width,
                            height: 24,
                            background: task.status === 'completed' ? '#22c55e' :
                              task.status === 'overdue' ? '#ef4444' :
                              task.status === 'in-progress' ? '#3b82f6' : '#94a3b8',
                          }}
                          onClick={() => onTaskClick?.(task)}
                          title={`${task.title} | ${getStatusLabel(task.status)}`}
                        >
                          {/* Progress overlay */}
                          {task.progress_percentage > 0 && task.status !== 'completed' && (
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-white/20 rounded"
                              style={{ width: `${task.progress_percentage}%` }}
                            />
                          )}
                          <span className="truncate relative z-10">{task.title}</span>
                          {task.progress_percentage > 0 && (
                            <span className="ml-auto relative z-10 text-white/80">{task.progress_percentage}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* SVG overlay for dependency arrows (finish-to-start) */}
            {depArrows.length > 0 && (
              <svg
                className="absolute top-0 pointer-events-none z-20"
                style={{ left: LABEL_COL, width: timelineWidth, height: visibleRows.length * ROW_HEIGHT }}
              >
                <defs>
                  <marker id="dep-arrow-orange" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#f97316" />
                  </marker>
                  <marker id="dep-arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
                  </marker>
                  <marker id="dep-arrow-gray" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#9ca3af" />
                  </marker>
                </defs>
                {depArrows.map(arrow => {
                  const elbowX = Math.max(arrow.x1 + 12, arrow.x2 - 8);
                  const d = `M ${arrow.x1} ${arrow.y1} H ${elbowX} V ${arrow.y2} H ${arrow.x2}`;
                  return (
                    <path
                      key={arrow.id}
                      d={d}
                      stroke={arrow.color}
                      strokeWidth={1.5}
                      fill="none"
                      markerEnd={`url(#dep-arrow-${arrow.markerColor})`}
                      opacity={0.85}
                    />
                  );
                })}
              </svg>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-400" /> รอดำเนินการ
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" /> กำลังดำเนินการ
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" /> เสร็จสิ้น
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" /> เลยกำหนด
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-primary" /> วันนี้
        </div>
        {depArrows.length > 0 && (
          <div className="flex items-center gap-1">
            <svg width="20" height="10"><path d="M0,5 H14" stroke="#f97316" strokeWidth="1.5" fill="none" markerEnd="url(#dep-arrow-orange)" /></svg>
            การพึ่งพา
          </div>
        )}
      </div>
    </div>
  );
}
