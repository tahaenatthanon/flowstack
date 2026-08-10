import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  BarChart3, CheckCircle2, AlertCircle, TrendingUp, Clock, Target,
  ArrowRight, RefreshCw, Zap, Pencil, X, Check, Database, Building2,
  CalendarDays,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';

// ─── interfaces ───────────────────────────────────────────────────────────────

interface DataQualityStats {
  projects:   { total: number; withHours: number; withBudget: number; withProgress: number; totalHours: number };
  tasks:      { total: number; withHours: number; completed: number };
  task_hours_list: { total: number; linked: number; unlinked: number; totalHours: number };
}

interface ProjectItem {
  id: string; name: string; status: string;
  start_date: string | null; end_date: string | null;
  budget_hours: number | null; hourly_rate: number | null;
  project_value: number | null; actual_hours: number | null;
  company_id: string | null; company_name: string | null;
  customer_id: string | null; customer_name: string | null;
  payment_status: string | null;
  task_count?: number; completed_tasks?: number;
}

interface ProjectCombinedItem extends ProjectItem {
  missingFields: ('budget_hours' | 'hourly_rate')[];
}

interface ProjectEditForm {
  status: string; start_date: string; end_date: string;
  budget_hours: string; hourly_rate: string; project_value: string;
  company_id: string; customer_id: string; payment_status: string;
}

interface MissingItem {
  id: string; title: string; project_name: string | null;
  estimated_hours: number | null; actual_hours: number | null;
  start_date: string | null; end_date: string | null;
  assignee: string | null; status: string; priority: string | null; is_subtask: number;
}

interface ItemEditForm {
  estimated_hours: string; actual_hours: string;
  start_date: string; end_date: string; assignee: string;
  status: string; priority: string;
}

interface Company {
  id: string; name: string;
  description: string; address: string; phone: string; email: string; website: string; tax_id: string;
  business_type: string | null; company_size: string | null; founded_year: number | null; is_active: number;
}

interface CompanyEditForm {
  name: string; phone: string; email: string; website: string; tax_id: string;
  business_type: string; company_size: string; founded_year: string;
}

interface Customer { id: string; company_id: string; full_name: string; position: string; }

type MainTab = 'projects' | 'tasks' | 'subtasks' | 'companies';

// ─── constants ────────────────────────────────────────────────────────────────

const PROJECT_STATUS_OPTS = [
  { value: 'on-track',  label: 'ตามแผน' },
  { value: 'at-risk',   label: 'เสี่ยง' },
  { value: 'delayed',   label: 'ล่าช้า' },
  { value: 'completed', label: 'เสร็จแล้ว' },
];

const PROJECT_STATUS_COLOR: Record<string, string> = {
  'on-track':  'bg-green-100 text-green-700',
  'at-risk':   'bg-orange-100 text-orange-700',
  'delayed':   'bg-red-100 text-red-700',
  'completed': 'bg-blue-100 text-blue-700',
};

const PAYMENT_STATUS_OPTS = [
  { value: 'pending',  label: 'รอชำระ' },
  { value: 'partial',  label: 'ชำระบางส่วน' },
  { value: 'paid',     label: 'ชำระแล้ว' },
  { value: 'overdue',  label: 'เกินกำหนด' },
];

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  'pending': 'bg-yellow-100 text-yellow-700',
  'partial': 'bg-blue-100 text-blue-700',
  'paid':    'bg-green-100 text-green-700',
  'overdue': 'bg-red-100 text-red-700',
};

const TASK_STATUS_OPTS = [
  { value: 'pending',     label: 'รอดำเนินการ' },
  { value: 'in-progress', label: 'กำลังทำ' },
  { value: 'completed',   label: 'เสร็จแล้ว' },
  { value: 'overdue',     label: 'เกินกำหนด' },
];

const TASK_STATUS_COLOR: Record<string, string> = {
  'completed':   'bg-green-100 text-green-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  'overdue':     'bg-red-100 text-red-700',
  'pending':     'bg-gray-100 text-gray-600',
};

const TASK_PRIORITY_OPTS = [
  { value: 'high',   label: 'สูง' },
  { value: 'medium', label: 'กลาง' },
  { value: 'low',    label: 'ต่ำ' },
];

const TASK_PRIORITY_COLOR: Record<string, string> = {
  'high':   'bg-red-100 text-red-700',
  'medium': 'bg-yellow-100 text-yellow-700',
  'low':    'bg-gray-100 text-gray-600',
};

const BUSINESS_TYPES = [
  'เทคโนโลยีสารสนเทศ (IT)', 'การเงิน / ธนาคาร', 'ประกันภัย', 'อสังหาริมทรัพย์',
  'การผลิต / อุตสาหกรรม', 'ค้าปลีก / ค้าส่ง', 'การแพทย์ / สุขภาพ', 'การศึกษา',
  'พลังงาน', 'โทรคมนาคม', 'การขนส่ง / โลจิสติกส์', 'อาหาร / เครื่องดื่ม',
  'การท่องเที่ยว / โรงแรม', 'สื่อ / โฆษณา', 'ก่อสร้าง / วิศวกรรม', 'เกษตรกรรม', 'อื่น ๆ',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function Empty() {
  return <span className="text-red-500 font-medium text-[11px]">ว่าง</span>;
}

function fmtNum(v: number | null | undefined, suffix = '') {
  if (v === null || v === undefined || v === 0) return null;
  return `${v}${suffix}`;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function DataQualityDashboard() {
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));

  const yearDateRange = useMemo(() => {
    if (!yearFilter || yearFilter === '__all__') return {};
    const y = parseInt(yearFilter);
    return { year_from: `${y}-01-01`, year_to: `${y}-12-31` };
  }, [yearFilter]);

  // stats
  const [stats, setStats]       = useState<DataQualityStats | null>(null);
  const [loading, setLoading]   = useState(true);

  // project data
  const [projectsBudget, setProjectsBudget] = useState<ProjectItem[]>([]);
  const [projectsRate,   setProjectsRate]   = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // task / subtask data
  const [tasksMissing,    setTasksMissing]    = useState<MissingItem[]>([]);
  const [subtasksMissing, setSubtasksMissing] = useState<MissingItem[]>([]);
  const [loadingMissing,  setLoadingMissing]  = useState(false);

  // companies data
  const [companies, setCompanies] = useState<Company[]>([]);

  // unified tab
  const [activeTab, setActiveTab] = useState<MainTab>('companies');

  // project inline edit
  const [projectForms, setProjectForms] = useState<Map<string, ProjectEditForm>>(new Map());
  const [savingProjectIds, setSavingProjectIds] = useState<Set<string>>(new Set());

  // project bulk selection + bulk edit dialog
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [showBulkProjectEdit, setShowBulkProjectEdit] = useState(false);
  const [bulkProjectForm, setBulkProjectForm] = useState({ budget_hours: '', hourly_rate: '', status: '', payment_status: '' });
  const [savingBulkProject, setSavingBulkProject] = useState(false);

  // companies + customers for project dropdowns
  const [customersByCompany, setCustomersByCompany] = useState<Map<string, Customer[]>>(new Map());
  const [loadingCustomerIds, setLoadingCustomerIds] = useState<Set<string>>(new Set());

  // task inline edit
  const [itemForms, setItemForms] = useState<Map<string, ItemEditForm>>(new Map());
  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(new Set());

  // selection for bulk fill (tasks)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fillingHours, setFillingHours] = useState(false);
  const [showBulkTaskEdit, setShowBulkTaskEdit] = useState(false);
  const [bulkTaskForm, setBulkTaskForm] = useState({ status: '', priority: '', assignee: '' });
  const [savingBulkTask, setSavingBulkTask] = useState(false);

  // ── companies tab state ─────────────────────────────────────────────────────

  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [normalizingCompanyIds, setNormalizingCompanyIds] = useState<Set<string>>(new Set());
  const [normalizingAll, setNormalizingAll] = useState(false);
  const [companyForms, setCompanyForms] = useState<Map<string, CompanyEditForm>>(new Map());
  const [savingCompanyIds, setSavingCompanyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStats();
    fetchProjects();
    fetchMissingFields();
    fetchCompanies();
  }, [yearFilter]);

  // ── fetches ─────────────────────────────────────────────────────────────────

  const fetchCompanies = async () => {
    try {
      const data = await apiFetch('/data-quality-stats.php?action=companies_list');
      if (data.success) setCompanies(data.companies || []);
    } catch { /* non-critical */ }
  };

  const fetchCustomersForCompany = async (companyId: string) => {
    if (!companyId || customersByCompany.has(companyId)) return;
    setLoadingCustomerIds(prev => new Set(prev).add(companyId));
    try {
      const data = await apiFetch(`/data-quality-stats.php?action=customers_by_company&company_id=${companyId}`);
      if (data.success) setCustomersByCompany(prev => new Map(prev).set(companyId, data.customers || []));
    } catch { /* non-critical */ }
    finally { setLoadingCustomerIds(prev => { const n = new Set(prev); n.delete(companyId); return n; }); }
  };

  const fetchStats = async () => {
    try {
      const qs = new URLSearchParams();
      if (yearDateRange.year_from) qs.set('year_from', yearDateRange.year_from);
      if (yearDateRange.year_to)   qs.set('year_to', yearDateRange.year_to);
      const q = qs.toString();
      const data = await apiFetch('/data-quality-stats.php' + (q ? `?${q}` : ''));
      if (data.success) setStats(data);
    } catch {
      setStats({ projects: { total:0,withHours:0,withBudget:0,withProgress:0,totalHours:0 }, tasks:{total:0,withHours:0,completed:0}, task_hours_list:{total:0,linked:0,unlinked:0,totalHours:0} });
    } finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const qs = new URLSearchParams();
      qs.set('action', 'projects_without_budget');
      if (yearDateRange.year_from) qs.set('year_from', yearDateRange.year_from);
      if (yearDateRange.year_to)   qs.set('year_to', yearDateRange.year_to);
      const data = await apiFetch(`/data-quality-stats.php?${qs.toString()}`);
      setProjectsBudget(data.projects_without_budget || []);
      setProjectsRate(data.projects_without_rate     || []);
    } catch { setProjectsBudget([]); setProjectsRate([]); }
    finally  { setLoadingProjects(false); }
  };

  const fetchMissingFields = async () => {
    setLoadingMissing(true);
    try {
      const qs = new URLSearchParams();
      qs.set('action', 'items_missing_fields');
      if (yearDateRange.year_from) qs.set('year_from', yearDateRange.year_from);
      if (yearDateRange.year_to)   qs.set('year_to', yearDateRange.year_to);
      const data = await apiFetch(`/data-quality-stats.php?${qs.toString()}`);
      if (data.success) { setTasksMissing(data.tasks||[]); setSubtasksMissing(data.subtasks||[]); }
    } catch { setTasksMissing([]); setSubtasksMissing([]); }
    finally  { setLoadingMissing(false); }
  };

  const refreshAll = () => { fetchStats(); fetchProjects(); fetchMissingFields(); };

  // ── company normalize ───────────────────────────────────────────────────────

  const normalizeCompanies = async (ids?: string[]) => {
    const targeted = ids && ids.length > 0;
    if (targeted) {
      setNormalizingCompanyIds(prev => { const n = new Set(prev); ids!.forEach(id => n.add(id)); return n; });
    } else {
      setNormalizingAll(true);
    }
    try {
      const data = await apiFetch('/data-quality-stats.php?action=normalize_company_names', {
        method: 'POST',
        body: JSON.stringify(targeted ? { company_ids: ids } : {}),
      });
      if (data.success) {
        toast({ title: data.message || 'อัปเดตชื่อบริษัทเรียบร้อย' });
        fetchCompanies();
        if (targeted) setSelectedCompanyIds(prev => { const n = new Set(prev); ids!.forEach(id => n.delete(id)); return n; });
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setNormalizingAll(false);
      setNormalizingCompanyIds(new Set());
    }
  };

  // ── company inline edit ─────────────────────────────────────────────────────

  const startCompanyEdit = (c: Company) => {
    setCompanyForms(prev => new Map(prev).set(c.id, {
      name: c.name, phone: c.phone || '', email: c.email || '', website: c.website || '', tax_id: c.tax_id || '',
      business_type: c.business_type || '', company_size: c.company_size || '', founded_year: c.founded_year?.toString() || '',
    }));
  };

  const cancelCompanyEdit = (id: string) => setCompanyForms(prev => { const n = new Map(prev); n.delete(id); return n; });

  const setCompanyField = (id: string, field: keyof CompanyEditForm, value: string) => {
    setCompanyForms(prev => {
      const n = new Map(prev);
      const f = n.get(id);
      if (f) n.set(id, { ...f, [field]: value });
      return n;
    });
  };

  const saveCompanyEdit = async (companyId: string) => {
    const form = companyForms.get(companyId);
    if (!form) return;
    setSavingCompanyIds(prev => new Set(prev).add(companyId));
    try {
      const data = await apiFetch('/data-quality-stats.php?action=update_company_fields', {
        method: 'POST', body: JSON.stringify({
          company_id: companyId,
          name: form.name.trim().toUpperCase() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
          tax_id: form.tax_id.trim() || null,
          business_type: form.business_type || null,
          company_size: form.company_size || null,
          founded_year: form.founded_year || null,
        }),
      });
      if (!data.success) throw new Error(data.error || 'Failed');
      toast({ title: 'บันทึกสำเร็จ' });
      cancelCompanyEdit(companyId);
      fetchCompanies();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCompanyIds(prev => { const n = new Set(prev); n.delete(companyId); return n; });
    }
  };

  const toggleCompanySelect = (id: string) => {
    setSelectedCompanyIds(prev => { const n = new Set(prev); prev.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAllCompanies = () => {
    if (companies.length === 0) return;
    const allOn = companies.every(c => selectedCompanyIds.has(c.id));
    setSelectedCompanyIds(prev => {
      const n = new Set(prev);
      companies.forEach(c => allOn ? n.delete(c.id) : n.add(c.id));
      return n;
    });
  };

  // ── combined project list ───────────────────────────────────────────────────

  const projectsCombined = useMemo((): ProjectCombinedItem[] => {
    const map = new Map<string, ProjectCombinedItem>();
    projectsBudget.forEach(p => map.set(p.id, { ...p, missingFields: ['budget_hours'] }));
    projectsRate.forEach(p => {
      if (map.has(p.id)) map.get(p.id)!.missingFields.push('hourly_rate');
      else map.set(p.id, { ...p, missingFields: ['hourly_rate'] });
    });
    return [...map.values()];
  }, [projectsBudget, projectsRate]);

  // ── project edit ────────────────────────────────────────────────────────────

  const startProjectEdit = (p: ProjectCombinedItem) => {
    setProjectForms(prev => new Map(prev).set(p.id, {
      status: p.status || 'on-track', start_date: p.start_date || '', end_date: p.end_date || '',
      budget_hours: p.budget_hours?.toString() || '', hourly_rate: p.hourly_rate?.toString() || '',
      project_value: p.project_value?.toString() || '', company_id: p.company_id || '',
      customer_id: p.customer_id || '', payment_status: p.payment_status || 'pending',
    }));
    if (p.company_id) fetchCustomersForCompany(p.company_id);
  };

  const cancelProjectEdit = (id: string) => setProjectForms(prev => { const n = new Map(prev); n.delete(id); return n; });

  const setProjectField = (id: string, field: keyof ProjectEditForm, value: string) => {
    setProjectForms(prev => { const n = new Map(prev); const f = n.get(id); if (f) n.set(id, { ...f, [field]: value }); return n; });
  };

  const saveProjectEdit = async (projectId: string) => {
    const form = projectForms.get(projectId);
    if (!form) return;
    setSavingProjectIds(prev => new Set(prev).add(projectId));
    try {
      const data = await apiFetch('/data-quality-stats.php?action=update_project_fields', {
        method: 'POST', body: JSON.stringify({
          project_id: projectId, status: form.status || null, start_date: form.start_date || null,
          end_date: form.end_date || null, budget_hours: form.budget_hours || null,
          hourly_rate: form.hourly_rate || null, project_value: form.project_value || null,
          company_id: form.company_id || null, customer_id: form.customer_id || null,
          payment_status: form.payment_status || null,
        }),
      });
      if (!data.success) throw new Error(data.error || 'Failed');
      toast({ title: 'บันทึกสำเร็จ' });
      cancelProjectEdit(projectId);
      fetchStats(); fetchProjects();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSavingProjectIds(prev => { const n = new Set(prev); n.delete(projectId); return n; });
    }
  };

  // ── project bulk selection ──────────────────────────────────────────────────

  const toggleProjectSelect = (id: string) => setSelectedProjectIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAllProjects = () => {
    const ids = projectsCombined.map(p => p.id);
    const allOn = ids.every(id => selectedProjectIds.has(id));
    setSelectedProjectIds(prev => { const n = new Set(prev); ids.forEach(id => allOn ? n.delete(id) : n.add(id)); return n; });
  };

  const saveBulkProjectEdit = async () => {
    if (!selectedProjectIds.size) return;
    if (!bulkProjectForm.budget_hours && !bulkProjectForm.hourly_rate) {
      toast({ title: 'กรุณากรอกอย่างน้อยหนึ่งค่า', variant: 'destructive' }); return;
    }
    setSavingBulkProject(true);
    try {
      const data = await apiFetch('/data-quality-stats.php?action=update_project_fields_bulk', {
        method: 'POST', body: JSON.stringify({
          project_ids: [...selectedProjectIds], budget_hours: bulkProjectForm.budget_hours || null,
          hourly_rate: bulkProjectForm.hourly_rate || null, status: bulkProjectForm.status || null,
          payment_status: bulkProjectForm.payment_status || null,
        }),
      });
      if (!data.success) throw new Error(data.error || 'Failed');
      toast({ title: 'บันทึกสำเร็จ', description: `อัปเดต ${data.updated} โปรเจกต์` });
      setSelectedProjectIds(new Set()); setBulkProjectForm({ budget_hours: '', hourly_rate: '' });
      setShowBulkProjectEdit(false); fetchStats(); fetchProjects();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally { setSavingBulkProject(false); }
  };

  // ── task edit ───────────────────────────────────────────────────────────────

  const startItemEdit = (item: MissingItem) => {
    setItemForms(prev => new Map(prev).set(item.id, {
      estimated_hours: item.estimated_hours?.toString() || '', actual_hours: item.actual_hours?.toString() || '',
      start_date: item.start_date || '', end_date: item.end_date || '',
      assignee: item.assignee || '', status: item.status || 'pending', priority: item.priority || 'medium',
    }));
  };

  const cancelItemEdit = (id: string) => setItemForms(prev => { const n = new Map(prev); n.delete(id); return n; });

  const setItemField = (id: string, field: keyof ItemEditForm, value: string) => {
    setItemForms(prev => { const n = new Map(prev); const f = n.get(id); if (f) n.set(id, { ...f, [field]: value }); return n; });
  };

  const saveItemEdit = async (itemId: string, isSub: boolean) => {
    const form = itemForms.get(itemId);
    if (!form) return;
    setSavingItemIds(prev => new Set(prev).add(itemId));
    try {
      const payload: Record<string, string | null> = { task_id: itemId };
      payload.actual_hours = form.actual_hours || null;
      payload.estimated_hours = form.estimated_hours || null;
      payload.status = form.status || null;
      payload.priority = form.priority || null;
      if (!isSub) { payload.start_date = form.start_date || null; payload.end_date = form.end_date || null; payload.assignee = form.assignee || null; }
      const data = await apiFetch('/data-quality-stats.php?action=update_task_fields', { method: 'POST', body: JSON.stringify(payload) });
      if (!data.success) throw new Error(data.error || 'Failed');
      toast({ title: 'บันทึกสำเร็จ' });
      cancelItemEdit(itemId);
      fetchMissingFields();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSavingItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  };

  const handleFill = async () => {
    if (!selectedIds.size) return;
    setFillingHours(true);
    try {
      const data = await apiFetch('/data-quality-stats.php?action=fill_actual_hours', {
        method: 'POST', body: JSON.stringify({ task_ids: [...selectedIds] }),
      });
      if (data.success) {
        toast({ title: 'อัปเดตสำเร็จ', description: `เติมชั่วโมงจริงให้ ${data.updated} รายการ` });
        setSelectedIds(new Set()); fetchMissingFields();
      }
    } catch (e: any) { toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }); }
    finally { setFillingHours(false); }
  };

  const saveBulkTaskEdit = async () => {
    if (!selectedIds.size) return;
    if (!bulkTaskForm.status && !bulkTaskForm.priority && !bulkTaskForm.assignee) {
      toast({ title: 'กรุณากรอกอย่างน้อยหนึ่งค่า', variant: 'destructive' }); return;
    }
    setSavingBulkTask(true);
    try {
      const data = await apiFetch('/data-quality-stats.php?action=update_task_fields_bulk', {
        method: 'POST', body: JSON.stringify({
          task_ids: [...selectedIds], status: bulkTaskForm.status || null,
          priority: bulkTaskForm.priority || null, assignee: bulkTaskForm.assignee || null,
        }),
      });
      if (!data.success) throw new Error(data.error || 'Failed');
      toast({ title: 'บันทึกสำเร็จ', description: `อัปเดต ${data.updated} รายการ` });
      setSelectedIds(new Set()); setBulkTaskForm({ status: '', priority: '', assignee: '' });
      setShowBulkTaskEdit(false); fetchMissingFields();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally { setSavingBulkTask(false); }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = (items: MissingItem[]) => {
    const ids = items.map(i => i.id);
    const allOn = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => allOn ? n.delete(id) : n.add(id)); return n; });
  };

  // ── score ───────────────────────────────────────────────────────────────────

  const score = !stats ? 0 : Math.round(
    (stats.projects.withHours    / (stats.projects.total   || 1)) * 25 +
    (stats.projects.withBudget   / (stats.projects.total   || 1)) * 25 +
    (stats.task_hours_list.linked     / (stats.task_hours_list.total || 1)) * 25 +
    (stats.projects.withProgress / (stats.projects.total   || 1)) * 25,
  );
  const scoreColor = score >= 80 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';

  // ── tab config ──────────────────────────────────────────────────────────────

  const tabs: { key: MainTab; label: string; count: number }[] = [
    { key: 'companies', label: 'บริษัท',            count: companies.length },
    { key: 'projects',  label: 'โปรเจกต์ขาดข้อมูล', count: projectsCombined.length },
    { key: 'tasks',     label: 'งานหลักขาดข้อมูล',  count: tasksMissing.length },
    { key: 'subtasks',  label: 'งานย่อยขาดชม.จริง', count: subtasksMissing.length },
  ];

  const isProjectTab    = activeTab === 'projects';
  const isCompaniesTab  = activeTab === 'companies';
  const isTaskTab       = activeTab === 'tasks' || activeTab === 'subtasks';
  const currentTasks    = activeTab === 'tasks' ? tasksMissing : subtasksMissing;

  const resetTabs = () => {
    setProjectForms(new Map()); setItemForms(new Map()); setCompanyForms(new Map());
    setSelectedProjectIds(new Set()); setSelectedCompanyIds(new Set());
  };

  if (loading) return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 space-y-6">

      {/* ── Score ─────────────────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />คะแนนคุณภาพข้อมูล</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className={`text-6xl font-bold ${scoreColor}`}>{score}<span className="text-2xl text-muted-foreground">/100</span></div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span>ความสมบูรณ์ของข้อมูล</span>
                <span className="text-muted-foreground">{score >= 80 ? 'ดีเยี่ยม' : score >= 50 ? 'พอใช้' : 'ต้องปรับปรุง'}</span>
              </div>
              <Progress value={score} className="h-3" />
              <p className="text-sm text-muted-foreground">คะแนนจาก: ชั่วโมงงาน, Budget Hours, Timesheet linkage, ความคืบหน้า</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Year Filter ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">กรองตามปี:</span>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">ทุกปี</SelectItem>
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map(y =>
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />โปรเจกต์</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ทั้งหมด</span><span className="font-medium">{stats?.projects.total}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">มีชั่วโมงทำงาน</span><span className="font-medium text-green-500">{stats?.projects.withHours} ({Math.round((stats?.projects.withHours||0)/(stats?.projects.total||1)*100)}%)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">มี Budget</span><span className="font-medium text-red-500">{stats?.projects.withBudget} ({Math.round((stats?.projects.withBudget||0)/(stats?.projects.total||1)*100)}%)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ชั่วโมงรวม</span><span className="font-medium">{stats?.projects.totalHours?.toLocaleString()}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />งาน</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ทั้งหมด</span><span className="font-medium">{stats?.tasks.total}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">มีประมาณการชั่วโมง</span><span className="font-medium text-green-500">{stats?.tasks.withHours} ({Math.round((stats?.tasks.withHours||0)/(stats?.tasks.total||1)*100)}%)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="font-medium text-blue-500">{stats?.tasks.completed}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Timesheet</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ทั้งหมด</span><span className="font-medium">{stats?.task_hours_list.total}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">เชื่อมโยงแล้ว</span><span className="font-medium text-green-500">{stats?.task_hours_list.linked} ({Math.round((stats?.task_hours_list.linked||0)/(stats?.task_hours_list.total||1)*100)}%)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ยังไม่เชื่อม</span><span className={`font-medium ${(stats?.task_hours_list.unlinked||0)>0?'text-red-500':'text-green-500'}`}>{stats?.task_hours_list.unlinked}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* ── Unified Missing-Data Card ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            ข้อมูลที่ต้องเพิ่มเพื่อการประเมินผล
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {isProjectTab && selectedProjectIds.size > 0 && (
              <Button size="sm" onClick={() => setShowBulkProjectEdit(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />แก้ไขที่เลือก ({selectedProjectIds.size})
              </Button>
            )}
            {isTaskTab && selectedIds.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowBulkTaskEdit(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />แก้ไขที่เลือก ({selectedIds.size})
                </Button>
                <Button size="sm" onClick={handleFill} disabled={fillingHours}>
                  {fillingHours ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                  เติม ชม.จริง
                </Button>
              </>
            )}
            {isCompaniesTab && (
              <>
                {selectedCompanyIds.size > 0 && (
                  <Button size="sm" onClick={() => normalizeCompanies([...selectedCompanyIds])} disabled={normalizingCompanyIds.size > 0}>
                    {normalizingCompanyIds.size > 0 ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Building2 className="h-3.5 w-3.5 mr-1" />}
                    จัดรูปแบบที่เลือก ({selectedCompanyIds.size})
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => normalizeCompanies()} disabled={normalizingAll}>
                  {normalizingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Building2 className="h-3.5 w-3.5 mr-1" />}
                  จัดรูปแบบทั้งหมด
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={loadingProjects || loadingMissing}>
              <RefreshCw className={`h-4 w-4 ${(loadingProjects||loadingMissing)?'animate-spin':''}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* ── Tabs ── */}
          <div className="flex flex-wrap gap-1 mb-4">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); resetTabs(); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  activeTab === t.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* ── Companies tab ──────────────────────────────────────────────── */}
          {isCompaniesTab && (
            companies.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />กำลังโหลด...
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-2 py-2 w-8">
                        <input type="checkbox" className="cursor-pointer"
                          checked={companies.length > 0 && companies.every(c => selectedCompanyIds.has(c.id))}
                          onChange={toggleSelectAllCompanies}
                        />
                      </th>
                      <th className="px-2 py-2 text-xs font-medium min-w-[200px]">ชื่อบริษัท</th>
                      <th className="px-2 py-2 text-xs font-medium w-36">ประเภทธุรกิจ</th>
                      <th className="px-2 py-2 text-xs font-medium w-24">ขนาด</th>
                      <th className="px-2 py-2 text-xs font-medium w-32">โทรศัพท์</th>
                      <th className="px-2 py-2 text-xs font-medium w-36">อีเมล</th>
                      <th className="px-2 py-2 text-xs font-medium min-w-[140px]">เว็บไซต์</th>
                      <th className="px-2 py-2 text-xs font-medium w-24">รูปแบบชื่อ</th>
                      <th className="px-2 py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {companies.map(c => {
                      const normalized = c.name.toUpperCase().trim();
                      const needsFix = c.name !== normalized;
                      const isEditing = companyForms.has(c.id);
                      const form = companyForms.get(c.id);
                      const isSaving = savingCompanyIds.has(c.id);
                      const isNorming = normalizingCompanyIds.has(c.id) || normalizingAll;

                      if (isEditing) return (
                        <tr key={c.id} className="bg-primary/5">
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5">
                            <Input className="h-7 text-xs" value={form!.name}
                              onChange={e => setCompanyField(c.id, 'name', e.target.value.toUpperCase())} />
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={form!.business_type || '__none__'} onValueChange={v => setCompanyField(c.id, 'business_type', v === '__none__' ? '' : v)}>
                              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="เลือก" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                                {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={form!.company_size || '__none__'} onValueChange={v => setCompanyField(c.id, 'company_size', v === '__none__' ? '' : v)}>
                              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="เลือก" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                                {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s} คน</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input className="h-7 w-28 text-xs" value={form!.phone} onChange={e => setCompanyField(c.id, 'phone', e.target.value)} />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input className="h-7 w-32 text-xs" value={form!.email} onChange={e => setCompanyField(c.id, 'email', e.target.value)} />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input className="h-7 w-32 text-xs" value={form!.website} onChange={e => setCompanyField(c.id, 'website', e.target.value)} />
                          </td>
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveCompanyEdit(c.id)} disabled={isSaving}>
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelCompanyEdit(c.id)} disabled={isSaving}>
                                <X className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );

                      return (
                        <tr key={c.id} className={`hover:bg-muted/20 ${selectedCompanyIds.has(c.id) ? 'bg-primary/5' : ''}`}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" className="cursor-pointer"
                              checked={selectedCompanyIds.has(c.id)} onChange={() => toggleCompanySelect(c.id)} />
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="text-xs font-medium">{c.name}</span>
                          </td>
                          <td className="px-2 py-1.5 text-xs">{c.business_type || <Empty />}</td>
                          <td className="px-2 py-1.5 text-xs">{c.company_size ? `${c.company_size} คน` : <Empty />}</td>
                          <td className="px-2 py-1.5 text-xs">{c.phone || <Empty />}</td>
                          <td className="px-2 py-1.5 text-xs">{c.email || <Empty />}</td>
                          <td className="px-2 py-1.5 text-xs">
                            {c.website
                              ? <a href={c.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-[160px]">{c.website}</a>
                              : <Empty />}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                              needsFix ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {needsFix ? 'ต้องแก้ไข' : 'ถูกต้อง'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1 items-center">
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => startCompanyEdit(c)}>
                                <Pencil className="h-3 w-3 mr-1" />แก้ไข
                              </Button>
                              {needsFix && (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                  onClick={() => normalizeCompanies([c.id])} disabled={isNorming}>
                                  {isNorming ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Projects tab ───────────────────────────────────────────────── */}
          {isProjectTab && (
            loadingProjects ? (
              <div className="flex items-center justify-center h-32"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : projectsCombined.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><p>ข้อมูลครบแล้ว!</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm min-w-[1200px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox" className="cursor-pointer"
                          checked={projectsCombined.length > 0 && projectsCombined.every(p => selectedProjectIds.has(p.id))}
                          onChange={toggleSelectAllProjects} />
                      </th>
                      <th className="px-3 py-2 text-xs font-medium min-w-[150px]">โปรเจกต์</th>
                      <th className="px-3 py-2 text-xs font-medium w-28">สถานะ</th>
                      <th className="px-3 py-2 text-xs font-medium w-32">บริษัท</th>
                      <th className="px-3 py-2 text-xs font-medium w-28">ผู้ติดต่อ</th>
                      <th className="px-3 py-2 text-xs font-medium w-24">สถานะชำระ</th>
                      <th className="px-3 py-2 text-xs font-medium w-24">วันเริ่ม</th>
                      <th className="px-3 py-2 text-xs font-medium w-24">วันสิ้นสุด</th>
                      <th className="px-3 py-2 text-xs font-medium text-right w-24">Budget ชม.</th>
                      <th className="px-3 py-2 text-xs font-medium text-right w-24">Rate (บ/ชม.)</th>
                      <th className="px-3 py-2 text-xs font-medium text-right w-28">มูลค่า (บาท)</th>
                      <th className="px-3 py-2 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {projectsCombined.map(project => {
                      const isEditing = projectForms.has(project.id);
                      const form = projectForms.get(project.id);
                      const isSaving = savingProjectIds.has(project.id);
                      const customersForCompany = form ? (customersByCompany.get(form.company_id) || []) : [];
                      return (
                        <tr key={project.id} className={`hover:bg-muted/20 ${selectedProjectIds.has(project.id) ? 'bg-primary/5' : ''}`}>
                          <td className="px-3 py-2">
                            <input type="checkbox" className="cursor-pointer"
                              checked={selectedProjectIds.has(project.id)} onChange={() => toggleProjectSelect(project.id)} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-xs truncate max-w-[160px]">{project.name}</div>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {project.missingFields.includes('budget_hours') && <span className="text-[10px] px-1 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">ขาด Budget</span>}
                              {project.missingFields.includes('hourly_rate') && <span className="text-[10px] px-1 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">ขาด Rate</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <Select value={form!.status} onValueChange={v => setProjectField(project.id, 'status', v)}>
                                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{PROJECT_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (
                              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${PROJECT_STATUS_COLOR[project.status] || 'bg-muted text-muted-foreground'}`}>
                                {PROJECT_STATUS_OPTS.find(o => o.value === project.status)?.label || project.status}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {isEditing ? (
                              <Select value={form!.company_id || '__none__'} onValueChange={v => {
                                const val = v === '__none__' ? '' : v;
                                setProjectField(project.id, 'company_id', val);
                                setProjectField(project.id, 'customer_id', '');
                                if (val) fetchCustomersForCompany(val);
                              }}>
                                <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="เลือกบริษัท" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : project.company_name ? <span className="truncate block max-w-[120px]">{project.company_name}</span> : <Empty />
                            }
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {isEditing ? (
                              <Select value={form!.customer_id || '__none__'} onValueChange={v => setProjectField(project.id, 'customer_id', v === '__none__' ? '' : v)}
                                disabled={!form!.company_id || loadingCustomerIds.has(form!.company_id)}>
                                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="เลือกผู้ติดต่อ" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                                  {customersForCompany.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.position ? ` (${c.position})` : ''}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : project.customer_name ? <span className="truncate block max-w-[110px]">{project.customer_name}</span> : <Empty />
                            }
                          </td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <Select value={form!.payment_status || '__none__'} onValueChange={v => setProjectField(project.id, 'payment_status', v === '__none__' ? '' : v)}>
                                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                                  {PAYMENT_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : project.payment_status
                              ? <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${PAYMENT_STATUS_COLOR[project.payment_status] || 'bg-muted text-muted-foreground'}`}>{PAYMENT_STATUS_OPTS.find(o => o.value === project.payment_status)?.label || project.payment_status}</span>
                              : <Empty />
                            }
                          </td>
                          <td className="px-3 py-2 text-xs">{isEditing ? <Input type="date" className="h-7 w-28 text-xs" value={form!.start_date} onChange={e => setProjectField(project.id, 'start_date', e.target.value)} /> : project.start_date || <Empty />}</td>
                          <td className="px-3 py-2 text-xs">{isEditing ? <Input type="date" className="h-7 w-28 text-xs" value={form!.end_date} onChange={e => setProjectField(project.id, 'end_date', e.target.value)} /> : project.end_date || <Empty />}</td>
                          <td className="px-3 py-2 text-right text-xs">{isEditing ? <Input type="number" step="0.5" min="0" className="h-7 w-20 text-xs text-right" value={form!.budget_hours} onChange={e => setProjectField(project.id, 'budget_hours', e.target.value)} placeholder="ชม." /> : fmtNum(project.budget_hours, ' ชม.') ?? <Empty />}</td>
                          <td className="px-3 py-2 text-right text-xs">{isEditing ? <Input type="number" step="50" min="0" className="h-7 w-20 text-xs text-right" value={form!.hourly_rate} onChange={e => setProjectField(project.id, 'hourly_rate', e.target.value)} placeholder="บาท" /> : fmtNum(project.hourly_rate) ?? <Empty />}</td>
                          <td className="px-3 py-2 text-right text-xs">{isEditing ? <Input type="number" step="1000" min="0" className="h-7 w-24 text-xs text-right" value={form!.project_value} onChange={e => setProjectField(project.id, 'project_value', e.target.value)} placeholder="บาท" /> : fmtNum(project.project_value)?.toLocaleString() ?? <Empty />}</td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveProjectEdit(project.id)} disabled={isSaving}><Check className="h-3.5 w-3.5 text-green-500" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelProjectEdit(project.id)} disabled={isSaving}><X className="h-3.5 w-3.5 text-red-500" /></Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => startProjectEdit(project)}><Pencil className="h-3 w-3 mr-1" />แก้ไข</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {projectsCombined.length >= 50 && <p className="text-center text-xs text-muted-foreground py-2 border-t">แสดง 50 รายการแรก — บันทึกแล้วกดรีเฟรชเพื่อดูรายการถัดไป</p>}
              </div>
            )
          )}

          {/* ── Tasks / Subtasks tabs ───────────────────────────────────────── */}
          {isTaskTab && (
            loadingMissing ? (
              <div className="flex items-center justify-center h-32"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : currentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <p>{activeTab === 'tasks' ? 'งานหลักมีข้อมูลครบแล้ว!' : 'งานย่อยมีชั่วโมงจริงครบแล้ว!'}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2 w-8">
                          <input type="checkbox" className="cursor-pointer"
                            checked={currentTasks.length > 0 && currentTasks.every(i => selectedIds.has(i.id))}
                            onChange={() => toggleSelectAll(currentTasks)} />
                        </th>
                        <th className="px-3 py-2 text-xs font-medium">ชื่องาน</th>
                        <th className="px-3 py-2 text-xs font-medium hidden md:table-cell">โปรเจกต์</th>
                        <th className="px-3 py-2 text-xs font-medium w-24">สถานะ</th>
                        <th className="px-3 py-2 text-xs font-medium w-20">ลำดับ</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">ชม.ประมาณ</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">ชม.จริง</th>
                        {activeTab === 'tasks' && <>
                          <th className="px-3 py-2 text-xs font-medium hidden sm:table-cell">วันเริ่ม</th>
                          <th className="px-3 py-2 text-xs font-medium hidden sm:table-cell">วันสิ้นสุด</th>
                          <th className="px-3 py-2 text-xs font-medium hidden lg:table-cell">ผู้รับผิดชอบ</th>
                        </>}
                        {activeTab === 'subtasks' && <th className="px-3 py-2 text-xs font-medium hidden sm:table-cell">ผู้รับผิดชอบ</th>}
                        <th className="px-3 py-2 w-20" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {currentTasks.map(item => {
                        const isEditing = itemForms.has(item.id);
                        const form = itemForms.get(item.id);
                        const isSaving = savingItemIds.has(item.id);
                        const isSub = item.is_subtask === 1;
                        return (
                          <tr key={item.id} className={`hover:bg-muted/20 ${selectedIds.has(item.id) ? 'bg-primary/5' : ''}`}>
                            <td className="px-3 py-2"><input type="checkbox" className="cursor-pointer" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                            <td className="px-3 py-2 max-w-[180px]"><span className="text-xs font-medium truncate block">{item.title}</span></td>
                            <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[140px]">{item.project_name||'-'}</td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <Select value={form!.status} onValueChange={v => setItemField(item.id, 'status', v)}>
                                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{TASK_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : (
                                <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${TASK_STATUS_COLOR[item.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {TASK_STATUS_OPTS.find(o => o.value === item.status)?.label || item.status}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <Select value={form!.priority} onValueChange={v => setItemField(item.id, 'priority', v)}>
                                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{TASK_PRIORITY_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : item.priority
                                ? <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${TASK_PRIORITY_COLOR[item.priority] || 'bg-gray-100 text-gray-600'}`}>{TASK_PRIORITY_OPTS.find(o => o.value === item.priority)?.label || item.priority}</span>
                                : <Empty />
                              }
                            </td>
                            <td className="px-3 py-2 text-right text-xs">{isEditing ? <Input type="number" step="0.5" min="0" className="h-7 w-20 text-xs text-right" value={form!.estimated_hours} onChange={e => setItemField(item.id, 'estimated_hours', e.target.value)} placeholder="ชม." /> : item.estimated_hours ? <span>{item.estimated_hours}</span> : <Empty />}</td>
                            <td className="px-3 py-2 text-right text-xs">{isEditing ? <Input type="number" step="0.5" min="0" className="h-7 w-20 text-xs text-right" value={form!.actual_hours} onChange={e => setItemField(item.id, 'actual_hours', e.target.value)} placeholder="ชม." /> : item.actual_hours ? <span>{item.actual_hours}</span> : <Empty />}</td>
                            {activeTab === 'tasks' && <>
                              <td className="px-3 py-2 text-xs hidden sm:table-cell">{isEditing ? <Input type="date" className="h-7 w-32 text-xs" value={form!.start_date} onChange={e => setItemField(item.id, 'start_date', e.target.value)} /> : item.start_date || <Empty />}</td>
                              <td className="px-3 py-2 text-xs hidden sm:table-cell">{isEditing ? <Input type="date" className="h-7 w-32 text-xs" value={form!.end_date} onChange={e => setItemField(item.id, 'end_date', e.target.value)} /> : item.end_date || <Empty />}</td>
                              <td className="px-3 py-2 text-xs hidden lg:table-cell">{isEditing ? <Input type="text" className="h-7 w-28 text-xs" value={form!.assignee} onChange={e => setItemField(item.id, 'assignee', e.target.value)} placeholder="ชื่อ" /> : item.assignee || <Empty />}</td>
                            </>}
                            {activeTab === 'subtasks' && <td className="px-3 py-2 text-xs hidden sm:table-cell">{isEditing ? <Input type="text" className="h-7 w-28 text-xs" value={form!.assignee} onChange={e => setItemField(item.id, 'assignee', e.target.value)} placeholder="ชื่อ" /> : item.assignee || <Empty />}</td>}
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveItemEdit(item.id, isSub)} disabled={isSaving}><Check className="h-3.5 w-3.5 text-green-500" /></Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelItemEdit(item.id)} disabled={isSaving}><X className="h-3.5 w-3.5 text-red-500" /></Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => startItemEdit(item)}><Pencil className="h-3 w-3 mr-1" />แก้ไข</Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {currentTasks.length >= 200 && <p className="text-center text-xs text-muted-foreground py-2 border-t">แสดง 200 รายการแรก</p>}
                </div>
                {activeTab === 'subtasks' && (
                  <p className="text-xs text-muted-foreground mt-2">เลือกรายการแล้วกด <strong>เติม ชม.จริง</strong> เพื่อคัดลอกชั่วโมงประมาณมาเป็นชั่วโมงจริง (เฉพาะที่ยังว่างอยู่)</p>
                )}
              </>
            )
          )}
        </CardContent>
      </Card>

      {/* ── Recommendations ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />คำแนะนำ</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              stats && stats.projects.withBudget === 0 && { title:'กำหนด Budget Hours', desc:'เพิ่ม budget_hours เพื่อเปรียบเทียบกับชั่วโมงจริง', p:'high' },
              stats && stats.projects.withProgress < (stats.projects.total||1)*0.5 && { title:'อัปเดตความคืบหน้า', desc:'คำนวณ actual_progress อัตโนมัติจาก task ที่ completed', p:'high' },
              stats && stats.task_hours_list.unlinked > 0 && { title:'เชื่อมโยงบันทึกชั่วโมง', desc:`${stats.task_hours_list.unlinked} รายการยังไม่เชื่อมกับ task`, p:'medium' },
              { title:'ตั้งค่า Hourly Rate', desc:'กำหนดอัตราค่าแรงเพื่อคำนวณต้นทุนโปรเจกต์', p:'low' },
            ].filter(Boolean).map((rec: any, i) => (
              <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${
                rec.p==='high' ? 'bg-red-50 border-red-200 dark:bg-red-950/20' :
                rec.p==='medium' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20' :
                'bg-gray-50 border-gray-200 dark:bg-gray-950/20'
              }`}>
                {rec.p==='high' ? <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> :
                 rec.p==='medium' ? <TrendingUp className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" /> :
                 <CheckCircle2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />}
                <div><p className="text-sm font-medium">{rec.title}</p><p className="text-xs text-muted-foreground">{rec.desc}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Actions ──────────────────────────────────────────────────── */}
      <div className="flex gap-4 justify-center flex-wrap">
        <Button variant="outline" onClick={refreshAll}><RefreshCw className="h-4 w-4 mr-2" />รีเฟรชข้อมูล</Button>
        <Button variant="outline" onClick={() => normalizeCompanies()} disabled={normalizingAll}>
          {normalizingAll ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
          จัดรูปแบบชื่อบริษัท (UPPERCASE + TRIM)
        </Button>
        <Button onClick={() => window.location.href = '/#/projects'}>ไปที่โปรเจกต์<ArrowRight className="h-4 w-4 ml-2" /></Button>
      </div>

      {/* ── Bulk Project Edit Dialog ───────────────────────────────────────── */}
      <Dialog open={showBulkProjectEdit} onOpenChange={setShowBulkProjectEdit}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>แก้ไขโปรเจกต์ที่เลือก ({selectedProjectIds.size} รายการ)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">กรอกเฉพาะค่าที่ต้องการเปลี่ยน — เว้นว่างไว้เพื่อไม่เปลี่ยนค่านั้น</p>
            <div className="space-y-1">
              <label className="text-xs font-medium">สถานะโปรเจกต์</label>
              <Select value={bulkProjectForm.status || '__none__'} onValueChange={v => setBulkProjectForm(f => ({ ...f, status: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="— ไม่เปลี่ยน —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่เปลี่ยน —</SelectItem>
                  {PROJECT_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">สถานะการชำระเงิน</label>
              <Select value={bulkProjectForm.payment_status || '__none__'} onValueChange={v => setBulkProjectForm(f => ({ ...f, payment_status: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="— ไม่เปลี่ยน —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่เปลี่ยน —</SelectItem>
                  {PAYMENT_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Budget Hours (ชม.)</label>
              <Input type="number" step="0.5" min="0" placeholder="เช่น 120" value={bulkProjectForm.budget_hours} onChange={e => setBulkProjectForm(f => ({ ...f, budget_hours: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Hourly Rate (บาท/ชม.)</label>
              <Input type="number" step="50" min="0" placeholder="เช่น 500" value={bulkProjectForm.hourly_rate} onChange={e => setBulkProjectForm(f => ({ ...f, hourly_rate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkProjectEdit(false)} disabled={savingBulkProject}>ยกเลิก</Button>
            <Button onClick={saveBulkProjectEdit} disabled={savingBulkProject}>{savingBulkProject && <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />}บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Task Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={showBulkTaskEdit} onOpenChange={setShowBulkTaskEdit}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>แก้ไขงานที่เลือก ({selectedIds.size} รายการ)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">กรอกเฉพาะค่าที่ต้องการเปลี่ยน — เว้นว่างไว้เพื่อไม่เปลี่ยนค่านั้น</p>
            <div className="space-y-1">
              <label className="text-xs font-medium">สถานะ</label>
              <Select value={bulkTaskForm.status || '__none__'} onValueChange={v => setBulkTaskForm(f => ({ ...f, status: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="— ไม่เปลี่ยน —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่เปลี่ยน —</SelectItem>
                  {TASK_STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">ลำดับความสำคัญ</label>
              <Select value={bulkTaskForm.priority || '__none__'} onValueChange={v => setBulkTaskForm(f => ({ ...f, priority: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="— ไม่เปลี่ยน —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่เปลี่ยน —</SelectItem>
                  {TASK_PRIORITY_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">ผู้รับผิดชอบ</label>
              <Input type="text" placeholder="ชื่อผู้รับผิดชอบ" value={bulkTaskForm.assignee} onChange={e => setBulkTaskForm(f => ({ ...f, assignee: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTaskEdit(false)} disabled={savingBulkTask}>ยกเลิก</Button>
            <Button onClick={saveBulkTaskEdit} disabled={savingBulkTask}>{savingBulkTask && <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />}บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
