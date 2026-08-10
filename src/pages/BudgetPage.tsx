import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DbBudgetItem, DbBudgetSummary } from '@/types/project';
import PageShell from '@/components/PageShell';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Plus, Loader2, TrendingUp, AlertTriangle,
  CheckCircle, Edit, Trash2, FolderKanban, BarChart3, Clock,
  ChevronUp, ChevronDown, X, Pencil, Check,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';
import { th } from 'date-fns/locale';

// ── Labels ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  labor: 'แรงงาน',
  material: 'วัสดุ',
  equipment: 'อุปกรณ์',
  travel: 'ค่าเดินทาง',
  software: 'ซอฟต์แวร์',
  general: 'ทั่วไป',
  other: 'อื่นๆ',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'แผน',
  committed: 'ผูกพัน',
  actual: 'จริง',
  cancelled: 'ยกเลิก',
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  committed: 'bg-yellow-100 text-yellow-700',
  actual: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#F97316', '#06B6D4',
];

const HEALTH_CONFIG = {
  healthy: { label: 'ปกติ', color: 'text-green-600', icon: CheckCircle, bg: 'bg-green-50 border-green-200' },
  warning: { label: 'ใกล้เกินงบ', color: 'text-yellow-600', icon: AlertTriangle, bg: 'bg-yellow-50 border-yellow-200' },
  over_budget: { label: 'เกินงบประมาณ', color: 'text-red-600', icon: AlertTriangle, bg: 'bg-red-50 border-red-200' },
};

// ── Helpers ───────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(n);

const fmtDate = (s?: string | null) => {
  if (!s) return '-';
  const d = parseISO(s);
  return isValid(d) ? format(d, 'd MMM yyyy', { locale: th }) : '-';
};

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

// ── Empty form ────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'general',
  status: 'planned',
  planned_cost: '',
  actual_cost: '',
  quantity: '1',
  unit_price: '',
  unit: 'รายการ',
  vendor: '',
  task_id: '',
  start_date: todayStr(),
  end_date: '',
};

type BudgetForm = typeof EMPTY_FORM;

// ── Multi-project summary types ──────────────────────────

interface ProjectBudgetSummary {
  project_id: string;
  project_name: string;
  project_budget: number;
  total_planned: number;
  total_actual: number;
  committed: number;
  spent: number;
  labor_cost: number;
  total_with_labor: number;
  remaining: number;
  remaining_percent: number;
  health: 'healthy' | 'warning' | 'over_budget';
}

interface MultiBudgetResponse {
  projects: ProjectBudgetSummary[];
  total: { budget: number; spent: number; remaining: number; count: number };
}

type SortKey = 'project_name' | 'project_budget' | 'total_actual' | 'remaining' | 'remaining_percent';
type SortDir = 'asc' | 'desc';

// ── Main Page ─────────────────────────────────────────────

export default function BudgetPage() {
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);

  // ── Multi-project summary ─────────────────────────────
  const { data: multiSummary, isLoading: multiLoading } = useQuery<MultiBudgetResponse>({
    queryKey: ['budget-multi-summary', yearFilter],
    queryFn: () => apiFetch(`/budget.php?multi-summary&year=${yearFilter}`),
  });

  const projectList = multiSummary?.projects ?? [];

  // ── Selected project for detail ───────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // ── Dialog state ──────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DbBudgetItem | null>(null);
  const [form, setForm] = useState<BudgetForm>({ ...EMPTY_FORM });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Inline cell editing ────────────────────────────────
  const [inlineCell, setInlineCell] = useState<{ id: string; field: 'planned_cost' | 'actual_cost'; value: string } | null>(null);

  const openInline = (item: DbBudgetItem, field: 'planned_cost' | 'actual_cost') => {
    setInlineCell({ id: item.id, field, value: String(item[field] ?? 0) });
  };

  const commitInline = () => {
    if (!inlineCell) return;
    const val = parseFloat(inlineCell.value);
    if (isNaN(val) || val < 0) { setInlineCell(null); return; }
    updateMutation.mutate({ id: inlineCell.id, body: { [inlineCell.field]: val } });
    setInlineCell(null);
  };

  // ── Inline edit project budget (detail section) ───────
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // ── Inline edit budget directly on grid card ───────────
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardBudgetInput, setCardBudgetInput] = useState('');

  const openCardEdit = (e: React.MouseEvent, p: ProjectBudgetSummary) => {
    e.stopPropagation();
    setEditingCardId(p.project_id);
    setCardBudgetInput(String(p.project_budget));
  };

  const saveCardBudget = (projectId: string) => {
    const val = parseFloat(cardBudgetInput);
    if (!isNaN(val) && val >= 0) {
      updateProjectBudgetMutation.mutate({ id: projectId, value: val });
    }
    setEditingCardId(null);
  };

  // ── Filter/search for detail ──────────────────────────
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detailTab, setDetailTab] = useState('items');

  // Reset filters + tab when switching projects
  useEffect(() => {
    setCategoryFilter('all');
    setStatusFilter('all');
    setSearch('');
    setDetailTab('items');
  }, [selectedProjectId]);

  // Clear selected project if not in current year's data
  useEffect(() => {
    if (selectedProjectId && projectList.length > 0 && !projectList.some(p => p.project_id === selectedProjectId)) {
      setSelectedProjectId('');
    }
  }, [projectList, selectedProjectId]);

  // ── Sort state for comparison table ───────────────────
  const [sortKey, setSortKey] = useState<SortKey>('remaining_percent');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Queries (single project, conditional) ─────────────
  const { data: summary, isLoading: summaryLoading } = useQuery<DbBudgetSummary>({
    queryKey: ['budget-summary', selectedProjectId],
    queryFn: () => apiFetch(`/budget.php?summary&project_id=${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });

  const { data: budgetItems = [], isLoading: itemsLoading } = useQuery<DbBudgetItem[]>({
    queryKey: ['budget-items', selectedProjectId],
    queryFn: () => apiFetch(`/budget.php?project_id=${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });

  const { data: timeTracking, isLoading: timeLoading } = useQuery<any>({
    queryKey: ['budget-time', selectedProjectId],
    queryFn: () => apiFetch(`/budget.php?time_tracking&project_id=${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });

  // ── Tasks for task selector ────────────────────────────
  const { data: breakdown } = useQuery<any>({
    queryKey: ['budget-breakdown', selectedProjectId],
    queryFn: () => apiFetch(`/budget.php?breakdown&project_id=${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });
  const taskOptions: { id: string; title: string }[] = breakdown?.labor_by_task ?? [];

  // ── Mutations ──────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['budget-summary', selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ['budget-items', selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ['budget-multi-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch('/budget.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast.success('เพิ่มรายการงบประมาณสำเร็จ'); closeDialog(); },
    onError: (e: any) => toast.error(e.message || 'ไม่สามารถเพิ่มรายการได้'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch(`/budget.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast.success('บันทึกการแก้ไขสำเร็จ'); closeDialog(); },
    onError: (e: any) => toast.error(e.message || 'ไม่สามารถแก้ไขได้'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/budget.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success('ลบรายการสำเร็จ'); setDeleteId(null); },
    onError: (e: any) => toast.error(e.message || 'ไม่สามารถลบได้'),
  });

  const updateProjectBudgetMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) =>
      apiFetch(`/projects.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ project_value: value }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-multi-summary'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', selectedProjectId] });
      toast.success('บันทึกงบประมาณโปรเจกต์แล้ว');
      setEditingBudget(false);
    },
    onError: (e: any) => toast.error(e.message || 'ไม่สามารถแก้ไขงบได้'),
  });

  // ── Dialog helpers ─────────────────────────────────────
  const openCreateDialog = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEditDialog = (item: DbBudgetItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      category: item.category,
      status: item.status,
      planned_cost: String(item.planned_cost ?? ''),
      actual_cost: String(item.actual_cost ?? ''),
      quantity: String(item.quantity ?? '1'),
      unit_price: String(item.unit_price ?? ''),
      unit: item.unit || 'รายการ',
      vendor: item.vendor || '',
      task_id: item.task_id || '',
      start_date: item.start_date || todayStr(),
      end_date: item.end_date || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('กรุณากรอกชื่อรายการ'); return; }
    if (!selectedProjectId) { toast.error('กรุณาเลือกโปรเจกต์'); return; }
    const body = {
      project_id: selectedProjectId,
      name: form.name.trim(),
      description: form.description,
      category: form.category,
      status: form.status,
      planned_cost: parseFloat(form.planned_cost) || 0,
      actual_cost: parseFloat(form.actual_cost) || 0,
      quantity: parseFloat(form.quantity) || 1,
      unit_price: parseFloat(form.unit_price) || 0,
      unit: form.unit,
      vendor: form.vendor,
      task_id: form.task_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const setField = (k: keyof BudgetForm, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // ── Filtered items ─────────────────────────────────────
  const filteredItems = useMemo(() => {
    return budgetItems.filter(item => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !(item.vendor ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [budgetItems, categoryFilter, statusFilter, search]);

  // ── Chart data ─────────────────────────────────────────
  const categoryChartData = useMemo(() => {
    if (!summary?.by_category?.length) return [];
    return summary.by_category.map((c: any) => ({
      name: CATEGORY_LABELS[c.category] ?? c.category,
      แผน: c.planned,
      จริง: c.actual,
    }));
  }, [summary]);

  const pieData = useMemo(() => {
    if (!summary?.by_category?.length) return [];
    return summary.by_category
      .filter((c: any) => c.actual > 0)
      .map((c: any) => ({
        name: CATEGORY_LABELS[c.category] ?? c.category,
        value: c.actual,
      }));
  }, [summary]);

  // ── Selected project info ──────────────────────────────
  const selectedProject = projectList.find(p => p.project_id === selectedProjectId);

  // ── Sorted projects for table ──────────────────────────
  const sortedProjects = useMemo(() => {
    const list = [...projectList];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === 'project_name') return a.project_name.localeCompare(b.project_name, 'th') * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return list;
  }, [projectList, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  // ── Detail section: health ─────────────────────────────
  const usedPercent = summary
    ? summary.project_budget > 0 ? Math.min(100, Math.round((summary.total_actual / summary.project_budget) * 100)) : 0
    : 0;
  const health = summary?.health ?? 'healthy';
  const healthCfg = HEALTH_CONFIG[health as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.healthy;

  const isDetailLoading = summaryLoading || itemsLoading;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Year range for selector ────────────────────────────
  const yearRange = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Render ─────────────────────────────────────────────
  const total = multiSummary?.total;

  return (
    <PageShell
      breadcrumbs={[{ label: 'งบประมาณ', isCurrent: true }]}
      title="งบประมาณ"
      description="ภาพรวมงบประมาณทุกโปรเจกต์"
      actions={
        <Select value={String(yearFilter)} onValueChange={v => setYearFilter(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearRange.map(y => (
              <SelectItem key={y} value={String(y)}>ปี {y + 543}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* ═══════════════════ Grand Total Bar ═══════════════════ */}
      {total && total.count > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">โปรเจกต์ทั้งหมด</p>
              <p className="text-xl font-bold">{total.count} โปรเจกต์</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">งบรวมทั้งหมด</p>
              <p className="text-xl font-bold">{fmt(total.budget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">ใช้ไปแล้ว</p>
              <p className="text-xl font-bold text-blue-600">{fmt(total.spent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">คงเหลือทั้งหมด</p>
              <p className={`text-xl font-bold ${total.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(total.remaining)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════ Loading ═══════════════════ */}
      {multiLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ═══════════════════ Empty state ═══════════════════ */}
      {!multiLoading && projectList.length === 0 && (
        <Card className="py-20">
          <CardContent className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <FolderKanban className="w-12 h-12 opacity-30" />
            <p className="text-lg font-medium">ไม่มีโปรเจกต์ในปีนี้</p>
            <p className="text-sm">เลือกปีอื่น หรือสร้างโปรเจกต์ใหม่เพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ Project Cards Grid ═══════════════════ */}
      {!multiLoading && projectList.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">ภาพรวมแต่ละโปรเจกต์</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projectList.map(p => {
              const isSelected = selectedProjectId === p.project_id;
              const hc = HEALTH_CONFIG[p.health] ?? HEALTH_CONFIG.healthy;
              const pct = p.project_budget > 0
                ? Math.min(100, Math.round((p.total_actual / p.project_budget) * 100))
                : 0;
              return (
                <button
                  key={p.project_id}
                  type="button"
                  onClick={() => setSelectedProjectId(isSelected ? '' : p.project_id)}
                  className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                    isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md' : 'border-border hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm line-clamp-2 flex-1">{p.project_name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${hc.color} ${hc.bg} shrink-0`}>
                      <hc.icon className="w-3 h-3" />
                      {hc.label}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {/* งบประมาณ — inline editable */}
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-muted-foreground shrink-0">งบ</span>
                      {editingCardId === p.project_id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Input
                            autoFocus
                            type="number" min={0}
                            className="h-6 w-28 text-right text-xs px-1"
                            value={cardBudgetInput}
                            onChange={e => setCardBudgetInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveCardBudget(p.project_id);
                              if (e.key === 'Escape') setEditingCardId(null);
                            }}
                            onBlur={() => saveCardBudget(p.project_id)}
                          />
                        </div>
                      ) : (
                        <span
                          className="font-semibold flex items-center gap-1 cursor-pointer hover:text-primary group/budget"
                          onClick={e => openCardEdit(e, p)}
                          title="คลิกเพื่อแก้ไขงบประมาณ"
                        >
                          {fmt(p.project_budget)}
                          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/budget:opacity-50" />
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ใช้ไป</span>
                      <span className="font-semibold text-blue-600">{fmt(p.total_actual)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">คงเหลือ</span>
                      <span className={`font-semibold ${p.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {fmt(p.remaining)}
                      </span>
                    </div>
                    {p.project_budget > 0 && (
                      <div className="pt-1">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-0.5">{pct}%</p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════ Comparison Table ═══════════════════ */}
      {!multiLoading && projectList.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ตารางเปรียบเทียบ</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort('project_name')}>
                      ชื่อโปรเจกต์<SortIcon column="project_name" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('project_budget')}>
                      งบประมาณ<SortIcon column="project_budget" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('total_actual')}>
                      ใช้ไปแล้ว<SortIcon column="total_actual" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('remaining')}>
                      คงเหลือ<SortIcon column="remaining" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('remaining_percent')}>
                      %<SortIcon column="remaining_percent" />
                    </TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.map(p => {
                    const isSelected = selectedProjectId === p.project_id;
                    const hc = HEALTH_CONFIG[p.health] ?? HEALTH_CONFIG.healthy;
                    return (
                      <TableRow
                        key={p.project_id}
                        className={`cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedProjectId(isSelected ? '' : p.project_id)}
                      >
                        <TableCell className="font-medium">{p.project_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(p.project_budget)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-blue-600">{fmt(p.total_actual)}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${p.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {fmt(p.remaining)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{p.remaining_percent}%</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${hc.color}`}>
                            <hc.icon className="w-3 h-3" />{hc.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ Selected Project Detail ═══════════════════ */}
      {selectedProjectId && selectedProject && (
        <div className="space-y-4 mt-6 border-t pt-6">
          {/* Detail header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{selectedProject.project_name}</h2>
              <button
                onClick={() => setSelectedProjectId('')}
                className="text-muted-foreground hover:text-foreground"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Button onClick={openCreateDialog} className="gap-2" size="sm">
              <Plus className="w-4 h-4" />เพิ่มรายการ
            </Button>
          </div>

          {/* Detail loading */}
          {isDetailLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Detail content */}
          {!isDetailLoading && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">งบประมาณโปรเจกต์</p>
                    {editingBudget ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="number" min={0} className="h-8 text-sm"
                          value={budgetInput}
                          onChange={e => setBudgetInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') updateProjectBudgetMutation.mutate({ id: selectedProjectId, value: parseFloat(budgetInput) || 0 });
                            if (e.key === 'Escape') setEditingBudget(false);
                          }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600"
                          disabled={updateProjectBudgetMutation.isPending}
                          onClick={() => updateProjectBudgetMutation.mutate({ id: selectedProjectId, value: parseFloat(budgetInput) || 0 })}>
                          {updateProjectBudgetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingBudget(false)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-xl font-bold">{fmt(summary?.project_budget ?? 0)}</p>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => { setBudgetInput(String(summary?.project_budget ?? 0)); setEditingBudget(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">ใช้ไปแล้ว (จริง)</p>
                    <p className="text-xl font-bold mt-1 text-blue-600">{fmt(summary?.total_actual ?? 0)}</p>
                    {summary?.project_budget > 0 && (
                      <div className="mt-2 space-y-1">
                        <Progress value={usedPercent} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">{usedPercent}% ของงบ</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">คงเหลือ</p>
                    <p className={`text-xl font-bold mt-1 ${(summary?.remaining ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {fmt(summary?.remaining ?? 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className={`border ${healthCfg.bg}`}>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">สถานะงบประมาณ</p>
                    <div className={`flex items-center gap-2 mt-1 ${healthCfg.color}`}>
                      <healthCfg.icon className="w-5 h-5" />
                      <span className="text-lg font-bold">{healthCfg.label}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Extra row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">ต้นทุนแผน</p><p className="text-lg font-semibold">{fmt(summary?.total_planned ?? 0)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">ยอดผูกพัน</p><p className="text-lg font-semibold text-yellow-600">{fmt(summary?.committed ?? 0)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">ยอดจ่ายแล้ว</p><p className="text-lg font-semibold text-green-600">{fmt(summary?.spent ?? 0)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">ต้นทุนแรงงาน</p><p className="text-lg font-semibold text-purple-600">{fmt(summary?.labor_cost ?? 0)}</p></CardContent></Card>
              </div>

              {/* Tabs */}
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList>
                  <TabsTrigger value="items"><BarChart3 className="w-4 h-4 mr-1.5" />รายการงบประมาณ</TabsTrigger>
                  <TabsTrigger value="charts"><TrendingUp className="w-4 h-4 mr-1.5" />กราฟ</TabsTrigger>
                  <TabsTrigger value="time"><Clock className="w-4 h-4 mr-1.5" />แรงงาน / ชั่วโมง</TabsTrigger>
                </TabsList>

                {/* Budget Items Tab */}
                <TabsContent value="items" className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <Input placeholder="ค้นหาชื่อ / ผู้ขาย..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[180px]" />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[150px]"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกหมวด</SelectItem>
                        {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[130px]"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกสถานะ</SelectItem>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {(categoryFilter !== 'all' || statusFilter !== 'all' || search) && (
                      <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); setSearch(''); }}>ล้างตัวกรอง</Button>
                    )}
                  </div>

                  <Card>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ชื่อรายการ</TableHead>
                            <TableHead>หมวดหมู่</TableHead>
                            <TableHead>สถานะ</TableHead>
                            <TableHead className="text-right">ต้นทุนแผน</TableHead>
                            <TableHead className="text-right">ต้นทุนจริง</TableHead>
                            <TableHead className="text-right">ส่วนต่าง</TableHead>
                            <TableHead>ผู้ขาย</TableHead>
                            <TableHead>วันที่</TableHead>
                            <TableHead className="text-right">จัดการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                              {budgetItems.length === 0 ? 'ยังไม่มีรายการงบประมาณ — กด "เพิ่มรายการ" เพื่อเริ่มต้น' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
                            </TableCell></TableRow>
                          ) : (
                            filteredItems.map(item => {
                              const variance = (item.planned_cost ?? 0) - (item.actual_cost ?? 0);
                              const isEditingPlanned = inlineCell?.id === item.id && inlineCell.field === 'planned_cost';
                              const isEditingActual  = inlineCell?.id === item.id && inlineCell.field === 'actual_cost';
                              return (
                                <TableRow key={item.id}>
                                  <TableCell><div><p className="font-medium">{item.name}</p>{item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}{item.task_title && <p className="text-xs text-blue-600">งาน: {item.task_title}</p>}</div></TableCell>
                                  <TableCell><span className="text-sm">{CATEGORY_LABELS[item.category] ?? item.category}</span></TableCell>
                                  <TableCell><Badge className={STATUS_COLORS[item.status] ?? ''} variant="outline">{STATUS_LABELS[item.status] ?? item.status}</Badge></TableCell>

                                  {/* ต้นทุนแผน — inline editable */}
                                  <TableCell className="text-right">
                                    {isEditingPlanned ? (
                                      <Input autoFocus type="number" min={0} className="h-7 w-28 text-right text-sm ml-auto"
                                        value={inlineCell!.value}
                                        onChange={e => setInlineCell(c => c ? { ...c, value: e.target.value } : c)}
                                        onBlur={commitInline}
                                        onKeyDown={e => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') setInlineCell(null); }}
                                      />
                                    ) : (
                                      <span className="font-mono text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5 group relative"
                                        onClick={() => openInline(item, 'planned_cost')}
                                        title="คลิกเพื่อแก้ไข">
                                        {fmt(item.planned_cost ?? 0)}
                                        <Pencil className="h-2.5 w-2.5 inline ml-1 opacity-0 group-hover:opacity-40" />
                                      </span>
                                    )}
                                  </TableCell>

                                  {/* ต้นทุนจริง — inline editable */}
                                  <TableCell className="text-right">
                                    {isEditingActual ? (
                                      <Input autoFocus type="number" min={0} className="h-7 w-28 text-right text-sm ml-auto"
                                        value={inlineCell!.value}
                                        onChange={e => setInlineCell(c => c ? { ...c, value: e.target.value } : c)}
                                        onBlur={commitInline}
                                        onKeyDown={e => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') setInlineCell(null); }}
                                      />
                                    ) : (
                                      <span className="font-mono text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5 group relative"
                                        onClick={() => openInline(item, 'actual_cost')}
                                        title="คลิกเพื่อแก้ไข">
                                        {fmt(item.actual_cost ?? 0)}
                                        <Pencil className="h-2.5 w-2.5 inline ml-1 opacity-0 group-hover:opacity-40" />
                                      </span>
                                    )}
                                  </TableCell>

                                  <TableCell className={`text-right font-mono text-sm ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{variance >= 0 ? '+' : ''}{fmt(variance)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{item.vendor || '-'}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{item.start_date ? fmtDate(item.start_date) : '-'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}><Edit className="w-4 h-4" /></Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteId(item.id)}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                  {filteredItems.length > 0 && (
                    <div className="flex justify-end gap-6 text-sm text-muted-foreground px-2">
                      <span>รวมแผน: <strong className="text-foreground">{fmt(filteredItems.reduce((s, i) => s + (i.planned_cost ?? 0), 0))}</strong></span>
                      <span>รวมจริง: <strong className="text-foreground">{fmt(filteredItems.reduce((s, i) => s + (i.actual_cost ?? 0), 0))}</strong></span>
                    </div>
                  )}
                </TabsContent>

                {/* Charts Tab */}
                <TabsContent value="charts" className="space-y-4">
                  {summary && summary.project_budget > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-base">ภาพรวมการใช้งบประมาณ</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">ใช้ไป {fmt(summary.total_actual)}</span><span className="font-medium">งบรวม {fmt(summary.project_budget)}</span></div>
                        <Progress value={usedPercent} className={`h-4 ${health === 'over_budget' ? '[&>div]:bg-red-500' : health === 'warning' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-emerald-500'}`} />
                        <div className="flex justify-between text-sm"><span className={healthCfg.color}>{usedPercent}% ใช้ไป</span><span className="text-muted-foreground">คงเหลือ {fmt(summary.remaining)}</span></div>
                      </CardContent>
                    </Card>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader><CardTitle className="text-base">แผน vs จริง แยกตามหมวดหมู่</CardTitle></CardHeader>
                      <CardContent>
                        {categoryChartData.length === 0 ? (
                          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">ไม่มีข้อมูล</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={categoryChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} tick={{ fontSize: 11 }} />
                              <ChartTooltip formatter={(v: number) => fmt(v)} />
                              <Legend />
                              <Bar dataKey="แผน" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="จริง" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">สัดส่วนต้นทุนจริงตามหมวดหมู่</CardTitle></CardHeader>
                      <CardContent>
                        {pieData.length === 0 ? (
                          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">ยังไม่มีต้นทุนจริง</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine>
                                {pieData.map((_, i) => (<Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />))}
                              </Pie>
                              <ChartTooltip formatter={(v: number) => fmt(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Time / Labor Tab */}
                <TabsContent value="time" className="space-y-4">
                  {timeLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
                  {!timeLoading && timeTracking && (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">ชั่วโมงประมาณ</p><p className="text-xl font-bold mt-1">{timeTracking.totals?.estimated_hours ?? 0} ชม.</p></CardContent></Card>
                        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">ชั่วโมงจริง</p><p className="text-xl font-bold mt-1 text-blue-600">{timeTracking.totals?.actual_hours ?? 0} ชม.</p></CardContent></Card>
                        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">ต้นทุนแรงงานประมาณ</p><p className="text-xl font-bold mt-1">{fmt(timeTracking.totals?.planned_cost ?? 0)}</p></CardContent></Card>
                        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">ต้นทุนแรงงานจริง</p><p className="text-xl font-bold mt-1 text-emerald-600">{fmt(timeTracking.totals?.actual_cost ?? 0)}</p></CardContent></Card>
                      </div>
                      <Card>
                        <CardHeader><CardTitle className="text-base">รายละเอียดแยกตามงาน</CardTitle></CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader><TableRow><TableHead>งาน</TableHead><TableHead>สถานะ</TableHead><TableHead className="text-right">ชม. ประมาณ</TableHead><TableHead className="text-right">ชม. จริง</TableHead><TableHead className="text-right">อัตรา/ชม.</TableHead><TableHead className="text-right">ต้นทุนประมาณ</TableHead><TableHead className="text-right">ต้นทุนจริง</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {(timeTracking.tasks ?? []).length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">ไม่มีข้อมูลชั่วโมงงาน</TableCell></TableRow>
                              ) : (
                                (timeTracking.tasks ?? []).map((t: any) => (
                                  <TableRow key={t.task_id}>
                                    <TableCell className="font-medium">{t.task_title}</TableCell>
                                    <TableCell><Badge variant="outline" className="text-xs">{t.task_status}</Badge></TableCell>
                                    <TableCell className="text-right">{t.estimated_hours ?? 0}</TableCell>
                                    <TableCell className="text-right">{t.actual_hours ?? 0}</TableCell>
                                    <TableCell className="text-right">{fmt(t.hourly_rate ?? 0)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{fmt(t.planned_cost ?? 0)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{fmt(t.actual_cost ?? 0)}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════ Add/Edit Dialog ═══════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="w-full sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'แก้ไขรายการงบประมาณ' : 'เพิ่มรายการงบประมาณ'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>ชื่อรายการ <span className="text-red-500">*</span></Label><Input placeholder="เช่น ค่าซอฟต์แวร์ Figma" value={form.name} onChange={e => setField('name', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>หมวดหมู่</Label><Select value={form.category} onValueChange={v => setField('category', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABELS).map(([v, l]) => (<SelectItem key={v} value={v}>{l}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>สถานะ</Label><Select value={form.status} onValueChange={v => setField('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([v, l]) => (<SelectItem key={v} value={v}>{l}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>ต้นทุนแผน (บาท)</Label><Input type="number" min={0} placeholder="0.00" value={form.planned_cost} onChange={e => setField('planned_cost', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>ต้นทุนจริง (บาท)</Label><Input type="number" min={0} placeholder="0.00" value={form.actual_cost} onChange={e => setField('actual_cost', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>จำนวน</Label><Input type="number" min={0} step="0.01" placeholder="1" value={form.quantity} onChange={e => setField('quantity', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>หน่วย</Label><Input placeholder="รายการ" value={form.unit} onChange={e => setField('unit', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>ราคาต่อหน่วย</Label><Input type="number" min={0} placeholder="0.00" value={form.unit_price} onChange={e => setField('unit_price', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>ผู้ขาย / ซัพพลายเออร์</Label><Input placeholder="ชื่อบริษัทหรือผู้ขาย" value={form.vendor} onChange={e => setField('vendor', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>วันที่เริ่ม</Label><Input type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} /></div>
              <div className="space-y-1.5"><Label>วันที่สิ้นสุด</Label><Input type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} /></div>
            </div>
            {taskOptions.length > 0 && (
              <div className="space-y-1.5"><Label>เชื่อมกับงาน</Label><Select value={form.task_id || '__none__'} onValueChange={v => setField('task_id', v === '__none__' ? '' : v)}><SelectTrigger><SelectValue placeholder="เลือกงาน..." /></SelectTrigger><SelectContent><SelectItem value="__none__">— ไม่เชื่อมกับงาน —</SelectItem>{taskOptions.map(t => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}</SelectContent></Select></div>
            )}
            <div className="space-y-1.5"><Label>รายละเอียด</Label><Textarea rows={3} placeholder="รายละเอียดเพิ่มเติม..." value={form.description} onChange={e => setField('description', e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog} disabled={isSaving}>ยกเลิก</Button><Button onClick={handleSubmit} disabled={isSaving}>{isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingItem ? 'บันทึก' : 'เพิ่มรายการ'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ Delete confirm ═══════════════════ */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle><AlertDialogDescription>คุณต้องการลบรายการงบประมาณนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถยกเลิกได้</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}ลบ</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
