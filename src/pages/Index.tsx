import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanies, useProjects, useBaseCalendar, useTaskChildren, useDeleteProject, useDeleteTask, useCreateSubtask, useUsers, useUpdateProject, useUpdateTask } from '@/hooks/useProjectData';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import ProjectCard from '@/components/ProjectCard';
import ScrollableKanban from '@/components/ScrollableKanban';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateProjectDialog from '@/components/CreateProjectDialog';
import InsertAdHocTaskDialog from '@/components/InsertAdHocTaskDialog';
import EditProjectDialog from '@/components/EditProjectDialog';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import CreateCalendarEventDialog from '@/components/CreateCalendarEventDialog';
import CreateSubtaskDialog from '@/components/CreateSubtaskDialog';
import TaskDetailSheet from '@/components/TaskDetailSheet';
import TaskDependenciesDialog from '@/components/TaskDependenciesDialog';
import TaskCalendarView from '@/components/TaskCalendarView';
import MyTasksView from '@/components/MyTasksView';
import ProjectReportSheet from '@/components/ProjectReportSheet';
import ResourceWorkloadDashboard from '@/components/ResourceWorkloadDashboard';
import CrossProjectImpactView from '@/components/CrossProjectImpactView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateProjectReport, getProjectStatusColor, getStatusColor, getStatusLabel } from '@/lib/projectUtils';
import { FolderKanban, BarChart3, LayoutGrid, Table as TableIcon, CalendarRange, Users, Search, X, ChevronRight, ChevronDown, Pencil, Trash2, CalendarDays, CheckCircle, AlertTriangle, CheckCircle2, ListTodo, ChevronLeft, Plus, Table2, Kanban, UserCheck, Briefcase, ArrowUpFromLine, Clock, Circle, Link2, Loader2, List, FileText, Filter } from 'lucide-react';
import { addDays, addMonths, differenceInDays, endOfMonth, endOfYear, format, isBefore, isValid, parseISO, startOfMonth, startOfYear } from 'date-fns';
import { safeParseISO, safeFmt } from '@/lib/dateUtils';
import { PROJECT_STATUS_LABELS } from '@/lib/labels';
import PageShell from '@/components/PageShell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import RowsPerPageSelector from '@/components/RowsPerPageSelector';
import { th } from 'date-fns/locale';
import AllTasksTab, { Paginator, GanttRow } from '@/components/AllTasksTab';

const STATUS_OPTIONS = [
  { value: '__all__', label: 'ทุกสถานะ' },
  { value: 'on-track', label: PROJECT_STATUS_LABELS['on-track'] },
  { value: 'at-risk', label: PROJECT_STATUS_LABELS['at-risk'] },
  { value: 'delayed', label: PROJECT_STATUS_LABELS['delayed'] },
  { value: 'completed', label: PROJECT_STATUS_LABELS['completed'] },
];

const GANTT_DAY_WIDTH = 28;

// ─── Paginator ────────────────────────────────────────────────────────────────

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: rawProjects = [], isLoading: projectsLoading } = useProjects();
  const { data: baseCalendar } = useBaseCalendar();
  const projects = useMemo(() => {
    if (baseCalendar?.id) {
      return [baseCalendar, ...rawProjects];
    }
    return rawProjects;
  }, [baseCalendar, rawProjects]);
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: users = [] } = useUsers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [companyFilter, setCompanyFilter] = useState('__all__');
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [showDateRange, setShowDateRange] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<{ task: any; projectId: string } | null>(null);
  const [editTask, setEditTask] = useState<any | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [ganttMonth, setGanttMonth] = useState('');
  const [calendarCreateOpen, setCalendarCreateOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState('');
  const [calendarEventOpen, setCalendarEventOpen] = useState(false);
  const [calendarEventDate, setCalendarEventDate] = useState('');
  const [subtaskParent, setSubtaskParent] = useState<any>(null);
  const [depTask, setDepTask] = useState<any>(null);
  const [depOpen, setDepOpen] = useState(false);

  // Pagination
  const [cardsPerPage, setCardsPerPage] = useState(12);
  const [ganttPerPage, setGanttPerPage] = useState(10);
  const [cardsPage, setCardsPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [ganttPage, setGanttPage] = useState(1);
  const [ganttStart, setGanttStart] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [ganttEnd, setGanttEnd] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [projectCardView, setProjectCardView] = useState<'card' | 'table'>('table');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [bulkProjectField, setBulkProjectField] = useState('');
  const [bulkProjectValue, setBulkProjectValue] = useState('');
  const [isBulkProjectSaving, setIsBulkProjectSaving] = useState(false);
  const [resourceYear, setResourceYear]           = useState<number>(currentYear);
  const [resourceStartDate, setResourceStartDate] = useState('');
  const [resourceEndDate, setResourceEndDate]     = useState('');
  const [resourceSubTab, setResourceSubTab]       = useState<'workload' | 'impact'>('workload');
  const [reportProject, setReportProject]          = useState<any>(null);

  const isAdmin = Number(user?.is_admin) === 1;

  // Load tasks for the project whose dependency dialog is open
  const { data: depProjectTasks = [] } = useTasks(depTask?.project_id ?? '');
  const { confirm } = useConfirm();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const createSubtask = useCreateSubtask();
  const { toast } = useToast();

  const toggleProjectSelect = (id: string) => setSelectedProjectIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkProjectSave = async () => {
    if (!bulkProjectField || !bulkProjectValue || selectedProjectIds.size === 0) return;
    setIsBulkProjectSaving(true);
    const count = selectedProjectIds.size;
    try {
      await Promise.all([...selectedProjectIds].map(id =>
        updateProject.mutateAsync({ id, [bulkProjectField]: bulkProjectValue })
      ));
      setSelectedProjectIds(new Set());
      setBulkProjectField('');
      setBulkProjectValue('');
      toast({ title: 'อัปเดตสำเร็จ', description: `อัปเดต ${count} โปรเจกต์แล้ว` });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setIsBulkProjectSaving(false);
    }
  };

  // Pipeline drag-and-drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handlePipelineDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProjectId(projectId);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox and for safe capture in drop handler
    e.dataTransfer.setData('text/plain', projectId);
  };

  const handlePipelineDragEnd = () => {
    setDraggedProjectId(null);
    setDragOverColumn(null);
  };

  const handlePipelineDrop = async (e: React.DragEvent, newStatus: string) => {
    // Read projectId from dataTransfer to avoid stale-closure issues
    const projectId = e.dataTransfer.getData('text/plain') || draggedProjectId;
    setDraggedProjectId(null);
    setDragOverColumn(null);
    if (!projectId || !newStatus) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.status === newStatus) return;
    try {
      await updateProject.mutateAsync({ id: projectId, status: newStatus });
      toast({ title: 'อัปเดตสถานะโปรเจกต์แล้ว' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteProject = async (project: any) => {
    const ok2 = await confirm({ title: 'ลบโปรเจกต์', description: `ต้องการลบโปรเจกต์ "${project.name}" ใช่หรือไม่?`, variant: 'destructive' });
    if (!ok2) return;
    try {
      await deleteProject.mutateAsync(project.id);
      toast({ title: 'ลบโปรเจกต์สำเร็จ' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const companyMap = useMemo(() => {
    return new Map(companies.map((company: any) => [company.id, company.name]));
  }, [companies]);

  const projectCompanyMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p.company_id]).filter(([, cid]) => cid));
  }, [projects]);

  const userMap = useMemo(() => {
    return new Map(users.map((u) => [u.id, u.display_name]));
  }, [users]);

  const projectsWithCompany = useMemo(() => {
    return projects.map((project: any) => ({
      ...project,
      company_name: project.company_id ? companyMap.get(project.company_id) || 'ไม่ระบุ' : 'ไม่ระบุ',
      owner_name: project.user_id ? userMap.get(project.user_id) || 'ไม่ระบุ' : 'ไม่ระบุ',
    }));
  }, [projects, companyMap, userMap]);

  const filteredProjectsBase = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const selectedYear = yearFilter ? parseInt(yearFilter) : null;

    return projectsWithCompany.filter((project: any) => {
      if (statusFilter !== '__all__' && project.kind !== 'base_calendar') {
        // Derive a comparable status from project dates so filter matches ProjectCard display
        const today = new Date();
        const end = project.end_date ? new Date(project.end_date) : null;
        let derivedStatus: string;
        if (project.status === 'completed') {
          derivedStatus = 'completed';
        } else if (end && end < today) {
          derivedStatus = 'delayed';
        } else if (end) {
          const msLeft = end.getTime() - today.getTime();
          const daysLeft = msLeft / 86400000;
          derivedStatus = daysLeft <= 7 ? 'at-risk' : 'on-track';
        } else {
          derivedStatus = 'on-track';
        }
        if (derivedStatus !== statusFilter) return false;
      }
      if (companyFilter !== '__all__' && project.kind !== 'base_calendar' && project.company_id !== companyFilter) return false;

      // Year filter - check if project overlaps the selected year (not just starts in it)
      if (selectedYear) {
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);
        const projectStart = safeParseISO(project.start_date);
        const projectEnd = safeParseISO(project.end_date);
        // Exclude project only if it ends before the year starts or starts after the year ends
        if (projectEnd && projectEnd < yearStart) return false;
        if (projectStart && projectStart > yearEnd) return false;
      }

      if (normalizedSearch) {
        const haystack = [
          project.name,
          project.description,
          project.company_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [projectsWithCompany, search, statusFilter, companyFilter, yearFilter]);

  const filteredProjects = useMemo(() => {
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;

    if (!filterStart && !filterEnd) return filteredProjectsBase;

    return filteredProjectsBase.filter((project: any) => {
      const projectStart = safeParseISO(project.start_date);
      const projectEnd = safeParseISO(project.end_date);
      if (filterStart && projectEnd && projectEnd < filterStart) return false;
      if (filterEnd && projectStart && projectStart > filterEnd) return false;
      return true;
    });
  }, [filteredProjectsBase, startDate, endDate]);

  const realProjects = filteredProjects.filter((p: any) => p.kind !== 'base_calendar');
  const activeProjects = realProjects.filter((p: any) => p.status !== 'completed');
  const completedProjects = realProjects.filter((p: any) => p.status === 'completed');
  const isLoading = projectsLoading || companiesLoading;

  // Reset pages when filters change
  useEffect(() => { setCardsPage(1); setTablePage(1); setGanttPage(1); }, [filteredProjects.length, search, statusFilter, companyFilter, yearFilter, cardsPerPage, ganttPerPage]);

  const ganttProjects = useMemo(() => {
    return [...filteredProjectsBase].sort((a: any, b: any) => {
      const aTime = safeParseISO(a.start_date)?.getTime() ?? 0;
      const bTime = safeParseISO(b.start_date)?.getTime() ?? 0;
      return aTime - bTime;
    });
  }, [filteredProjectsBase]);

  const ganttRange = useMemo(() => {
    const hasRange = Boolean(ganttStart && ganttEnd);
    if (hasRange) {
      const minStart = parseISO(ganttStart);
      const maxEnd = parseISO(ganttEnd);
      const totalDays = Math.max(1, differenceInDays(maxEnd, minStart) + 1);
      return { minStart, maxEnd, totalDays };
    }

    const selected = ganttMonth ? parseISO(`${ganttMonth}-01`) : null;
    if (!selected) return null;
    const minStart = startOfMonth(selected);
    const maxEnd = endOfMonth(selected);
    const totalDays = Math.max(1, differenceInDays(maxEnd, minStart) + 1);
    return { minStart, maxEnd, totalDays };
  }, [ganttMonth, ganttStart, ganttEnd]);

  const ganttMonths = useMemo((): Array<{ label: string; width: number; year: number }> => {
    if (!ganttRange) return []; 
    const segments: Array<{ label: string; width: number; year: number }> = [];
    let cursor = startOfMonth(ganttRange.minStart);
    while (cursor <= ganttRange.maxEnd) {
      const monthStart = cursor;
      const monthEnd = endOfMonth(cursor);
      const segmentStart = new Date(Math.max(ganttRange.minStart.getTime(), monthStart.getTime()));
      const segmentEnd = new Date(Math.min(ganttRange.maxEnd.getTime(), monthEnd.getTime()));
      const days = Math.max(1, differenceInDays(segmentEnd, segmentStart) + 1);
      segments.push({
        label: format(monthStart, 'MMM', { locale: th }),
        width: days * GANTT_DAY_WIDTH,
        year: monthStart.getFullYear(),
      });
      cursor = addMonths(cursor, 1);
    }
    return segments;
  }, [ganttRange]);

  const ganttYears = useMemo(() => {
    if (!ganttRange || ganttMonths.length === 0) return [] as Array<{ label: string; width: number }>; 
    const years: Array<{ label: string; width: number }> = [];
    let currentYear = ganttMonths[0].year;
    let width = 0;
    ganttMonths.forEach((month) => {
      if (month.year !== currentYear) {
        years.push({ label: String(currentYear), width });
        currentYear = month.year;
        width = 0;
      }
      width += month.width;
    });
    years.push({ label: String(currentYear), width });
    return years;
  }, [ganttRange, ganttMonths]);

  const ganttProjectsInRange = useMemo(() => {
    if (!ganttRange) return [];
    return ganttProjects.filter((project) => {
      const projectStart = safeParseISO(project.start_date);
      const projectEnd = safeParseISO(project.end_date);
      if (!projectStart || !projectEnd) return false;
      return projectStart <= ganttRange.maxEnd && projectEnd >= ganttRange.minStart;
    });
  }, [ganttProjects, ganttRange]);

  const resetFilters = () => {
    const currentYear = new Date().getFullYear();
    setYearFilter(String(currentYear));
    setSearch('');
    setStatusFilter('__all__');
    setCompanyFilter('__all__');
    setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfYear(new Date()), 'yyyy-MM-dd'));
    setShowDateRange(false);
  };

  const handleYearChange = (year: string) => {
    setYearFilter(year);
    if (year === '__all__') {
      setStartDate('');
      setEndDate('');
    } else {
      const selectedYear = parseInt(year, 10);
      setStartDate(format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
    }
  };

  const openEditProject = (project: any) => {
    setEditingProject(project);
    setIsEditOpen(true);
  };

  const filtersContent = (
    <>
      {/* Status */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="flex-1 sm:flex-none min-w-[100px] max-w-[140px] h-9 text-sm">
          <SelectValue placeholder="สถานะ" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Company */}
      <Select value={companyFilter} onValueChange={setCompanyFilter}>
        <SelectTrigger className="flex-1 sm:flex-none min-w-[110px] max-w-[160px] h-9 text-sm">
          <SelectValue placeholder="บริษัท" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกบริษัท</SelectItem>
          {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Year */}
      <Select value={yearFilter} onValueChange={handleYearChange}>
        <SelectTrigger className="w-20 sm:w-24 h-9 text-sm shrink-0">
          <SelectValue placeholder="ปี" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกปี</SelectItem>
          {Array.from({ length: 11 }, (_, i) => currentYear - i).map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range toggle */}
      <button
        onClick={() => setShowDateRange((v) => !v)}
        title="กรองตามวันที่"
        className={`relative h-9 w-9 shrink-0 flex items-center justify-center rounded-md border transition-colors
          ${showDateRange ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-accent'}`}
      >
        <CalendarRange className="h-4 w-4" />
        {(startDate || endDate) && !showDateRange && (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </button>

      {/* Reset */}
      <button
        onClick={resetFilters}
        title="ล้างตัวกรอง"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
      >
        ริเซ็ต
      </button>

      <div className="w-px h-4 bg-border mx-0.5 shrink-0" />

      {/* View toggle */}
      <div className="flex border rounded-md overflow-hidden shrink-0">
        <button
          onClick={() => setProjectCardView('card')}
          className={`px-2.5 py-2 ${projectCardView === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          title="Grid View"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => setProjectCardView('table')}
          className={`px-2.5 py-2 ${projectCardView === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          title="List View"
        >
          <List className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  return (
    <PageShell
      breadcrumbs={[{ label: 'โปรเจกต์', isCurrent: true }]}
      title="โปรเจกต์"
      description="ภาพรวมโครงการทั้งหมด"
      actions={
        <>
          <InsertAdHocTaskDialog />
          <CreateProjectDialog />
        </>
      }
    >

      {/* Filters */}
      <div className="space-y-2">
        {/* Search bar + mobile filter toggle */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาโปรเจกต์..."
              className="w-full pl-9 pr-8 h-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFiltersMobile(v => !v)}
            className={`h-9 w-9 shrink-0 rounded-md border flex items-center justify-center transition-colors sm:hidden ${showFiltersMobile ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
            title="ตัวกรอง"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop filters (always visible on sm+) */}
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

      {/* Result count */}
      {filteredProjects.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          {realProjects.length} โครงการ ({activeProjects.length} ดำเนินการ, {completedProjects.length} เสร็จ)
        </p>
      )}

      {/* Date range (collapsible) */}
      {showDateRange && (
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">เริ่มต้น</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">สิ้นสุด</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">กำลังโหลดโครงการ...</p>
      ) : (
        <Tabs defaultValue="cards" className="space-y-6">
          <TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-7">
            <TabsTrigger value="cards" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">การ์ด</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <Kanban className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ไปป์ไลน์</span>
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <CalendarRange className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">แกนต์</span>
            </TabsTrigger>
            <TabsTrigger value="resource" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <Users className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ทรัพยากร</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ปฏิทิน</span>
            </TabsTrigger>
            <TabsTrigger value="mytasks" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">งานของฉัน</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <ListTodo className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">งานทั้งหมด</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="space-y-6">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-20">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold font-heading mb-2">ไม่พบโครงการตามตัวกรอง</h2>
                <p className="text-muted-foreground mb-6">ปรับตัวกรองหรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p>
                <Button variant="outline" onClick={resetFilters}>ล้างตัวกรอง</Button>
              </div>
            ) : (<>
            {/* Summary Stats */}
            {(() => {
              const total     = realProjects.length;
              const today = new Date();
              const derivedSt = (p: any) => {
                if (p.status === 'completed') return 'completed';
                const end = p.end_date ? new Date(p.end_date) : null;
                if (!end) return 'on-track';
                if (end < today) return 'delayed';
                return (end.getTime() - today.getTime()) / 86400000 <= 7 ? 'at-risk' : 'on-track';
              };
              const onTrack   = realProjects.filter((p: any) => derivedSt(p) === 'on-track').length;
              const atRisk    = realProjects.filter((p: any) => derivedSt(p) === 'at-risk').length;
              const delayed   = realProjects.filter((p: any) => derivedSt(p) === 'delayed').length;
              const completed = completedProjects.length;
              const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  <Card className="md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle>
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{total}</div>
                      <p className="text-xs text-muted-foreground">{activeProjects.length} กำลังดำเนินการ</p>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50/40 dark:bg-green-950/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">ตามแผน</CardTitle>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{onTrack}</div>
                      <p className="text-xs text-muted-foreground">{pct(onTrack)}% ของทั้งหมด</p>
                    </CardContent>
                  </Card>

                  <Card className="border-orange-200 bg-orange-50/40 dark:bg-orange-950/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">มีความเสี่ยง</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">{atRisk}</div>
                      <p className="text-xs text-muted-foreground">{pct(atRisk)}% ของทั้งหมด</p>
                    </CardContent>
                  </Card>

                  <Card className="border-red-200 bg-red-50/40 dark:bg-red-950/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">ล่าช้า</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{delayed}</div>
                      <p className="text-xs text-muted-foreground">{pct(delayed)}% ของทั้งหมด</p>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">เสร็จแล้ว</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">{completed}</div>
                      <p className="text-xs text-muted-foreground">{pct(completed)}% ของทั้งหมด</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

            {projectCardView === 'table' && (() => {
              const tblProjects = filteredProjects.slice((cardsPage - 1) * cardsPerPage, cardsPage * cardsPerPage);
              const tblAllIds = tblProjects.filter((p: any) => p.kind !== 'base_calendar').map((p: any) => p.id as string);
              const tblAllSelected = tblAllIds.length > 0 && tblAllIds.every(id => selectedProjectIds.has(id));
              const toggleTblAll = () => {
                if (tblAllSelected) setSelectedProjectIds(prev => { const n = new Set(prev); tblAllIds.forEach(id => n.delete(id)); return n; });
                else setSelectedProjectIds(prev => { const n = new Set(prev); tblAllIds.forEach(id => n.add(id)); return n; });
              };
              return (
                <>
                  {selectedProjectIds.size > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-sm font-medium text-primary shrink-0">เลือก {selectedProjectIds.size} โปรเจกต์</span>
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <Select value={bulkProjectField} onValueChange={v => { setBulkProjectField(v); setBulkProjectValue(''); }}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="เลือกฟิลด์" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="status">สถานะ</SelectItem>
                            <SelectItem value="company_id">บริษัท</SelectItem>
                            <SelectItem value="user_id">เจ้าของ</SelectItem>
                            <SelectItem value="start_date">วันที่เริ่ม</SelectItem>
                            <SelectItem value="end_date">วันที่สิ้นสุด</SelectItem>
                          </SelectContent>
                        </Select>
                        {bulkProjectField === 'status' && (
                          <Select value={bulkProjectValue} onValueChange={setBulkProjectValue}>
                            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on-track">ตามแผน</SelectItem>
                              <SelectItem value="at-risk">มีความเสี่ยง</SelectItem>
                              <SelectItem value="delayed">ล่าช้า</SelectItem>
                              <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {bulkProjectField === 'company_id' && (
                          <Select value={bulkProjectValue} onValueChange={setBulkProjectValue}>
                            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="เลือกบริษัท" /></SelectTrigger>
                            <SelectContent>
                              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {bulkProjectField === 'user_id' && (
                          <Select value={bulkProjectValue} onValueChange={setBulkProjectValue}>
                            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="เลือกเจ้าของ" /></SelectTrigger>
                            <SelectContent>
                              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {(bulkProjectField === 'start_date' || bulkProjectField === 'end_date') && (
                          <input type="date" value={bulkProjectValue} onChange={e => setBulkProjectValue(e.target.value)}
                            className="h-8 px-2 text-xs rounded-md border border-input bg-background" />
                        )}
                        <Button size="sm" className="h-8 text-xs" disabled={!bulkProjectField || !bulkProjectValue || isBulkProjectSaving} onClick={handleBulkProjectSave}>
                          {isBulkProjectSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}บันทึก
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSelectedProjectIds(new Set()); setBulkProjectField(''); setBulkProjectValue(''); }}>
                          ยกเลิก
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Mobile list cards */}
                  <div className="md:hidden space-y-3">
                    {tblProjects.map((project: any) => {
                      const start = safeParseISO(project.start_date);
                      const end   = safeParseISO(project.end_date);
                      const dur   = start && end ? differenceInDays(end, start) + 1 : null;
                      const isSel = selectedProjectIds.has(project.id);
                      const isCalendar = project.kind === 'base_calendar';
                      return (
                        <Card
                          key={project.id}
                          className={`relative cursor-pointer ${isSel ? 'ring-2 ring-primary' : ''} ${isCalendar ? 'border-violet-300 bg-violet-50/50 dark:border-violet-700 dark:bg-violet-950/30' : ''}`}
                          onClick={() => navigate(`/project/${project.id}`)}
                        >
                          <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                            {!isCalendar && <Checkbox checked={isSel} onCheckedChange={() => toggleProjectSelect(project.id)} />}
                          </div>
                          <CardContent className="pt-3 pb-3 pl-9">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                  {project.name}
                                  {isCalendar && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 shrink-0">ปฏิทินทีม</span>}
                                </div>
                                {project.description && (
                                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{project.description}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={e => { e.stopPropagation(); setReportProject(project); }}>
                                  <FileText className="h-3 w-3" />รายงาน
                                </Button>
                                {isAdmin && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditProject(project); }}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDeleteProject(project); }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className={`status-badge text-xs ${getProjectStatusColor(project.status)}`}>{getStatusLabel(project.status)}</span>
                              {project.company_name && (
                                <span className="text-xs text-muted-foreground">{project.company_name}</span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{safeFmt(project.start_date)}</span>
                              <span>→</span>
                              <span>{safeFmt(project.end_date)}</span>
                              {dur && <span className="ml-auto">({dur} วัน)</span>}
                            </div>
                            {project.creator_name && (
                              <div className="mt-1 text-xs text-muted-foreground">เจ้าของ: {project.creator_name}</div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block rounded-xl border bg-card overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox checked={tblAllSelected} onCheckedChange={toggleTblAll} />
                          </TableHead>
                          <TableHead>โปรเจกต์</TableHead>
                          <TableHead className="hidden sm:table-cell">บริษัท</TableHead>
                          <TableHead className="hidden md:table-cell">เจ้าของ</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead className="hidden sm:table-cell">เริ่ม</TableHead>
                          <TableHead className="hidden sm:table-cell">สิ้นสุด</TableHead>
                          <TableHead className="hidden md:table-cell text-right">ระยะเวลา</TableHead>
                          <TableHead className="hidden sm:table-cell text-right w-24">รายงาน</TableHead>
                          {isAdmin && <TableHead className="text-right">จัดการ</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tblProjects.map((project: any) => {
                          const start = safeParseISO(project.start_date);
                          const end   = safeParseISO(project.end_date);
                          const dur   = start && end ? differenceInDays(end, start) + 1 : null;
                          const isSel = selectedProjectIds.has(project.id);
                          const isCalendar = project.kind === 'base_calendar';
                          return (
                            <TableRow key={project.id} className={`cursor-pointer ${isSel ? 'bg-primary/5' : ''} ${isCalendar ? 'bg-violet-50/60 dark:bg-violet-950/20' : ''}`}
                              onClick={() => navigate(`/project/${project.id}`)}>
                              <TableCell onClick={e => e.stopPropagation()}>
                                {!isCalendar && <Checkbox checked={isSel} onCheckedChange={() => toggleProjectSelect(project.id)} className="shrink-0" />}
                              </TableCell>
                              <TableCell className="min-w-[150px] max-w-[260px]">
                                <div className="flex flex-col">
                                  <span className="truncate flex items-center gap-1.5">
                                    {project.name}
                                    {isCalendar && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 shrink-0">ปฏิทินทีม</span>}
                                  </span>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{project.description || '-'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell max-w-[150px]"><span className="truncate block">{project.company_name || '-'}</span></TableCell>
                              <TableCell className="hidden md:table-cell max-w-[120px]"><span className="truncate block">{project.creator_name || '-'}</span></TableCell>
                              <TableCell><span className={`status-badge ${getProjectStatusColor(project.status)}`}>{getStatusLabel(project.status)}</span></TableCell>
                              <TableCell className="hidden sm:table-cell">{safeFmt(project.start_date)}</TableCell>
                              <TableCell className="hidden sm:table-cell">{safeFmt(project.end_date)}</TableCell>
                              <TableCell className="hidden md:table-cell text-right">{dur ? `${dur} วัน` : '-'}</TableCell>
                              <TableCell className="hidden sm:table-cell text-right">
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={e => { e.stopPropagation(); setReportProject(project); }}><FileText className="h-3.5 w-3.5" />สรุปรายงาน</Button>
                              </TableCell>
                               {isAdmin && (
                                 <TableCell className="text-right">
                                   <div className="flex items-center justify-end gap-1">
                                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditProject(project); }}><Pencil className="h-3.5 w-3.5" /></Button>
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDeleteProject(project); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                   </div>
                                 </TableCell>
                               )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
            {projectCardView === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects
                .slice((cardsPage - 1) * cardsPerPage, cardsPage * cardsPerPage)
                .map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  showEdit={isAdmin && project.kind !== 'base_calendar'}
                  onEdit={() => openEditProject(project)}
                  showDelete={isAdmin && project.kind !== 'base_calendar'}
                  onDelete={() => handleDeleteProject(project)}
                  onReport={() => setReportProject(project)}
                  className={project.kind === 'base_calendar' ? 'border-violet-300 bg-violet-50/50 dark:border-violet-700 dark:bg-violet-950/30' : ''}
                  badge={project.kind === 'base_calendar' ? 'ปฏิทินทีม' : undefined}
                />
              ))}
            </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <RowsPerPageSelector value={cardsPerPage} onChange={setCardsPerPage} options={[6, 12, 24, 48, 99999]} />
              <Paginator page={cardsPage} total={filteredProjects.length} pageSize={cardsPerPage} onChange={setCardsPage} />
            </div>
            </>)}
          </TabsContent>

          <TabsContent value="table">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-20">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold font-heading mb-2">ไม่พบโครงการตามตัวกรอง</h2>
                <Button variant="outline" onClick={resetFilters}>ล้างตัวกรอง</Button>
              </div>
            ) : (
              <ScrollableKanban>
                {[
                  { value: 'on-track',  label: PROJECT_STATUS_LABELS['on-track'],       headerBg: 'bg-green-50 dark:bg-green-950',  headerText: 'text-green-700 dark:text-green-300',  border: 'border-green-300 dark:border-green-600',  cardBorder: 'border-l-4 border-l-green-500',  dropHighlight: 'ring-2 ring-green-400 bg-green-50/50 dark:bg-green-950/50' },
                  { value: 'at-risk',  label: PROJECT_STATUS_LABELS['at-risk'],   headerBg: 'bg-orange-50 dark:bg-orange-950', headerText: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-600', cardBorder: 'border-l-4 border-l-orange-500', dropHighlight: 'ring-2 ring-orange-400 bg-orange-50/50 dark:bg-orange-950/50' },
                  { value: 'delayed',  label: PROJECT_STATUS_LABELS['delayed'],        headerBg: 'bg-red-50 dark:bg-red-950',     headerText: 'text-red-700 dark:text-red-300',     border: 'border-red-300 dark:border-red-600',     cardBorder: 'border-l-4 border-l-red-500',    dropHighlight: 'ring-2 ring-red-400 bg-red-50/50 dark:bg-red-950/50' },
                  { value: 'completed', label: PROJECT_STATUS_LABELS['completed'],     headerBg: 'bg-blue-50 dark:bg-blue-950',   headerText: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-300 dark:border-blue-600',   cardBorder: 'border-l-4 border-l-blue-500',   dropHighlight: 'ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-950/50' },
                ].map(({ value, label, headerBg, headerText, border, cardBorder, dropHighlight }) => {
                  const cols = filteredProjects.filter((p) => p.status === value);
                  const isOver = dragOverColumn === value;
                  return (
                    <div
                      key={value}
                      className="flex-shrink-0 w-72 space-y-2"
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverColumn(value); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null); }}
                      onDrop={(e) => { e.preventDefault(); handlePipelineDrop(e, value); }}
                    >
                      <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${headerBg} ${border}`}>
                        <h3 className={`font-semibold text-sm ${headerText}`}>{label}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/30 ${headerText}`}>{cols.length}</span>
                      </div>
                      <div className={`space-y-2 min-h-[200px] rounded-lg transition-all duration-150 p-1 -m-1 ${isOver && draggedProjectId ? dropHighlight : ''}`}>
                        {cols.length === 0 ? (
                          <div className={`text-xs text-muted-foreground text-center py-6 rounded-lg border border-dashed transition-colors ${isOver && draggedProjectId ? 'border-primary' : ''}`}>
                            {isOver && draggedProjectId ? 'วางที่นี่' : 'ไม่มีโปรเจกต์'}
                          </div>
                        ) : cols.map((project: any) => (
                          <div
                            key={project.id}
                            draggable
                            onDragStart={(e) => handlePipelineDragStart(e, project.id)}
                            onDragEnd={handlePipelineDragEnd}
                            className={`bg-card rounded-lg border shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none p-3 ${cardBorder} ${draggedProjectId === project.id ? 'opacity-40' : 'opacity-100'}`}
                            onClick={() => { if (!draggedProjectId) navigate(`/project/${project.id}`); }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm line-clamp-2">{project.name}</div>
                                {project.company_name && <div className="text-xs text-muted-foreground mt-0.5 truncate">{project.company_name}</div>}
                               </div>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={(e) => { e.stopPropagation(); setReportProject(project); }} title="สรุปรายงาน"><FileText className="h-3 w-3" /></Button>
                               {isAdmin && (
                                 <div className="flex items-center gap-0.5 shrink-0">
                                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEditProject(project); }}><Pencil className="h-3 w-3" /></Button>
                                   <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project); }}><Trash2 className="h-3 w-3" /></Button>
                                 </div>
                               )}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{safeFmt(project.start_date)}</span>
                              <span>→</span>
                              <span>{safeFmt(project.end_date)}</span>
                            </div>
                            {project.owner_name && (
                              <div className="mt-1 text-xs text-muted-foreground">&#128100; {project.owner_name}</div>
                            )}
                          </div>
                        ))}
                        {cols.length > 0 && isOver && draggedProjectId && (
                          <div className="text-xs text-primary text-center py-3 rounded-lg border border-dashed border-primary">วางที่นี่</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </ScrollableKanban>
            )}
          </TabsContent>

          <TabsContent value="gantt">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-20">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold font-heading mb-2">ไม่พบโครงการตามตัวกรอง</h2>
                <Button variant="outline" onClick={resetFilters}>ล้างตัวกรอง</Button>
              </div>
            ) : (<>
            <div className="rounded-xl border bg-card p-4 space-y-4">
              {!ganttRange ? (
                <p className="text-center text-muted-foreground py-12">ยังไม่สามารถแสดง Gantt ได้</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold font-heading">Gantt Chart</h3>
                      <p className="text-sm text-muted-foreground">
                        ช่วงเวลา {format(ganttRange.minStart, 'd MMM yyyy', { locale: th })} -{' '}
                        {format(ganttRange.maxEnd, 'd MMM yyyy', { locale: th })} ({ganttRange.totalDays} วัน)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="date"
                        value={ganttStart}
                        onChange={(event) => setGanttStart(event.target.value)}
                        className="w-full sm:w-[150px]"
                      />
                      <Input
                        type="date"
                        value={ganttEnd}
                        onChange={(event) => setGanttEnd(event.target.value)}
                        className="w-full sm:w-[150px]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setGanttMonth(format(new Date(), 'yyyy-MM'));
                          setGanttStart('');
                          setGanttEnd('');
                        }}
                      >
                        เดือนนี้
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const half = now.getMonth() < 6;
                          setGanttStart(format(half ? startOfYear(now) : new Date(now.getFullYear(), 6, 1), 'yyyy-MM-dd'));
                          setGanttEnd(format(half ? new Date(now.getFullYear(), 5, 30) : endOfYear(now), 'yyyy-MM-dd'));
                          setGanttMonth('');
                        }}
                      >
                        ครึ่งปี
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const q = Math.floor(now.getMonth() / 3);
                          setGanttStart(format(new Date(now.getFullYear(), q * 3, 1), 'yyyy-MM-dd'));
                          setGanttEnd(format(endOfMonth(new Date(now.getFullYear(), q * 3 + 2, 1)), 'yyyy-MM-dd'));
                          setGanttMonth('');
                        }}
                      >
                        ไตรมาส
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setGanttStart(format(startOfYear(new Date()), 'yyyy-MM-dd'));
                          setGanttEnd(format(endOfYear(new Date()), 'yyyy-MM-dd'));
                          setGanttMonth('');
                        }}
                      >
                        ปีนี้
                      </Button>
                    </div>
                  </div>

                  {ganttProjectsInRange.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                      ไม่มีโครงการในช่วงเวลานี้
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <div className="min-w-max space-y-3">
                          <div className="flex flex-col border-b pb-2 gap-1">
                            <div className="flex items-end gap-3">
                              <div className="w-40 sm:w-64 shrink-0 text-xs font-medium text-muted-foreground sticky left-0 z-10 bg-card">
                                โปรเจกต์
                              </div>
                              <div
                                className="flex text-[11px] text-muted-foreground"
                                style={{ width: ganttRange.totalDays * GANTT_DAY_WIDTH }}
                              >
                                {ganttYears.map((year, index) => (
                                  <div
                                    key={`${year.label}-${index}`}
                                    className="border-l border-border/60 text-center font-semibold"
                                    style={{ width: year.width }}
                                  >
                                    {year.label}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-end gap-3">
                              <div className="w-40 sm:w-64 shrink-0 text-[11px] text-muted-foreground sticky left-0 z-10 bg-card">
                                เดือน
                              </div>
                              <div
                                className="flex text-[11px] text-muted-foreground"
                                style={{ width: ganttRange.totalDays * GANTT_DAY_WIDTH }}
                              >
                                {ganttMonths.map((month, index) => (
                                  <div
                                    key={`${month.label}-${index}`}
                                    className="border-l border-border/60 text-center font-medium"
                                    style={{ width: month.width }}
                                  >
                                    {month.label}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {ganttProjectsInRange
                              .slice((ganttPage - 1) * ganttPerPage, ganttPage * ganttPerPage)
                              .map((project: any) => (
                              <GanttRow
                                key={project.id}
                                project={project}
                                range={{ minStart: ganttRange.minStart, maxEnd: ganttRange.maxEnd, totalDays: ganttRange.totalDays }}
                                timelineWidth={ganttRange.totalDays * GANTT_DAY_WIDTH}
                                onOpen={(projectId) => navigate(`/project/${projectId}`)}
                                isExpanded={expandedProjects.includes(project.id)}
                                onToggle={toggleExpanded}
                                selectedTaskId={selectedTask?.projectId === project.id ? selectedTask.task.id : null}
                                onSelectTask={(payload) => setSelectedTask(payload)}
                                onEditTask={(task) => { setEditTask(task); setTaskDetailOpen(true); }}
                                 onEdit={openEditProject}
                                 onDelete={handleDeleteProject}
                                 onDependencies={(task) => { setDepTask(task); setDepOpen(true); }}
                                 onReport={setReportProject}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <RowsPerPageSelector value={ganttPerPage} onChange={setGanttPerPage} options={[5, 10, 20, 50, 99999]} />
                            <Paginator page={ganttPage} total={ganttProjectsInRange.length} pageSize={ganttPerPage} onChange={setGanttPage} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            </>)}
          </TabsContent>

          <TabsContent value="resource">
            <div className="space-y-4">
              {/* Filters */}
              <div className="rounded-xl border bg-card p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">ปี</label>
                    <Input type="number" value={resourceYear} onChange={(e) => setResourceYear(parseInt(e.target.value) || currentYear)} min="2020" max="2030" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">วันที่เริ่มต้น</label>
                    <Input type="date" value={resourceStartDate} onChange={(e) => setResourceStartDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">วันที่สิ้นสุด</label>
                    <Input type="date" value={resourceEndDate} onChange={(e) => setResourceEndDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">&nbsp;</label>
                    <Button variant="outline" onClick={() => { setResourceYear(currentYear); setResourceStartDate(''); setResourceEndDate(''); }}>ล้างตัวกรอง</Button>
                  </div>
                </div>
              </div>
              {/* Sub-tabs */}
              <div className="flex gap-2 border-b">
                <button
                  type="button"
                  onClick={() => setResourceSubTab('workload')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${resourceSubTab === 'workload' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Users className="h-4 w-4" />ภาระงาน
                </button>
                <button
                  type="button"
                  onClick={() => setResourceSubTab('impact')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${resourceSubTab === 'impact' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Briefcase className="h-4 w-4" />ผลกระทบข้ามโปรเจกต์
                </button>
              </div>
              {resourceSubTab === 'workload'
                ? <ResourceWorkloadDashboard year={resourceYear} startDate={resourceStartDate} endDate={resourceEndDate} />
                : <CrossProjectImpactView activeOnly={false} />
              }
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-3">
            <TaskCalendarView
              onTaskClick={(task) => { setEditTask(task); setTaskDetailOpen(true); }}
              onDateClick={(date) => { setCalendarDate(date); setCalendarCreateOpen(true); }}
              onAddSubtask={(task) => setSubtaskParent(task)}
              onCreateTask={() => { setCalendarDate(''); setCalendarCreateOpen(true); }}
              onCreateEvent={user?.is_admin === 1 ? () => { setCalendarEventDate(''); setCalendarEventOpen(true); } : undefined}
            />
          </TabsContent>

          <TabsContent value="mytasks">
            <MyTasksView yearFilter={yearFilter} onYearChange={handleYearChange} />
          </TabsContent>

          <TabsContent value="tasks">
            <AllTasksTab
              onEditTask={(task) => { setEditTask(task); setTaskDetailOpen(true); }}
              companies={companies}
              projectCompanyMap={projectCompanyMap}
              yearFilter={yearFilter}
            />
          </TabsContent>

        </Tabs>
      )}

      <TaskDetailSheet
        task={editTask}
        open={taskDetailOpen}
        onOpenChange={(open) => {
          setTaskDetailOpen(open);
          if (!open) setEditTask(null);
        }}
      />

      {/* Task Dependencies Dialog */}
      <TaskDependenciesDialog
        open={depOpen}
        onOpenChange={setDepOpen}
        task={depTask}
        availableTasks={depProjectTasks}
        dependencies={[]}
        onAddDependency={async (dependsOnTaskId: string) => {
          if (!depTask) return;
          try {
            await apiFetch('/task-dependencies.php', {
              method: 'POST',
              body: JSON.stringify({ task_id: depTask.id, depends_on_task_id: dependsOnTaskId, dependency_type: 'depends_on' }),
            });
            toast({ title: 'เพิ่มความสัมพันธ์สำเร็จ' });
          } catch (err: any) { toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }); }
        }}
        onRemoveDependency={async (id: string) => {
          try {
            await apiFetch(`/task-dependencies.php?id=${id}`, { method: 'DELETE' });
            toast({ title: 'ลบความสัมพันธ์สำเร็จ' });
          } catch (err: any) { toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }); }
        }}
        onResolveBlocker={async (id: string, notes: string) => {
          try {
            await apiFetch(`/task-dependencies.php?id=${id}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'resolved', resolution_notes: notes }),
            });
            toast({ title: 'แก้ไขบล็อกเกอร์สำเร็จ' });
          } catch (err: any) { toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }); }
        }}
      />

      {/* Calendar: create event dialog (calendar.php) */}
      <CreateCalendarEventDialog
        open={calendarEventOpen}
        onOpenChange={setCalendarEventOpen}
        defaultDate={calendarEventDate}
      />

      {/* Calendar: create task dialog */}
      <CreateTaskDialog
        externalOpen={calendarCreateOpen}
        onExternalOpenChange={setCalendarCreateOpen}
        defaultDate={calendarDate}
      />

      {/* Calendar: create subtask dialog */}
      {subtaskParent && (
        <CreateSubtaskDialog
          open={!!subtaskParent}
          onOpenChange={(v) => { if (!v) setSubtaskParent(null); }}
          parentTask={subtaskParent}
          onSubmit={async (sub) => {
            await createSubtask.mutateAsync(sub);
            setSubtaskParent(null);
          }}
        />
      )}

      <EditProjectDialog
        project={editingProject}
        open={isEditOpen}
        onOpenChange={(nextOpen) => {
          setIsEditOpen(nextOpen);
          if (!nextOpen) setEditingProject(null);
        }}
      />

      <ProjectReportSheet project={reportProject} onClose={() => setReportProject(null)} />
    </PageShell>
  );
};

export default Index;
