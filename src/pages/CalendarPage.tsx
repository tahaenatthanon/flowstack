import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useBaseCalendar, useProjects, useUsers } from '@/hooks/useProjectData';
import TaskDetailSheet from '@/components/TaskDetailSheet';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import type { DbTask } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import PageShell from '@/components/PageShell';
import ProjectFilterSelect from '@/components/ProjectFilterSelect';
import { RefreshCw, FolderKanban, Pencil, CalendarPlus, ClipboardList, Filter, Info } from 'lucide-react';
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';

interface CalendarFilterPreferences {
  visibleTypes?: string[];
  projectId?: string;
  assigneeId?: string;
}

const getCalendarFilterStorageKey = (userId?: string) => `calendar-page-filters:v1:${userId || 'guest'}`;

function readCalendarFilterPreferences(userId?: string): CalendarFilterPreferences {
  try {
    const raw = localStorage.getItem(getCalendarFilterStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeCalendarFilterPreferences(userId: string | undefined, data: CalendarFilterPreferences) {
  try {
    localStorage.setItem(getCalendarFilterStorageKey(userId), JSON.stringify(data));
  } catch {
    // Ignore storage failures (private mode/quota) and continue with in-memory state.
  }
}

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  all_day: number;
  description?: string;
  status: string;
  source: 'calendar' | 'task';
  created_by_name?: string;
  created_by?: string;
  project_id?: string;
  parent_task_id?: string | null;
  assignee?: string;
  assignee_user_id?: string;
  assignee_name?: string;
  recurrence?: string | null;
}

interface EventFormData {
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  description: string;
  project_id: string;
  recurrence: string;
  assignee_user_id: string;
}

function ProjectTypeahead({ projects, baseCalendar, value, onChange }: {
  projects: any[];
  baseCalendar?: any;
  value: string;
  onChange: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const allOptions = [
    { id: '', name: 'ไม่ระบุโปรเจค' },
    ...(baseCalendar?.id ? [{ id: baseCalendar.id, name: '📅 Team Calendar' }] : []),
    ...projects.filter((p: any) => p.kind !== 'base_calendar').map((p: any) => ({ id: p.id, name: p.name })),
  ];
  const selected = allOptions.find(o => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-sm font-normal">
          {selected ? selected.name : 'ค้นหาโปรเจค...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="พิมพ์ค้นหาโปรเจค..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs p-2">ไม่พบโปรเจค</CommandEmpty>
            <CommandGroup>
              {allOptions.map((opt) => (
                <CommandItem key={opt.id || '__none__'} value={opt.name}
                  className="text-xs cursor-pointer"
                  onSelect={() => { onChange(opt.id); setOpen(false); }}>
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const makeDefaultForm = (isAdmin?: boolean): EventFormData => {
  const today = new Date().toISOString().split('T')[0];
  return {
    title: '',
    event_type: isAdmin ? 'holiday' : 'other',
    start_at: today + 'T09:00',
    end_at: today + 'T10:00',
    all_day: true,
    description: '',
    project_id: '',
    recurrence: 'none',
    assignee_user_id: '',
  };
};

export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === 1;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: baseCalendar } = useBaseCalendar();
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const { activeTaskTypes, activeEventTypes, taskTypeLabels, eventTypeLabels, typeColors } = useWorkTypeCatalog();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const mergedTypeOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string }>();
    for (const item of [...activeEventTypes, ...activeTaskTypes]) {
      if (!byKey.has(item.key)) {
        byKey.set(item.key, { key: item.key, label: item.label });
      }
    }
    return [...byKey.values()];
  }, [activeEventTypes, activeTaskTypes]);
  const allEventTypes = useMemo(() => mergedTypeOptions.map((t) => t.key), [mergedTypeOptions]);
  const calendarTypeKeys = useMemo(() => activeEventTypes.map((t) => t.key), [activeEventTypes]);
  const taskTypeKeys = useMemo(() => activeTaskTypes.map((t) => t.key), [activeTaskTypes]);
  const defaultVisibleTypeKeys = useMemo(() => {
    return calendarTypeKeys.length > 0 ? calendarTypeKeys : allEventTypes;
  }, [calendarTypeKeys, allEventTypes]);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(defaultVisibleTypeKeys));
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  // Stable refs for values the load effect reads but shouldn't re-trigger on
  const allEventTypesRef = useRef(allEventTypes);
  allEventTypesRef.current = allEventTypes;
  const defaultVisibleTypeKeysRef = useRef(defaultVisibleTypeKeys);
  defaultVisibleTypeKeysRef.current = defaultVisibleTypeKeys;

  const lastAppliedPrefs = useRef<{ visibleTypes: string[]; projectId: string; assigneeId: string }>({ visibleTypes: [], projectId: '', assigneeId: '' });

  // Load saved filter preferences — only on user change, not type-catalog churn
  useEffect(() => {
    const currentAllTypes = allEventTypesRef.current;
    const currentDefaults = defaultVisibleTypeKeysRef.current;
    const preferences = readCalendarFilterPreferences(user?.id);
    const storedVisible = Array.isArray(preferences.visibleTypes)
      ? preferences.visibleTypes.filter((key): key is string => typeof key === 'string' && currentAllTypes.includes(key))
      : [];
    const nextVisibleTypes = storedVisible.length > 0 ? storedVisible : currentDefaults;
    const nextProjectId = typeof preferences.projectId === 'string' ? preferences.projectId : '';
    const nextAssignee = typeof preferences.assigneeId === 'string' ? preferences.assigneeId : '';

    const prev = lastAppliedPrefs.current;
    const same =
      prev.visibleTypes.length === nextVisibleTypes.length &&
      prev.visibleTypes.every((k, i) => k === nextVisibleTypes[i]) &&
      prev.projectId === nextProjectId &&
      prev.assigneeId === nextAssignee;
    if (same) return;

    setVisibleTypes(new Set(nextVisibleTypes));
    setFilterProjectId(nextProjectId);
    setFilterAssignee(nextAssignee);
    lastAppliedPrefs.current = { visibleTypes: nextVisibleTypes, projectId: nextProjectId, assigneeId: nextAssignee };
  }, [user?.id]);

  // Persist filter state to localStorage
  useEffect(() => {
    writeCalendarFilterPreferences(user?.id, {
      visibleTypes: [...visibleTypes],
      projectId: filterProjectId,
      assigneeId: filterAssignee,
    });
  }, [user?.id, visibleTypes, filterProjectId, filterAssignee]);

  const toggleType = (type: string) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const today = new Date();
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const y = today.getFullYear() - 1;
    return `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    const y = today.getFullYear() + 1;
    return `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-28`;
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(() => makeDefaultForm(user?.is_admin === 1));
  const [editForm, setEditForm] = useState<EventFormData>(() => makeDefaultForm(user?.is_admin === 1));
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventSource, setEditingEventSource] = useState<'calendar' | 'task'>('calendar');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [taskSheetData, setTaskSheetData] = useState<DbTask | null>(null);
  const [fetchingTaskSheetId, setFetchingTaskSheetId] = useState<string | null>(null);

  const isSameSet = useCallback((keys: string[]) => {
    if (keys.length !== visibleTypes.size) return false;
    return keys.every((key) => visibleTypes.has(key));
  }, [visibleTypes]);

  const showCalendarOnly = useCallback(() => {
    setVisibleTypes(new Set(calendarTypeKeys));
  }, [calendarTypeKeys]);

  const showTaskOnly = useCallback(() => {
    setVisibleTypes(new Set(taskTypeKeys));
  }, [taskTypeKeys]);

  const showAllTypes = useCallback(() => {
    setVisibleTypes(new Set(allEventTypes));
  }, [allEventTypes]);

  const { data: events = [], isLoading, refetch } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events', rangeStart, rangeEnd, filterProjectId, filterAssignee],
    queryFn: async () => {
      const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
      if (filterProjectId) params.set('project_id', filterProjectId);
      if (filterAssignee) params.set('user_id', filterAssignee);
      const res: any = await apiFetch(`/calendar.php?${params.toString()}`);
      return Array.isArray(res) ? res : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch full task data when opening TaskDetailSheet from calendar.
  // Keep the query active (enabled) while the sheet is open so that
  // cache invalidation from mutations (useUpdateTask etc.) triggers an
  // immediate refetch and the sheet sees fresh data without a page reload.
  const { data: fetchedTaskSheet, isFetching: taskSheetFetching } = useQuery<DbTask>({
    queryKey: ['task', fetchingTaskSheetId],
    queryFn: () => apiFetch(`/tasks.php?id=${fetchingTaskSheetId}`),
    enabled: !!fetchingTaskSheetId,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (fetchedTaskSheet && fetchingTaskSheetId && fetchedTaskSheet.id === fetchingTaskSheetId) {
      setTaskSheetData(fetchedTaskSheet);
      setTaskSheetOpen(true);
    }
  }, [fetchedTaskSheet, fetchingTaskSheetId]);

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const body: any = {
        title: data.title,
        event_type: data.event_type,
        start_at: data.all_day ? data.start_at.split('T')[0] + ' 00:00:00' : data.start_at.replace('T', ' ') + ':00',
        end_at: data.all_day ? data.end_at.split('T')[0] + ' 23:59:59' : data.end_at.replace('T', ' ') + ':00',
        all_day: data.all_day ? 1 : 0,
        description: data.description,
        project_id: data.project_id || null,
        recurrence: data.recurrence === 'none' ? null : data.recurrence,
        assignee_user_id: data.assignee_user_id || null,
      };
      return apiFetch('/calendar.php', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setShowCreateDialog(false);
      setForm(makeDefaultForm(isAdmin));
      toast({ title: 'สำเร็จ', description: 'เพิ่มนัดหมายเรียบร้อยแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/calendar.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setShowDetailDialog(false);
      toast({ title: 'สำเร็จ', description: 'ยกเลิกนัดหมายแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    },
  });

  const moveToTaskMutation = useMutation({
    mutationFn: async (event: CalendarEvent) => {
      const startDate = (event.all_day ? event.start_at.split(' ')[0] : event.start_at.split(' ')[0]);
      const endDate = (event.all_day ? event.end_at.split(' ')[0] : event.end_at.split(' ')[0]);
      const targetProjectId = event.project_id || baseCalendar?.id;
      if (!targetProjectId) throw new Error('ไม่พบโปรเจกต์ปลายทาง');
      // 1. Create task
      const task = await apiFetch('/tasks.php', {
        method: 'POST',
        body: JSON.stringify({
          project_id: targetProjectId,
          title: event.title,
          description: event.description || '',
          task_type: event.event_type,
          start_date: startDate,
          end_date: endDate,
          estimated_days: 1,
        }),
      });
      // 2. Cancel the original calendar event
      await apiFetch(`/calendar.php?id=${event.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      return task;
    },
    onSuccess: (task: any) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setShowDetailDialog(false);
      // Open the newly created task
      setFetchingTaskSheetId(task.id);
      toast({ title: 'สำเร็จ', description: 'ย้ายนัดหมายเป็นงานโปรเจกต์เรียบร้อยแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; source: 'calendar' | 'task' } & EventFormData) => {
      if (data.source === 'task') {
        const body: any = {
          title: data.title,
          task_type: data.event_type,
          start_date: data.start_at.split('T')[0],
          end_date: data.end_at.split('T')[0],
          description: data.description,
          project_id: data.project_id || null,
        };
        return apiFetch(`/tasks.php?id=${data.id}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      const body: any = {
        title: data.title,
        event_type: data.event_type,
        start_at: data.all_day ? data.start_at.split('T')[0] + ' 00:00:00' : data.start_at.replace('T', ' ') + ':00',
        end_at: data.all_day ? data.end_at.split('T')[0] + ' 23:59:59' : data.end_at.replace('T', ' ') + ':00',
        all_day: data.all_day ? 1 : 0,
        description: data.description,
        project_id: data.project_id || null,
        recurrence: data.recurrence === 'none' ? null : data.recurrence,
        assignee_user_id: data.assignee_user_id || null,
      };
      return apiFetch(`/calendar.php?id=${data.id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setShowEditDialog(false);
      setShowDetailDialog(false);
      toast({ title: 'สำเร็จ', description: 'อัปเดตนัดหมายแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    },
  });

  const fcEvents = events
    .filter(e => e.status !== 'cancelled' && visibleTypes.has(e.event_type))
    .map(e => {
      const startStr = e.all_day ? e.start_at.split(' ')[0] : e.start_at.replace(' ', 'T');
      // FullCalendar uses exclusive end for all-day events — add +1 day so multi-day events
      // render the same as TaskCalendarView (which also uses exclusive end).
      let endStr: string;
      if (e.all_day) {
        const [y, mo, day] = e.end_at.split(' ')[0].split('-').map(Number);
        endStr = new Date(Date.UTC(y, mo - 1, day + 1)).toISOString().split('T')[0];
      } else {
        endStr = e.end_at.replace(' ', 'T');
      }
      const isSubtask = !!e.parent_task_id;
      const prefix = isSubtask ? '↳ ' : '';
      const sourceIcon = e.source === 'task' ? '📋 ' : '';
      const title = `${sourceIcon}${prefix}${e.title}`;
      return {
        id: e.id,
        title,
        sortOrder: (e.parent_task_id || e.id) + "__" + (e.parent_task_id ? "1" : "0"),
        start: startStr,
        end: endStr,
        allDay: e.all_day === 1,
        backgroundColor: typeColors[e.event_type] || '#6b7280',
        borderColor: typeColors[e.event_type] || '#6b7280',
        textColor: '#ffffff',
        classNames: isSubtask ? ['calendar-subtask'] : [],
        extendedProps: e,
      };
    });

  const handleDateSelect = useCallback((arg: DateSelectArg) => {
    const startStr = arg.startStr.includes('T') ? arg.startStr.substring(0, 16) : arg.startStr + 'T09:00';
    const endStr = arg.endStr.includes('T') ? arg.endStr.substring(0, 16) : arg.startStr + 'T10:00';
    setForm({ ...makeDefaultForm(isAdmin), start_at: startStr, end_at: endStr, all_day: !arg.startStr.includes('T') });
    setShowCreateDialog(true);
  }, [isAdmin]);

  const populateEditForm = (ev: CalendarEvent) => {
    const startVal = ev.all_day
      ? ev.start_at.split(' ')[0] + 'T09:00'
      : ev.start_at.replace(' ', 'T');
    const endVal = ev.all_day
      ? ev.end_at.split(' ')[0] + 'T10:00'
      : ev.end_at.replace(' ', 'T');
    setEditForm({
      title: ev.title,
      event_type: ev.event_type,
      start_at: startVal.substring(0, 16),
      end_at: endVal.substring(0, 16),
      all_day: ev.all_day === 1,
      description: ev.description || '',
      project_id: ev.project_id || '',
      recurrence: ev.recurrence || 'none',
      assignee_user_id: ev.assignee_user_id || '',
    });
    setEditingEventId(ev.id);
  };

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const ev = arg.event.extendedProps as CalendarEvent;
    if (ev.source === 'task') {
      setFetchingTaskSheetId(ev.id);
    } else {
      setSelectedEvent(ev);
      populateEditForm(ev);
      setEditingEventSource(ev.source);
      setShowDetailDialog(true);
    }
  }, []);

  const handleDatesSet = useCallback((arg: { startStr: string; endStr: string }) => {
    // Use the exact visible range from FullCalendar.
    // React Query cache (staleTime: 2min) keeps recently viewed months cached.
    // This prevents the query range from growing unboundedly like the old
    // grow-only logic which caused 12-year spans and truncated responses.
    setRangeStart(arg.startStr.split('T')[0]);
    setRangeEnd(arg.endStr.split('T')[0]);
  }, []);

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast({ title: 'กรุณาระบุชื่อนัดหมาย', variant: 'destructive' });
      return;
    }
    createMutation.mutate(form);
  };

  const handleEditSubmit = () => {
    if (!editForm.title.trim()) {
      toast({ title: 'กรุณาระบุชื่อนัดหมาย', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({ id: editingEventId!, source: editingEventSource, ...editForm });
  };

  return (
    <PageShell
      breadcrumbs={[{ label: 'ปฏิทินทีม', isCurrent: true }]}
      title="ปฏิทินทีม"
      description="ดูงานและกิจกรรมของทีม — บันทึกงาน ประชุม และลาใน ปฏิทินทีม (งาน)"
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          {baseCalendar?.id && (
            <Button size="sm" variant="outline" asChild className="text-xs sm:text-sm px-2 sm:px-3" title="เปิด Base Calendar (ปฏิทินทีม) เป็นโปรเจกต์">
              <Link to={`/project/${baseCalendar.id}`}>
                <FolderKanban className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                <span className="hidden sm:inline">เปิดเป็นโปรเจกต์</span>
                <span className="sm:hidden">โปรเจกต์</span>
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => { setForm(makeDefaultForm(isAdmin)); setShowCreateDialog(true); }} title="วันหยุดบริษัท / กิจกรรมที่ไม่นับชั่วโมง (admin เท่านั้น)" className="text-xs sm:text-sm px-2 sm:px-3">
              <CalendarPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
              <span>วันหยุด</span>
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateTaskOpen(true)} title="บันทึกงาน ประชุม ลา ในปฏิทินทีม — นับชั่วโมงและติดตามได้" className="text-xs sm:text-sm px-2 sm:px-3">
            <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
            <span className="hidden sm:inline">บันทึกงาน</span>
            <span className="sm:hidden">งาน</span>
          </Button>
        </div>
      }
    >
      {/* Filter bar — wraps on desktop, scrolls horizontally on mobile */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">แสดง:</span>

          {mergedTypeOptions.map(({ key: type, label }) => {
            const active = visibleTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] transition-colors shrink-0 ${
                  active
                    ? 'border-border bg-background text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground/40 line-through'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: active ? (typeColors[type] || '#6b7280') : '#d1d5db' }} />
                {label}
              </button>
            );
          })}

          <button
            onClick={() => setVisibleTypes(new Set(defaultVisibleTypeKeys))}
            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
          >
            รีเซ็ต
          </button>

          <span className="w-px h-4 bg-border mx-0.5 shrink-0" />

          <button
            onClick={showCalendarOnly}
            className={`px-1.5 py-0.5 rounded border text-[11px] shrink-0 transition-colors ${
              isSameSet(calendarTypeKeys)
                ? 'border-border bg-background text-foreground shadow-sm'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            ปฏิทินเท่านั้น
          </button>
          <button
            onClick={showTaskOnly}
            className={`px-1.5 py-0.5 rounded border text-[11px] shrink-0 transition-colors ${
              isSameSet(taskTypeKeys)
                ? 'border-border bg-background text-foreground shadow-sm'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            disabled={taskTypeKeys.length === 0}
          >
            งานเท่านั้น
          </button>
          <button
            onClick={showAllTypes}
            className={`px-1.5 py-0.5 rounded border text-[11px] shrink-0 transition-colors ${
              isSameSet(allEventTypes)
                ? 'border-border bg-background text-foreground shadow-sm'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            ทั้งหมด
          </button>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFiltersMobile(v => !v)}
            className={`h-7 w-7 shrink-0 rounded-md border flex items-center justify-center transition-colors sm:hidden ${showFiltersMobile ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
            title="ตัวกรอง"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>

          {/* Desktop project/user filters */}
          <span className="w-px h-4 bg-border mx-0.5 shrink-0 hidden sm:block" />
          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">โปรเจค:</span>
          <ProjectFilterSelect
            value={filterProjectId || '__all__'}
            onChange={(v) => setFilterProjectId(v === '__all__' ? '' : v)}
            options={[
              { value: '__all__', label: 'ทั้งหมด' },
              ...[...projects]
                .filter((p: any) => p.kind !== 'base_calendar')
                .sort((a: any, b: any) => a.name.localeCompare(b.name, 'th'))
                .map((p: any) => ({ value: p.id, label: p.name })),
            ]}
            placeholder="ทั้งหมด"
            className="w-[160px] shrink-0 hidden sm:block"
          />
          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">คน:</span>
          <ProjectFilterSelect
            value={filterAssignee || '__all__'}
            onChange={(v) => setFilterAssignee(v === '__all__' ? '' : v)}
            options={[
              { value: '__all__', label: 'ทุกคน' },
              ...users.map((u) => ({ value: u.id, label: u.display_name })),
            ]}
            placeholder="ทุกคน"
            className="w-[150px] shrink-0 hidden sm:block"
          />
        </div>

        {/* Mobile collapsible filters */}
        {showFiltersMobile && (
          <div className="sm:hidden flex flex-wrap items-center gap-2 pt-1 border-t">
            <span className="text-[11px] text-muted-foreground">โปรเจค:</span>
            <ProjectFilterSelect
              value={filterProjectId || '__all__'}
              onChange={(v) => setFilterProjectId(v === '__all__' ? '' : v)}
              options={[
                { value: '__all__', label: 'ทั้งหมด' },
                ...[...projects]
                  .filter((p: any) => p.kind !== 'base_calendar')
                  .sort((a: any, b: any) => a.name.localeCompare(b.name, 'th'))
                  .map((p: any) => ({ value: p.id, label: p.name })),
              ]}
              placeholder="ทั้งหมด"
              className="w-[160px]"
            />
            <span className="text-[11px] text-muted-foreground">คน:</span>
            <ProjectFilterSelect
              value={filterAssignee || '__all__'}
              onChange={(v) => setFilterAssignee(v === '__all__' ? '' : v)}
              options={[
                { value: '__all__', label: 'ทุกคน' },
                ...users.map((u) => ({ value: u.id, label: u.display_name })),
              ]}
              placeholder="ทุกคน"
              className="w-[150px]"
            />
          </div>
        )}
      </div>


      {/* Calendar */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border p-0.5 sm:p-3 overflow-auto"
        style={{ height: isMobile ? 'calc(100vh - 230px)' : 'calc(100vh - 190px)' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={isMobile ? {
            left: 'prev,next',
            center: 'title',
            right: 'today',
          } : {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth',
          }}
          footerToolbar={isMobile ? { center: 'dayGridMonth,timeGridWeek,listMonth' } : undefined}
          locale="th"
          firstDay={1}
          height="100%"
          events={fcEvents}
          selectable
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          buttonText={{ today: 'วันนี้', month: 'เดือน', week: 'สัปดาห์', day: 'วัน', list: 'รายการ' }}
          views={{
            listMonth: { buttonText: 'รายการ' },
          }}
          eventOrder="sortOrder"
          eventContent={(arg) => {
            if (arg.event.extendedProps?.parent_task_id) {
              return (
                <div className="fc-subtask-inner" title={arg.event.title}>
                  {arg.event.title}
                </div>
              );
            }
            return (
              <div className="truncate text-xs px-0.5">
                {arg.event.title}
              </div>
            );
          }}
          eventDisplay="block"
          dayMaxEvents={false}
          moreLinkText={(n) => `+${n} รายการ`}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          titleFormat={isMobile ? { year: 'numeric', month: 'long' } : { year: 'numeric', month: 'long' }}
        />
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="w-full sm:max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAdmin ? 'วันหยุดบริษัท / กิจกรรม' : 'กิจกรรมอื่นๆ'}</DialogTitle>
            <div className="flex items-start gap-1.5 mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                {isAdmin
                  ? 'สำหรับวันหยุดบริษัทและกิจกรรมที่ไม่นับชั่วโมง — ประชุม / ลา / งานให้บันทึกในปฏิทินทีม (งาน)'
                  : 'สำหรับกิจกรรมที่ไม่นับชั่วโมง — ประชุม / ลา / งานให้บันทึกในปฏิทินทีม (งาน)'}
              </p>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ชื่อ *</Label>
              <Input
                placeholder={isAdmin ? 'เช่น วันสงกรานต์, วันหยุดพิเศษ' : 'เช่น กิจกรรมทีม, งานเลี้ยง'}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <Select
                  value={form.event_type}
                  onValueChange={v => setForm(f => ({ ...f, event_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">วันหยุดบริษัท</SelectItem>
                    <SelectItem value="other">กิจกรรมอื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="all-day"
                checked={form.all_day}
                onCheckedChange={v => setForm(f => ({ ...f, all_day: v }))}
              />
              <Label htmlFor="all-day">ทั้งวัน</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>เริ่มต้น</Label>
                <Input
                  type={form.all_day ? 'date' : 'datetime-local'}
                  value={form.all_day ? form.start_at.split('T')[0] : form.start_at}
                  onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>สิ้นสุด</Label>
                <Input
                  type={form.all_day ? 'date' : 'datetime-local'}
                  value={form.all_day ? form.end_at.split('T')[0] : form.end_at}
                  onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>หมายเหตุ</Label>
              <Textarea
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-full sm:max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขนัดหมาย</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ชื่อนัดหมาย *</Label>
              <Input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ประเภท</Label>
              <Select
                value={editForm.event_type}
                onValueChange={v => setEditForm(f => ({ ...f, event_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="holiday">วันหยุดบริษัท</SelectItem>}
                  <SelectItem value="other">กิจกรรมอื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>การทำซ้ำ</Label>
              <Select
                value={editForm.recurrence}
                onValueChange={v => setEditForm(f => ({ ...f, recurrence: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ทำซ้ำ</SelectItem>
                  <SelectItem value="daily">ทุกวัน</SelectItem>
                  <SelectItem value="weekly">ทุกสัปดาห์</SelectItem>
                  <SelectItem value="biweekly">ทุก 2 สัปดาห์</SelectItem>
                  <SelectItem value="monthly">ทุกเดือน</SelectItem>
                  <SelectItem value="yearly">ทุกปี</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="all-day-edit"
                checked={editForm.all_day}
                onCheckedChange={v => setEditForm(f => ({ ...f, all_day: v }))}
              />
              <Label htmlFor="all-day-edit">ทั้งวัน</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>เริ่มต้น</Label>
                <Input
                  type={editForm.all_day ? 'date' : 'datetime-local'}
                  value={editForm.all_day ? editForm.start_at.split('T')[0] : editForm.start_at}
                  onChange={e => setEditForm(f => ({ ...f, start_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>สิ้นสุด</Label>
                <Input
                  type={editForm.all_day ? 'date' : 'datetime-local'}
                  value={editForm.all_day ? editForm.end_at.split('T')[0] : editForm.end_at}
                  onChange={e => setEditForm(f => ({ ...f, end_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>หมายเหตุ</Label>
              <Textarea
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={2}
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog — calendar events only (task events use TaskDetailSheet) */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="w-full sm:max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: selectedEvent ? (typeColors[selectedEvent.event_type] || '#6b7280') : '#6b7280' }}
              />
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3 py-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-20">ประเภท:</span>
                <span>{eventTypeLabels[selectedEvent.event_type] || taskTypeLabels[selectedEvent.event_type] || selectedEvent.event_type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-20">เริ่มต้น:</span>
                <span>{selectedEvent.all_day ? selectedEvent.start_at.split(' ')[0] : selectedEvent.start_at}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-20">สิ้นสุด:</span>
                <span>{selectedEvent.all_day ? selectedEvent.end_at.split(' ')[0] : selectedEvent.end_at}</span>
              </div>
              {selectedEvent.assignee_name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">ผู้ลา:</span>
                  <span>{selectedEvent.assignee_name}</span>
                </div>
              )}
              {selectedEvent.created_by_name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">สร้างโดย:</span>
                  <span>{selectedEvent.created_by_name}</span>
                </div>
              )}
              {selectedEvent.description && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">หมายเหตุ:</span>
                  <span>{selectedEvent.description}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => selectedEvent && cancelMutation.mutate(selectedEvent.id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'กำลังยกเลิก...' : 'ยกเลิก'}
            </Button>
            <Button size="sm" onClick={() => { setShowDetailDialog(false); setShowEditDialog(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              แก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet — right sidebar for task events (same as ProjectDetail) */}
      <TaskDetailSheet
        task={taskSheetData}
        open={taskSheetOpen}
        onOpenChange={(open) => {
          setTaskSheetOpen(open);
          if (!open) {
            setTaskSheetData(null);
            setFetchingTaskSheetId(null);
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
          }
        }}
      />

      {/* Create Task Dialog (reuses same component as ProjectDetail) */}
      <CreateTaskDialog
        externalOpen={createTaskOpen}
        onExternalOpenChange={setCreateTaskOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        }}
      />
    </PageShell>
  );
}
