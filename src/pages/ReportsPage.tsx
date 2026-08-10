import { useState, useMemo } from 'react';
import { useProjects, useAllTasks } from '@/hooks/useProjectData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Printer, FolderKanban, ListTodo, Layers, Zap, FileText, CheckCircle, AlertTriangle, Search, X } from 'lucide-react';
import { format, parseISO, endOfYear, isWithinInterval, startOfDay, endOfDay, startOfYear } from 'date-fns';
import { th } from 'date-fns/locale';
import { convertToCSV, downloadCSV } from '@/lib/exportUtils';
import { getStatusLabel, getPriorityLabel, calculateProjectReport } from '@/lib/projectUtils';
import PageShell from '@/components/PageShell';
import type { DbProject, DbTask } from '@/types/project';

import ReportDateFilter from '@/components/reports/ReportDateFilter';
import ProjectSummaryReport from '@/components/reports/ProjectSummaryReport';
import TasksReport from '@/components/reports/TasksReport';
import SubtasksReport from '@/components/reports/SubtasksReport';
import AdHocTasksReport from '@/components/reports/AdHocTasksReport';

export default function ReportsPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(format(startOfYear(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(today), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('project-summary');

   const { data: projects = [], isLoading: pLoading } = useProjects();
   const { data: tasksPage = { data: [] }, isLoading: tLoading } = useAllTasks({ per_page: 5000, year_from: startDate, year_to: endDate });
   const allTasks = tasksPage.data;

   const isLoading = pLoading || tLoading;

  // Filter data by date range
  const filteredData = useMemo(() => {
    if (!startDate || !endDate) {
      const adHocTasks = (allTasks as DbTask[]).filter((t) => Boolean(t.is_ad_hoc));
      return { filteredProjects: projects as DbProject[], filteredTasks: allTasks as DbTask[], adHocTasks };
    }

    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    const interval = { start, end };

    // Projects: active during the date range (overlapping)
    const filteredProjects = (projects as DbProject[]).filter((p) => {
      if (!p.start_date || !p.end_date) return false;
      const pStart = parseISO(p.start_date);
      const pEnd = parseISO(p.end_date);
      return pStart <= end && pEnd >= start;
    });

    // Tasks: start_date within range OR completed_date within range
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

    // Ad-hoc tasks
    const adHocTasks = filteredTasks.filter((t) => Boolean(t.is_ad_hoc));

    return { filteredProjects, filteredTasks, adHocTasks };
  }, [projects, allTasks, startDate, endDate]);

  // CSV Export
  const handleExportCSV = () => {
    const timestamp = format(today, 'yyyyMMdd');
    const dateLabel = `${startDate}_${endDate}`;

    if (activeTab === 'project-summary') {
      const data = filteredData.filteredProjects.map((p) => {
        const tasks = filteredData.filteredTasks.filter((t) => t.project_id === p.id);
        const report = calculateProjectReport(p, tasks);
        return {
          'ชื่อโครงการ': p.name,
          'สถานะ': getStatusLabel(p.status),
          'วันเริ่มต้น': p.start_date,
          'วันสิ้นสุด': p.end_date,
          '% เสร็จ': report.completionPercentage,
          'งานทั้งหมด': tasks.length,
          'งานเสร็จ': report.completedTasks.length,
          'วันขยาย': report.extensionDays,
        };
      });
      downloadCSV(convertToCSV(data), `project_summary_${dateLabel}_${timestamp}.csv`);
    } else if (activeTab === 'tasks') {
      const projectMap = new Map((projects as DbProject[]).map((p) => [p.id, p.name]));
      const data = filteredData.filteredTasks.map((t) => ({
        'ชื่องาน': t.title,
        'โครงการ': projectMap.get(t.project_id) || '',
        'ผู้รับผิดชอบ': t.assignee || '',
        'สถานะ': getStatusLabel(t.status),
        'ความสำคัญ': getPriorityLabel(t.priority),
        'วันเริ่มต้น': t.start_date,
        'วันสิ้นสุด': t.end_date,
        'วันที่ใช้': t.days_spent,
        'วันที่ประเมิน': t.estimated_days,
        'งานแทรก': t.is_ad_hoc ? 'ใช่' : 'ไม่',
      }));
      downloadCSV(convertToCSV(data), `tasks_report_${dateLabel}_${timestamp}.csv`);
    } else if (activeTab === 'adhoc') {
      const projectMap = new Map((projects as DbProject[]).map((p) => [p.id, p.name]));
      const data = filteredData.adHocTasks.map((t) => ({
        'ชื่องาน': t.title,
        'โครงการ': projectMap.get(t.project_id) || '',
        'ผู้รับผิดชอบ': t.assignee || '',
        'สถานะ': getStatusLabel(t.status),
        'ความสำคัญ': getPriorityLabel(t.priority),
        'วันเริ่มต้น': t.start_date,
        'วันสิ้นสุด': t.end_date,
        'วันที่ใช้': t.days_spent,
        'วันที่ประเมิน': t.estimated_days,
      }));
      downloadCSV(convertToCSV(data), `adhoc_tasks_${dateLabel}_${timestamp}.csv`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const tabLabels: Record<string, string> = {
    'project-summary': 'สรุปโครงการ',
    'tasks': 'รายงานงาน',
    'subtasks': 'งานย่อย',
    'adhoc': 'งานแทรก',
  };

  const summaryText: Record<string, string> = {
    'project-summary': `${filteredData.filteredProjects.length} โครงการ · ${filteredData.filteredTasks.length} งาน`,
    'tasks': `${filteredData.filteredTasks.length} งาน`,
    'subtasks': `งานย่อยในช่วง ${startDate} — ${endDate}`,
    'adhoc': `${filteredData.adHocTasks.length} งานแทรก`,
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

  const resetFilters = () => {
    const s = format(startOfYear(today), 'yyyy-MM-dd');
    const e = format(endOfYear(today), 'yyyy-MM-dd');
    setSearch('');
    setYearFilter(String(today.getFullYear()));
    setStartDate(s);
    setEndDate(e);
  };

  return (
    <PageShell
      breadcrumbs={[{ label: 'รายงาน', isCurrent: true }]}
      title="รายงาน"
      description="สรุปโครงการ งาน งานย่อย และการวิเคราะห์ พร้อม Export"
      actions={
        <div className="no-print flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">พิมพ์/PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      }
    >

      {/* Filters - matching Projects template */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {/* Search - spans 2 cols on lg */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาโครงการ, งาน..."
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Year filter */}
          <Select value={yearFilter} onValueChange={handleYearChange}>
            <SelectTrigger>
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
          {/* Start date */}
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          {/* End date */}
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          {/* Reset button */}
          <Button variant="outline" onClick={resetFilters} className="w-full">
            ล้างตัวกรอง
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {summaryText[activeTab]}
        </div>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold font-heading">Flowstack — {tabLabels[activeTab]}</h1>
        {startDate && endDate && (
          <p className="text-sm text-muted-foreground mt-1">
            ช่วงเวลา: {format(parseISO(startDate), 'd MMMM yyyy', { locale: th })} — {format(parseISO(endDate), 'd MMMM yyyy', { locale: th })}
          </p>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div id="report-print-area">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 text-xs sm:text-sm no-print">
              <TabsTrigger value="project-summary" className="gap-1 sm:gap-2 px-2 sm:px-3">
                <FolderKanban className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">สรุปโครงการ</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1 sm:gap-2 px-2 sm:px-3">
                <ListTodo className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">รายงานงาน</span>
              </TabsTrigger>
              <TabsTrigger value="subtasks" className="gap-1 sm:gap-2 px-2 sm:px-3">
                <Layers className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">งานย่อย</span>
              </TabsTrigger>
              <TabsTrigger value="adhoc" className="gap-1 sm:gap-2 px-2 sm:px-3">
                <Zap className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">งานแทรก</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="project-summary">
              <ProjectSummaryReport
                projects={filteredData.filteredProjects}
                allTasks={filteredData.filteredTasks}
              />
            </TabsContent>

            <TabsContent value="tasks">
              <TasksReport
                tasks={filteredData.filteredTasks}
                projects={projects as DbProject[]}
              />
            </TabsContent>

            <TabsContent value="subtasks">
              <SubtasksReport startDate={startDate} endDate={endDate} />
            </TabsContent>

            <TabsContent value="adhoc">
              <AdHocTasksReport
                adHocTasks={filteredData.adHocTasks}
                allTasksCount={filteredData.filteredTasks.length}
                projects={projects as DbProject[]}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </PageShell>
  );
}
