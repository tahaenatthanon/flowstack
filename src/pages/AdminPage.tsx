import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl, getToken } from '@/lib/api';
import * as XLSX from 'xlsx';
import PageShell from '@/components/PageShell';
import RowsPerPageSelector from '@/components/RowsPerPageSelector';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useChangeUserPassword, useCreateUser, useDeleteUser, useResetUserPassword,
  useUsers, useUpdateUser, useToggleUserActive, useAllTasks, useTaskChildren, useProjectsWithCompanyCustomer,
  useCompanies, useCustomers, useDeleteProject, useUpdateProject,
  useUpdateTask, useDeleteTask,
  useRoles, useCreateRole, useUpdateRole, useDeleteRole, type RoleData,
  useDeleteCompany, useDeleteCustomer,
  useOpportunities, useDeleteOpportunity, useUpdateOpportunity,
  useQuotations, useDeleteQuotation, useUpdateQuotation,
  useAllTaskHoursEntries, useDeleteTaskHoursEntry,
  useAdminOverview,
  useActivityLogs, type ActivityLog,
  useEmailAliases, useCreateEmailAlias, useDeleteEmailAlias, type EmailAlias,
} from '@/hooks/useProjectData';
import { getStatusLabel, getProjectStatusColor, getStatusColor, getPriorityLabel } from '@/lib/projectUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, Users, Building2, KeyRound, Key, RotateCcw, Trash2, Upload, Plus, Pencil, FolderKanban, CheckCircle2, Search, UserCheck, UserX, Lock, FileText, Clock, ListTodo, TrendingUp, Target, AlertTriangle, DollarSign, Activity, LogIn, LogOut, X, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, AtSign, CheckCheck, Download, Bot, HardDrive, FileSpreadsheet, Timer, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { endOfYear, format, parseISO, startOfYear } from 'date-fns';
import { th } from 'date-fns/locale';
import CompanySettingsForm from '@/components/admin/CompanySettingsForm';
import ImportDataPanel from '@/components/admin/ImportDataPanel';
import SmtpSettingsForm from '@/components/admin/SmtpSettingsForm';
import ImapSettingsForm from '@/components/admin/ImapSettingsForm';
import AISettingsPanel from '@/components/admin/AISettingsPanel';
import { CustomFieldsPanel } from '@/components/admin/CustomFieldsPanel';
import { EmailAliasesPanel } from '@/components/admin/EmailAliasesPanel';
import { AgentApiKeysPanel } from '@/components/admin/AgentApiKeysPanel';
import { KpiWeightsPanel } from '@/components/admin/KpiWeightsPanel';
import { PersonasPanel } from '@/components/admin/PersonasPanel';
import { KpiAlertsPanel } from '@/components/admin/KpiAlertsPanel';
import { StaleTasksPanel } from '@/components/admin/StaleTasksPanel';
import { CronJobsPanel } from '@/components/admin/CronJobsPanel';
import { ClientErrorsPanel } from '@/components/admin/ClientErrorsPanel';
import { AdminOverviewTab } from '@/components/admin/AdminOverviewTab';
import { AdminActivityLogsTab } from '@/components/admin/AdminActivityLogsTab';
import QuotationTemplatesPanel from '@/components/admin/QuotationTemplatesPanel';
import WorkTypeSettingsPanel from '@/components/admin/WorkTypeSettingsPanel';
import LeadSourceSettingsPanel from '@/components/admin/LeadSourceSettingsPanel';
import WorkSchedulePanel from '@/components/admin/WorkSchedulePanel';
import EditProjectDialog from '@/components/EditProjectDialog';
import TaskDetailSheet from '@/components/TaskDetailSheet';
import CreateTaskHoursEntryDialog from '@/components/CreateTaskHoursEntryDialog';

// All available menus with Thai labels
const WORK_TYPE_LABELS: Record<string, string> = {
  task: 'งานปกติ', work: 'งานปกติ', meeting: 'ประชุม', onsite: 'งานลูกค้า (Onsite)',
  ot: 'งานล่วงเวลา (OT)', leave: 'ลาหยุด', holiday: 'วันหยุด',
};
const WORK_TYPE_COLORS: Record<string, string> = {
  task: 'bg-blue-100 text-blue-700', work: 'bg-blue-100 text-blue-700', meeting: 'bg-violet-100 text-violet-700',
  onsite: 'bg-green-100 text-green-700', ot: 'bg-orange-100 text-orange-700',
  leave: 'bg-gray-100 text-gray-600', holiday: 'bg-gray-100 text-gray-600',
};

const ALL_MENUS = [
  { key: 'home',             label: 'หน้าหลัก' },
  { key: 'projects',         label: 'โปรเจกต์' },
  { key: 'task_hours',       label: 'บันทึกเวลา' },
  { key: 'calendar',         label: 'ปฏิทินทีม' },
  { key: 'goals',            label: 'เป้าหมาย & OKR' },
  { key: 'budget',           label: 'งบประมาณ' },
  { key: 'automation',       label: 'ระบบอัตโนมัติ' },
  { key: 'workflow',         label: 'Workflow BPM' },
  { key: 'companies',        label: 'บริษัทและลูกค้า' },
  { key: 'sales',            label: 'ไปป์ไลน์การขาย' },
  { key: 'quotations',       label: 'ใบเสนอราคา' },
  { key: 'revenue',          label: 'รายงานรายได้' },
  { key: 'support',          label: 'ศูนย์ช่วยเหลือ' },
  { key: 'inbox',            label: 'กล่องข้อความ' },
  { key: 'marketing',        label: 'การตลาด' },
  { key: 'analytics',        label: 'วิเคราะห์ข้อมูล' },
  { key: 'reports',          label: 'รายงาน' },
  { key: 'resources',        label: 'ทรัพยากร' },
  { key: 'task_intelligence', label: 'ประเมินผลงาน' },
  { key: 'admin',            label: 'ผู้ดูแลระบบ' },
];

interface EditableUser {
  email: string;
  display_name: string;
  position: string;
  is_admin: number;
  is_active: number;
  role_id: number | null;
}

// Expandable child rows for a parent task in the admin tasks table
function AdminTaskChildRows({ parentId, projectName, onEdit, onDelete }: {
  parentId: string;
  projectName: string;
  onEdit: (t: any) => void;
  onDelete: (t: any) => void;
}) {
  const { data: children = [], isLoading } = useTaskChildren(parentId);
  const updateTask = useUpdateTask();
  const { toast } = useToast();

  const handleStatusChange = async (sub: any, newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: sub.id, project_id: sub.project_id, status: newStatus });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <tr><td colSpan={12} className="pl-16 py-1.5 text-xs text-muted-foreground">กำลังโหลด...</td></tr>;
  }
  if (children.length === 0) {
    return <tr><td colSpan={12} className="pl-16 py-1.5 text-xs text-muted-foreground italic">ไม่มีงานย่อย</td></tr>;
  }
  return (
    <>
      {children.map((sub: any) => (
        <tr key={sub.id} className="border-b bg-muted/10 hover:bg-muted/25 transition-colors group">
          <td className="px-3 py-1.5" />
          <td className="pl-10 pr-3 py-1.5 max-w-[220px]">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50 text-xs">↳</span>
              <span className="text-xs truncate" title={sub.title}>{sub.title}</span>
            </div>
          </td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground">{sub.project_name || projectName || '-'}</td>
          <td className="px-2 py-1.5 text-xs truncate max-w-[110px]">{sub.assignee || <span className="text-muted-foreground/40">—</span>}</td>
          <td className="px-2 py-1.5">
            <button onClick={() => handleStatusChange(sub, sub.status === 'completed' ? 'in-progress' : 'completed')} title="คลิกสลับสถานะ">
              <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium cursor-pointer hover:opacity-80 ${getStatusColor(sub.status)}`}>
                {getStatusLabel(sub.status)}
              </span>
            </button>
          </td>
          <td className="px-2 py-1.5">
            <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${
              sub.priority === 'high' ? 'bg-destructive/10 text-destructive' :
              sub.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-muted text-muted-foreground'}`}>
              {getPriorityLabel(sub.priority)}
            </span>
          </td>
          <td className="px-2 py-1.5">
            {sub.task_type && sub.task_type !== 'work' ? (
              <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${WORK_TYPE_COLORS[sub.task_type] || 'bg-muted text-muted-foreground'}`}>
                {WORK_TYPE_LABELS[sub.task_type] || sub.task_type}
              </span>
            ) : <span className="text-muted-foreground/40 text-xs">—</span>}
          </td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{sub.start_date ? sub.start_date.slice(0, 10) : '—'}</td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{sub.end_date ? sub.end_date.slice(0, 10) : '—'}</td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground tabular-nums">
            {sub.progress_percentage != null && sub.progress_percentage > 0
              ? <span className="font-medium">{sub.progress_percentage}%</span>
              : <span className="text-muted-foreground/40">—</span>}
          </td>
          <td className="px-2 py-1.5 text-xs text-muted-foreground tabular-nums">
            {sub.actual_hours > 0 || sub.estimated_hours > 0
              ? <>{Number(sub.actual_hours || 0).toFixed(1)} / {Number(sub.estimated_hours || 0).toFixed(1)}</>
              : <span className="text-muted-foreground/40">—</span>}
          </td>
          <td className="px-2 py-1.5">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(sub)} title="แก้ไข">
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(sub)} title="ลบ">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function RestoreSection() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleRestore = async () => {
    if (!file || !confirmed) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('sql_file', file);
      const res = await fetch(getApiUrl('/backup.php?action=restore'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      toast({ title: 'กู้คืนสำเร็จ', description: 'ฐานข้อมูลถูกกู้คืนแล้ว กรุณา refresh หน้า' });
      setFile(null);
      setConfirmed(false);
    } catch (e: any) {
      toast({ title: 'กู้คืนไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm">เลือกไฟล์ .sql</Label>
        <Input
          type="file"
          accept=".sql"
          className="mt-1"
          onChange={e => { setFile(e.target.files?.[0] ?? null); setConfirmed(false); }}
        />
        {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
      </div>
      {file && (
        <div className="flex items-center gap-2">
          <Checkbox id="restore-confirm" checked={confirmed} onCheckedChange={v => setConfirmed(!!v)} />
          <Label htmlFor="restore-confirm" className="text-sm cursor-pointer">
            ฉันเข้าใจว่าข้อมูลปัจจุบันจะถูกเขียนทับทั้งหมด
          </Label>
        </div>
      )}
      <Button
        variant="destructive"
        className="gap-2"
        disabled={!file || !confirmed || loading}
        onClick={handleRestore}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        กู้คืนข้อมูล
      </Button>
    </div>
  );
}

// Sidebar nav item component
export default function AdminPage() {
  const navigate = useNavigate();

  // Tab-visit tracking for lazy loading
  const [activeTab, setActiveTab] = useState('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['overview']));
  const hasTab = (tab: string) => visitedTabs.has(tab);
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
  };

  // Overview filter state (must be declared before data hooks)
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const filterStartDate = startDate;
  const filterEndDate = endDate;

  // Data hooks - lazy loaded per tab
  const { data: users = [], isLoading: isLoadingUsers } = useUsers(hasTab('users'));
  const { data: projects = [], isLoading: isLoadingProjects } = useProjectsWithCompanyCustomer(hasTab('projects') || hasTab('tasks'));
  const { data: tasksData = { data: [] }, isLoading: isLoadingTasks } = useAllTasks(
    { per_page: 5000, year_from: filterStartDate, year_to: filterEndDate },
    hasTab('tasks') || hasTab('admin-subtasks')
  );
  const tasks = tasksData.data;
  const { data: companies = [], isLoading: isLoadingCompanies } = useCompanies(false, hasTab('companies') || hasTab('sales') || hasTab('quotations'));
  const { data: customers = [] } = useCustomers(undefined, false, hasTab('companies') || hasTab('quotations'));
  const updateUser = useUpdateUser();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetUserPassword();
  const toggleUserActive = useToggleUserActive();

  // Role management
  const { data: roles = [], isLoading: isLoadingRoles } = useRoles(hasTab('roles') || hasTab('users'));
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormLabel, setRoleFormLabel] = useState('');
  const [roleFormPermissions, setRoleFormPermissions] = useState<string[]>([]);
  const changePassword = useChangeUserPassword();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteCompany = useDeleteCompany();
  const deleteCustomer = useDeleteCustomer();
  const { data: opportunities = [], isLoading: isLoadingOpportunities } = useOpportunities(undefined, hasTab('sales'));
  const deleteOpportunity = useDeleteOpportunity();
  const updateOpportunity = useUpdateOpportunity();
  const { data: quotations = [], isLoading: isLoadingQuotations } = useQuotations(undefined, hasTab('quotations'));
  const deleteQuotation = useDeleteQuotation();
  const updateQuotation = useUpdateQuotation();
  const { data: allบันทึกชั่วโมง = [], isLoading: isLoadingบันทึกชั่วโมง } = useAllTaskHoursEntries(
    hasTab('admin-บันทึกชั่วโมง'),
    { dateFrom: filterStartDate, dateTo: filterEndDate }
  );
  const deleteTimesheetEntry = useDeleteTaskHoursEntry();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Activity log state
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [logAction, setLogAction] = useState('');
  const [logUserId, setLogUserId] = useState('');

  // Pagination state
  const [taskPage, setTaskPage] = useState(1);
  const [TaskHoursPage, setTaskHoursPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [logLimit, setLogLimit] = useState(50);

  // Reset page when per-page changes
  useEffect(() => { setTaskPage(1); setTaskHoursPage(1); }, [pageSize]);
  useEffect(() => { setLogPage(1); }, [logLimit]);

  const { data: activityData, isLoading: isLoadingLogs } = useActivityLogs(
    { page: logPage, limit: logLimit, search: logSearch || undefined, action: logAction || undefined, user_id: logUserId || undefined },
    hasTab('activity-logs')
  );
  const activityLogs = activityData?.logs ?? [];
  const logTotalPages = activityData?.pages ?? 1;
  const logTotal = activityData?.total ?? 0;

  // User state
  const [search, setSearch] = useState('');
  const [edited, setEdited] = useState<Record<string, EditableUser>>({});
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ email: '', display_name: '', position: '', password: '', role_id: null as number | null, is_admin: 0 });

  // Project state
  const [projectSearch, setProjectSearch] = useState('');
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);

  // Task state
  const [taskSearch, setTaskSearch] = useState('');
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [taskSheetTask, setTaskSheetTask] = useState<any>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Company/Customer state
  const [companySearch, setCompanySearch] = useState('');

  // Opportunity state
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [isEditOpportunityOpen, setIsEditOpportunityOpen] = useState(false);
  const [editOpportunityData, setEditOpportunityData] = useState<any>(null);
  const [eoName, setEoName] = useState('');
  const [eoDescription, setEoDescription] = useState('');
  const [eoStage, setEoStage] = useState('lead');
  const [eoValue, setEoValue] = useState('');
  const [eoProbability, setEoProbability] = useState('');
  const [eoExpectedCloseDate, setEoExpectedCloseDate] = useState('');
  const [eoNotes, setEoNotes] = useState('');

  // Quotation state
  const [quotationSearch, setQuotationSearch] = useState('');
  const [isEditQuotationOpen, setIsEditQuotationOpen] = useState(false);
  const [editQuotationData, setEditQuotationData] = useState<any>(null);
  const [eqStatus, setEqStatus] = useState('draft');
  const [eqIssueDate, setEqIssueDate] = useState('');
  const [eqValidUntil, setEqValidUntil] = useState('');
  const [eqPaymentTerms, setEqPaymentTerms] = useState('');
  const [eqNotes, setEqNotes] = useState('');

  // Admin บันทึกชั่วโมง state
  const [adminTimesheetSearch, setAdminTimesheetSearch] = useState('');
  const [editTimesheetEntry, setEditTimesheetEntry] = useState<any>(null);

  // Bulk selection state
  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<Set<string>>(new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState<Set<string>>(new Set());

  // Bulk edit state — opportunities
  const [bulkOppStage, setBulkOppStage] = useState('');
  const [isBulkSavingOpp, setIsBulkSavingOpp] = useState(false);

  // Bulk edit state — projects
  const [bulkProjectStatus, setBulkProjectStatus] = useState('');
  const [isBulkSavingProjects, setIsBulkSavingProjects] = useState(false);

  // Tasks tab mode: main tasks vs subtasks
  const [taskMode, setTaskMode] = useState<'main' | 'sub'>('main');
  const { data: subtasksData = { data: [] }, isLoading: isLoadingSubtasks } = useAllTasks(
    { subtask_only: true, per_page: 5000, year_from: filterStartDate, year_to: filterEndDate },
    hasTab('tasks') && taskMode === 'sub'
  );

  const handleYearChange = (year: string) => {
    setYearFilter(year);
    if (year === '__all__') {
      setStartDate('');
      setEndDate('');
    } else {
      const y = parseInt(year, 10);
      setStartDate(format(startOfYear(new Date(y, 0, 1)), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(new Date(y, 0, 1)), 'yyyy-MM-dd'));
    }
  };

  const resetFilters = () => {
    setYearFilter(String(currentYear));
    setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  };

  // Date range filter helper (compares YYYY-MM-DD strings; empty = show all)
  const filterByDate = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    if (!filterStartDate && !filterEndDate) return true;
    const d = dateStr.substring(0, 10);
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    return true;
  };

  // Overview stats - single endpoint replaces 9 concurrent queries
  const { data: overviewData, isLoading: isLoadingOverview } = useAdminOverview({
    start_date: filterStartDate || '2000-01-01',
    end_date: filterEndDate || '2099-12-31',
  });

  useEffect(() => {
    if (users.length > 0) {
      const nextState: Record<string, EditableUser> = {};
      users.forEach((user) => {
        nextState[user.id] = {
          email: user.email || '',
          display_name: user.display_name || '',
          position: user.position || '',
          is_admin: Number(user.is_admin) === 1 ? 1 : 0,
          is_active: Number(user.is_active) === 0 ? 0 : 1,
          role_id: user.role_id ?? null,
        };
      });
      setEdited(nextState);
    }
  }, [users]);

  // --- User Handlers ---
  const handleChange = (userId: string, field: keyof EditableUser, value: string | number) => {
    setEdited((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
  };

  const filteredUsers = useMemo(() => {
    let result = users.filter((u) => filterByDate(u.created_at));
    const term = search.trim().toLowerCase();
    if (term) result = result.filter((u) =>
      (u.email || '').toLowerCase().includes(term) ||
      (u.display_name || '').toLowerCase().includes(term) ||
      (u.position || '').toLowerCase().includes(term)
    );
    return result;
  }, [users, search, filterStartDate, filterEndDate]);

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast({ title: 'ไม่สามารถลบผู้ใช้งานของตัวเอง', variant: 'destructive' });
      return;
    }
    const ok = await confirm({ title: 'ลบผู้ใช้', description: 'ต้องการลบผู้ใช้นี้?', variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteUser.mutateAsync(userId);
      toast({ title: 'ลบผู้ใช้สำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast({ title: 'ไม่สามารถรีเซ็ตรหัสผ่านของตัวเองด้วยวิธีนี้', variant: 'destructive' });
      return;
    }
    const ok = await confirm({ title: 'รีเซ็ตรหัสผ่าน', description: 'ต้องการรีเซ็ตรหัสผ่านผู้ใช้นี้?' });
    if (!ok) return;
    try {
      const res = await resetPassword.mutateAsync(userId);
      toast({ title: 'รีเซ็ตรหัสผ่านสำเร็จ', description: `รหัสผ่านใหม่: ${res.temporary_password}` });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const openChangePassword = (userId: string) => {
    setPasswordUserId(userId);
    setNewPassword('');
    setIsPasswordDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordUserId) return;
    try {
      await changePassword.mutateAsync({ id: passwordUserId, newPassword });
      toast({ title: 'เปลี่ยนรหัสผ่านสำเร็จ' });
      setIsPasswordDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const openAddUserDialog = () => {
    setNewUser({ email: '', display_name: '', position: '', password: '', role_id: null, is_admin: 0 });
    setIsAddUserDialogOpen(true);
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast({ title: 'กรุณากรอกอีเมลและรหัสผ่าน', variant: 'destructive' });
      return;
    }
    try {
      await createUser.mutateAsync(newUser);
      toast({ title: 'เพิ่มผู้ใช้สำเร็จ' });
      setIsAddUserDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleUserActive = async (userId: string, currentActive: number) => {
    if (userId === currentUser?.id) {
      toast({ title: 'ไม่สามารถระงับบัญชีของตัวเอง', variant: 'destructive' });
      return;
    }
    const action = currentActive ? 'ระงับการใช้งาน' : 'เปิดใช้งาน';
    const ok = await confirm({ title: `${action}ผู้ใช้`, description: `ต้องการ${action}ผู้ใช้นี้?` });
    if (!ok) return;
    try {
      await toggleUserActive.mutateAsync(userId);
      toast({ title: `${action}ผู้ใช้สำเร็จ` });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const openEditUserDialog = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setEditingUserId(userId);
      setEdited((prev) => ({
        ...prev,
        [userId]: {
          email: user.email || '',
          display_name: user.display_name || '',
          position: user.position || '',
          is_admin: Number(user.is_admin) === 1 ? 1 : 0,
          is_active: Number(user.is_active) === 0 ? 0 : 1,
          role_id: user.role_id ?? null,
        },
      }));
      setIsEditUserDialogOpen(true);
    }
  };

  const handleEditUserSave = async () => {
    if (!editingUserId) return;
    const payload = edited[editingUserId];
    if (!payload) return;
    try {
      await updateUser.mutateAsync({ id: editingUserId, updates: payload });
      toast({ title: 'บันทึกสำเร็จ' });
      setIsEditUserDialogOpen(false);
      setEditingUserId(null);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // --- Role Handlers ---
  const openCreateRole = () => {
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormLabel('');
    setRoleFormPermissions([]);
    setIsRoleDialogOpen(true);
  };

  const openEditRole = (role: RoleData) => {
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormLabel(role.label);
    setRoleFormPermissions([...role.permissions]);
    setIsRoleDialogOpen(true);
  };

  const handleRoleSave = async () => {
    try {
      if (editingRole) {
        await updateRole.mutateAsync({ id: editingRole.id, label: roleFormLabel, permissions: roleFormPermissions });
        toast({ title: 'แก้ไข Role สำเร็จ' });
      } else {
        await createRole.mutateAsync({ name: roleFormName, label: roleFormLabel, permissions: roleFormPermissions });
        toast({ title: 'สร้าง Role สำเร็จ' });
      }
      setIsRoleDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteRole = async (role: RoleData) => {
    const ok = await confirm({ title: 'ลบ Role', description: `ต้องการลบ Role "${role.label}"?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteRoleMutation.mutateAsync(role.id);
      toast({ title: 'ลบ Role สำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const toggleRolePermission = (menuKey: string) => {
    setRoleFormPermissions((prev) =>
      prev.includes(menuKey) ? prev.filter((k) => k !== menuKey) : [...prev, menuKey]
    );
  };

  // --- Project Handlers ---
  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => filterByDate(p.start_date));
    const term = projectSearch.trim().toLowerCase();
    if (term) result = result.filter((p) =>
      (p.project_name || '').toLowerCase().includes(term) ||
      (p.company_name || '').toLowerCase().includes(term) ||
      (p.customer_name || '').toLowerCase().includes(term)
    );
    return result;
  }, [projects, projectSearch, filterStartDate, filterEndDate]);

  const openEditProject = (project: any) => {
    setEditProject(project);
    setIsEditProjectOpen(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    const ok = await confirm({ title: 'ลบโครงการ', description: 'ต้องการลบโครงการนี้? ข้อมูลงานและ บันทึกชั่วโมง ที่เกี่ยวข้องจะถูกลบด้วย', variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteProject.mutateAsync(projectId);
      toast({ title: 'ลบโครงการสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // --- Task Handlers ---
  const filteredTasks = useMemo(() => {
    let result = tasks;
    const term = taskSearch.trim().toLowerCase();
    if (term) result = result.filter((t) =>
      (t.title || '').toLowerCase().includes(term) ||
      (t.assignee || '').toLowerCase().includes(term)
    );
    return [...result].sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''));
  }, [tasks, taskSearch]);

  // Build project name map from projects list
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.project_id, p.project_name));
    return map;
  }, [projects]);

  const openEditTask = (task: any) => {
    setTaskSheetTask(task);
    setTaskSheetOpen(true);
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const handleBulkEdit = async () => {
    if (!bulkStatus && !bulkAssignee && !bulkPriority) return;
    setIsBulkSaving(true);
    const allTasksPool = [...tasks, ...subtasksData.data];
    try {
      await Promise.all(Array.from(selectedTaskIds).map(taskId => {
        const task = allTasksPool.find((t: any) => t.id === taskId);
        return updateTask.mutateAsync({
          id: taskId,
          project_id: task?.project_id || '',
          ...(bulkStatus   ? { status:   bulkStatus }   : {}),
          ...(bulkAssignee ? { assignee: bulkAssignee } : {}),
          ...(bulkPriority ? { priority: bulkPriority } : {}),
        });
      }));
      toast({ title: `แก้ไข ${selectedTaskIds.size} งานสำเร็จ` });
      setBulkStatus(''); setBulkAssignee(''); setBulkPriority('');
      setSelectedTaskIds(new Set());
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleDeleteTask = async (task: any) => {
    const ok = await confirm({ title: 'ลบงาน', description: `ต้องการลบงาน "${task.title}"?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId: task.project_id });
      toast({ title: 'ลบงานสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // --- Company / Customer Handlers ---
  const filteredCompanies = useMemo(() => {
    let result = companies.filter((c) => filterByDate(c.created_at));
    const term = companySearch.trim().toLowerCase();
    if (term) result = result.filter((c) =>
      (c.name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term)
    );
    return result;
  }, [companies, companySearch, filterStartDate, filterEndDate]);

  const filteredCustomers = useMemo(() => {
    let result = customers.filter((c) => filterByDate(c.created_at));
    const term = companySearch.trim().toLowerCase();
    if (term) result = result.filter((c) =>
      (c.first_name || '').toLowerCase().includes(term) ||
      (c.last_name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
    return result;
  }, [customers, companySearch, filterStartDate, filterEndDate]);

  const companyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [companies]);

  const handleDeleteCompany = async (company: any) => {
    const ok = await confirm({ title: 'ลบบริษัท', description: `ต้องการลบบริษัท "${company.name}"? ลูกค้าและข้อมูลที่เกี่ยวข้องจะถูกลบด้วย`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteCompany.mutateAsync(company.id);
      toast({ title: 'ลบบริษัทสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteCustomer = async (customer: any) => {
    const name = `${customer.first_name} ${customer.last_name}`;
    const ok = await confirm({ title: 'ลบลูกค้า', description: `ต้องการลบลูกค้า "${name}"?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteCustomer.mutateAsync(customer.id);
      toast({ title: 'ลบลูกค้าสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // --- Opportunity Handlers ---
  const filteredOpportunities = useMemo(() => {
    let result = opportunities.filter((o) => filterByDate(o.expected_close_date));
    const term = opportunitySearch.trim().toLowerCase();
    if (term) result = result.filter((o) =>
      (o.opportunity_name || '').toLowerCase().includes(term) ||
      (o.company_name || '').toLowerCase().includes(term) ||
      (o.assigned_user_name || '').toLowerCase().includes(term)
    );
    return result;
  }, [opportunities, opportunitySearch, filterStartDate, filterEndDate]);

  const opportunityStageLabel = (stage: string) => {
    const map: Record<string, string> = {
      lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
      negotiation: 'Negotiation', won: 'ชนะ', lost: 'แพ้',
    };
    return map[stage] ?? stage;
  };

  const opportunityStageVariant = (stage: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (stage === 'won') return 'default';
    if (stage === 'lost') return 'destructive';
    if (stage === 'negotiation') return 'secondary';
    return 'outline';
  };

  const openEditOpportunity = (o) => {
    setEditOpportunityData(o);
    setEoName(o.opportunity_name || '');
    setEoDescription(o.description || '');
    setEoStage(o.stage || 'lead');
    setEoValue(String(o.value ?? ''));
    setEoProbability(String(o.probability ?? ''));
    setEoExpectedCloseDate(o.expected_close_date || '');
    setEoNotes(o.notes || '');
    setIsEditOpportunityOpen(true);
  };

  const handleEditOpportunitySave = async () => {
    if (!editOpportunityData) return;
    try {
      await updateOpportunity.mutateAsync({
        id: editOpportunityData.opportunity_id,
        updates: {
          name: eoName,
          description: eoDescription,
          stage: eoStage,
          value: parseFloat(eoValue) || 0,
          probability: parseInt(eoProbability) || 0,
          expected_close_date: eoExpectedCloseDate || null,
          notes: eoNotes,
        },
      });
      toast({ title: 'แก้ไขโอกาสการขายสำเร็จ' });
      setIsEditOpportunityOpen(false);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteOpportunity = async (o) => {
    const ok = await confirm({ title: 'ลบโอกาสการขาย', description: `ต้องการลบโอกาสการขาย "${o.opportunity_name}"?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteOpportunity.mutateAsync(o.opportunity_id);
      toast({ title: 'ลบโอกาสการขายสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDeleteOpportunities = async () => {
    const ids = [...selectedOpportunityIds];
    const ok = await confirm({ title: 'ลบโอกาสการขาย', description: `ต้องการลบ ${ids.length} โอกาสการขายที่เลือก?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => deleteOpportunity.mutateAsync(id)));
      setSelectedOpportunityIds(new Set());
      toast({ title: `ลบ ${ids.length} รายการสำเร็จ` });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkEditOpportunities = async () => {
    if (!bulkOppStage) return;
    setIsBulkSavingOpp(true);
    try {
      await Promise.all([...selectedOpportunityIds].map(id =>
        updateOpportunity.mutateAsync({ id, updates: { stage: bulkOppStage } })
      ));
      toast({ title: `อัปเดต ${selectedOpportunityIds.size} รายการสำเร็จ` });
      setBulkOppStage('');
      setSelectedOpportunityIds(new Set());
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setIsBulkSavingOpp(false);
    }
  };

  const handleBulkEditProjects = async () => {
    if (!bulkProjectStatus) return;
    setIsBulkSavingProjects(true);
    try {
      await Promise.all([...selectedProjectIds].map(id =>
        updateProject.mutateAsync({ id, status: bulkProjectStatus })
      ));
      toast({ title: `อัปเดต ${selectedProjectIds.size} โครงการสำเร็จ` });
      setBulkProjectStatus('');
      setSelectedProjectIds(new Set());
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setIsBulkSavingProjects(false);
    }
  };

  // --- Quotation Handlers ---
  const filteredQuotations = useMemo(() => {
    let result = quotations.filter((q) => filterByDate(q.created_at));
    const term = quotationSearch.trim().toLowerCase();
    if (term) result = result.filter((q) =>
      (q.quotation_number || '').toLowerCase().includes(term) ||
      (q.company_name || '').toLowerCase().includes(term)
    );
    return result;
  }, [quotations, quotationSearch, filterStartDate, filterEndDate]);

  const quotationStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: 'ร่าง', sent: 'ส่งแล้ว', approved: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธ', expired: 'หมดอายุ',
    };
    return map[status] ?? status;
  };

  const quotationStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === 'approved') return 'default';
    if (status === 'sent') return 'secondary';
    if (status === 'rejected') return 'destructive';
    return 'outline';
  };

  const openEditQuotation = (q) => {
    setEditQuotationData(q);
    setEqStatus(q.status || 'draft');
    setEqIssueDate(q.issue_date || '');
    setEqValidUntil(q.valid_until || '');
    setEqPaymentTerms(q.payment_terms || '');
    setEqNotes(q.notes || '');
    setIsEditQuotationOpen(true);
  };

  const handleEditQuotationSave = async () => {
    if (!editQuotationData) return;
    try {
      await updateQuotation.mutateAsync({
        id: editQuotationData.id,
        updates: {
          status: eqStatus,
          issue_date: eqIssueDate || null,
          valid_until: eqValidUntil || null,
          payment_terms: eqPaymentTerms,
          notes: eqNotes,
        },
      });
      toast({ title: 'แก้ไขใบเสนอราคาสำเร็จ' });
      setIsEditQuotationOpen(false);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteQuotation = async (q) => {
    const ok = await confirm({ title: 'ลบใบเสนอราคา', description: `ต้องการลบใบเสนอราคา "${q.quotation_number}"?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteQuotation.mutateAsync(q.id);
      toast({ title: 'ลบใบเสนอราคาสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // --- Admin บันทึกชั่วโมง Handlers ---
  const filteredAdminบันทึกชั่วโมง = useMemo(() => {
    let result = allบันทึกชั่วโมง;
    const term = adminTimesheetSearch.trim().toLowerCase();
    if (term) result = result.filter((e) =>
      (e.task_title || '').toLowerCase().includes(term) ||
      (e.user_name || '').toLowerCase().includes(term) ||
      (e.project_name || '').toLowerCase().includes(term)
    );
    return result;
  }, [allบันทึกชั่วโมง, adminTimesheetSearch]);

  const handleDeleteTimesheetEntry = async (entry: any) => {
    const ok = await confirm({ title: 'ลบรายการบันทึกเวลา', description: 'ต้องการลบรายการบันทึกเวลานี้?', variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteTimesheetEntry.mutateAsync({ id: entry.id, projectId: entry.project_id });
      toast({ title: 'ลบรายการสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const openEditTimesheetEntry = (entry: any) => {
    setEditTimesheetEntry(entry);
  };

  // --- Bulk Delete Handlers ---
  const handleBulkDeleteProjects = async () => {
    const ids = [...selectedProjectIds];
    const ok = await confirm({ title: 'ลบโครงการ', description: `ต้องการลบ ${ids.length} โครงการที่เลือก? ข้อมูลงานและ บันทึกชั่วโมง ที่เกี่ยวข้องจะถูกลบด้วย`, variant: 'destructive' });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => deleteProject.mutateAsync(id)));
      setSelectedProjectIds(new Set());
      toast({ title: `ลบ ${ids.length} โครงการสำเร็จ` });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDeleteTasks = async () => {
    const ids = [...selectedTaskIds];
    const ok = await confirm({ title: 'ลบงาน', description: `ต้องการลบ ${ids.length} งานที่เลือก?`, variant: 'destructive' });
    if (!ok) return;
    const allTasksPool = [...tasks, ...subtasksData.data];
    try {
      await Promise.all(ids.map(id => {
        const task = allTasksPool.find((t: any) => t.id === id);
        return deleteTask.mutateAsync({ id, projectId: task?.project_id || '' });
      }));
      setSelectedTaskIds(new Set());
      toast({ title: `ลบ ${ids.length} งานสำเร็จ` });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDeleteบันทึกชั่วโมง = async () => {
    const ids = [...selectedTimesheetIds];
    const ok = await confirm({ title: 'ลบรายการบันทึกเวลา', description: `ต้องการลบ ${ids.length} รายการบันทึกเวลาที่เลือก?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await Promise.all(ids.map(id => {
        const entry = allบันทึกชั่วโมง.find((e) => e.id === id);
        return deleteTimesheetEntry.mutateAsync({ id, projectId: entry?.project_id || '' });
      }));
      setSelectedTimesheetIds(new Set());
      toast({ title: `ลบ ${ids.length} รายการสำเร็จ` });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // --- Overview Stats (from dedicated endpoint) ---
  const ovStats        = overviewData?.stats;
  const atRiskProjects = overviewData?.at_risk_projects ?? [];
  const overdueTaskList = overviewData?.overdue_tasks ?? [];
  const recentUsers    = overviewData?.recent_users ?? [];
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try { return format(parseISO(dateStr), 'd MMM yy', { locale: th }); } catch { return dateStr; }
  };

  return (
    <PageShell
      breadcrumbs={[{ label: 'จัดการระบบ', isCurrent: true }]}
      title="การจัดการระบบ"
      description="จัดการผู้ใช้ โครงการ งาน และตั้งค่าระบบ"
    >

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">

          {/* Horizontal scroll tabs — icon-only mobile, label sm+ */}
          <div className="overflow-x-auto w-full">
          <TabsList className="flex w-max justify-start h-auto text-xs sm:text-sm">
            {/* ── ทั่วไป ── */}
            <TabsTrigger value="overview"            className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><ShieldCheck className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ภาพรวม</span></TabsTrigger>
            <TabsTrigger value="users"               className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Users className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ผู้ใช้งาน</span></TabsTrigger>
            <TabsTrigger value="roles"               className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Lock className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">กำหนดสิทธิ์</span></TabsTrigger>
            {/* ── ตั้งค่าระบบ ── */}
            <TabsTrigger value="company-settings"    className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Building2 className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ตั้งค่าบริษัท</span></TabsTrigger>
            <TabsTrigger value="work-types"          className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><ListTodo className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ประเภทงาน</span></TabsTrigger>
            <TabsTrigger value="work-schedules"      className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Clock className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ตารางงาน</span></TabsTrigger>
            <TabsTrigger value="lead-sources"        className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Target className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">แหล่งลูกค้า</span></TabsTrigger>
            <TabsTrigger value="custom-fields"       className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><ListTodo className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ฟิลด์เพิ่มเติม</span></TabsTrigger>
            <TabsTrigger value="quotation-templates" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><FileSpreadsheet className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Template ใบเสนอราคา</span></TabsTrigger>
            <TabsTrigger value="kpi-weights"         className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Target className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">KPI Weight</span></TabsTrigger>
            <TabsTrigger value="kpi-alerts"          className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><AlertTriangle className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">KPI Alerts</span></TabsTrigger>
            {/* ── AI ── */}
            <TabsTrigger value="ai-settings"         className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Bot className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ตั้งค่า AI</span></TabsTrigger>
            <TabsTrigger value="ai-personas"         className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Bot className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">AI Persona</span></TabsTrigger>
            {/* ── การแจ้งเตือน & Integration ── */}
            <TabsTrigger value="smtp"                className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Bell className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">แจ้งเตือน</span></TabsTrigger>
            <TabsTrigger value="email-aliases"       className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><AtSign className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Email Alias</span></TabsTrigger>
            <TabsTrigger value="agent-api-keys"      className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Key className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">API Keys</span></TabsTrigger>
            {/* ── นำเข้า / สำรองข้อมูล ── */}
            <TabsTrigger value="import"              className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Upload className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">นำเข้า</span></TabsTrigger>
            <TabsTrigger value="backup"              className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><HardDrive className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">สำรองข้อมูล</span></TabsTrigger>
            {/* ── Monitoring ── */}
            <TabsTrigger value="activity-logs"       className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Activity className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Log กิจกรรม</span></TabsTrigger>
            <TabsTrigger value="stale-tasks"         className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Clock className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">งานค้าง</span></TabsTrigger>
            <TabsTrigger value="crash-log"           className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><AlertTriangle className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Crash Log</span></TabsTrigger>
            <TabsTrigger value="cron-jobs"           className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Timer className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Cron Jobs</span></TabsTrigger>
          </TabsList>
          </div>

        {/* === Date Filter (only for tabs that use date filtering) === */}
        {['overview', 'users', 'projects', 'tasks', 'companies', 'sales', 'quotations', 'admin-บันทึกชั่วโมง'].includes(activeTab) && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button variant="outline" onClick={resetFilters} className="w-full">
                ล้างตัวกรอง
              </Button>
            </div>
          </div>
        )}


        {/* === Overview === */}
        <TabsContent value="overview">
          <AdminOverviewTab startDate={filterStartDate} endDate={filterEndDate} />
        </TabsContent>

        {/* === Users === */}
        <TabsContent value="users">
          {isLoadingUsers ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>ผู้ใช้งานทั้งหมด ({filteredUsers.length})</CardTitle>
                  <CardDescription>แก้ไขข้อมูลผู้ใช้และกำหนดสิทธิ์</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <Input placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Button className="gap-2 shrink-0" onClick={openAddUserDialog}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">เพิ่มผู้ใช้</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">ไม่พบผู้ใช้งาน</p>
                ) : (
                  <>
                    {/* Mobile user cards */}
                    <div className="md:hidden space-y-3">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{user.email}</div>
                              <div className="text-xs text-muted-foreground">{user.display_name || '-'}{user.position ? ` · ${user.position}` : ''}</div>
                            </div>
                            {Number(user.is_active) === 0 ? (
                              <Badge variant="destructive" className="text-xs shrink-0">ระงับแล้ว</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs shrink-0 text-green-600 border-green-400">ใช้งานได้</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {Number(user.is_admin) === 1 ? (
                              <Badge variant="default" className="text-xs"><ShieldCheck className="h-3 w-3 mr-1" />ผู้ดูแลระบบ</Badge>
                            ) : user.role_label ? (
                              <Badge variant="secondary" className="text-xs">{user.role_label}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">User</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1 border-t">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditUserDialog(user.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openChangePassword(user.id)}><KeyRound className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleResetPassword(user.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost"
                              className={`h-7 w-7 ${Number(user.is_active) === 0 ? 'text-green-600' : 'text-yellow-600'}`}
                              onClick={() => handleToggleUserActive(user.id, Number(user.is_active))}
                              disabled={user.id === currentUser?.id}
                            >
                              {Number(user.is_active) === 0 ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteUser(user.id)} disabled={user.id === currentUser?.id}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop user table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>อีเมล</TableHead>
                            <TableHead className="hidden sm:table-cell">ชื่อแสดง</TableHead>
                            <TableHead className="hidden md:table-cell">ตำแหน่ง</TableHead>
                            <TableHead>สิทธิ์</TableHead>
                            <TableHead className="hidden sm:table-cell">สถานะ</TableHead>
                            <TableHead className="text-right">จัดการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div className="font-medium text-sm">{user.email}</div>
                                <div className="text-xs text-muted-foreground sm:hidden">
                                  {user.display_name || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{user.display_name || '-'}</TableCell>
                              <TableCell className="hidden md:table-cell">{user.position || '-'}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {Number(user.is_admin) === 1 ? (
                                    <Badge variant="default" className="text-xs w-fit">
                                      <ShieldCheck className="h-3 w-3 mr-1" />ผู้ดูแลระบบ
                                    </Badge>
                                  ) : user.role_label ? (
                                    <Badge variant="secondary" className="text-xs w-fit">
                                      {user.role_label}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">User</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {Number(user.is_active) === 0 ? (
                                  <Badge variant="destructive" className="text-xs">ระงับแล้ว</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-400">ใช้งานได้</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditUserDialog(user.id)} title="แก้ไข">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openChangePassword(user.id)} title="เปลี่ยนรหัสผ่าน">
                                    <KeyRound className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleResetPassword(user.id)} title="รีเซ็ตรหัสผ่าน">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon" variant="ghost"
                                    className={`h-8 w-8 ${Number(user.is_active) === 0 ? 'text-green-600' : 'text-yellow-600'}`}
                                    onClick={() => handleToggleUserActive(user.id, Number(user.is_active))}
                                    disabled={user.id === currentUser?.id}
                                    title={Number(user.is_active) === 0 ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
                                  >
                                    {Number(user.is_active) === 0
                                      ? <UserCheck className="h-3.5 w-3.5" />
                                      : <UserX className="h-3.5 w-3.5" />
                                    }
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteUser(user.id)} disabled={user.id === currentUser?.id} title="ลบ">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="import"><ImportDataPanel /></TabsContent>

        {/* === Activity Logs Tab === */}
        {/* === Activity Logs === */}
        <TabsContent value="activity-logs" className="space-y-4">
          <AdminActivityLogsTab users={users} />
        </TabsContent>

        {/* === Roles === */}
        <TabsContent value="roles">
          {isLoadingRoles ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>บทบาท (Roles) ทั้งหมด ({roles.length})</CardTitle>
                  <CardDescription>กำหนดสิทธิ์การเข้าถึงเมนูสำหรับแต่ละบทบาท</CardDescription>
                </div>
                <Button className="gap-2 shrink-0" onClick={openCreateRole}>
                  <Plus className="h-4 w-4" />
                  <span>เพิ่ม Role ใหม่</span>
                </Button>
              </CardHeader>
              <CardContent>
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีบทบาท</p>
                ) : (
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div key={role.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{role.label}</span>
                              <Badge variant="outline" className="text-xs font-mono">{role.name}</Badge>
                              <Badge variant="secondary" className="text-xs">
                                {role.user_count ?? 0} ผู้ใช้
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {role.permissions.length === 0 ? (
                                <span className="text-xs text-muted-foreground">ไม่มีสิทธิ์การเข้าถึงเมนูใด</span>
                              ) : (
                                role.permissions.map((key) => {
                                  const menu = ALL_MENUS.find((m) => m.key === key);
                                  return (
                                    <Badge key={key} variant="default" className="text-xs">
                                      {menu?.label ?? key}
                                    </Badge>
                                  );
                                })
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditRole(role)} title="แก้ไข">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRole(role)} title="ลบ">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="quotation-templates" className="space-y-6">
          <QuotationTemplatesPanel />
        </TabsContent>

        <TabsContent value="company-settings" className="space-y-6">
          <CompanySettingsForm />
        </TabsContent>

        <TabsContent value="work-types" className="space-y-6">
          <WorkTypeSettingsPanel />
        </TabsContent>

        <TabsContent value="lead-sources" className="space-y-6">
          <LeadSourceSettingsPanel />
        </TabsContent>

        <TabsContent value="work-schedules" className="space-y-6">
          {hasTab('work-schedules') && <WorkSchedulePanel />}
        </TabsContent>

        <TabsContent value="smtp" className="space-y-6">
          <SmtpSettingsForm />
          <ImapSettingsForm />
        </TabsContent>

        <TabsContent value="ai-settings" className="space-y-6">
          <AISettingsPanel />
        </TabsContent>

        <TabsContent value="custom-fields" className="space-y-6">
          <CustomFieldsPanel />
        </TabsContent>

        <TabsContent value="email-aliases" className="space-y-6">
          <EmailAliasesPanel />
        </TabsContent>

        <TabsContent value="agent-api-keys" className="space-y-6">
          <AgentApiKeysPanel />
        </TabsContent>

        <TabsContent value="kpi-weights" className="space-y-6">
          <KpiWeightsPanel />
        </TabsContent>

        <TabsContent value="kpi-alerts" className="space-y-6">
          <KpiAlertsPanel />
        </TabsContent>

        <TabsContent value="stale-tasks" className="space-y-6">
          <StaleTasksPanel />
        </TabsContent>

        <TabsContent value="crash-log" className="space-y-6">
          <ClientErrorsPanel />
        </TabsContent>

        <TabsContent value="ai-personas" className="space-y-6">
          <PersonasPanel />
        </TabsContent>

        <TabsContent value="cron-jobs" className="space-y-6">
          <CronJobsPanel />
        </TabsContent>

        <TabsContent value="backup" className="space-y-6">
          {/* Download */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                สำรองฐานข้อมูล
              </CardTitle>
              <CardDescription>
                ดาวน์โหลดไฟล์สำรองข้อมูล SQL ของฐานข้อมูลทั้งหมด
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ไฟล์สำรองข้อมูลจะรวมทุกตารางและข้อมูลในฐานข้อมูล flowstack รูปแบบไฟล์ .sql
                สามารถนำไปใช้กู้คืนข้อมูลได้ทันที
              </p>
              <div className="flex items-center gap-3">
                <Button
                  className="gap-2"
                  onClick={() => {
                    fetch(getApiUrl('/backup.php'), { headers: { Authorization: `Bearer ${getToken() ?? ''}` } })
                      .then(res => {
                        if (!res.ok) throw new Error('Unauthorized');
                        const disposition = res.headers.get('Content-Disposition') || '';
                        const match = disposition.match(/filename="([^"]+)"/);
                        const filename = match ? match[1] : 'flowstack_backup.sql';
                        return res.blob().then(blob => ({ blob, filename }));
                      })
                      .then(({ blob, filename }) => {
                        const blobUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(blobUrl);
                      })
                      .catch(() => toast({ title: 'ดาวน์โหลดไม่สำเร็จ', description: 'กรุณาตรวจสอบสิทธิ์ผู้ดูแลระบบ', variant: 'destructive' }));
                  }}
                >
                  <Download className="w-4 h-4" />
                  ดาวน์โหลดสำรองข้อมูล
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                หมายเหตุ: ไฟล์สำรองข้อมูลอาจมีขนาดใหญ่ขึ้นอยู่กับปริมาณข้อมูลในระบบ
              </p>
            </CardContent>
          </Card>

          {/* Restore */}
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Upload className="w-5 h-5" />
                กู้คืนฐานข้อมูล
              </CardTitle>
              <CardDescription>
                อัปโหลดไฟล์ .sql เพื่อกู้คืนข้อมูล — ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                ⚠️ คำเตือน: การกู้คืนจะเขียนทับข้อมูลทั้งหมดในฐานข้อมูล ควรสำรองข้อมูลปัจจุบันก่อนดำเนินการ
              </div>
              <RestoreSection />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* === Dialogs === */}

      {/* Change Password */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(v) => { setIsPasswordDialogOpen(v); if (!v) setNewPassword(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>เปลี่ยนรหัสผ่านผู้ใช้</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>รหัสผ่านใหม่</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="กรอกรหัสผ่านใหม่" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleChangePassword} disabled={!newPassword || changePassword.isPending}>
              {changePassword.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={(v) => { setIsAddUserDialogOpen(v); if (!v) setNewUser({ email: '', display_name: '', position: '', password: '', role_id: null, is_admin: 0 }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>อีเมล <span className="text-destructive">*</span></Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
            <div><Label>ชื่อแสดง</Label><Input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} /></div>
            <div><Label>ตำแหน่ง</Label><Input value={newUser.position} onChange={(e) => setNewUser({ ...newUser, position: e.target.value })} /></div>
            <div><Label>รหัสผ่าน <span className="text-destructive">*</span></Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
            <div>
              <Label>บทบาท (Role)</Label>
              <Select
                value={newUser.role_id ? String(newUser.role_id) : 'none'}
                onValueChange={(val) => setNewUser({ ...newUser, role_id: val === 'none' ? null : Number(val) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— ไม่ระบุ —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                กำหนด Role เพื่อควบคุมเมนูที่เข้าถึงได้ (Admin เข้าถึงได้ทุกเมนูเสมอ)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newUser.is_admin === 1} onCheckedChange={(checked) => setNewUser({ ...newUser, is_admin: checked ? 1 : 0 })} />
              <Label>ผู้ดูแลระบบ (Admin)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleAddUser} disabled={!newUser.email || !newUser.password || createUser.isPending}>
              {createUser.isPending ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>แก้ไขข้อมูลผู้ใช้</DialogTitle></DialogHeader>
          {editingUserId && edited[editingUserId] && (
            <div className="space-y-4">
              <div><Label>อีเมล</Label><Input type="email" value={edited[editingUserId].email} onChange={(e) => handleChange(editingUserId, 'email', e.target.value)} /></div>
              <div><Label>ชื่อแสดง</Label><Input value={edited[editingUserId].display_name} onChange={(e) => handleChange(editingUserId, 'display_name', e.target.value)} /></div>
              <div><Label>ตำแหน่ง</Label><Input value={edited[editingUserId].position} onChange={(e) => handleChange(editingUserId, 'position', e.target.value)} /></div>
              <div>
                <Label>บทบาท (Role)</Label>
                <Select
                  value={edited[editingUserId].role_id ? String(edited[editingUserId].role_id) : 'none'}
                  onValueChange={(val) => handleChange(editingUserId, 'role_id', val === 'none' ? null : Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— ไม่ระบุ —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  กำหนด Role เพื่อควบคุมเมนูที่เข้าถึงได้ (Admin เข้าถึงได้ทุกเมนูเสมอ)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edited[editingUserId].is_admin === 1} onCheckedChange={(checked) => handleChange(editingUserId, 'is_admin', checked ? 1 : 0)} />
                <Label>ผู้ดูแลระบบ (Admin)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={edited[editingUserId].is_active === 1}
                  onCheckedChange={(checked) => handleChange(editingUserId, 'is_active', checked ? 1 : 0)}
                  disabled={editingUserId === currentUser?.id}
                />
                <Label>เปิดใช้งานบัญชี</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEditUserSave} disabled={updateUser.isPending}>
              {updateUser.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project */}
      <EditProjectDialog
        project={editProject}
        open={isEditProjectOpen}
        onOpenChange={(open) => { setIsEditProjectOpen(open); if (!open) setEditProject(null); }}
      />

      {/* Create / Edit Role */}
      <Dialog open={isRoleDialogOpen} onOpenChange={(v) => { setIsRoleDialogOpen(v); if (!v) { setRoleFormName(''); setRoleFormLabel(''); setRoleFormPermissions([]); } }}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'แก้ไข Role' : 'สร้าง Role ใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingRole && (
              <div>
                <Label>ชื่อ Role (ภาษาอังกฤษ, ตัวพิมพ์เล็ก)</Label>
                <Input
                  value={roleFormName}
                  onChange={(e) => setRoleFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="เช่น sales, viewer, hr"
                />
              </div>
            )}
            <div>
              <Label>ชื่อแสดง (ภาษาไทย)</Label>
              <Input value={roleFormLabel} onChange={(e) => setRoleFormLabel(e.target.value)} placeholder="เช่น ฝ่ายขาย" />
            </div>
            <div>
              <Label className="mb-2 block">เมนูที่เข้าถึงได้</Label>
              <div className="grid grid-cols-2 gap-2 border rounded-lg p-3">
                {ALL_MENUS.map((menu) => (
                  <div key={menu.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`perm-${menu.key}`}
                      checked={roleFormPermissions.includes(menu.key)}
                      onCheckedChange={() => toggleRolePermission(menu.key)}
                    />
                    <label htmlFor={`perm-${menu.key}`} className="text-sm cursor-pointer">
                      {menu.label}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">เลือก {roleFormPermissions.length} จาก {ALL_MENUS.length} เมนู</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>ยกเลิก</Button>
            <Button
              onClick={handleRoleSave}
              disabled={(!editingRole && !roleFormName) || !roleFormLabel || createRole.isPending || updateRole.isPending}
            >
              {(createRole.isPending || updateRole.isPending) ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Quotation */}
      <Dialog open={isEditQuotationOpen} onOpenChange={setIsEditQuotationOpen}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader><DialogTitle>แก้ไขใบเสนอราคา {editQuotationData?.quotation_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>สถานะ</Label>
              <Select value={eqStatus} onValueChange={setEqStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">ร่าง</SelectItem>
                  <SelectItem value="sent">ส่งแล้ว</SelectItem>
                  <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                  <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                  <SelectItem value="expired">หมดอายุ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>วันที่ออก</Label>
                <Input type="date" value={eqIssueDate} onChange={(e) => setEqIssueDate(e.target.value)} />
              </div>
              <div>
                <Label>วันหมดอายุ</Label>
                <Input type="date" value={eqValidUntil} onChange={(e) => setEqValidUntil(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>เงื่อนไขการชำระ</Label>
              <Textarea value={eqPaymentTerms} onChange={(e) => setEqPaymentTerms(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Textarea value={eqNotes} onChange={(e) => setEqNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditQuotationOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEditQuotationSave} disabled={updateQuotation.isPending}>
              {updateQuotation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Opportunity */}
      <Dialog open={isEditOpportunityOpen} onOpenChange={setIsEditOpportunityOpen}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader><DialogTitle>แก้ไขโอกาสการขาย</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อโอกาสการขาย</Label>
              <Input value={eoName} onChange={(e) => setEoName(e.target.value)} />
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea value={eoDescription} onChange={(e) => setEoDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>ขั้นตอน</Label>
              <Select value={eoStage} onValueChange={setEoStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="won">ชนะ</SelectItem>
                  <SelectItem value="lost">แพ้</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>มูลค่า (฿)</Label>
                <Input type="number" min="0" value={eoValue} onChange={(e) => setEoValue(e.target.value)} />
              </div>
              <div>
                <Label>โอกาสสำเร็จ (%)</Label>
                <Input type="number" min="0" max="100" value={eoProbability} onChange={(e) => setEoProbability(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>วันที่คาดว่าจะปิด</Label>
              <Input type="date" value={eoExpectedCloseDate} onChange={(e) => setEoExpectedCloseDate(e.target.value)} />
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Textarea value={eoNotes} onChange={(e) => setEoNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpportunityOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEditOpportunitySave} disabled={updateOpportunity.isPending}>
              {updateOpportunity.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDetailSheet
        task={taskSheetTask}
        open={taskSheetOpen}
        onOpenChange={(open) => { setTaskSheetOpen(open); if (!open) setTaskSheetTask(null); }}
      />

      {/* Edit บันทึกชั่วโมง Entry Dialog */}
      <CreateTaskHoursEntryDialog
        editEntry={editTimesheetEntry}
        open={!!editTimesheetEntry}
        onOpenChange={(open) => { if (!open) setEditTimesheetEntry(null); }}
        onSuccess={() => setEditTimesheetEntry(null)}
        hideTrigger
      />
    </PageShell>
  );
}


