import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjects, useUsers } from '@/hooks/useProjectData';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import thLocale from '@fullcalendar/core/locales/th';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Pencil } from 'lucide-react';
import ProjectFilterSelect from '@/components/ProjectFilterSelect';
import { CalendarPlus, ClipboardList } from 'lucide-react';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';

interface TaskCalendarViewProps {
  projectId?: string;
  onTaskClick?: (task: any) => void;
  onDateClick?: (date: string) => void;
  onAddSubtask?: (parentTask: any) => void;
  onCreateTask?: () => void;
  onCreateEvent?: () => void;
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
  recurrence: string;
  assignee_user_id: string;
}

const defaultEditForm = (): EventFormData => {
  const today = new Date().toISOString().split('T')[0];
  return {
    title: '',
    event_type: 'meeting',
    start_at: today + 'T09:00',
    end_at: today + 'T10:00',
    all_day: false,
    description: '',
    recurrence: 'none',
    assignee_user_id: '',
  };
};

export default function TaskCalendarView({ projectId, onTaskClick, onDateClick, onAddSubtask, onCreateTask, onCreateEvent }: TaskCalendarViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const calendarRef = useRef<any>(null);

  const { taskTypes, eventTypes, activeTaskTypes, activeEventTypes, taskTypeLabels, eventTypeLabels, typeColors } = useWorkTypeCatalog();

  // Merge both catalogs for the unified type filter (show all, user toggles what to display)
  const allCatalogTypes = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; color: string }>();
    for (const t of [...taskTypes, ...eventTypes]) {
      if (!byKey.has(t.key)) {
        byKey.set(t.key, { key: t.key, label: t.label, color: t.color });
      }
    }
    return [...byKey.values()];
  }, [taskTypes, eventTypes]);

  const defaultActiveKeys = useMemo(
    () => new Set([...activeTaskTypes.map(t => t.key), ...activeEventTypes.map(t => t.key)]),
    [activeTaskTypes, activeEventTypes]
  );

  const today = new Date();
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return d.toISOString().split('T')[0];
  });
  const [rangeEnd, setRangeEnd] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return d.toISOString().split('T')[0];
  });

  const [filterProjectId, setFilterProjectId] = useState(projectId || '__all__');
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(defaultActiveKeys));
  const [initialized, setInitialized] = useState(false);

  // Sync initial activeTypes with catalog once it loads
  useEffect(() => {
    if (!initialized && defaultActiveKeys.size > 0) {
      setActiveTypes(new Set(defaultActiveKeys));
      setInitialized(true);
    }
  }, [defaultActiveKeys, initialized]);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Single source of truth: same calendar.php endpoint as CalendarPage
  // Only fetch the visible range (set by datesSet) — not all 11 years
  const { data: calendarItems = [] } = useQuery<any[]>({
    queryKey: ['calendar-all', projectId ?? '__all__', filterAssignee, rangeStart, rangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
      if (projectId) params.set('project_id', projectId);
      if (filterAssignee) params.set('user_id', filterAssignee);
      const res: any = await apiFetch(`/calendar.php?${params.toString()}`);
      return Array.isArray(res) ? res : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch full task from tasks.php when clicked (calendar.php tasks lack detail fields)
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const { data: fetchedTask } = useQuery<any>({
    queryKey: ['task-detail', fetchingId],
    queryFn: () => apiFetch(`/tasks.php?id=${fetchingId}`),
    enabled: !!fetchingId,
  });
  useEffect(() => {
    if (fetchedTask && fetchingId) {
      onTaskClick?.(fetchedTask);
      setFetchingId(null);
    }
  }, [fetchedTask, fetchingId, onTaskClick]);

  // --- Calendar event detail + edit state ---
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editForm, setEditForm] = useState<EventFormData>(defaultEditForm());
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const isAdmin = user?.is_admin === 1;

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
      recurrence: ev.recurrence || 'none',
      assignee_user_id: ev.assignee_user_id || '',
    });
    setEditingEventId(ev.id);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/calendar.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-all'] });
      setShowDetailDialog(false);
      toast({ title: 'สำเร็จ', description: 'ลบนัดหมายแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & EventFormData) => {
      const body: any = {
        title: data.title,
        event_type: data.event_type,
        start_at: data.all_day ? data.start_at.split('T')[0] + ' 00:00:00' : data.start_at.replace('T', ' ') + ':00',
        end_at: data.all_day ? data.end_at.split('T')[0] + ' 23:59:59' : data.end_at.replace('T', ' ') + ':00',
        all_day: data.all_day ? 1 : 0,
        description: data.description,
        recurrence: data.recurrence === 'none' ? null : data.recurrence,
        assignee_user_id: data.assignee_user_id || null,
      };
      return apiFetch(`/calendar.php?id=${data.id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-all'] });
      setShowEditDialog(false);
      setShowDetailDialog(false);
      toast({ title: 'สำเร็จ', description: 'อัปเดตนัดหมายแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    },
  });

  const handleEditSubmit = () => {
    if (!editForm.title.trim()) {
      toast({ title: 'กรุณาระบุชื่อนัดหมาย', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({ id: editingEventId!, ...editForm });
  };

  const toggleType = (key: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const events = useMemo(() => {
    // Normalise all items to a common shape using calendar.php's unified schema
    return calendarItems
      .filter((e: any) => {
        if (e.status === 'cancelled') return false;
        if (!e.start_at) return false;

        // Project filter (only when component is not scoped to a single project)
        if (!projectId && filterProjectId && filterProjectId !== '__all__') {
          if (e.project_id !== filterProjectId) return false;
        }

        return true;
      })
      .map((e: any) => {
        const wtKey = e.event_type || 'task';
        const color = typeColors[wtKey] || typeColors.task || '#6b7280';

        const startDate = e.start_at.split(' ')[0];
        const endDate   = (e.end_at ?? e.start_at).split(' ')[0];
        // UTC-safe exclusive end (same formula as CalendarPage)
        const [y, mo, day] = endDate.split('-').map(Number);
        const endExclusive = new Date(Date.UTC(y, mo - 1, day + 1)).toISOString().split('T')[0];

        const isSubtask = !!e.parent_task_id;
        const title = isSubtask ? `↳ ${e.title}` : e.title;

        return {
          id:              e.source === 'task' ? `task-${e.id}` : `cal-${e.id}`,
          title,
          sortOrder:       (e.parent_task_id || e.id) + '__' + (e.parent_task_id ? '1' : '0'),
          start:           startDate,
          end:             endExclusive,
          allDay:          true,
          backgroundColor: color,
          borderColor:     color,
          classNames:      isSubtask ? ['calendar-subtask'] : [],
          extendedProps:   { raw: { ...e, _wtKey: wtKey } },
        };
      });
  }, [calendarItems, projectId, filterProjectId, typeColors]);

  const filteredEvents = useMemo(
    () => events.filter(e => activeTypes.has(e.extendedProps.raw._wtKey)),
    [events, activeTypes],
  );

  const hasCreateActions = !!(onCreateTask || (onCreateEvent && isAdmin));

  return (
    <div className="space-y-3">
      {/* Filters + Add button — wraps on desktop, scrolls on mobile */}
      <div className="flex items-start sm:items-center gap-2 flex-col sm:flex-row">
        <div className="flex-1 min-w-0 w-full sm:w-auto flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">แสดง:</span>
          {allCatalogTypes.map((type) => {
            const active = activeTypes.has(type.key);
            return (
              <button
                key={type.key}
                onClick={() => toggleType(type.key)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] transition-colors shrink-0 ${
                  active
                    ? 'border-border bg-background text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground/40 line-through'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: active ? type.color : '#d1d5db' }}
                />
                {type.label}
              </button>
            );
          })}
          <button
            onClick={() => setActiveTypes(new Set(defaultActiveKeys))}
            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
          >
            รีเซ็ต
          </button>
          {!projectId && (
            <>
              <span className="w-px h-4 bg-border mx-0.5 shrink-0" />
              <span className="text-[11px] text-muted-foreground shrink-0">โปรเจค:</span>
              <ProjectFilterSelect
                value={filterProjectId}
                onChange={(v) => setFilterProjectId(v)}
                options={[
                  { value: '__all__', label: 'ทั้งหมด' },
                  ...[...projects]
                    .filter((p: any) => p.kind !== 'base_calendar')
                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'th'))
                    .map((p: any) => ({ value: p.id, label: p.name })),
                ]}
                placeholder="ทั้งหมด"
                className="w-[160px] shrink-0"
              />
            </>
          )}
          <span className="w-px h-4 bg-border mx-0.5 shrink-0" />
          <span className="text-[11px] text-muted-foreground shrink-0">คน:</span>
          <ProjectFilterSelect
            value={filterAssignee || '__all__'}
            onChange={(v) => setFilterAssignee(v === '__all__' ? '' : v)}
            options={[
              { value: '__all__', label: 'ทุกคน' },
              ...users.map((u) => ({ value: u.id, label: u.display_name })),
            ]}
            placeholder="ทุกคน"
            className="w-[150px] shrink-0"
          />
        </div>
        {hasCreateActions && (
          <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
            {onCreateEvent && isAdmin && (
              <Button size="sm" variant="outline" onClick={onCreateEvent} title="วันหยุดบริษัท / กิจกรรมที่ไม่นับชั่วโมง (admin เท่านั้น)" className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-initial">
                <CalendarPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                <span className="hidden sm:inline">วันหยุด</span>
                <span className="sm:hidden">หยุด</span>
              </Button>
            )}
            {onCreateTask && (
              <Button size="sm" onClick={onCreateTask} title="บันทึกงาน ประชุม ลา ในปฏิทินทีม — นับชั่วโมงและติดตามได้" className="text-xs sm:text-sm px-2 sm:px-3 flex-1 sm:flex-initial">
                <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                <span className="hidden sm:inline">บันทึกงาน</span>
                <span className="sm:hidden">งาน</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* FullCalendar */}
      <Card>
        <CardContent className="pt-4 fc-theme-card">
          <style>{`
            .fc-theme-card .fc-toolbar-title { font-size: 1.1rem; font-weight: 700; }
            .fc-theme-card .fc-button {
              background: hsl(var(--primary)) !important;
              border-color: hsl(var(--primary)) !important;
              font-size: 0.75rem !important;
              padding: 0.25rem 0.6rem !important;
              min-height: 2rem;
            }
            .fc-theme-card .fc-button:hover { opacity: 0.85; }
            .fc-theme-card .fc-button-active { opacity: 0.7 !important; }
            .fc-theme-card .fc-event { border-radius: 4px; font-size: 0.72rem; cursor: pointer; }
            .fc-theme-card .fc-daygrid-event { padding: 2px 4px; }
            .fc-theme-card .fc-event-main { overflow: hidden; }
            .fc-theme-card .fc-event.calendar-subtask { padding-left: 0; opacity: 0.9; }
            .fc-theme-card .fc-event.calendar-subtask .fc-subtask-inner { display: flex; align-items: center; }
            .fc-theme-card .fc-list-event.calendar-subtask td { padding-left: 24px !important; border-left: 3px solid rgba(0,0,0,0.15); }
            .fc-theme-card .fc-daygrid-day { cursor: default; }
            .fc-theme-card .fc-list-event:hover td { background: hsl(var(--muted)); }
            @media (max-width: 639px) {
              .fc-theme-card .fc-toolbar { flex-wrap: wrap; gap: 0.3rem; }
              .fc-theme-card .fc-toolbar-title { font-size: 0.85rem; }
              .fc-theme-card .fc-button { font-size: 0.7rem !important; padding: 0.2rem 0.45rem !important; }
              .fc-theme-card .fc-daygrid-day-number { font-size: 0.7rem; }
              .fc-theme-card .fc-col-header-cell-cushion { font-size: 0.7rem; padding: 1px; }
              .fc-theme-card .fc-footer-toolbar { margin-top: 0.5rem !important; padding-top: 0.25rem !important; border-top: 1px solid hsl(var(--border)); }
            }
          `}</style>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            locales={[thLocale]}
            locale="th"
            headerToolbar={isMobile ? {
              left:   'prev,next',
              center: 'title',
              right:  'today',
            } : {
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,listMonth',
            }}
            footerToolbar={isMobile ? { center: 'dayGridMonth,listMonth' } : undefined}
            buttonText={{ today: 'วันนี้', month: 'เดือน', list: 'รายการ' }}
            events={filteredEvents}
            datesSet={(arg) => {
              setRangeStart(arg.startStr.split('T')[0]);
              setRangeEnd(arg.endStr.split('T')[0]);
            }}
            dateClick={(info) => onDateClick?.(info.dateStr)}
            eventClick={(info) => {
              const raw = info.event.extendedProps.raw;
              if (raw.source === 'calendar') {
                setSelectedEvent(raw as CalendarEvent);
                populateEditForm(raw as CalendarEvent);
                setShowDetailDialog(true);
                return;
              }
              // Fetch full task data before opening detail sheet
              setFetchingId(raw.id);
            }}
            height="auto"
            eventOrder="sortOrder"
            dayMaxEvents={false}
            moreLinkText={(n) => `+${n} รายการ`}
            eventContent={(arg) => {
              const isSub = arg.event.extendedProps?.raw?.parent_task_id;
              if (isSub) {
                return (
                  <div className="overflow-hidden w-full leading-tight">
                    <div className="fc-subtask-inner font-medium truncate pl-2 border-l-[3px] border-l-white/40 ml-0.5 text-[0.92em]">{arg.event.title}</div>
                  </div>
                );
              }
              return (
                <div className="overflow-hidden w-full leading-tight">
                  <div className="font-medium truncate">{arg.event.title}</div>
                </div>
              );
            }}
          />
        </CardContent>
      </Card>

      {/* Detail Dialog — calendar events only */}
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
              onClick={() => selectedEvent && deleteMutation.mutate(selectedEvent.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'กำลังลบ...' : 'ลบ'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDetailDialog(false)}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={() => { setShowDetailDialog(false); setShowEditDialog(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              แก้ไข
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
                  {activeEventTypes
                    .filter((t) => isAdmin || t.key !== 'holiday')
                    .map((t) => (
                      <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {editForm.event_type === 'leave' && (
              <div className="space-y-1.5">
                <Label>ผู้ลา</Label>
                <Select
                  value={editForm.assignee_user_id || '__none__'}
                  onValueChange={v => setEditForm(f => ({ ...f, assignee_user_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="เลือกผู้ลา..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ยังไม่ระบุ —</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                id="all-day-edit-tcv"
                checked={editForm.all_day}
                onCheckedChange={v => setEditForm(f => ({ ...f, all_day: v }))}
              />
              <Label htmlFor="all-day-edit-tcv">ทั้งวัน</Label>
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
    </div>
  );
}
