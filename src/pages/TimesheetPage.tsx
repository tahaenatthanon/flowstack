import { useState, useMemo } from 'react';
import { Clock, Calendar, Users, TrendingUp, ChevronDown, ChevronRight,
         Trash2, Pencil, Loader2, FolderKanban, Filter, X, ExternalLink, ArrowUpFromLine } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjectData';
import CreateTimesheetEntryDialog from '@/components/CreateTimesheetEntryDialog';
import TaskDetailSheet from '@/components/TaskDetailSheet';
import { RecurringTasksContent } from './RecurringTasksPage';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { safeFmt } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import type { DbTimesheetEntry } from '@/types/project';

const WORK_TYPE_LABELS: Record<string, string> = {
  work: 'งานปกติ', meeting: 'ประชุม', onsite: 'งานลูกค้า (Onsite)',
  ot: 'งานล่วงเวลา (OT)', leave: 'ลาหยุด', holiday: 'วันหยุด',
};
const WORK_TYPE_COLORS: Record<string, string> = {
  work: 'bg-blue-100 text-blue-700', meeting: 'bg-violet-100 text-violet-700',
  onsite: 'bg-green-100 text-green-700', ot: 'bg-orange-100 text-orange-700',
  leave: 'bg-gray-100 text-gray-600', holiday: 'bg-gray-100 text-gray-600',
};

function getRangePreset(preset: string): { from: string; to: string } {
  const today = new Date();
  if (preset === 'week') return {
    from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    to:   format(endOfWeek(today,   { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  };
  if (preset === 'month') return {
    from: format(startOfMonth(today), 'yyyy-MM-dd'),
    to:   format(endOfMonth(today),   'yyyy-MM-dd'),
  };
  if (preset === 'year') return {
    from: format(startOfYear(today), 'yyyy-MM-dd'),
    to:   format(endOfYear(today),   'yyyy-MM-dd'),
  };
  // last month
  const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return {
    from: format(startOfMonth(lm), 'yyyy-MM-dd'),
    to:   format(endOfMonth(lm),   'yyyy-MM-dd'),
  };
}

export default function TimesheetPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('timesheet');
  const { user } = useAuth();
  const isAdmin = user?.is_admin === 1 || user?.is_admin === '1';

  // ── filters ──────────────────────────────────────────────────────────────
  const [preset,     setPreset]     = useState('year');
  const [dateFrom,   setDateFrom]   = useState(() => getRangePreset('year').from);
  const [dateTo,     setDateTo]     = useState(() => getRangePreset('year').to);
  const [filterProject, setFilterProject] = useState('__all__');
  const [filterUser,    setFilterUser]    = useState('__all__');
  const [filterType,    setFilterType]    = useState('__all__');
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set());
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // ── edit timesheet entry dialog ───────────────────────────────────────────
  const [editEntry, setEditEntry]   = useState<DbTimesheetEntry | null>(null);
  const [editForm,  setEditForm]    = useState({ hours_worked: '', description: '', date: '', work_type: '' });

  // ── promote subtask → task dialog ────────────────────────────────────────
  const [promoteEntry, setPromoteEntry] = useState<DbTimesheetEntry | null>(null);
  const [promoteProjectId, setPromoteProjectId] = useState('');

  const openPromote = (e: DbTimesheetEntry) => {
    setPromoteEntry(e);
    setPromoteProjectId(e.project_id || '');
  };

  // ── edit task (TaskDetailSheet) ───────────────────────────────────────────
  const [editTaskId,   setEditTaskId]   = useState<string | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);

  const { data: editTaskData } = useQuery<any>({
    queryKey: ['task', 'detail', editTaskId],
    queryFn: () => apiFetch(`/tasks.php?id=${editTaskId}`),
    enabled: !!editTaskId,
    staleTime: 30_000,
  });

  const openTaskEdit = (taskId: string) => {
    setEditTaskId(taskId);
    setTaskSheetOpen(true);
  };

  // ── data ──────────────────────────────────────────────────────────────────
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  if (filterUser !== '__all__' && isAdmin) params.set('user_id', filterUser);

  const { data: entries = [], isLoading } = useQuery<DbTimesheetEntry[]>({
    queryKey: ['timesheet', 'all', dateFrom, dateTo, filterUser],
    queryFn: () => apiFetch(`/timesheet.php?${params}`),
    enabled: !!user,
  });

  const { data: projects = [] } = useProjects();

  // Only admins need user list; non-admin sees own entries only
  const { data: usersRaw = [] } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/users.php?active_only=1'),
    enabled: isAdmin,
  });

  // ── mutations ─────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/timesheet.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet'] }); toast({ title: 'แก้ไขแล้ว' }); setEditEntry(null); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/timesheet.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheet'] }); toast({ title: 'ลบรายการแล้ว' }); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/tasks.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheet'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'ลบงานแล้ว' });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  // Promote subtask → standalone task (keep in project)
  const promoteMutation = useMutation({
    mutationFn: ({ id, project_id }: { id: string; project_id: string }) =>
      apiFetch(`/tasks.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ parent_task_id: null, is_subtask: 0, project_id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheet'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setPromoteEntry(null);
      toast({ title: 'ย้ายเป็น task หลักแล้ว' });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  // ── filter & group ────────────────────────────────────────────────────────
  const filtered = useMemo(() => entries.filter(e => {
    if (filterProject !== '__all__' && e.project_id !== filterProject) return false;
    if (filterType    !== '__all__' && e.work_type   !== filterType)    return false;
    return true;
  }), [entries, filterProject, filterType]);

  // Group by parent task
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; taskTitle: string; projectName: string; projectId: string; entries: DbTimesheetEntry[]; totalHours: number }>();
    for (const e of filtered) {
      const key = e.parent_task_id ?? `no-task-${e.work_type}`;
      if (!map.has(key)) map.set(key, { key, taskTitle: e.task_title || 'ไม่มีงานที่เชื่อมโยง', projectName: e.project_name || '-', projectId: e.project_id || '', entries: [], totalHours: 0 });
      const g = map.get(key)!;
      g.entries.push(e);
      g.totalHours += Number(e.hours_worked) || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filtered]);

  const totalHours   = filtered.reduce((s, e) => s + (Number(e.hours_worked) || 0), 0);
  const totalDays    = Math.round(totalHours / 8 * 10) / 10;
  const uniqueProj   = new Set(filtered.map(e => e.project_id).filter(Boolean)).size;
  const uniqueUsers  = new Set(filtered.map(e => e.user_id)).size;

  const toggle = (key: string) => setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const applyPreset = (p: string) => {
    setPreset(p);
    const r = getRangePreset(p);
    setDateFrom(r.from); setDateTo(r.to);
  };

  const openEdit = (e: DbTimesheetEntry) => {
    setEditEntry(e);
    setEditForm({ hours_worked: String(e.hours_worked), description: e.description || '', date: e.work_date || e.date, work_type: e.work_type || 'work' });
  };

  const filtersContent = (
    <>
      {/* Date preset buttons */}
      {[['week','สัปดาห์นี้'],['month','เดือนนี้'],['lastmonth','เดือนที่แล้ว'],['year','ปีนี้']].map(([v, l]) => (
        <button key={v} onClick={() => applyPreset(v)}
          className={cn('px-3 py-1 rounded-full text-xs border transition-colors shrink-0', preset === v ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:bg-muted')}>
          {l}
        </button>
      ))}
      <span className="text-xs text-muted-foreground shrink-0">หรือเลือกเอง:</span>
      <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset('custom'); }} className="w-32 h-8 text-xs shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">&ndash;</span>
      <Input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPreset('custom'); }} className="w-32 h-8 text-xs shrink-0" />

      <div className="w-px h-6 bg-border shrink-0" />

      {/* Project filter */}
      <Select value={filterProject} onValueChange={setFilterProject}>
        <SelectTrigger className="w-40 h-8 text-xs shrink-0"><SelectValue placeholder="ทุกโปรเจกต์" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกโปรเจกต์</SelectItem>
          {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Type filter */}
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="w-36 h-8 text-xs shrink-0"><SelectValue placeholder="ทุกประเภท" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกประเภท</SelectItem>
          {Object.entries(WORK_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* User filter (admin only) */}
      {isAdmin && (
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-40 h-8 text-xs shrink-0"><SelectValue placeholder="ทุกคน" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">ทุกคน</SelectItem>
            {usersRaw.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {(filterProject !== '__all__' || filterType !== '__all__' || filterUser !== '__all__') && (
        <button onClick={() => { setFilterProject('__all__'); setFilterType('__all__'); setFilterUser('__all__'); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-3 w-3" />ล้างตัวกรอง
        </button>
      )}
    </>
  );

  return (
    <PageShell
      breadcrumbs={[
        { label: 'โปรเจกต์', href: '/#/projects' },
        { label: 'บันทึกชั่วโมงงาน', isCurrent: true },
      ]}
      title="บันทึกชั่วโมงงาน"
      description="บันทึกชั่วโมงทำงานและจัดการงานที่ทำซ้ำ"
      actions={
        activeTab === 'timesheet'
          ? <CreateTimesheetEntryDialog buttonLabel="+ บันทึกชั่วโมง" onSuccess={() => qc.invalidateQueries({ queryKey: ['timesheet'] })} />
          : null
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="mb-2 flex w-full sm:grid sm:grid-cols-2 h-auto">
            <TabsTrigger value="timesheet" className="shrink-0"><Clock className="h-4 w-4 mr-1.5" />บันทึกชั่วโมง</TabsTrigger>
            <TabsTrigger value="recurring" className="shrink-0"><span className="mr-1.5">🔄</span>งานที่ทำซ้ำ</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="timesheet" className="space-y-4 mt-0">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">ชั่วโมงรวม</p><p className="text-3xl font-bold text-primary">{totalHours.toFixed(1)}</p><p className="text-xs text-muted-foreground">ชม.</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">เทียบเป็นวัน</p><p className="text-3xl font-bold text-blue-500">{totalDays}</p><p className="text-xs text-muted-foreground">วัน (÷8)</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">รายการ</p><p className="text-3xl font-bold text-green-500">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">{isAdmin ? 'ผู้ใช้' : 'โปรเจกต์'}</p><p className="text-3xl font-bold text-amber-500">{isAdmin ? uniqueUsers : uniqueProj}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="rounded-lg border p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" />ตัวกรอง</div>
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFiltersMobile(v => !v)}
            className={`h-9 w-9 shrink-0 rounded-md border flex items-center justify-center transition-colors sm:hidden ${showFiltersMobile ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
            title="ตัวกรอง"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop filters */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {filtersContent}
        </div>

        {/* Mobile filters (collapsible) */}
        {showFiltersMobile && (
          <div className="sm:hidden flex flex-wrap items-center gap-2 pt-1 border-t">
            {filtersContent}
          </div>
        )}
      </div>

      {/* Entries list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground rounded-lg border">
          <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>ไม่พบรายการบันทึกชั่วโมงในช่วงเวลาที่เลือก</p>
          <p className="text-xs mt-1">ลองปรับช่วงวันที่หรือสร้างรายการใหม่</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {groups.map(g => (
              <Card key={g.key}>
                <CardContent className="pt-3 pb-3">
                  {/* Group header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{g.taskTitle}</p>
                      <p className="text-xs text-muted-foreground">{g.projectName} · {g.entries.length} รายการ</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-primary shrink-0 ml-2">{g.totalHours.toFixed(1)} ชม.</span>
                  </div>
                  {/* Task actions */}
                  {g.key && !g.key.startsWith('no-task-') && (
                    <div className="flex gap-1 mb-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTaskEdit(g.key)}>
                        <ExternalLink className="h-3 w-3 mr-1" />แก้ไขงาน
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive"
                        disabled={deleteTaskMutation.isPending}
                        onClick={async () => {
                          if (await confirm({ title: 'ลบงาน', description: 'ลบงานนี้ รวมถึง subtasks และ timesheet ที่เกี่ยวข้อง?', variant: 'destructive' }))
                            deleteTaskMutation.mutate(g.key);
                        }}>
                        <Trash2 className="h-3 w-3 mr-1" />ลบ
                      </Button>
                    </div>
                  )}
                  {/* Entry rows */}
                  <div className="space-y-2">
                    {g.entries.map(e => (
                      <div key={e.id} className="flex items-start gap-2 bg-muted/30 rounded-md px-2.5 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm">{e.entry_title || e.description || '—'}</span>
                            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', WORK_TYPE_COLORS[e.work_type] || WORK_TYPE_COLORS.work)}>
                              {WORK_TYPE_LABELS[e.work_type] || e.work_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{safeFmt(e.work_date || e.date)}</span>
                            {e.start_time && e.end_time && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.start_time.slice(0,5)} – {e.end_time.slice(0,5)}</span>
                            )}
                            {isAdmin && e.user_name && (
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.user_name}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">{Number(e.hours_worked).toFixed(1)} ชม.</span>
                        <div className="flex gap-0.5 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="แก้ไขรายการ" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="ลบรายการ"
                            onClick={async () => { if (await confirm({ title: 'ลบรายการ', description: 'ลบรายการนี้?', variant: 'destructive' })) deleteMutation.mutate(e.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="ย้ายเป็น task หลัก" onClick={() => openPromote(e)}>
                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Mobile footer total */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 font-semibold text-sm rounded-md border">
              <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-primary" />รวมทั้งหมด</span>
              <span className="text-primary tabular-nums">{totalHours.toFixed(1)} ชม. ({totalDays} วัน)</span>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="rounded-lg border divide-y">
              {groups.map(g => {
                const isOpen = expanded.has(g.key);
                return (
                  <div key={g.key}>
                    {/* Task group header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors group/header"
                      onClick={() => toggle(g.key)}
                    >
                      <button className="text-muted-foreground shrink-0">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{g.taskTitle}</p>
                        <p className="text-xs text-muted-foreground">{g.projectName} · {g.entries.length} รายการ</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-primary shrink-0">
                        {g.totalHours.toFixed(1)} ชม.
                      </span>
                      {g.key && !g.key.startsWith('no-task-') && (
                        <>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0"
                            title="แก้ไขงาน"
                            onClick={ev => { ev.stopPropagation(); openTaskEdit(g.key); }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                            title="ลบงาน"
                            disabled={deleteTaskMutation.isPending}
                            onClick={async ev => {
                              ev.stopPropagation();
                              if (await confirm({ title: 'ลบงาน', description: 'ลบงานนี้ รวมถึง subtasks และ timesheet ที่เกี่ยวข้อง?', variant: 'destructive' })) deleteTaskMutation.mutate(g.key);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Entry rows */}
                    {isOpen && g.entries.map(e => (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors group border-t border-border/50 pl-12">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm">{e.entry_title || e.description || '—'}</span>
                            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', WORK_TYPE_COLORS[e.work_type] || WORK_TYPE_COLORS.work)}>
                              {WORK_TYPE_LABELS[e.work_type] || e.work_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{safeFmt(e.work_date || e.date)}</span>
                            {e.start_time && e.end_time && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.start_time.slice(0,5)} – {e.end_time.slice(0,5)}</span>
                            )}
                            {isAdmin && e.user_name && (
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.user_name}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">{Number(e.hours_worked).toFixed(1)} ชม.</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="แก้ไขรายการ" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="ลบรายการ"
                            onClick={async () => { if (await confirm({ title: 'ลบรายการ', description: 'ลบรายการนี้?', variant: 'destructive' })) deleteMutation.mutate(e.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="ย้ายเป็น task หลัก"
                            onClick={() => openPromote(e)}
                          >
                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Footer total */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 font-semibold text-sm">
                <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-primary" />รวมทั้งหมด</span>
                <span className="text-primary tabular-nums">{totalHours.toFixed(1)} ชม. ({totalDays} วัน)</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Task detail / edit sheet */}
      <TaskDetailSheet
        task={editTaskData ?? null}
        open={taskSheetOpen}
        onOpenChange={(o) => { setTaskSheetOpen(o); if (!o) setEditTaskId(null); }}
      />

      {/* Promote subtask → task dialog */}
      <Dialog open={!!promoteEntry} onOpenChange={(o) => { if (!o) setPromoteEntry(null); }}>
        <DialogContent className="w-full sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ย้ายเป็น task หลัก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="font-medium truncate">{promoteEntry?.entry_title || promoteEntry?.description || '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">จาก: {promoteEntry?.task_title || 'ไม่มี task หลัก'}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">เก็บไว้ใน project</Label>
              <Select value={promoteProjectId || '__none__'} onValueChange={v => setPromoteProjectId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="ไม่ระบุ project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ไม่ระบุ project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteEntry(null)}>ยกเลิก</Button>
            <Button
              disabled={promoteMutation.isPending}
              onClick={() => promoteEntry && promoteMutation.mutate({ id: promoteEntry.id, project_id: promoteProjectId })}
            >
              {promoteMutation.isPending ? 'กำลังย้าย...' : 'ย้ายเป็น task หลัก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit timesheet entry dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => { if (!o) setEditEntry(null); }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader><DialogTitle>แก้ไขบันทึกชั่วโมง</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>วันที่</Label>
              <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>ชั่วโมงทำงาน</Label>
              <Input type="number" step="0.5" min="0.5" max="24"
                value={editForm.hours_worked}
                onChange={e => setEditForm(f => ({ ...f, hours_worked: e.target.value }))} />
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {['0.5','1','2','4','6','8'].map(h => (
                  <button key={h} type="button"
                    onClick={() => setEditForm(f => ({ ...f, hours_worked: h }))}
                    className={cn('px-2 py-0.5 rounded text-xs border transition-colors',
                      editForm.hours_worked === h ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:bg-muted')}>
                    {h} ชม.
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>ประเภทงาน</Label>
              <Select value={editForm.work_type} onValueChange={v => setEditForm(f => ({ ...f, work_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(WORK_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>ยกเลิก</Button>
            <Button disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({
                id: editEntry!.id,
                hours_worked: parseFloat(editForm.hours_worked),
                date: editForm.date,
                work_type: editForm.work_type,
                description: editForm.description,
              })}>
              {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="recurring" className="mt-0">
          <RecurringTasksContent />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
