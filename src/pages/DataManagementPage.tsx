import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO, startOfYear, endOfYear } from 'date-fns';
import { th } from 'date-fns/locale';
import PageShell from '@/components/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Building2, TrendingUp, FileText, FolderKanban, CheckCircle2, Clock,
  Search, Trash2, Pencil, Loader2, ChevronDown, ChevronRight, RefreshCw,
  ChevronLeft, Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  useCompanies, useCustomers, useDeleteCompany, useDeleteCustomer,
  useOpportunities, useDeleteOpportunity, useUpdateOpportunity,
  useQuotations, useDeleteQuotation, useUpdateQuotation,
  useProjectsWithCompanyCustomer, useDeleteProject, useUpdateProject,
  useAllTasks, useDeleteTask, useUpdateTask, useTaskChildren,
} from '@/hooks/useProjectData';
import { getStatusLabel, getStatusColor, getPriorityLabel, getProjectStatusColor } from '@/lib/projectUtils';
import EditProjectDialog from '@/components/EditProjectDialog';
import TaskDetailSheet from '@/components/TaskDetailSheet';

// ── Pager ─────────────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100];

function usePager<T>(items: T[], resetKey: unknown) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const serialized = JSON.stringify(resetKey);
  const [prevKey, setPrevKey] = useState(serialized);
  if (serialized !== prevKey) { setPrevKey(serialized); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { paged, page: safePage, setPage, pageSize, setPageSize, totalPages, total: items.length };
}

function Pager({ page, setPage, totalPages, total, pageSize, setPageSize, colSpan }: {
  page: number; setPage: (p: number) => void;
  totalPages: number; total: number;
  pageSize: number; setPageSize: (s: number) => void;
  colSpan: number;
}) {
  if (total === 0) return null;
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-2 border-t">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>ทั้งหมด {total.toLocaleString('th-TH')} รายการ</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s} แถว</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-1">{page} / {totalPages}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── BulkBar ───────────────────────────────────────────────────────────────────

type BulkField = { label: string; key: string; options: { value: string; label: string }[] };

function BulkBar({ count, onDelete, isDeleting, fields, onBulkEdit, isBulkEditing }: {
  count: number; onDelete: () => void; isDeleting: boolean;
  fields?: BulkField[]; onBulkEdit?: (vals: Record<string, string>) => Promise<void>; isBulkEditing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});

  if (count === 0) return null;

  const handleEdit = async () => {
    if (!onBulkEdit) return;
    const payload = Object.fromEntries(Object.entries(vals).filter(([, v]) => v && v !== '__skip__'));
    if (Object.keys(payload).length === 0) return;
    await onBulkEdit(payload);
    setOpen(false);
    setVals({});
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm flex-wrap">
        <span className="font-medium text-primary">{count} รายการที่เลือก</span>
        {fields && onBulkEdit && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs border-primary/30" onClick={() => { setVals({}); setOpen(true); }} disabled={isBulkEditing}>
            <Pencil className="h-3 w-3" />แก้ไขที่เลือก
          </Button>
        )}
        <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-xs" onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          ลบที่เลือก
        </Button>
      </div>

      {fields && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>แก้ไข {count} รายการพร้อมกัน</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground -mt-2">เลือกเฉพาะฟิลด์ที่ต้องการเปลี่ยน ฟิลด์ที่ไม่ได้เลือกจะไม่ถูกแก้ไข</p>
            <div className="space-y-3 py-1">
              {fields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Select value={vals[f.key] ?? '__skip__'} onValueChange={v => setVals(prev => ({ ...prev, [f.key]: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="— ไม่เปลี่ยน —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">— ไม่เปลี่ยน —</SelectItem>
                      {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button
                onClick={handleEdit}
                disabled={isBulkEditing || Object.values(vals).every(v => !v || v === '__skip__')}
              >
                {isBulkEditing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                บันทึกการเปลี่ยนแปลง
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

const OPP_STAGES: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', won: 'ชนะ', lost: 'แพ้',
};
const QUO_STATUSES: Record<string, string> = {
  draft: 'ร่าง', sent: 'ส่งแล้ว', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ', expired: 'หมดอายุ',
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(parseISO(d), 'd MMM yy', { locale: th }); } catch { return d; }
}
function fmtCurrency(v: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(v ?? 0);
}

// ── date filter ───────────────────────────────────────────────────────────────

function DateFilter({ startDate, endDate, onStartChange, onEndChange, onReset }: {
  startDate: string; endDate: string;
  onStartChange: (v: string) => void; onEndChange: (v: string) => void; onReset: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const handleYear = (y: string) => {
    setYearFilter(y);
    if (y === '__all__') { onStartChange(''); onEndChange(''); }
    else {
      const yr = parseInt(y);
      onStartChange(format(startOfYear(new Date(yr, 0, 1)), 'yyyy-MM-dd'));
      onEndChange(format(endOfYear(new Date(yr, 0, 1)), 'yyyy-MM-dd'));
    }
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={yearFilter} onValueChange={handleYear}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกปี</SelectItem>
          {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="date" value={startDate} onChange={e => onStartChange(e.target.value)} className="w-36 h-8 text-xs" />
      <span className="text-muted-foreground text-xs">—</span>
      <Input type="date" value={endDate} onChange={e => onEndChange(e.target.value)} className="w-36 h-8 text-xs" />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReset}><RefreshCw className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

// ── Subtask child rows ────────────────────────────────────────────────────────

function SubtaskRows({ parentId, onEdit, onDelete }: { parentId: string; onEdit: (t: any) => void; onDelete: (t: any) => void }) {
  const { data: children = [], isLoading } = useTaskChildren(parentId);
  if (isLoading) return <TableRow><TableCell colSpan={8} className="pl-12 py-1 text-xs text-muted-foreground">โหลด...</TableCell></TableRow>;
  if (!children.length) return <TableRow><TableCell colSpan={8} className="pl-12 py-1 text-xs text-muted-foreground italic">ไม่มีงานย่อย</TableCell></TableRow>;
  return (
    <>
      {children.map((sub: any) => (
        <TableRow key={sub.id} className="bg-muted/10 group">
          <TableCell className="py-1.5 w-8" />
          <TableCell className="pl-10 py-1.5 text-xs">
            <span className="text-muted-foreground/50 mr-1">↳</span>{sub.title}
          </TableCell>
          <TableCell className="py-1.5 text-xs text-muted-foreground">{sub.project_name || '—'}</TableCell>
          <TableCell className="py-1.5 text-xs">{sub.user_display_name || '—'}</TableCell>
          <TableCell className="py-1.5"><span className={`text-[11px] rounded-full px-2 py-0.5 ${getStatusColor(sub.status)}`}>{getStatusLabel(sub.status)}</span></TableCell>
          <TableCell className="py-1.5 text-xs text-muted-foreground">{fmtDate(sub.end_date)}</TableCell>
          <TableCell className="py-1.5 text-xs text-muted-foreground tabular-nums">
            {(sub.actual_hours > 0 || sub.estimated_hours > 0) ? `${Number(sub.actual_hours||0).toFixed(1)} / ${Number(sub.estimated_hours||0).toFixed(1)}` : '—'}
          </TableCell>
          <TableCell className="py-1.5">
            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(sub)}><Pencil className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(sub)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ── useSelection ──────────────────────────────────────────────────────────────

function useSelection<T extends { id?: string; opportunity_id?: string; project_id?: string }>(items: T[], getId: (item: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allIds = useMemo(() => items.map(getId), [items]);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = !allSelected && allIds.some(id => selected.has(id));
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const clear = () => setSelected(new Set());
  return { selected, toggle, toggleAll, clear, allSelected, someSelected, count: selected.size };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DataManagementPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'companies');
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const resetDates = () => {
    setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  };
  const inRange = (d: string | null | undefined) => {
    if (!d) return false;
    const s = d.substring(0, 10);
    if (startDate && s < startDate) return false;
    if (endDate   && s > endDate)   return false;
    return true;
  };

  // ── search states ──
  const [companySearch,  setCompanySearch]  = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [oppSearch,      setOppSearch]      = useState('');
  const [quoteSearch,    setQuoteSearch]    = useState('');
  const [projSearch,     setProjSearch]     = useState('');
  const [taskSearch,     setTaskSearch]     = useState('');
  const [subtaskSearch,  setSubtaskSearch]  = useState('');

  // ── expanded task rows ──
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── data hooks (lazy by activeTab) ──
  const { data: companies = [], isLoading: loadCo } = useCompanies(false, activeTab === 'companies');
  const { data: customers = [], isLoading: loadCust } = useCustomers(undefined, false, activeTab === 'customers');
  const { data: opps = [],      isLoading: loadOpp } = useOpportunities(undefined, activeTab === 'sales');
  const { data: quotes = [],    isLoading: loadQ }   = useQuotations(undefined, activeTab === 'quotations');
  const { data: projects = [],  isLoading: loadP }   = useProjectsWithCompanyCustomer(activeTab === 'projects' || activeTab === 'tasks' || activeTab === 'subtasks');
  const { data: tasksRaw = { data: [] }, isLoading: loadT } = useAllTasks(
    { per_page: 5000, year_from: startDate, year_to: endDate }, activeTab === 'tasks'
  );
  const { data: subRaw = { data: [] }, isLoading: loadSub } = useAllTasks(
    { subtask_only: true, per_page: 5000, year_from: startDate, year_to: endDate }, activeTab === 'subtasks'
  );

  const tasks    = (tasksRaw as any).data ?? [];
  const subtasks = (subRaw as any).data ?? [];

  // ── mutations ──
  const delCo   = useDeleteCompany();
  const delCust = useDeleteCustomer();
  const delOpp  = useDeleteOpportunity();
  const updOpp  = useUpdateOpportunity();
  const delQ    = useDeleteQuotation();
  const updQ    = useUpdateQuotation();
  const delProj = useDeleteProject();
  const updProj = useUpdateProject();
  const delTask = useDeleteTask();
  const updTask = useUpdateTask();

  const [bulkEditing, setBulkEditing] = useState(false);

  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p: any) => m.set(p.project_id, p.project_name));
    return m;
  }, [projects]);

  // ── filtered lists ──
  const filtCo  = useMemo(() => { const t = companySearch.toLowerCase();  return companies.filter((c: any) => !t || (c.name||'').toLowerCase().includes(t) || (c.email||'').toLowerCase().includes(t)); }, [companies, companySearch]);
  const filtCust = useMemo(() => { const t = customerSearch.toLowerCase(); return customers.filter((c: any) => !t || (c.first_name||'').toLowerCase().includes(t) || (c.last_name||'').toLowerCase().includes(t) || (c.email||'').toLowerCase().includes(t)); }, [customers, customerSearch]);
  const filtOpp  = useMemo(() => { const t = oppSearch.toLowerCase();      return opps.filter((o: any) => (!t || (o.opportunity_name||'').toLowerCase().includes(t) || (o.company_name||'').toLowerCase().includes(t)) && inRange(o.expected_close_date)); }, [opps, oppSearch, startDate, endDate]);
  const filtQ    = useMemo(() => { const t = quoteSearch.toLowerCase();    return quotes.filter((q: any) => (!t || (q.quotation_number||'').toLowerCase().includes(t) || (q.company_name||'').toLowerCase().includes(t)) && inRange(q.created_at)); }, [quotes, quoteSearch, startDate, endDate]);
  const filtP    = useMemo(() => { const t = projSearch.toLowerCase();     return projects.filter((p: any) => (!t || (p.project_name||'').toLowerCase().includes(t) || (p.company_name||'').toLowerCase().includes(t))); }, [projects, projSearch]);
  const filtT    = useMemo(() => { const t = taskSearch.toLowerCase();     return tasks.filter((tk: any) => !t || (tk.title||'').toLowerCase().includes(t) || (tk.user_display_name||'').toLowerCase().includes(t)); }, [tasks, taskSearch]);
  const filtSub  = useMemo(() => { const t = subtaskSearch.toLowerCase();  return subtasks.filter((s: any) => !t || (s.title||'').toLowerCase().includes(t) || (s.user_display_name||'').toLowerCase().includes(t)); }, [subtasks, subtaskSearch]);

  // ── Pagers ──
  const coPager  = usePager(filtCo,   [companySearch]);
  const custPager = usePager(filtCust, [customerSearch]);
  const oppPager = usePager(filtOpp,  [oppSearch, startDate, endDate]);
  const qPager   = usePager(filtQ,    [quoteSearch, startDate, endDate]);
  const pPager   = usePager(filtP,    [projSearch]);
  const tPager   = usePager(filtT,    [taskSearch, startDate, endDate]);
  const subPager = usePager(filtSub,  [subtaskSearch, startDate, endDate]);

  // ── Selections (per tab, based on paged items) ──
  const coSel   = useSelection(coPager.paged,  (c: any) => c.id);
  const custSel = useSelection(custPager.paged, (c: any) => c.id);
  const oppSel  = useSelection(oppPager.paged,  (o: any) => o.opportunity_id);
  const qSel    = useSelection(qPager.paged,    (q: any) => q.id);
  const pSel    = useSelection(pPager.paged,    (p: any) => p.project_id);
  const tSel    = useSelection(tPager.paged,    (t: any) => t.id);
  const subSel  = useSelection(subPager.paged,  (s: any) => s.id);

  // ── bulk delete state ──
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── single delete helper ──
  async function del(label: string, fn: () => Promise<any>) {
    const ok = await confirm({ title: `ลบ${label}`, description: `ต้องการลบรายการนี้?`, variant: 'destructive' });
    if (!ok) return;
    try { await fn(); toast({ title: `ลบ${label}สำเร็จ` }); }
    catch (e: any) { toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }); }
  }

  // ── bulk delete helper ──
  async function bulkDel(label: string, ids: string[], delFn: (id: string) => Promise<any>, clearFn: () => void) {
    const ok = await confirm({ title: `ลบ ${ids.length} ${label}`, description: `ต้องการลบ ${ids.length} รายการที่เลือก?`, variant: 'destructive' });
    if (!ok) return;
    setBulkDeleting(true);
    let failed = 0;
    await Promise.allSettled(ids.map(id => delFn(id).catch(() => { failed++; })));
    setBulkDeleting(false);
    clearFn();
    toast({ title: failed === 0 ? `ลบ ${ids.length} รายการสำเร็จ` : `ลบสำเร็จ ${ids.length - failed} รายการ, ล้มเหลว ${failed} รายการ`, variant: failed > 0 ? 'destructive' : 'default' });
  }

  // ── bulk edit helper ──
  async function bulkEdit(label: string, ids: string[], updFn: (id: string, vals: Record<string, string>) => Promise<any>, vals: Record<string, string>, clearFn: () => void) {
    setBulkEditing(true);
    let failed = 0;
    await Promise.allSettled(ids.map(id => updFn(id, vals).catch(() => { failed++; })));
    setBulkEditing(false);
    clearFn();
    toast({ title: failed === 0 ? `อัปเดต ${ids.length} ${label}สำเร็จ` : `อัปเดตสำเร็จ ${ids.length - failed} รายการ, ล้มเหลว ${failed} รายการ`, variant: failed > 0 ? 'destructive' : 'default' });
  }

  // ── bulk edit field definitions ──
  const OPP_STAGE_OPTIONS  = Object.entries(OPP_STAGES).map(([v, l]) => ({ value: v, label: l }));
  const QUO_STATUS_OPTIONS = Object.entries(QUO_STATUSES).map(([v, l]) => ({ value: v, label: l }));
  const PROJ_STATUS_OPTIONS = [
    { value: 'active', label: 'กำลังดำเนินการ' }, { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'on_hold', label: 'พักไว้' }, { value: 'cancelled', label: 'ยกเลิก' },
  ];
  const TASK_STATUS_OPTIONS = [
    { value: 'pending', label: 'รอดำเนินการ' }, { value: 'in_progress', label: 'กำลังดำเนินการ' },
    { value: 'review', label: 'รอตรวจสอบ' }, { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' },
  ];
  const PRIORITY_OPTIONS = [
    { value: 'low', label: 'ต่ำ' }, { value: 'medium', label: 'ปานกลาง' }, { value: 'high', label: 'สูง' },
  ];

  // ── edit company dialog ──
  const [editCo, setEditCo] = useState<any>(null);
  const [ecName, setEcName] = useState(''); const [ecEmail, setEcEmail] = useState(''); const [ecPhone, setEcPhone] = useState('');
  const [ecSaving, setEcSaving] = useState(false);
  const openEditCo = (c: any) => { setEditCo(c); setEcName(c.name||''); setEcEmail(c.email||''); setEcPhone(c.phone||''); };
  const saveCompany = async () => {
    setEcSaving(true);
    try {
      await apiFetch(`/companies.php/${editCo.id}`, { method: 'PUT', body: JSON.stringify({ name: ecName, email: ecEmail, phone: ecPhone }) });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'บันทึกสำเร็จ' }); setEditCo(null);
    } catch (e: any) { toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }); }
    finally { setEcSaving(false); }
  };

  // ── edit customer dialog ──
  const [editCust, setEditCust] = useState<any>(null);
  const [ecuFirst, setEcuFirst] = useState(''); const [ecuLast, setEcuLast] = useState('');
  const [ecuEmail, setEcuEmail] = useState(''); const [ecuPos, setEcuPos] = useState('');
  const [ecuSaving, setEcuSaving] = useState(false);
  const openEditCust = (c: any) => { setEditCust(c); setEcuFirst(c.first_name||''); setEcuLast(c.last_name||''); setEcuEmail(c.email||''); setEcuPos(c.position||''); };
  const saveCustomer = async () => {
    setEcuSaving(true);
    try {
      await apiFetch(`/customers.php/${editCust.id}`, { method: 'PUT', body: JSON.stringify({ first_name: ecuFirst, last_name: ecuLast, email: ecuEmail, position: ecuPos }) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'บันทึกสำเร็จ' }); setEditCust(null);
    } catch (e: any) { toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }); }
    finally { setEcuSaving(false); }
  };

  // ── edit opp dialog ──
  const [editOpp, setEditOpp] = useState<any>(null);
  const [eoStage, setEoStage] = useState('lead'); const [eoValue, setEoValue] = useState(''); const [eoClose, setEoClose] = useState('');
  const openEditOpp = (o: any) => { setEditOpp(o); setEoStage(o.stage); setEoValue(String(o.value ?? '')); setEoClose(o.expected_close_date || ''); };
  const saveOpp = async () => {
    try {
      await updOpp.mutateAsync({ id: editOpp.opportunity_id, updates: { stage: eoStage, value: parseFloat(eoValue) || 0, expected_close_date: eoClose || null } });
      toast({ title: 'บันทึกสำเร็จ' }); setEditOpp(null);
    } catch (e: any) { toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }); }
  };

  // ── edit quote dialog ──
  const [editQ, setEditQ] = useState<any>(null);
  const [eqStatus, setEqStatus] = useState('draft');
  const openEditQ = (q: any) => { setEditQ(q); setEqStatus(q.status); };
  const saveQ = async () => {
    try {
      await updQ.mutateAsync({ id: editQ.id, updates: { status: eqStatus } });
      toast({ title: 'บันทึกสำเร็จ' }); setEditQ(null);
    } catch (e: any) { toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }); }
  };

  // ── edit project dialog ──
  const [editProj, setEditProj] = useState<any>(null);
  const [isEditProjOpen, setIsEditProjOpen] = useState(false);
  const openEditProj = (p: any) => { setEditProj(p); setIsEditProjOpen(true); };

  // ── task sheet ──
  const [taskSheet, setTaskSheet] = useState<any>(null);

  const DATE_TABS = ['sales', 'quotations', 'tasks', 'subtasks'];

  return (
    <PageShell
      breadcrumbs={[{ label: 'การจัดการระบบ' }, { label: 'ปรับปรุงข้อมูล', isCurrent: true }]}
      title="ปรับปรุงข้อมูล"
      description="จัดการและแก้ไขข้อมูล transaction ทั้งหมดในระบบ"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

        {/* Tab bar */}
        <TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-7">
          <TabsTrigger value="companies"  className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Building2 className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">บริษัท</span></TabsTrigger>
          <TabsTrigger value="customers"  className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Users className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ลูกค้า</span></TabsTrigger>
          <TabsTrigger value="sales"      className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><TrendingUp className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ไปป์ไลน์การขาย</span></TabsTrigger>
          <TabsTrigger value="quotations" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><FileText className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">ใบเสนอราคา</span></TabsTrigger>
          <TabsTrigger value="projects"   className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><FolderKanban className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">โครงการ</span></TabsTrigger>
          <TabsTrigger value="tasks"      className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><CheckCircle2 className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">งานหลัก</span></TabsTrigger>
          <TabsTrigger value="subtasks"   className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"><Clock className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">งานย่อย</span></TabsTrigger>
        </TabsList>

        {DATE_TABS.includes(activeTab) && (
          <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onReset={resetDates} />
        )}

        {/* ── บริษัท ──────────────────────────────────────────────────── */}
        <TabsContent value="companies">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm flex-1">บริษัท ({filtCo.length})</CardTitle>
              <BulkBar count={coSel.count} onDelete={() => bulkDel('บริษัท', [...coSel.selected], id => delCo.mutateAsync(id), coSel.clear)} isDeleting={bulkDeleting} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={companySearch} onChange={e => setCompanySearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              {loadCo ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><Checkbox checked={coSel.allSelected} onCheckedChange={coSel.toggleAll} aria-label="เลือกทั้งหมด" /></TableHead>
                        <TableHead>ชื่อบริษัท</TableHead>
                        <TableHead>อีเมล</TableHead>
                        <TableHead>เบอร์โทร</TableHead>
                        <TableHead>สร้างเมื่อ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coPager.paged.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูล</TableCell></TableRow>
                      ) : coPager.paged.map((c: any) => (
                        <TableRow key={c.id} className="group" data-state={coSel.selected.has(c.id) ? 'selected' : undefined}>
                          <TableCell><Checkbox checked={coSel.selected.has(c.id)} onCheckedChange={() => coSel.toggle(c.id)} /></TableCell>
                          <TableCell className="font-medium text-sm">{c.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.email || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.phone || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditCo(c)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del('บริษัท', () => delCo.mutateAsync(c.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      <Pager {...coPager} colSpan={6} />
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ลูกค้า ──────────────────────────────────────────────────── */}
        <TabsContent value="customers">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm flex-1">ลูกค้า / ผู้ติดต่อ ({filtCust.length})</CardTitle>
              <BulkBar count={custSel.count} onDelete={() => bulkDel('ลูกค้า', [...custSel.selected], id => delCust.mutateAsync(id), custSel.clear)} isDeleting={bulkDeleting} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              {loadCust ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><Checkbox checked={custSel.allSelected} onCheckedChange={custSel.toggleAll} aria-label="เลือกทั้งหมด" /></TableHead>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead>อีเมล</TableHead>
                        <TableHead>บริษัท</TableHead>
                        <TableHead>ตำแหน่ง</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {custPager.paged.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูล</TableCell></TableRow>
                      ) : custPager.paged.map((c: any) => (
                        <TableRow key={c.id} className="group" data-state={custSel.selected.has(c.id) ? 'selected' : undefined}>
                          <TableCell><Checkbox checked={custSel.selected.has(c.id)} onCheckedChange={() => custSel.toggle(c.id)} /></TableCell>
                          <TableCell className="font-medium text-sm">{c.first_name} {c.last_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.email || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.company_name || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.position || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditCust(c)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del('ลูกค้า', () => delCust.mutateAsync(c.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      <Pager {...custPager} colSpan={6} />
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ไปป์ไลน์การขาย ──────────────────────────────────────────── */}
        <TabsContent value="sales">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm flex-1">โอกาสการขาย ({filtOpp.length})</CardTitle>
              <BulkBar count={oppSel.count} onDelete={() => bulkDel('โอกาสการขาย', [...oppSel.selected], id => delOpp.mutateAsync(id), oppSel.clear)} isDeleting={bulkDeleting}
                fields={[{ label: 'Stage', key: 'stage', options: OPP_STAGE_OPTIONS }]}
                onBulkEdit={vals => bulkEdit('โอกาสการขาย', [...oppSel.selected], (id, v) => updOpp.mutateAsync({ id, updates: v }), vals, oppSel.clear)}
                isBulkEditing={bulkEditing} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={oppSearch} onChange={e => setOppSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              {loadOpp ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><Checkbox checked={oppSel.allSelected} onCheckedChange={oppSel.toggleAll} aria-label="เลือกทั้งหมด" /></TableHead>
                        <TableHead>ชื่อโอกาส</TableHead>
                        <TableHead>บริษัท</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>มูลค่า</TableHead>
                        <TableHead>วันปิด</TableHead>
                        <TableHead>ผู้สร้าง</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oppPager.paged.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูล</TableCell></TableRow>
                      ) : oppPager.paged.map((o: any) => (
                        <TableRow key={o.opportunity_id} className="group" data-state={oppSel.selected.has(o.opportunity_id) ? 'selected' : undefined}>
                          <TableCell><Checkbox checked={oppSel.selected.has(o.opportunity_id)} onCheckedChange={() => oppSel.toggle(o.opportunity_id)} /></TableCell>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">{o.opportunity_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{o.company_name || '—'}</TableCell>
                          <TableCell><Badge variant={o.stage === 'won' ? 'default' : o.stage === 'lost' ? 'destructive' : 'outline'} className="text-xs">{OPP_STAGES[o.stage] ?? o.stage}</Badge></TableCell>
                          <TableCell className="text-xs tabular-nums">{fmtCurrency(o.value)} ฿</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(o.expected_close_date)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{o.assigned_user_name || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditOpp(o)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del('โอกาสการขาย', () => delOpp.mutateAsync(o.opportunity_id))}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      <Pager {...oppPager} colSpan={8} />
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ใบเสนอราคา ──────────────────────────────────────────────── */}
        <TabsContent value="quotations">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm flex-1">ใบเสนอราคา ({filtQ.length})</CardTitle>
              <BulkBar count={qSel.count} onDelete={() => bulkDel('ใบเสนอราคา', [...qSel.selected], id => delQ.mutateAsync(id), qSel.clear)} isDeleting={bulkDeleting}
                fields={[{ label: 'สถานะ', key: 'status', options: QUO_STATUS_OPTIONS }]}
                onBulkEdit={vals => bulkEdit('ใบเสนอราคา', [...qSel.selected], (id, v) => updQ.mutateAsync({ id, updates: v }), vals, qSel.clear)}
                isBulkEditing={bulkEditing} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={quoteSearch} onChange={e => setQuoteSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              {loadQ ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><Checkbox checked={qSel.allSelected} onCheckedChange={qSel.toggleAll} aria-label="เลือกทั้งหมด" /></TableHead>
                        <TableHead>เลขที่</TableHead>
                        <TableHead>บริษัท</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>ยอดรวม</TableHead>
                        <TableHead>สร้างเมื่อ</TableHead>
                        <TableHead>หมดอายุ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qPager.paged.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูล</TableCell></TableRow>
                      ) : qPager.paged.map((q: any) => (
                        <TableRow key={q.id} className="group" data-state={qSel.selected.has(q.id) ? 'selected' : undefined}>
                          <TableCell><Checkbox checked={qSel.selected.has(q.id)} onCheckedChange={() => qSel.toggle(q.id)} /></TableCell>
                          <TableCell className="font-mono text-xs">{q.quotation_number}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{q.company_name || '—'}</TableCell>
                          <TableCell><Badge variant={q.status === 'approved' ? 'default' : q.status === 'rejected' ? 'destructive' : 'outline'} className="text-xs">{QUO_STATUSES[q.status] ?? q.status}</Badge></TableCell>
                          <TableCell className="text-xs tabular-nums">{fmtCurrency(q.total_amount)} ฿</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(q.created_at)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(q.valid_until)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditQ(q)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del('ใบเสนอราคา', () => delQ.mutateAsync(q.id))}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      <Pager {...qPager} colSpan={8} />
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── โครงการ ──────────────────────────────────────────────────── */}
        <TabsContent value="projects">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm flex-1">โครงการ ({filtP.length})</CardTitle>
              <BulkBar count={pSel.count} onDelete={() => bulkDel('โครงการ', [...pSel.selected], id => delProj.mutateAsync(id), pSel.clear)} isDeleting={bulkDeleting}
                fields={[{ label: 'สถานะ', key: 'status', options: PROJ_STATUS_OPTIONS }]}
                onBulkEdit={vals => bulkEdit('โครงการ', [...pSel.selected], (id, v) => updProj.mutateAsync({ id, ...v }), vals, pSel.clear)}
                isBulkEditing={bulkEditing} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={projSearch} onChange={e => setProjSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              {loadP ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><Checkbox checked={pSel.allSelected} onCheckedChange={pSel.toggleAll} aria-label="เลือกทั้งหมด" /></TableHead>
                        <TableHead>ชื่อโครงการ</TableHead>
                        <TableHead>บริษัท</TableHead>
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>เริ่ม</TableHead>
                        <TableHead>สิ้นสุด</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pPager.paged.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูล</TableCell></TableRow>
                      ) : pPager.paged.map((p: any) => (
                        <TableRow key={p.project_id} className="group" data-state={pSel.selected.has(p.project_id) ? 'selected' : undefined}>
                          <TableCell><Checkbox checked={pSel.selected.has(p.project_id)} onCheckedChange={() => pSel.toggle(p.project_id)} /></TableCell>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.project_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.company_name || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.customer_name || '—'}</TableCell>
                          <TableCell><Badge className={`text-xs ${getProjectStatusColor(p.status)}`}>{getStatusLabel(p.status)}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(p.start_date)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(p.end_date)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditProj(p)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del('โครงการ', () => delProj.mutateAsync(p.project_id))}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      <Pager {...pPager} colSpan={8} />
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── งานหลัก ──────────────────────────────────────────────────── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm flex-1">งานหลัก ({filtT.length})</CardTitle>
              <BulkBar count={tSel.count} onDelete={() => bulkDel('งาน', [...tSel.selected], id => { const t = tasks.find((x: any) => x.id === id); return delTask.mutateAsync({ id, projectId: t?.project_id }); }, tSel.clear)} isDeleting={bulkDeleting}
                fields={[{ label: 'สถานะ', key: 'status', options: TASK_STATUS_OPTIONS }, { label: 'ความสำคัญ', key: 'priority', options: PRIORITY_OPTIONS }]}
                onBulkEdit={vals => bulkEdit('งาน', [...tSel.selected], (id, v) => { const t = tasks.find((x: any) => x.id === id); return updTask.mutateAsync({ id, project_id: t?.project_id, ...v }); }, vals, tSel.clear)}
                isBulkEditing={bulkEditing} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              {loadT ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><Checkbox checked={tSel.allSelected} onCheckedChange={tSel.toggleAll} aria-label="เลือกทั้งหมด" /></TableHead>
                        <TableHead>ชื่องาน</TableHead>
                        <TableHead>โครงการ</TableHead>
                        <TableHead>ผู้สร้าง</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>ความสำคัญ</TableHead>
                        <TableHead>กำหนดส่ง</TableHead>
                        <TableHead>ชม. จริง/ประมาณ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tPager.paged.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูล</TableCell></TableRow>
                      ) : tPager.paged.map((t: any) => {
                        const isExpanded = expanded.has(t.id);
                        const hasChild = (t.subtask_count ?? 0) > 0;
                        return [
                          <TableRow key={t.id} className="group" data-state={tSel.selected.has(t.id) ? 'selected' : undefined}>
                            <TableCell><Checkbox checked={tSel.selected.has(t.id)} onCheckedChange={() => tSel.toggle(t.id)} /></TableCell>
                            <TableCell className="text-sm font-medium max-w-[220px]">
                              <div className="flex items-center gap-1">
                                {hasChild ? (
                                  <button onClick={() => toggle(t.id)} className="text-muted-foreground hover:text-foreground p-0.5 shrink-0">
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </button>
                                ) : <span className="w-5 shrink-0" />}
                                <span className="truncate">{t.title}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{projectNameMap.get(t.project_id) || t.project_name || '—'}</TableCell>
                            <TableCell className="text-xs">{t.user_display_name || '—'}</TableCell>
                            <TableCell><span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${getStatusColor(t.status)}`}>{getStatusLabel(t.status)}</span></TableCell>
                            <TableCell>
                              <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${t.priority === 'high' ? 'bg-destructive/10 text-destructive' : t.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                                {getPriorityLabel(t.priority)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(t.end_date)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {(t.actual_hours > 0 || t.estimated_hours > 0) ? `${Number(t.actual_hours||0).toFixed(1)} / ${Number(t.estimated_hours||0).toFixed(1)}` : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTaskSheet(t)}><Pencil className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del('งาน', () => delTask.mutateAsync({ id: t.id, projectId: t.project_id }))}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>,
                          isExpanded && <SubtaskRows key={`c-${t.id}`} parentId={t.id}
                            onEdit={st => setTaskSheet(st)}
                            onDelete={st => del('งานย่อย', () => delTask.mutateAsync({ id: st.id, projectId: st.project_id }))} />,
                        ].filter(Boolean);
                      })}
                      <Pager {...tPager} colSpan={9} />
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── งานย่อย ──────────────────────────────────────────────────── */}
        <TabsContent value="subtasks">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm flex-1">งานย่อย ({filtSub.length})</CardTitle>
              <BulkBar count={subSel.count} onDelete={() => bulkDel('งานย่อย', [...subSel.selected], id => { const s = subtasks.find((x: any) => x.id === id); return delTask.mutateAsync({ id, projectId: s?.project_id }); }, subSel.clear)} isDeleting={bulkDeleting}
                fields={[{ label: 'สถานะ', key: 'status', options: TASK_STATUS_OPTIONS }, { label: 'ความสำคัญ', key: 'priority', options: PRIORITY_OPTIONS }]}
                onBulkEdit={vals => bulkEdit('งานย่อย', [...subSel.selected], (id, v) => { const s = subtasks.find((x: any) => x.id === id); return updTask.mutateAsync({ id, project_id: s?.project_id, ...v }); }, vals, subSel.clear)}
                isBulkEditing={bulkEditing} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ค้นหา..." value={subtaskSearch} onChange={e => setSubtaskSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent>
              {loadSub ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"><Checkbox checked={subSel.allSelected} onCheckedChange={subSel.toggleAll} aria-label="เลือกทั้งหมด" /></TableHead>
                        <TableHead>ชื่องานย่อย</TableHead>
                        <TableHead>โครงการ</TableHead>
                        <TableHead>ผู้สร้าง</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>กำหนดส่ง</TableHead>
                        <TableHead>ชม. จริง/ประมาณ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subPager.paged.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">ไม่พบข้อมูล</TableCell></TableRow>
                      ) : subPager.paged.map((s: any) => (
                        <TableRow key={s.id} className="group" data-state={subSel.selected.has(s.id) ? 'selected' : undefined}>
                          <TableCell><Checkbox checked={subSel.selected.has(s.id)} onCheckedChange={() => subSel.toggle(s.id)} /></TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate">{s.title}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.project_name || projectNameMap.get(s.project_id) || '—'}</TableCell>
                          <TableCell className="text-xs">{s.user_display_name || '—'}</TableCell>
                          <TableCell><span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${getStatusColor(s.status)}`}>{getStatusLabel(s.status)}</span></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(s.end_date)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {(s.actual_hours > 0 || s.estimated_hours > 0) ? `${Number(s.actual_hours||0).toFixed(1)} / ${Number(s.estimated_hours||0).toFixed(1)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTaskSheet(s)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del('งานย่อย', () => delTask.mutateAsync({ id: s.id, projectId: s.project_id }))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      <Pager {...subPager} colSpan={8} />
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Edit Project Dialog */}
      {editProj && (
        <EditProjectDialog
          project={editProj}
          open={isEditProjOpen}
          onOpenChange={open => { setIsEditProjOpen(open); if (!open) setEditProj(null); }}
        />
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={taskSheet}
        open={!!taskSheet}
        onOpenChange={open => { if (!open) setTaskSheet(null); }}
      />

      {/* Edit Company Dialog */}
      <Dialog open={!!editCo} onOpenChange={open => { if (!open) setEditCo(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>แก้ไขบริษัท</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>ชื่อบริษัท <span className="text-destructive">*</span></Label><Input value={ecName} onChange={e => setEcName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>อีเมล</Label><Input type="email" value={ecEmail} onChange={e => setEcEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>เบอร์โทร</Label><Input value={ecPhone} onChange={e => setEcPhone(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCo(null)}>ยกเลิก</Button>
            <Button onClick={saveCompany} disabled={ecSaving || !ecName.trim()}>{ecSaving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={!!editCust} onOpenChange={open => { if (!open) setEditCust(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>แก้ไขลูกค้า</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>ชื่อ</Label><Input value={ecuFirst} onChange={e => setEcuFirst(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>นามสกุล</Label><Input value={ecuLast} onChange={e => setEcuLast(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>อีเมล</Label><Input type="email" value={ecuEmail} onChange={e => setEcuEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>ตำแหน่ง</Label><Input value={ecuPos} onChange={e => setEcuPos(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCust(null)}>ยกเลิก</Button>
            <Button onClick={saveCustomer} disabled={ecuSaving}>{ecuSaving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Opportunity Dialog */}
      <Dialog open={!!editOpp} onOpenChange={open => { if (!open) setEditOpp(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>แก้ไขโอกาสการขาย</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Stage</Label>
              <Select value={eoStage} onValueChange={setEoStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(OPP_STAGES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>มูลค่า (฿)</Label><Input type="number" value={eoValue} onChange={e => setEoValue(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>วันปิดที่คาดการณ์</Label><Input type="date" value={eoClose} onChange={e => setEoClose(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpp(null)}>ยกเลิก</Button>
            <Button onClick={saveOpp} disabled={updOpp.isPending}>{updOpp.isPending ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Quotation Dialog */}
      <Dialog open={!!editQ} onOpenChange={open => { if (!open) setEditQ(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>แก้ไขใบเสนอราคา</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>สถานะ</Label>
              <Select value={eqStatus} onValueChange={setEqStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(QUO_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQ(null)}>ยกเลิก</Button>
            <Button onClick={saveQ} disabled={updQ.isPending}>{updQ.isPending ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageShell>
  );
}
