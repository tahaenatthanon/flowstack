import { useState, useMemo } from 'react';
import { useProjects, useTasks, useOpportunities, useQuotations, useCompanies, useAllTasks, useAllTaskHoursEntries } from '@/hooks/useProjectData';
import PageShell from '@/components/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, CheckCircle, Download, FolderKanban, AlertTriangle, CheckCircle2, Clock, ListTodo, Layers, Zap, FileText, Filter } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { exportProjectsToCSV, exportOpportunitiesToCSV, exportTasksToCSV, exportTaskHoursToCSV } from '@/lib/exportUtils';
import { endOfYear, format, startOfYear, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import ProjectSummaryReport from '@/components/reports/ProjectSummaryReport';
import TasksReport from '@/components/reports/TasksReport';
import SubtasksReport from '@/components/reports/SubtasksReport';
import AdHocTasksReport from '@/components/reports/AdHocTasksReport';
import type { DbProject, DbTask } from '@/types/project';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
   const { data: opportunities = [], isLoading: opportunitiesLoading } = useOpportunities();
   const { data: quotations = [], isLoading: quotationsLoading } = useQuotations();
   const { data: companies = [], isLoading: companiesLoading } = useCompanies();
   const { data: tasksPage = { data: [] }, isLoading: tasksLoading } = useAllTasks({ per_page: 5000 });
   const allTasks = tasksPage.data;
   const { data: allTaskHours = [], isLoading: taskHoursLoading } = useAllTaskHoursEntries();

  const isLoading = projectsLoading || opportunitiesLoading || quotationsLoading || companiesLoading;

  // Current year for default filter
  const currentYear = new Date().getFullYear();

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState<string[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatus, setTaskStatus] = useState('all');
  const [taskAssignee, setTaskAssignee] = useState('all');
  const [taskHoursSearch, setTimesheetSearch] = useState('');
  const [taskHoursUser, setTimesheetUser] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [taskHoursDateFrom, setTimesheetDateFrom] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [taskHoursDateTo, setTimesheetDateTo] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [reportStartDate, setReportStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Filter data by selected year
  const filterByYear = <T extends { [key: string]: any }>(
    data: T[],
    dateField: string,
    fallbackField?: string
  ): T[] => {
    if (yearFilter === '__all__') return data;
    const year = parseInt(yearFilter, 10);
    return data.filter((item) => {
      const dateStr = item[dateField] || (fallbackField ? item[fallbackField] : null);
      if (!dateStr || dateStr === '0000-00-00') return false;
      const date = new Date(dateStr);
      return date.getFullYear() === year;
    });
  };

  // Filter data by year for each entity type
  const filteredProjects = filterByYear(projects, 'start_date', 'end_date');
  const filteredOpportunities = filterByYear(opportunities, 'expected_close_date', 'actual_close_date');
  const filteredQuotations = filterByYear(quotations, 'issue_date');
  const yearFilteredTasks = filterByYear(allTasks, 'start_date');

  const handleYearChange = (year: string) => {
    setYearFilter(year);
    if (year === '__all__') {
      setTimesheetDateFrom('');
      setTimesheetDateTo('');
    } else {
      const selectedYear = parseInt(year, 10);
      setTimesheetDateFrom(format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
      setTimesheetDateTo(format(endOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
    }
  };

  const resetFilters = () => {
    setYearFilter(String(currentYear));
    setTimesheetDateFrom(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setTimesheetDateTo(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  };

  const filtersContent = (
    <>
      <Select value={yearFilter} onValueChange={handleYearChange}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="ปี" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกปี</SelectItem>
          {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input type="date" value={taskHoursDateFrom} onChange={(event) => setTimesheetDateFrom(event.target.value)} className="w-36" />
        <Input type="date" value={taskHoursDateTo} onChange={(event) => setTimesheetDateTo(event.target.value)} className="w-36" />
      </div>
      <Button variant="outline" onClick={resetFilters}>
        ล้างตัวกรอง
      </Button>
    </>
  );

  const taskStatuses = Array.from(
    new Set(yearFilteredTasks.map((task: any) => task.status).filter((value): value is string => Boolean(value)))
  ) as string[];
  const taskAssignees = Array.from(
    new Set(yearFilteredTasks.map((task: any) => task.assignee).filter((value): value is string => Boolean(value)))
  ) as string[];
  const taskHoursUsers = Array.from(
    new Set(allTaskHours.map((entry: any) => entry.user_name).filter((value): value is string => Boolean(value)))
  ) as string[];

  // Helper to check if task matches year
  const matchesYear = (task: any) => {
    if (yearFilter === '__all__') return true;
    const year = parseInt(yearFilter, 10);
    const dateStr = task.start_date;
    if (!dateStr || dateStr === '0000-00-00') return false;
    const date = new Date(dateStr);
    return date.getFullYear() === year;
  };

  const filteredTasks = allTasks.filter((task: any) => {
    // First apply year filter
    if (!matchesYear(task)) return false;
    
    const matchesSearch = taskSearch.trim() === ''
      || (task.title || '').toLowerCase().includes(taskSearch.toLowerCase())
      || (task.description || '').toLowerCase().includes(taskSearch.toLowerCase())
      || (task.assignee || '').toLowerCase().includes(taskSearch.toLowerCase());

    const matchesStatus = taskStatus === 'all' || task.status === taskStatus;
    const matchesAssignee = taskAssignee === 'all' || task.assignee === taskAssignee;

    return matchesSearch && matchesStatus && matchesAssignee;
  });

  const filteredTimesheet = allTaskHours.filter((entry: any) => {
    const matchesSearch = taskHoursSearch.trim() === ''
      || (entry.task_title || '').toLowerCase().includes(taskHoursSearch.toLowerCase())
      || (entry.description || '').toLowerCase().includes(taskHoursSearch.toLowerCase())
      || (entry.user_name || '').toLowerCase().includes(taskHoursSearch.toLowerCase());

    const matchesUser = taskHoursUser === 'all' || entry.user_name === taskHoursUser;

    const entryDate = entry.date ? new Date(entry.date) : null;
    const fromDate = taskHoursDateFrom ? new Date(taskHoursDateFrom) : null;
    const toDate = taskHoursDateTo ? new Date(taskHoursDateTo) : null;
    const matchesFrom = !fromDate || (entryDate && entryDate >= fromDate);
    const matchesTo = !toDate || (entryDate && entryDate <= toDate);

    return matchesSearch && matchesUser && matchesFrom && matchesTo;
  });

  const selectedTasks = filteredTasks.filter((task: any) => selectedTaskIds.includes(task.id));
  const selectedTimesheet = filteredTimesheet.filter((entry: any) => selectedTimesheetIds.includes(entry.id));

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleTimesheetSelection = (entryId: string) => {
    setSelectedTimesheetIds((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
    );
  };

  const selectAllTasks = () => setSelectedTaskIds(filteredTasks.map((task: any) => task.id));
  const clearAllTasks = () => setSelectedTaskIds([]);
  const selectAllTimesheet = () => setSelectedTimesheetIds(filteredTimesheet.map((entry: any) => entry.id));
  const clearAllTimesheet = () => setSelectedTimesheetIds([]);

  // Task Analytics - must be before any early return (Rules of Hooks)
  const taskStats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    yearFilteredTasks.forEach((task: any) => {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      byAssignee[task.assignee || 'ไม่ระบุ'] = (byAssignee[task.assignee || 'ไม่ระบุ'] || 0) + 1;
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    });

    return {
      total: yearFilteredTasks.length,
      byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
      byAssignee: Object.entries(byAssignee).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
      byPriority: Object.entries(byPriority).map(([name, value]) => ({ name, value })),
    };
  }, [yearFilteredTasks]);

  // Timesheet Analytics - must be before any early return (Rules of Hooks)
  const taskHoursStats = useMemo(() => {
    const byUser: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byTask: Record<string, number> = {};
    let totalHours = 0;

    filteredTimesheet.forEach((entry: any) => {
      const hours = Number(entry.hours_worked) || 0;
      totalHours += hours;
      byUser[entry.user_name || 'ไม่ระบุ'] = (byUser[entry.user_name || 'ไม่ระบุ'] || 0) + hours;
      byTask[entry.task_title || 'ไม่ระบุ'] = (byTask[entry.task_title || 'ไม่ระบุ'] || 0) + hours;

      if (entry.date) {
        const month = entry.date.substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + hours;
      }
    });

    return {
      totalHours,
      totalEntries: filteredTimesheet.length,
      byUser: Object.entries(byUser).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
      byMonth: Object.entries(byMonth).sort().map(([name, value]) => ({ name, value })),
      byTask: Object.entries(byTask).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
    };
  }, [filteredTimesheet]);

  // ── Report tab filtered data ──────────────────────────────────────────
  const reportFiltered = useMemo(() => {
    if (!reportStartDate || !reportEndDate) {
      const adHocTasks = (allTasks as DbTask[]).filter((t) => Boolean(t.is_ad_hoc));
      return { filteredProjects: projects as DbProject[], filteredTasks: allTasks as DbTask[], adHocTasks };
    }
    const start = startOfDay(parseISO(reportStartDate));
    const end = endOfDay(parseISO(reportEndDate));
    const interval = { start, end };
    const filteredProjects = (projects as DbProject[]).filter((p) => {
      if (!p.start_date || !p.end_date) return false;
      const pStart = parseISO(p.start_date);
      const pEnd = parseISO(p.end_date);
      return pStart <= end && pEnd >= start;
    });
    const filteredTasks = (allTasks as DbTask[]).filter((t) => {
      if (!t.start_date) return false;
      const tStart = parseISO(t.start_date);
      if (isWithinInterval(tStart, interval)) return true;
      if (t.completed_date) {
        const tCompleted = parseISO(t.completed_date);
        if (isWithinInterval(tCompleted, interval)) return true;
      }
      return false;
    });
    const adHocTasks = filteredTasks.filter((t) => Boolean(t.is_ad_hoc));
    return { filteredProjects, filteredTasks, adHocTasks };
  }, [projects, allTasks, reportStartDate, reportEndDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Project Analytics - use filtered data
  const projectStats = {
    total: filteredProjects.length,
    active: filteredProjects.filter((p: any) => p.status !== 'completed').length,
    completed: filteredProjects.filter((p: any) => p.status === 'completed').length,
    onTrack: filteredProjects.filter((p: any) => p.status === 'on-track').length,
    atRisk: filteredProjects.filter((p: any) => p.status === 'at-risk').length,
    delayed: filteredProjects.filter((p: any) => p.status === 'delayed').length,
  };

  const projectStatusData = [
    { name: 'On Track', value: projectStats.onTrack, color: '#10B981' },
    { name: 'At Risk', value: projectStats.atRisk, color: '#F59E0B' },
    { name: 'Delayed', value: projectStats.delayed, color: '#EF4444' },
    { name: 'Completed', value: projectStats.completed, color: '#6366F1' },
  ];

  // Sales Analytics - use filtered data
  const salesStats = {
    total: filteredOpportunities.length,
    won: filteredOpportunities.filter((o: any) => o.stage === 'won').length,
    lost: filteredOpportunities.filter((o: any) => o.stage === 'lost').length,
    active: filteredOpportunities.filter((o: any) => !['won', 'lost'].includes(o.stage)).length,
    totalValue: filteredOpportunities.reduce((sum: number, o: any) => sum + (o.value || 0), 0),
    wonValue: filteredOpportunities.filter((o: any) => o.stage === 'won').reduce((sum: number, o: any) => sum + (o.value || 0), 0),
    avgDealSize: filteredOpportunities.length > 0 
      ? Math.round(filteredOpportunities.reduce((sum: number, o: any) => sum + (o.value || 0), 0) / filteredOpportunities.length)
      : 0,
    winRate: filteredOpportunities.filter((o: any) => ['won', 'lost'].includes(o.stage)).length > 0
      ? Math.round((filteredOpportunities.filter((o: any) => o.stage === 'won').length / filteredOpportunities.filter((o: any) => ['won', 'lost'].includes(o.stage)).length) * 100)
      : 0,
  };

  const pipelineData = [
    { name: 'Lead', value: filteredOpportunities.filter((o: any) => o.stage === 'lead').length },
    { name: 'Qualified', value: filteredOpportunities.filter((o: any) => o.stage === 'qualified').length },
    { name: 'Proposal', value: filteredOpportunities.filter((o: any) => o.stage === 'proposal').length },
    { name: 'Negotiation', value: filteredOpportunities.filter((o: any) => o.stage === 'negotiation').length },
    { name: 'Won', value: salesStats.won },
    { name: 'Lost', value: salesStats.lost },
  ];

  // Quotation Analytics - use filtered data
  const quotationStats = {
    total: filteredQuotations.length,
    draft: filteredQuotations.filter((q: any) => q.status === 'draft').length,
    sent: filteredQuotations.filter((q: any) => q.status === 'sent').length,
    approved: filteredQuotations.filter((q: any) => q.status === 'approved').length,
    rejected: filteredQuotations.filter((q: any) => q.status === 'rejected').length,
    totalValue: filteredQuotations.reduce((sum: number, q: any) => sum + (q.grand_total || 0), 0),
    approvedValue: filteredQuotations.filter((q: any) => q.status === 'approved').reduce((sum: number, q: any) => sum + (q.grand_total || 0), 0),
  };

  const quotationStatusData = [
    { name: 'Draft', value: quotationStats.draft },
    { name: 'Sent', value: quotationStats.sent },
    { name: 'Approved', value: quotationStats.approved },
    { name: 'Rejected', value: quotationStats.rejected },
  ];

  // Company Analytics - use filtered data
  const companyStats = {
    total: companies.length,
    active: companies.filter((c: any) => Number(c.is_active) === 1).length,
    avgProjectsPerCompany: companies.length > 0
      ? Math.round(filteredProjects.filter((p: any) => p.company_id).length / companies.length)
      : 0,
  };

  return (
    <PageShell
      breadcrumbs={[{ label: 'วิเคราะห์และรายงาน', isCurrent: true }]}
      title="วิเคราะห์และรายงาน"
      description="วิเคราะห์โปรเจกต์ งาน Timesheet · ออกรายงาน · ส่งออก CSV"
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportProjectsToCSV(projects)}
            disabled={projects.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            ส่งออกโปรเจกต์
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportOpportunitiesToCSV(opportunities)}
            disabled={opportunities.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            ส่งออกการขาย
          </Button>
        </>
      }
    >

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            ตัวกรองข้อมูล
          </span>
          <Button
            variant="outline"
            size="sm"
            className="sm:hidden gap-2"
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
          >
            <Filter className="h-4 w-4" />
            ตัวกรอง
          </Button>
        </div>
        <div className="hidden sm:flex gap-2 items-center flex-wrap">
          {filtersContent}
        </div>
        {showFiltersMobile && (
          <div className="sm:hidden flex flex-wrap items-center gap-2 pt-1 border-t">
            {filtersContent}
          </div>
        )}
      </div>

      <Tabs defaultValue="projects" className="space-y-6">
        <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pb-1">
        <TabsList className="flex sm:grid w-full sm:grid-cols-4 text-xs sm:text-sm">
          <TabsTrigger value="projects" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <FolderKanban className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">โปรเจกต์</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <ListTodo className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">งาน</span>
          </TabsTrigger>
          <TabsTrigger value="task-hours" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <Clock className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">บันทึกเวลา</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">รายงาน</span>
          </TabsTrigger>
        </TabsList>
        </div>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">โปรเจกต์ทั้งหมด</CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {projectStats.active} กำลังดำเนินการ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ตามแผน</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {projectStats.onTrack}
                </div>
                <p className="text-xs text-muted-foreground">
                  {projectStats.total > 0 ? Math.round((projectStats.onTrack / projectStats.total) * 100) : 0}% ของทั้งหมด
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">มีความเสี่ยง</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {projectStats.atRisk}
                </div>
                <p className="text-xs text-muted-foreground">
                  {projectStats.delayed} ล่าช้า
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">เสร็จสมบูรณ์</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {projectStats.completed}
                </div>
                <p className="text-xs text-muted-foreground">
                  {projectStats.total > 0 ? Math.round((projectStats.completed / projectStats.total) * 100) : 0}% ของทั้งหมด
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>สถิติโปรเจกต์</CardTitle>
              <CardDescription>ข้อมูลเจาะลึก</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">อัตราความสำเร็จ</span>
                <span className="font-medium">
                  {projectStats.total > 0 
                    ? Math.round((projectStats.completed / projectStats.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">เสร็จสมบูรณ์</span>
                <span className="font-medium text-green-600">{projectStats.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">กำลังดำเนินการ</span>
                <span className="font-medium text-blue-600">{projectStats.active}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          {/* Task Analytics Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">งานทั้งหมด</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {yearFilter === '__all__' ? 'ทุกปี' : `ปี ${yearFilter}`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">กำลังดำเนินการ</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {taskStats.byStatus.find(s => s.name === 'in-progress')?.value || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {taskStats.total > 0 ? Math.round(((taskStats.byStatus.find(s => s.name === 'in-progress')?.value || 0) / taskStats.total) * 100) : 0}% ของทั้งหมด
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">เสร็จสมบูรณ์</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {taskStats.byStatus.find(s => s.name === 'completed')?.value || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {taskStats.total > 0 ? Math.round(((taskStats.byStatus.find(s => s.name === 'completed')?.value || 0) / taskStats.total) * 100) : 0}% ของทั้งหมด
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ยังไม่เริ่ม</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {taskStats.byStatus.find(s => s.name === 'pending')?.value || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {taskStats.total > 0 ? Math.round(((taskStats.byStatus.find(s => s.name === 'pending')?.value || 0) / taskStats.total) * 100) : 0}% ของทั้งหมด
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Task Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>สถานะงาน</CardTitle>
                <CardDescription>การกระจายตามสถานะ</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={taskStats.byStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {taskStats.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>งานตามผู้รับผิดชอบ</CardTitle>
                <CardDescription>Top 10 ผู้รับผิดชอบ</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={taskStats.byAssignee} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>รายการงานทั้งหมด</CardTitle>
                <CardDescription>เลือกงานที่ต้องการส่งออก</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllTasks}
                  disabled={tasksLoading || allTasks.length === 0}
                >
                  เลือกทั้งหมด
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllTasks}
                  disabled={selectedTaskIds.length === 0}
                >
                  ล้าง
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportTasksToCSV(selectedTasks)}
                  disabled={selectedTasks.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <Input
                  placeholder="ค้นหางาน/คำอธิบาย/ผู้รับผิดชอบ"
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={taskStatus}
                  onChange={(event) => setTaskStatus(event.target.value)}
                >
                  <option value="all">ทุกสถานะ</option>
                  {taskStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={taskAssignee}
                  onChange={(event) => setTaskAssignee(event.target.value)}
                >
                  <option value="all">ทุกผู้รับผิดชอบ</option>
                  {taskAssignees.map((assignee) => (
                    <option key={assignee} value={assignee}>{assignee}</option>
                  ))}
                </select>
              </div>

              {tasksLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีงานในระบบ</p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto space-y-2">
                  {filteredTasks.map((task: any) => (
                    <label
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTaskIds.includes(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.assignee ? `👤 ${task.assignee}` : 'ไม่ระบุผู้รับผิดชอบ'} • {task.status}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {task.end_date ? `กำหนด: ${task.end_date}` : ''}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timesheet Tab */}
        <TabsContent value="task-hours" className="space-y-6">
          {/* Timesheet Analytics Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ชั่วโมงทั้งหมด</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskHoursStats.totalHours.toLocaleString('th-TH')}</div>
                <p className="text-xs text-muted-foreground">
                  {taskHoursStats.totalEntries} รายการ
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ชั่วโมงเฉลี่ย/วัน</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {taskHoursStats.totalEntries > 0 
                    ? (taskHoursStats.totalHours / taskHoursStats.totalEntries).toFixed(1) 
                    : 0}
                </div>
                <p className="text-xs text-muted-foreground">ชั่วโมง/รายการ</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ผู้บันทึก</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {taskHoursStats.byUser.length}
                </div>
                <p className="text-xs text-muted-foreground">คน</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">งานที่บันทึก</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {taskHoursStats.byTask.length}
                </div>
                <p className="text-xs text-muted-foreground">งาน</p>
              </CardContent>
            </Card>
          </div>

          {/* Timesheet Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>ชั่วโมงตามผู้บันทึก</CardTitle>
                <CardDescription>Top 10 ผู้บันทึกเวลา</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={taskHoursStats.byUser} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ชั่วโมงตามเดือน</CardTitle>
                <CardDescription>แนวโน้มการบันทึกเวลา</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={taskHoursStats.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Timesheet ทั้งหมด</CardTitle>
                <CardDescription>เลือกข้อมูลบันทึกชั่วโมงก่อนส่งออก</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllTimesheet}
                  disabled={taskHoursLoading || allTaskHours.length === 0}
                >
                  เลือกทั้งหมด
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllTimesheet}
                  disabled={selectedTimesheetIds.length === 0}
                >
                  ล้าง
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportTaskHoursToCSV(selectedTimesheet)}
                  disabled={selectedTimesheet.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <Input
                  placeholder="ค้นหางาน/คำอธิบาย/ผู้บันทึก"
                  value={taskHoursSearch}
                  onChange={(event) => setTimesheetSearch(event.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={taskHoursUser}
                  onChange={(event) => setTimesheetUser(event.target.value)}
                >
                  <option value="all">ทุกผู้บันทึก</option>
                  {taskHoursUsers.map((userName) => (
                    <option key={userName} value={userName}>{userName}</option>
                  ))}
                </select>
                <Input
                  type="date"
                  value={taskHoursDateFrom}
                  onChange={(event) => setTimesheetDateFrom(event.target.value)}
                />
                <Input
                  type="date"
                  value={taskHoursDateTo}
                  onChange={(event) => setTimesheetDateTo(event.target.value)}
                />
              </div>

              {taskHoursLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTimesheet.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีข้อมูลบันทึกชั่วโมง</p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto space-y-2">
                  {filteredTimesheet.map((entry: any) => (
                    <label
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTimesheetIds.includes(entry.id)}
                        onCheckedChange={() => toggleTimesheetSelection(entry.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.task_title || 'ไม่พบชื่องาน'}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.user_name ? `👤 ${entry.user_name}` : 'ไม่ระบุผู้บันทึก'} • {entry.hours_worked} ชม.
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {entry.date || ''}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">ถึง</span>
            <Input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="w-40" />
          </div>
          <Tabs defaultValue="project-summary" className="space-y-6">
            <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pb-1">
            <TabsList className="flex sm:grid w-full sm:grid-cols-4 text-xs sm:text-sm">
              <TabsTrigger value="project-summary" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
                <FolderKanban className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">สรุปโครงการ</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
                <ListTodo className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">รายงานงาน</span>
              </TabsTrigger>
              <TabsTrigger value="subtasks" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
                <Layers className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">งานย่อย</span>
              </TabsTrigger>
              <TabsTrigger value="adhoc" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
                <Zap className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">งานแทรก</span>
              </TabsTrigger>
            </TabsList>
            </div>
            <TabsContent value="project-summary">
              <ProjectSummaryReport projects={reportFiltered.filteredProjects} allTasks={reportFiltered.filteredTasks} />
            </TabsContent>
            <TabsContent value="tasks">
              <TasksReport tasks={reportFiltered.filteredTasks} projects={projects as DbProject[]} />
            </TabsContent>
            <TabsContent value="subtasks">
              <SubtasksReport startDate={reportStartDate} endDate={reportEndDate} />
            </TabsContent>
            <TabsContent value="adhoc">
              <AdHocTasksReport adHocTasks={reportFiltered.adHocTasks} allTasksCount={reportFiltered.filteredTasks.length} projects={projects as DbProject[]} />
            </TabsContent>
          </Tabs>
        </TabsContent>

      </Tabs>
    </PageShell>
  );
}
