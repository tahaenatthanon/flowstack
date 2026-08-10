import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { useProjects, useUsers } from '@/hooks/useProjectData';
import ProjectCombobox from '@/components/ProjectCombobox';
import type {
  TaskIntelligenceAssessment,
  TaskIntelligenceQuality,
  DuplicateTaskGroup,
  TaskIntelligenceOrphaned,
  ValidationRule,
  TaskIntelligenceMigratePreview,
  QualityTaskItem,
} from '@/types/project';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, Pencil, Search, Trash2, X, Wand2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import PageShell from '@/components/PageShell';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

// ── Data fetching hooks ──────────────────────────────────────────────────────
function useAssessment(filters: Record<string, string>) {
  const params = new URLSearchParams({ action: 'assessment', ...filters }).toString();
  return useQuery({
    queryKey: ['task-intelligence', 'assessment', filters],
    queryFn: () => apiFetch<TaskIntelligenceAssessment>(`/task-intelligence.php?${params}`),
  });
}

interface QualityParams {
  per_page: number;
  missing_page: number;
  anomaly_page: number;
  zombie_page: number;
  search: string;
}

function useQuality(params: QualityParams) {
  const qs = `action=quality&per_page=${params.per_page}&missing_page=${params.missing_page}&anomaly_page=${params.anomaly_page}&zombie_page=${params.zombie_page}${params.search ? `&search=${encodeURIComponent(params.search)}` : ''}`;
  return useQuery({
    queryKey: ['task-intelligence', 'quality', params.per_page, params.missing_page, params.anomaly_page, params.zombie_page, params.search],
    queryFn: () => apiFetch<TaskIntelligenceQuality>(`/task-intelligence.php?${qs}`),
  });
}

function useDuplicates() {
  return useQuery({
    queryKey: ['task-intelligence', 'duplicates'],
    queryFn: () => apiFetch<{ data: DuplicateTaskGroup[] }>('/task-intelligence.php?action=duplicates'),
  });
}

function useValidationRules() {
  return useQuery({
    queryKey: ['validation-rules'],
    queryFn: () => apiFetch<{ data: ValidationRule[] }>('/validation-rules.php'),
  });
}

function useStaleProjects(days: number) {
  return useQuery({
    queryKey: ['task-intelligence', 'stale_projects', days],
    queryFn: () => apiFetch<{ data: any[] }>(`/task-intelligence.php?action=stale_projects&days=${days}`),
  });
}

function useOrphaned(page: number, perPage: number, search: string) {
  const qs = `action=orphaned&page=${page}&per_page=${perPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  return useQuery({
    queryKey: ['task-intelligence', 'orphaned', page, perPage, search],
    queryFn: () => apiFetch<TaskIntelligenceOrphaned>(`/task-intelligence.php?${qs}`),
  });
}

function useAssignProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { task_ids: string[]; project_id: string }) =>
      apiFetch<{ success: boolean }>('/task-intelligence.php?action=assign_project', {
        method: 'POST', body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'orphaned'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

function useBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { task_ids: string[]; fields: Record<string, any> }) =>
      apiFetch<{ success: boolean; updated?: number }>('/task-intelligence.php?action=bulk_update', {
        method: 'POST', body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'quality'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ── Assessment Tab ───────────────────────────────────────────────────────────
const YEAR_OPTIONS = ['all', ...Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - i))];

function AssessmentTab() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [useCustom, setUseCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const filters: Record<string, string> = useCustom
    ? { date_from: customFrom, date_to: customTo }
    : { year };

  const { data, isLoading } = useAssessment(filters);

  const s = data?.summary ?? {};
  const monthly: any[] = data?.monthly ?? [];
  const workload: any[] = data?.workload ?? [];

  const filtersContent = (<>
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">ช่วงเวลา</span>
      <Select value={useCustom ? 'custom' : year} onValueChange={v => {
        if (v === 'custom') { setUseCustom(true); }
        else { setUseCustom(false); setYear(v); }
      }}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YEAR_OPTIONS.map(y => (
            <SelectItem key={y} value={y}>
              {y === 'all' ? 'ทั้งหมด' : `ปี ${Number(y) + 543}`}
            </SelectItem>
          ))}
          <SelectItem value="custom">กำหนดเอง</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {useCustom && (<>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">ตั้งแต่</span>
        <Input type="date" className="w-40" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">ถึง</span>
        <Input type="date" className="w-40" value={customTo} onChange={e => setCustomTo(e.target.value)} />
      </div>
    </>)}
  </>);

  // Status distribution for pie-like bar
  const statusData = s.total > 0 ? [
    { name: 'เสร็จตรงเวลา', value: s.on_time ?? 0, color: '#22c55e' },
    { name: 'เสร็จช้า', value: (s.completed ?? 0) - (s.on_time ?? 0), color: '#f97316' },
    { name: 'เกินกำหนด', value: s.overdue ?? 0, color: '#ef4444' },
    { name: 'กำลังทำ', value: s.in_progress ?? 0, color: '#3b82f6' },
    { name: 'รอดำเนินการ', value: s.pending ?? 0, color: '#94a3b8' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card>
        <CardContent className="pt-4">
          {/* Mobile: year selector + filter toggle */}
          <div className="sm:hidden flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">ช่วงเวลา</span>
              <Select value={useCustom ? 'custom' : year} onValueChange={v => {
                if (v === 'custom') { setUseCustom(true); }
                else { setUseCustom(false); setYear(v); }
              }}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map(y => (
                    <SelectItem key={y} value={y}>
                      {y === 'all' ? 'ทั้งหมด' : `ปี ${Number(y) + 543}`}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">กำหนดเอง</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="mt-auto" onClick={() => setShowFiltersMobile(!showFiltersMobile)}>
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Desktop: inline filters */}
          <div className="hidden sm:flex gap-3 items-end flex-wrap">
            {filtersContent}
          </div>
          {/* Mobile: collapsible custom date filters */}
          {showFiltersMobile && useCustom && (
            <div className="sm:hidden flex flex-wrap items-center gap-2 pt-2 border-t mt-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">ตั้งแต่</span>
                <Input type="date" className="w-40" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">ถึง</span>
                <Input type="date" className="w-40" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && <p className="text-muted-foreground py-8 text-center">กำลังโหลด...</p>}

      {!isLoading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">งานทั้งหมด</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{s.total ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.total_actual_hours ?? 0}h จริง / {s.total_estimated_hours ?? 0}h ประมาณ</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">เสร็จตรงเวลา</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{s.on_time_pct ?? 0}%</p>
                <p className="text-xs text-muted-foreground">{s.on_time ?? 0} จาก {s.completed ?? 0} งานที่เสร็จ</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">เกินกำหนด</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{s.overdue_pct ?? 0}%</p>
                <p className="text-xs text-muted-foreground">{s.overdue ?? 0} งาน</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">ชั่วโมงเบี่ยงเฉลี่ย</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(s.avg_hours_deviation ?? 0) > 2 ? 'text-red-500' : (s.avg_hours_deviation ?? 0) < 0 ? 'text-green-500' : ''}`}>
                  {(s.avg_hours_deviation ?? 0) > 0 ? '+' : ''}{s.avg_hours_deviation ?? 0}h
                </p>
                <p className="text-xs text-muted-foreground">{(s.avg_hours_deviation ?? 0) > 0 ? 'ใช้เวลานานกว่าที่ประมาณ' : (s.avg_hours_deviation ?? 0) < 0 ? 'เร็วกว่าที่ประมาณ' : 'ตรงตามแผน'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly completion chart */}
          {monthly.length > 0 && (
            <Card>
              <CardHeader><CardTitle>งานเสร็จ vs เกินกำหนด รายเดือน</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthly} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: any, name: string) => [`${v} งาน`, name]} />
                    <Legend />
                    <Bar dataKey="completed" name="เสร็จแล้ว" fill="#22c55e" radius={[3,3,0,0]} />
                    <Bar dataKey="overdue"   name="เกินกำหนด" fill="#ef4444" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Monthly hours chart */}
          {monthly.length > 0 && (
            <Card>
              <CardHeader><CardTitle>ชั่วโมงทำงานจริง vs ประมาณ รายเดือน</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthly} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any, name: string) => [`${v}h`, name]} />
                    <Legend />
                    <Line type="monotone" dataKey="actual_hours"    name="ชั่วโมงจริง"    stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="estimated_hours" name="ชั่วโมงประมาณ" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Status distribution */}
          {statusData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>สัดส่วนสถานะงาน</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusData} layout="vertical" margin={{ top: 4, right: 40, left: 80, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: any) => [`${v} งาน`]} />
                    <Bar dataKey="value" radius={[0,3,3,0]}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Workload per person */}
          {workload.length > 0 && (
            <Card>
              <CardHeader><CardTitle>ภาระงานต่อคน</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(180, workload.length * 44)}>
                  <BarChart data={workload} layout="vertical" margin={{ top: 4, right: 60, left: 80, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: any, name: string) => [name.includes('ชั่วโมง') ? `${v}h` : `${v} งาน`, name]} />
                    <Legend />
                    <Bar dataKey="task_count"       name="จำนวนงาน"     fill="#6366f1" radius={[0,3,3,0]} />
                    <Bar dataKey="actual_hours"     name="ชั่วโมงจริง"  fill="#3b82f6" radius={[0,3,3,0]} />
                    <Bar dataKey="overdue"          name="งานเกินกำหนด" fill="#ef4444" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3 mt-4">
                  {workload.map((w: any) => (
                    <Card key={w.id}>
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{w.name}</p>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-xs">
                          <span className="text-muted-foreground">งาน: <strong className="text-foreground">{w.task_count}</strong></span>
                          <span className="text-muted-foreground">ชม.ประมาณ: <strong className="text-foreground">{w.estimated_hours}h</strong></span>
                          <span className="text-muted-foreground">ชม.จริง: <strong className="text-foreground">{w.actual_hours}h</strong></span>
                          <span className="text-muted-foreground">ตรงเวลา: <strong className="text-green-600">{w.on_time}</strong></span>
                          <span className="text-muted-foreground col-span-2">เกินกำหนด: <strong className="text-red-600">{w.overdue}</strong></span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ</TableHead>
                      <TableHead className="text-right">งาน</TableHead>
                      <TableHead className="text-right">ชม.ประมาณ</TableHead>
                      <TableHead className="text-right">ชม.จริง</TableHead>
                      <TableHead className="text-right">ตรงเวลา</TableHead>
                      <TableHead className="text-right">เกินกำหนด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workload.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-right">{w.task_count}</TableCell>
                        <TableCell className="text-right">{w.estimated_hours}h</TableCell>
                        <TableCell className="text-right">{w.actual_hours}h</TableCell>
                        <TableCell className="text-right text-green-600">{w.on_time}</TableCell>
                        <TableCell className="text-right text-red-600">{w.overdue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!isLoading && s.total === 0 && (
            <p className="text-muted-foreground text-center py-12">ไม่พบข้อมูลในช่วงเวลาที่เลือก</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared Pagination ────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 50];

function PaginationBar({
  page, pages, total, perPage, onPage, onPerPage,
}: {
  page: number; pages: number; total: number; perPage: number;
  onPage: (p: number) => void; onPerPage?: (n: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-2">
      <span className="text-sm text-muted-foreground">
        แสดง {from}–{to} จาก {total} รายการ
      </span>
      <div className="flex items-center gap-2">
        {onPerPage && (
          <Select value={String(perPage)} onValueChange={(v) => { onPerPage(Number(v)); onPage(1); }}>
            <SelectTrigger className="h-8 w-24 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n} รายการ</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← ก่อนหน้า</Button>
        <span className="text-sm text-muted-foreground">หน้า {page} / {Math.max(1, pages)}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>ถัดไป →</Button>
      </div>
    </div>
  );
}

function usePaged<T>(items: T[], page: number, perPage: number) {
  return useMemo(() => {
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    const slice = items.slice((page - 1) * perPage, page * perPage);
    return { slice, pages };
  }, [items, page, perPage]);
}

// ── Shared utilities ─────────────────────────────────────────────────────────
function useDebounce(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function SearchInput({ value, onChange, placeholder = 'ค้นหา...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="pl-8 pr-8 h-8 text-sm" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ── ProjectComboBox ────────────────────────────────────────────────────────────
function ProjectComboBox({ projects, baseCalendar, disabled, onSelect, size }: {
  projects: any[];
  baseCalendar?: any;
  disabled?: boolean;
  size?: 'sm';
  onSelect: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isSm = size === 'sm';

  const allOptions = baseCalendar
    ? [{ id: baseCalendar.id, name: '📅 Team Calendar', kind: 'base_calendar' }, ...projects.filter((p: any) => p.kind !== 'base_calendar')]
    : projects;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={isSm ? 'sm' : 'sm'} disabled={disabled}
          className={isSm ? 'h-7 text-xs w-32 justify-start truncate' : 'h-8 text-sm'}>
          เลือก Project...
        </Button>
      </PopoverTrigger>
      <PopoverContent className={isSm ? 'w-48 p-0' : 'w-56 p-0'} align="start">
        <Command>
          <CommandInput placeholder="ค้นหา Project หรือ Team Calendar..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs p-2">ไม่พบ</CommandEmpty>
            <CommandGroup>
              {allOptions.map((p: any) => (
                <CommandItem key={p.id} value={p.name}
                  className="text-xs cursor-pointer"
                  onSelect={() => { onSelect(p.id); setOpen(false); }}>
                  {p.kind === 'base_calendar' ? '📅 Team Calendar' : p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Orphaned Tasks Card ───────────────────────────────────────────────────────
function OrphanedTasksCard({ search }: { search: string }) {
  const [page, setPage]         = useState(1);
  const [perPage, setPerPage]   = useState(20);
  const [selected, setSelected] = useState<string[]>([]);
  const { data, isLoading } = useOrphaned(page, perPage, search);
  const assign = useAssignProject();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users = [] } = useUsers();
  const userList = Array.isArray(users) ? users : [];

  // Per-row edit & delete
  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editProject, setEditProject] = useState('');

  const editMutation = useMutation({
    mutationFn: (payload: { task_ids: string[]; fields: Record<string, any> }) =>
      apiFetch<{ success: boolean; updated?: number }>('/task-intelligence.php?action=bulk_update', {
        method: 'POST', body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'orphaned'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'อัปเดตสำเร็จ' });
      setEditOpen(false);
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => apiFetch(`/tasks.php?id=${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'orphaned'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'ลบงานเรียบร้อยแล้ว' });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (t: any) => {
    setEditTask(t);
    setEditTitle(t.title || '');
    setEditHours(String(t.estimated_hours ?? ''));
    setEditEndDate(t.end_date || '');
    setEditStatus(t.status || '');
    setEditAssignee(t.assignee_user_id || t.assignee_id || '');
    setEditProject(t.project_id || '');
    setEditOpen(true);
  };

  const handleEditSave = () => {
    const fields: Record<string, any> = {};
    if (editTitle && editTitle !== editTask?.title) fields.title = editTitle;
    if (editHours !== '' && Number(editHours) !== Number(editTask?.estimated_hours ?? '')) fields.estimated_hours = Number(editHours);
    if (editEndDate && editEndDate !== editTask?.end_date) fields.end_date = editEndDate;
    if (editStatus && editStatus !== editTask?.status) fields.status = editStatus;
    if (editAssignee && editAssignee !== (editTask?.assignee_user_id || editTask?.assignee_id || '')) fields.assignee_user_id = editAssignee;
    if (editProject && editProject !== editTask?.project_id) fields.project_id = editProject;
    if (Object.keys(fields).length === 0) {
      toast({ title: 'ไม่มีข้อมูลที่แก้ไข', variant: 'destructive' });
      return;
    }
    editMutation.mutate({ task_ids: [editTask.id], fields });
  };

  // Bulk edit & delete
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkHours, setBulkHours] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');

  const bulkEditMutation = useMutation({
    mutationFn: (payload: { task_ids: string[]; fields: Record<string, any> }) =>
      apiFetch<{ success: boolean; updated?: number }>('/task-intelligence.php?action=bulk_update', {
        method: 'POST', body: JSON.stringify(payload),
      }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'orphaned'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: `อัปเดต ${d.updated} รายการสำเร็จ` });
      setBulkEditOpen(false);
      setSelected([]);
      setBulkHours(''); setBulkEndDate(''); setBulkStatus(''); setBulkAssignee('');
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (taskIds: string[]) =>
      apiFetch<{ success: boolean; updated?: number }>('/task-intelligence.php?action=bulk_update', {
        method: 'POST', body: JSON.stringify({ task_ids: taskIds, fields: { status: 'cancelled' } }),
      }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'orphaned'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: `ลบ ${d.updated} รายการสำเร็จ` });
      setSelected([]);
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const handleBulkEdit = () => {
    const fields: Record<string, any> = {};
    if (bulkHours) fields.estimated_hours = Number(bulkHours);
    if (bulkAssignee) fields.assignee_user_id = bulkAssignee;
    if (bulkEndDate) fields.end_date = bulkEndDate;
    if (bulkStatus) fields.status = bulkStatus;
    if (Object.keys(fields).length === 0) {
      toast({ title: 'กรุณาระบุฟิลด์ที่ต้องการแก้ไข', variant: 'destructive' });
      return;
    }
    bulkEditMutation.mutate({ task_ids: selected, fields });
  };

  const handleBulkDelete = () => {
    if (!selected.length) return;
    if (!confirm(`ลบ ${selected.length} งานที่เลือก ใช่หรือไม่?`)) return;
    bulkDeleteMutation.mutate(selected);
  };

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [search]);

  const tasks: any[]    = data?.tasks    ?? [];
  const total: number   = data?.total    ?? 0;
  const projects: any[] = data?.projects ?? [];
  const pages = Math.max(1, Math.ceil(total / perPage));

  const baseCalendar = projects.find((p: any) => p.kind === 'base_calendar');

  const toggleAll = () => {
    if (selected.length === tasks.length) setSelected([]);
    else setSelected(tasks.map((t: any) => t.id));
  };

  const handleAssign = async (projectId: string) => {
    if (!selected.length) { toast({ title: 'กรุณาเลือกงานก่อน', variant: 'destructive' }); return; }
    try {
      const r = await assign.mutateAsync({ task_ids: selected, project_id: projectId });
      toast({ title: `ย้าย ${r.assigned} งาน → ${r.project_name} สำเร็จ` });
      setSelected([]);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            งานที่ไม่มีโปรเจค (Orphaned)
            <Badge variant={total > 0 ? 'destructive' : 'secondary'}>{total}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
        ) : total === 0 ? (
          <p className="text-muted-foreground text-sm">{search ? 'ไม่พบงานที่ตรงกับคำค้นหา' : 'ไม่พบงานที่ไม่มีโปรเจค'}</p>
        ) : (
          <>
            {/* Action bar */}
            {selected.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">เลือก {selected.length} งาน</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground">ย้าย:</span>
                <ProjectComboBox
                  projects={projects}
                  baseCalendar={baseCalendar}
                  disabled={assign.isPending}
                  onSelect={(projectId) => handleAssign(projectId)}
                />
                <span className="text-muted-foreground">|</span>
                <Button size="sm" variant="outline"
                  onClick={() => { setBulkEditOpen(true); setBulkHours(''); setBulkEndDate(''); setBulkStatus(''); setBulkAssignee(''); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  แก้ไข
                </Button>
                <Button size="sm" variant="destructive"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={handleBulkDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  ลบ
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>ล้างเลือก</Button>
              </div>
            )}

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {tasks.map((t: any) => (
                <Card key={t.id} className={selected.includes(t.id) ? 'ring-2 ring-primary bg-primary/5' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox"
                        checked={selected.includes(t.id)}
                        onChange={() => setSelected(prev =>
                          prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                        )}
                        className="cursor-pointer mt-1 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                          <Badge variant="outline" className="text-xs">{t.status}</Badge>
                          <span className="text-muted-foreground">{t.assignee || '—'}</span>
                          <span className="text-muted-foreground">{t.end_date || '—'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                          onClick={() => openEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                          onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                          disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <input type="checkbox"
                      checked={selected.length === tasks.length && tasks.length > 0}
                      onChange={toggleAll}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>ชื่องาน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ผู้รับผิดชอบ</TableHead>
                  <TableHead>วันสิ้นสุด</TableHead>
                  <TableHead className="w-20 text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t: any) => (
                  <TableRow key={t.id} className={selected.includes(t.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <input type="checkbox"
                        checked={selected.includes(t.id)}
                        onChange={() => setSelected(prev =>
                          prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                        )}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.assignee || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.end_date || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                          onClick={() => openEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                          onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                          disabled={deleteMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <PaginationBar page={page} pages={pages} total={total} perPage={perPage}
              onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} />
          </>
        )}
      </CardContent>
    </Card>
    {/* Edit Row Dialog */}
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แก้ไขงาน</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>ชื่องาน</Label>
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>โปรเจค</Label>
            <ProjectCombobox value={editProject} onChange={(id) => setEditProject(id === 'none' ? '' : id)} placeholder="เลือกโปรเจค..." allowNone includeBaseCalendar />
          </div>
          <div className="space-y-1.5">
            <Label>สถานะ</Label>
            <Select value={editStatus || '__none__'} onValueChange={v => setEditStatus(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่เปลี่ยน</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="in-progress">กำลังทำ</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="cancelled">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ชั่วโมงประมาณ</Label>
            <Input type="number" min={0} step={0.5} placeholder="0" value={editHours} onChange={e => setEditHours(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ผู้รับผิดชอบ</Label>
            <Select value={editAssignee || '__none__'} onValueChange={v => setEditAssignee(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="เลือกผู้รับผิดชอบ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                {userList.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>วันสิ้นสุด</Label>
            <Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleEditSave} disabled={editMutation.isPending}>
            {editMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* Bulk Edit Dialog */}
    <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
      <DialogContent className="w-full sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>แก้ไข {selected.length} งานพร้อมกัน</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">ระบุเฉพาะฟิลด์ที่ต้องการเปลี่ยน — ฟิลด์ที่เว้นว่างไว้จะคงค่าเดิม</p>
          <div className="space-y-1.5">
            <Label>สถานะ</Label>
            <Select value={bulkStatus || '__none__'} onValueChange={v => setBulkStatus(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="ไม่เปลี่ยน" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่เปลี่ยน</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="in-progress">กำลังทำ</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="cancelled">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ชั่วโมงประมาณ</Label>
            <Input type="number" min={0} placeholder="ไม่เปลี่ยน" value={bulkHours} onChange={e => setBulkHours(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ผู้รับผิดชอบ</Label>
            <Select value={bulkAssignee || '__none__'} onValueChange={v => setBulkAssignee(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="ไม่เปลี่ยน" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่เปลี่ยน</SelectItem>
                {userList.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>วันสิ้นสุด</Label>
            <Input type="date" placeholder="ไม่เปลี่ยน" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBulkEditOpen(false)}>ยกเลิก</Button>
          <Button onClick={handleBulkEdit} disabled={bulkEditMutation.isPending}>
            {bulkEditMutation.isPending ? `กำลังอัปเดต ${selected.length} รายการ...` : `อัปเดต ${selected.length} รายการ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── Data Quality Tab ─────────────────────────────────────────────────────────
function DataQualityTab({ isAdmin }: { isAdmin: boolean }) {
  const [perPage, setPerPage]         = useState(20);
  const [missingPage, setMissingPage] = useState(1);
  const [anomalyPage, setAnomalyPage] = useState(1);
  const [zombiePage, setZombiePage]   = useState(1);
  const [dupPage, setDupPage]         = useState(1);
  const [searchRaw, setSearchRaw]     = useState('');
  const search = useDebounce(searchRaw);

  // Per-section selected IDs
  const [missingSelected, setMissingSelected] = useState<string[]>([]);
  const [anomalySelected, setAnomalySelected] = useState<string[]>([]);
  const [zombieSelected,  setZombieSelected]  = useState<string[]>([]);
  const [dupSelected,     setDupSelected]     = useState<string[]>([]);

  // Bulk edit field state
  const [bulkHours,    setBulkHours]    = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkEndDate,  setBulkEndDate]  = useState('');
  const [bulkStatus,   setBulkStatus]   = useState('');

  const bulkUpdate = useBulkUpdate();
  const { data: users = [] } = useUsers();
  const userList = Array.isArray(users) ? users : [];

  const handleBulkUpdate = async (ids: string[], fields: Record<string, any>, onDone: () => void) => {
    if (!ids.length) return;
    try {
      const r = await bulkUpdate.mutateAsync({ task_ids: ids, fields });
      toast({ title: `อัปเดต ${r.updated} รายการสำเร็จ` });
      onDone();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = (ids: string[], onDone: () => void) => {
    if (!ids.length) return;
    if (!confirm(`ลบ ${ids.length} งานที่เลือก ใช่หรือไม่?`)) return;
    apiFetch<{ success: boolean; deleted: number }>('/task-intelligence.php?action=bulk_delete', {
      method: 'POST', body: JSON.stringify({ task_ids: ids }),
    }).then((d) => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'quality'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'duplicates'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'orphaned'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: `ลบ ${d.deleted} รายการสำเร็จ` });
      onDone();
    }).catch((e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }));
  };

  const qualityParams: QualityParams = { per_page: perPage, missing_page: missingPage, anomaly_page: anomalyPage, zombie_page: zombiePage, search };
  const { data: quality, isLoading: qLoading } = useQuality(qualityParams);
  const { data: dups, isLoading: dLoading } = useDuplicates();
  const { data: allProjects } = useProjects();
  const [staleDays, setStaleDays] = useState(0);
  const { data: staleData, isLoading: staleLoading } = useStaleProjects(staleDays);
  const staleProjects: any[] = staleData?.data ?? [];
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const migrableProjects = useMemo(() => {
    const base = (Array.isArray(allProjects) ? allProjects : [])
      .filter((p) => p.kind !== 'base_calendar' && p.status !== 'cancelled');
    if (!projectSearch) return base;
    return base.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase()));
  }, [allProjects, projectSearch]);

  const updateProjectStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/projects.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'stale_projects'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'อัปเดตสถานะโปรเจคสำเร็จ' });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const migrateMutation = useMutation({
    mutationFn: (projectIds: string[]) =>
      apiFetch<{ moved: number }>('/task-intelligence.php?action=migrate', {
        method: 'POST',
        body: JSON.stringify({ project_ids: projectIds }),
      }),
    onSuccess: (d) => {
      toast({ title: `ย้าย ${d.moved} งานสำเร็จ` });
      setPreview(null);
      setSelectedProjects([]);
      qc.invalidateQueries({ queryKey: ['task-intelligence'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const autoFixMutation = useMutation({
    mutationFn: () => apiFetch<{ total_fixed: number }>('/task-intelligence.php?action=auto_fix', { method: 'POST' }),
    onSuccess: (d) => {
      toast({ title: d.total_fixed > 0 ? `ปรับปรุงข้อมูลสำเร็จ — ${d.total_fixed} รายการ` : 'ไม่พบรายการที่ต้องปรับปรุง' });
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'quality'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'orphaned'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'duplicates'] });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  // Per-row edit & delete
  const [editOpen, setEditOpen] = useState(false);
  const [editSection, setEditSection] = useState<'missing' | 'anomaly' | 'zombie' | 'dup'>('missing');
  const [editTask, setEditTask] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editActualHours, setEditActualHours] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editProject, setEditProject] = useState('');

  const editMutation = useMutation({
    mutationFn: (payload: { task_ids: string[]; fields: Record<string, any> }) =>
      apiFetch<{ success: boolean; updated?: number }>('/task-intelligence.php?action=bulk_update', {
        method: 'POST', body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'quality'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'duplicates'] });
      toast({ title: 'อัปเดตสำเร็จ' });
      setEditOpen(false);
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => apiFetch(`/tasks.php?id=${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'quality'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence', 'duplicates'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'ลบงานเรียบร้อยแล้ว' });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (section: 'missing' | 'anomaly' | 'zombie' | 'dup', task: any) => {
    setEditSection(section);
    setEditTask(task);
    setEditTitle(task.title || '');
    setEditHours(String(task.estimated_hours ?? ''));
    setEditActualHours(String(task.actual_hours ?? ''));
    setEditEndDate(task.end_date || '');
    setEditStatus(task.status || '');
    setEditAssignee(task.assignee_user_id || task.assignee_id || '');
    setEditProject(task.project_id || '');
    setEditOpen(true);
  };

  const handleEditSave = () => {
    const fields: Record<string, any> = {};
    if (editTitle && editTitle !== editTask?.title) fields.title = editTitle;
    if (editHours !== '' && Number(editHours) !== Number(editTask?.estimated_hours ?? '')) fields.estimated_hours = Number(editHours);
    if (editActualHours !== '' && Number(editActualHours) !== Number(editTask?.actual_hours ?? '')) fields.actual_hours = Number(editActualHours);
    if (editEndDate && editEndDate !== editTask?.end_date) fields.end_date = editEndDate;
    if (editStatus && editStatus !== editTask?.status) fields.status = editStatus;
    if (editAssignee && editAssignee !== (editTask?.assignee_user_id || editTask?.assignee_id || '')) fields.assignee_user_id = editAssignee;
    if (editProject && editProject !== editTask?.project_id) fields.project_id = editProject;
    if (Object.keys(fields).length === 0) {
      toast({ title: 'ไม่มีข้อมูลที่แก้ไข', variant: 'destructive' });
      return;
    }
    editMutation.mutate({ task_ids: [editTask.id], fields });
  };

  // Project edit/delete for Consolidation Tool
  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [projectEditName, setProjectEditName] = useState('');
  const [projectEditStatus, setProjectEditStatus] = useState('');

  const openProjectEdit = (p: any) => {
    setEditingProject(p);
    setProjectEditName(p.name || '');
    setProjectEditStatus(p.status || 'active');
    setProjectEditOpen(true);
  };

  const projectEditMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; status: string }) =>
      apiFetch(`/projects.php?id=${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: payload.name, status: payload.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence'] });
      toast({ title: 'อัปเดตโปรเจคสำเร็จ' });
      setProjectEditOpen(false);
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const projectDeleteMutation = useMutation({
    mutationFn: (projectId: string) => apiFetch(`/projects.php?id=${projectId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['task-intelligence'] });
      toast({ title: 'ลบโปรเจคเรียบร้อยแล้ว' });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const missing        = quality?.missing        ?? [];
  const missingTotal   = quality?.missing_total  ?? 0;
  const anomalies      = quality?.anomalies      ?? [];
  const anomalyTotal   = quality?.anomalies_total ?? 0;
  const zombies        = quality?.zombies        ?? [];
  const zombieTotal    = quality?.zombies_total  ?? 0;
  const dupGroups = useMemo(() => (Array.isArray(dups) ? dups as DuplicateTaskGroup[] : []), [dups]);

  const filteredDups = useMemo(() => {
    if (!search) return dupGroups;
    return dupGroups.filter((group: any[]) =>
      group.some((t: any) => t.title.toLowerCase().includes(search.toLowerCase()))
    );
  }, [dupGroups, search]);

  const missingPages = Math.max(1, Math.ceil(missingTotal / perPage));
  const anomalyPages = Math.max(1, Math.ceil(anomalyTotal / perPage));
  const zombiePages  = Math.max(1, Math.ceil(zombieTotal  / perPage));
  const { slice: dupSlice, pages: dupPages } = usePaged(filteredDups, dupPage, perPage);

  const [showQualityFiltersMobile, setShowQualityFiltersMobile] = useState(false);

  if (qLoading || dLoading) return <p className="text-muted-foreground py-8 text-center">กำลังโหลด...</p>;

  const qualityActionsContent = (<>
    {search && <span className="text-sm text-muted-foreground">กรองด้วย "{search}"</span>}
    <div className="flex-1" />
    <Button size="sm" variant="outline" onClick={() => autoFixMutation.mutate()} disabled={autoFixMutation.isPending}>
      <Wand2 className="h-3.5 w-3.5 mr-1" />
      {autoFixMutation.isPending ? 'กำลังปรับปรุง...' : 'ปรับปรุงข้อมูลทั้งหมด'}
    </Button>
  </>);

  return (
    <div className="space-y-6">
      {/* Global search */}
      <div className="flex items-center gap-2">
        <SearchInput value={searchRaw} onChange={(v) => { setSearchRaw(v); setMissingPage(1); setAnomalyPage(1); setZombiePage(1); setDupPage(1); setMissingSelected([]); setAnomalySelected([]); setZombieSelected([]); setDupSelected([]); }} placeholder="ค้นหาชื่องานในทุกส่วน..." />
        <Button variant="outline" size="sm" className="shrink-0 sm:hidden" onClick={() => setShowQualityFiltersMobile(!showQualityFiltersMobile)}>
          <Filter className="h-3.5 w-3.5" />
        </Button>
        <div className="hidden sm:flex items-center gap-2 flex-1">{qualityActionsContent}</div>
      </div>
      {showQualityFiltersMobile && (
        <div className="sm:hidden flex flex-wrap items-center gap-2 pt-2 border-t">
          {qualityActionsContent}
        </div>
      )}

      {/* Stale Projects */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              โปรเจคค้างนาน
              <Badge variant={staleProjects.length > 0 ? 'destructive' : 'secondary'}>{staleProjects.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>เกินกำหนดมากกว่า</span>
              <Select value={String(staleDays)} onValueChange={v => setStaleDays(Number(v))}>
                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">ทั้งหมด</SelectItem>
                  <SelectItem value="7">7 วัน</SelectItem>
                  <SelectItem value="14">14 วัน</SelectItem>
                  <SelectItem value="30">30 วัน</SelectItem>
                  <SelectItem value="60">60 วัน</SelectItem>
                  <SelectItem value="90">90 วัน</SelectItem>
                  <SelectItem value="180">6 เดือน</SelectItem>
                  <SelectItem value="365">1 ปี</SelectItem>
                  <SelectItem value="730">2 ปี</SelectItem>
                  <SelectItem value="1095">3 ปี</SelectItem>
                  <SelectItem value="1825">5 ปี</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {staleLoading
            ? <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
            : staleProjects.length === 0
              ? <p className="text-muted-foreground text-sm">ไม่พบโปรเจคค้างนาน</p>
              : <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {staleProjects.map((p: any) => (
                      <Card key={p.id} className="border-orange-200">
                        <CardContent className="p-3 space-y-2">
                          <p className="font-medium text-sm">{p.name}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              p.status === 'on-track' ? 'bg-green-100 text-green-700' :
                              p.status === 'at-risk' ? 'bg-yellow-100 text-yellow-700' :
                              p.status === 'delayed' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {{'on-track':'ตามแผน','at-risk':'มีความเสี่ยง','delayed':'ล่าช้า','on-hold':'พักไว้'}[p.status] ?? p.status}
                            </span>
                            <span>วันสิ้นสุด: {p.end_date}</span>
                            <span className="text-red-600 font-medium">เกินมา {p.days_overdue} วัน</span>
                            {p.open_task_count > 0 && <span>{p.open_task_count} งานยังค้างอยู่</span>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              disabled={updateProjectStatusMutation.isPending}
                              onClick={() => updateProjectStatusMutation.mutate({ id: p.id, status: 'completed' })}>
                              เสร็จแล้ว
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground"
                              disabled={updateProjectStatusMutation.isPending}
                              onClick={() => updateProjectStatusMutation.mutate({ id: p.id, status: 'cancelled' })}>
                              ยกเลิก
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground"
                              disabled={updateProjectStatusMutation.isPending}
                              onClick={() => updateProjectStatusMutation.mutate({ id: p.id, status: 'on-hold' })}>
                              พักไว้
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>โปรเจค</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead>วันสิ้นสุด</TableHead>
                          <TableHead>เกินมา</TableHead>
                          <TableHead>งานค้าง</TableHead>
                          <TableHead className="text-right">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staleProjects.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                p.status === 'on-track' ? 'bg-green-100 text-green-700' :
                                p.status === 'at-risk' ? 'bg-yellow-100 text-yellow-700' :
                                p.status === 'delayed' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {{'on-track':'ตามแผน','at-risk':'มีความเสี่ยง','delayed':'ล่าช้า','on-hold':'พักไว้'}[p.status] ?? p.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{p.end_date}</TableCell>
                            <TableCell className="text-red-600 font-medium">{p.days_overdue} วัน</TableCell>
                            <TableCell className="text-muted-foreground">{p.open_task_count > 0 ? `${p.open_task_count} งาน` : '–'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  disabled={updateProjectStatusMutation.isPending}
                                  onClick={() => updateProjectStatusMutation.mutate({ id: p.id, status: 'completed' })}>
                                  เสร็จแล้ว
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground"
                                  disabled={updateProjectStatusMutation.isPending}
                                  onClick={() => updateProjectStatusMutation.mutate({ id: p.id, status: 'on-hold' })}>
                                  พักไว้
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600"
                                  disabled={updateProjectStatusMutation.isPending}
                                  onClick={() => updateProjectStatusMutation.mutate({ id: p.id, status: 'cancelled' })}>
                                  ยกเลิก
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
          }
        </CardContent>
      </Card>

      {/* Orphaned Tasks */}
      <OrphanedTasksCard search={search} />

      {/* Zombies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            งานค้าง (ไม่มีกิจกรรม &gt;14 วัน)
            <Badge variant={zombieTotal > 0 ? 'destructive' : 'secondary'}>{zombieTotal}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {zombieTotal === 0
            ? <p className="text-muted-foreground text-sm">ไม่พบงานค้าง</p>
            : <>
                {zombieSelected.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">เลือก {zombieSelected.length} งาน</span>
                    <span className="text-muted-foreground text-xs">|</span>
                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                        <SelectItem value="cancelled">ยกเลิก</SelectItem>
                        <SelectItem value="pending">รอดำเนินการ</SelectItem>
                        <SelectItem value="in-progress">กำลังทำ</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input className="h-7 w-32 text-xs" type="date" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)} placeholder="วันสิ้นสุด" />
                    <Button size="sm" disabled={bulkUpdate.isPending}
                      onClick={() => {
                        const fields: Record<string, any> = {};
                        if (bulkStatus) fields.status = bulkStatus;
                        if (bulkEndDate) fields.end_date = bulkEndDate;
                        handleBulkUpdate(zombieSelected, fields, () => { setZombieSelected([]); setBulkStatus(''); setBulkEndDate(''); });
                      }}>
                      บันทึก
                    </Button>
                    <Button size="sm" variant="destructive" disabled={bulkUpdate.isPending}
                      onClick={() => handleBulkDelete(zombieSelected, () => { setZombieSelected([]); })}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      ลบ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setZombieSelected([])}>ล้างเลือก</Button>
                  </div>
                )}
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {zombies.map((t: any) => (
                    <Card key={t.id} className={zombieSelected.includes(t.id) ? 'ring-2 ring-primary bg-primary/5' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" className="cursor-pointer mt-1 shrink-0" checked={zombieSelected.includes(t.id)}
                            onChange={() => setZombieSelected(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.project_name}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                              <span className="text-red-600">สิ้นสุด: {t.end_date}</span>
                              <span className="text-muted-foreground">ล่าสุด: {t.last_activity ?? 'ไม่มี'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                              onClick={() => openEdit('zombie', t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                              onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                              disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <input type="checkbox" className="cursor-pointer"
                          checked={zombieSelected.length === zombies.length && zombies.length > 0}
                          onChange={() => setZombieSelected(zombieSelected.length === zombies.length ? [] : zombies.map((t: any) => t.id))} />
                      </TableHead>
                      <TableHead>งาน</TableHead>
                      <TableHead>โปรเจค</TableHead>
                      <TableHead>วันสิ้นสุด</TableHead>
                      <TableHead>Activity ล่าสุด</TableHead>
                      <TableHead className="w-20 text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zombies.map((t: any) => (
                      <TableRow key={t.id} className={zombieSelected.includes(t.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <input type="checkbox" className="cursor-pointer" checked={zombieSelected.includes(t.id)}
                            onChange={() => setZombieSelected(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                        </TableCell>
                        <TableCell>{t.title}</TableCell>
                        <TableCell>{t.project_name}</TableCell>
                        <TableCell className="text-red-600">{t.end_date}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{t.last_activity ?? 'ไม่มี'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                              onClick={() => openEdit('zombie', t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                              onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                              disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <PaginationBar page={zombiePage} pages={zombiePages} total={zombieTotal} perPage={perPage} onPage={setZombiePage} onPerPage={(n) => { setPerPage(n); setZombiePage(1); }} />
              </>
          }
        </CardContent>
      </Card>

      {/* Missing fields */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              ข้อมูลไม่ครบ
              <Badge variant={missingTotal > 0 ? 'destructive' : 'secondary'}>{missingTotal}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {missingTotal === 0
            ? <p className="text-muted-foreground text-sm">ข้อมูลครบถ้วน</p>
            : <>
                {missingSelected.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">เลือก {missingSelected.length} งาน</span>
                    <span className="text-muted-foreground text-xs">|</span>
                    <Input className="h-7 w-24 text-xs" type="number" min={0} placeholder="ชั่วโมง" value={bulkHours}
                      onChange={e => setBulkHours(e.target.value)} />
                    <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
                      <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="ผู้รับผิดชอบ" /></SelectTrigger>
                      <SelectContent>
                        {userList.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="h-7 w-32 text-xs" type="date" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)} />
                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">รอดำเนินการ</SelectItem>
                        <SelectItem value="in-progress">กำลังทำ</SelectItem>
                        <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                        <SelectItem value="cancelled">ยกเลิก</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={bulkUpdate.isPending}
                      onClick={() => {
                        const fields: Record<string, any> = {};
                        if (bulkHours) fields.estimated_hours = Number(bulkHours);
                        if (bulkAssignee) fields.assignee_user_id = bulkAssignee;
                        if (bulkEndDate) fields.end_date = bulkEndDate;
                        if (bulkStatus) fields.status = bulkStatus;
                        handleBulkUpdate(missingSelected, fields, () => { setMissingSelected([]); setBulkHours(''); setBulkAssignee(''); setBulkEndDate(''); setBulkStatus(''); });
                      }}>
                      บันทึก
                    </Button>
                    <Button size="sm" variant="destructive" disabled={bulkUpdate.isPending}
                      onClick={() => handleBulkDelete(missingSelected, () => { setMissingSelected([]); })}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      ลบ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setMissingSelected([])}>ล้างเลือก</Button>
                  </div>
                )}
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {missing.map((t: any) => (
                    <Card key={t.id} className={missingSelected.includes(t.id) ? 'ring-2 ring-primary bg-primary/5' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" className="cursor-pointer mt-1 shrink-0" checked={missingSelected.includes(t.id)}
                            onChange={() => setMissingSelected(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.project_name}</p>
                            <p className="text-xs text-red-600 mt-0.5">
                              {[!t.estimated_hours && 'ไม่มีชั่วโมงประมาณ', !t.assignee && 'ไม่มีผู้รับผิดชอบ', !t.end_date && 'ไม่มีวันสิ้นสุด'].filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                              onClick={() => openEdit('missing', t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                              onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                              disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <input type="checkbox" className="cursor-pointer"
                          checked={missingSelected.length === missing.length && missing.length > 0}
                          onChange={() => setMissingSelected(missingSelected.length === missing.length ? [] : missing.map((t: any) => t.id))} />
                      </TableHead>
                      <TableHead>งาน</TableHead>
                      <TableHead>โปรเจค</TableHead>
                      <TableHead>ปัญหา</TableHead>
                      <TableHead className="w-20 text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missing.map((t: any) => (
                      <TableRow key={t.id} className={missingSelected.includes(t.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <input type="checkbox" className="cursor-pointer" checked={missingSelected.includes(t.id)}
                            onChange={() => setMissingSelected(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                        </TableCell>
                        <TableCell>{t.title}</TableCell>
                        <TableCell>{t.project_name}</TableCell>
                        <TableCell className="text-xs text-red-600">
                          {[!t.estimated_hours && 'ไม่มีชั่วโมงประมาณ', !t.assignee && 'ไม่มีผู้รับผิดชอบ', !t.end_date && 'ไม่มีวันสิ้นสุด'].filter(Boolean).join(', ')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                              onClick={() => openEdit('missing', t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                              onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                              disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <PaginationBar page={missingPage} pages={missingPages} total={missingTotal} perPage={perPage} onPage={setMissingPage} onPerPage={(n) => { setPerPage(n); setMissingPage(1); }} />
              </>
          }
        </CardContent>
      </Card>

      {/* Anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ชั่วโมงผิดปกติ (&gt;16h)
            <Badge variant={anomalyTotal > 0 ? 'destructive' : 'secondary'}>{anomalyTotal}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {anomalyTotal === 0
            ? <p className="text-muted-foreground text-sm">ไม่พบความผิดปกติ</p>
            : <>
                {anomalySelected.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">เลือก {anomalySelected.length} งาน</span>
                    <span className="text-muted-foreground text-xs">|</span>
                    <Input className="h-7 w-24 text-xs" type="number" min={0} placeholder="ชั่วโมงจริง" value={bulkHours}
                      onChange={e => setBulkHours(e.target.value)} />
                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">รอดำเนินการ</SelectItem>
                        <SelectItem value="in-progress">กำลังทำ</SelectItem>
                        <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                        <SelectItem value="cancelled">ยกเลิก</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={bulkUpdate.isPending}
                      onClick={() => {
                        const fields: Record<string, any> = {};
                        if (bulkHours) fields.actual_hours = Number(bulkHours);
                        if (bulkStatus) fields.status = bulkStatus;
                        handleBulkUpdate(anomalySelected, fields, () => { setAnomalySelected([]); setBulkHours(''); setBulkStatus(''); });
                      }}>
                      บันทึก
                    </Button>
                    <Button size="sm" variant="destructive" disabled={bulkUpdate.isPending}
                      onClick={() => handleBulkDelete(anomalySelected, () => { setAnomalySelected([]); })}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      ลบ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAnomalySelected([])}>ล้างเลือก</Button>
                  </div>
                )}
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {anomalies.map((t: any) => (
                    <Card key={t.id} className={anomalySelected.includes(t.id) ? 'ring-2 ring-primary bg-primary/5' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" className="cursor-pointer mt-1 shrink-0" checked={anomalySelected.includes(t.id)}
                            onChange={() => setAnomalySelected(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.project_name}</p>
                            <p className="text-sm font-bold text-red-600 mt-0.5">{t.actual_hours}h</p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                              onClick={() => openEdit('anomaly', t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                              onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                              disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <input type="checkbox" className="cursor-pointer"
                          checked={anomalySelected.length === anomalies.length && anomalies.length > 0}
                          onChange={() => setAnomalySelected(anomalySelected.length === anomalies.length ? [] : anomalies.map((t: any) => t.id))} />
                      </TableHead>
                      <TableHead>งาน</TableHead>
                      <TableHead>โปรเจค</TableHead>
                      <TableHead className="text-right">ชั่วโมงจริง</TableHead>
                      <TableHead className="w-20 text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anomalies.map((t: any) => (
                      <TableRow key={t.id} className={anomalySelected.includes(t.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <input type="checkbox" className="cursor-pointer" checked={anomalySelected.includes(t.id)}
                            onChange={() => setAnomalySelected(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                        </TableCell>
                        <TableCell>{t.title}</TableCell>
                        <TableCell>{t.project_name}</TableCell>
                        <TableCell className="text-right text-red-600 font-bold">{t.actual_hours}h</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="แก้ไข"
                              onClick={() => openEdit('anomaly', t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="ลบ"
                              onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                              disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <PaginationBar page={anomalyPage} pages={anomalyPages} total={anomalyTotal} perPage={perPage} onPage={setAnomalyPage} onPerPage={(n) => { setPerPage(n); setAnomalyPage(1); }} />
              </>
          }
        </CardContent>
      </Card>

      {/* Duplicates */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              งานที่อาจซ้ำซ้อน
              <Badge variant={filteredDups.length > 0 ? 'destructive' : 'secondary'}>{filteredDups.length} กลุ่ม</Badge>
            </CardTitle>
            {filteredDups.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => {
                  const allIds = dupSlice.flat().map((t: any) => t.id);
                  setDupSelected(dupSelected.length === allIds.length ? [] : allIds);
                }}>
                {dupSelected.length === dupSlice.flat().length ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredDups.length === 0
            ? <p className="text-muted-foreground text-sm">{search ? 'ไม่พบงานซ้ำที่ตรงกับคำค้นหา' : 'ไม่พบงานซ้ำ'}</p>
            : <>
                {dupSelected.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted rounded-lg mb-3">
                    <span className="text-sm font-medium">เลือก {dupSelected.length} งาน</span>
                    <span className="text-muted-foreground text-xs">|</span>
                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">รอดำเนินการ</SelectItem>
                        <SelectItem value="in-progress">กำลังทำ</SelectItem>
                        <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                        <SelectItem value="cancelled">ยกเลิก</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={bulkUpdate.isPending}
                      onClick={() => {
                        const fields: Record<string, any> = {};
                        if (bulkStatus) fields.status = bulkStatus;
                        handleBulkUpdate(dupSelected, fields, () => { setDupSelected([]); setBulkStatus(''); });
                      }}>
                      บันทึก
                    </Button>
                    <Button size="sm" variant="destructive" disabled={bulkUpdate.isPending}
                      onClick={() => handleBulkDelete(dupSelected, () => { setDupSelected([]); })}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      ลบ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDupSelected([])}>ล้างเลือก</Button>
                  </div>
                )}
                {dupSlice.map((group, i) => (
                  <div key={i} className="mb-4 border rounded p-3">
                    {group.map((t: any) => (
                      <div key={t.id} className={`flex items-center justify-between text-sm py-1 gap-2 ${dupSelected.includes(t.id) ? 'bg-muted/50 -mx-3 px-3' : ''}`}>
                        <input type="checkbox" className="cursor-pointer shrink-0"
                          checked={dupSelected.includes(t.id)}
                          onChange={() => setDupSelected(prev =>
                            prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                          )} />
                        <span className="flex-1 truncate">{t.title}</span>
                        <span className="text-muted-foreground shrink-0">{t.project_name} · {t.start_date}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="แก้ไข"
                            onClick={() => openEdit('dup', t)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" title="ลบ"
                            onClick={() => { if (confirm(`ลบงาน "${t.title}" ใช่หรือไม่?`)) deleteMutation.mutate(t.id); }}
                            disabled={deleteMutation.isPending}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <PaginationBar page={dupPage} pages={dupPages} total={filteredDups.length} perPage={perPage} onPage={setDupPage} onPerPage={setPerPage} />
              </>
          }
        </CardContent>
      </Card>

      {/* Edit Row Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขงาน</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>ชื่องาน</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>โปรเจค</Label>
              <ProjectCombobox value={editProject} onChange={(id) => setEditProject(id === 'none' ? '' : id)} placeholder="เลือกโปรเจค..." allowNone includeBaseCalendar />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ชั่วโมงประมาณ</Label>
                <Input type="number" min={0} step={0.5} placeholder="0" value={editHours} onChange={e => setEditHours(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ชั่วโมงจริง</Label>
                <Input type="number" min={0} step={0.5} placeholder="0" value={editActualHours} onChange={e => setEditActualHours(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>วันสิ้นสุด</Label>
              <Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ผู้รับผิดชอบ</Label>
              <Select value={editAssignee || '__none__'} onValueChange={v => setEditAssignee(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="เลือกผู้รับผิดชอบ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                  {userList.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>สถานะ</Label>
              <Select value={editStatus || '__none__'} onValueChange={v => setEditStatus(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ไม่เปลี่ยน</SelectItem>
                  <SelectItem value="pending">รอดำเนินการ</SelectItem>
                  <SelectItem value="in-progress">กำลังทำ</SelectItem>
                  <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEditSave} disabled={editMutation.isPending}>
              {editMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consolidation Tool - Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>รวม Projects เข้า Team Calendar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">เลือก Projects ที่ต้องการย้ายงานทั้งหมดไปรวมไว้ใน Team Calendar</p>
            <SearchInput value={projectSearch} onChange={setProjectSearch} placeholder="ค้นหา Project..." />
            {migrableProjects.length === 0
              ? <p className="text-sm text-muted-foreground">{projectSearch ? 'ไม่พบ Project ที่ตรงกับคำค้นหา' : 'ไม่มี Project ที่สามารถย้ายได้'}</p>
              : <div className="border rounded divide-y max-h-64 overflow-y-auto">
                  {migrableProjects.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedProjects.includes(p.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProjects(prev =>
                            checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                          );
                          setPreview(null);
                        }}
                      />
                      <span className="text-sm flex-1">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.status}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="แก้ไขชื่อ/สถานะ"
                          onClick={(e) => { e.stopPropagation(); openProjectEdit(p); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" title="ลบโปรเจค"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`ลบโปรเจค "${p.name}" ใช่หรือไม่?\nงานทั้งหมดในโปรเจคจะถูกลบด้วย`)) {
                              projectDeleteMutation.mutate(p.id);
                              setSelectedProjects(prev => prev.filter(id => id !== p.id));
                              setPreview(null);
                            }
                          }}
                          disabled={projectDeleteMutation.isPending}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
            }
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm"
                disabled={!selectedProjects.length}
                onClick={async () => {
                  const d = await apiFetch<TaskIntelligenceMigratePreview>(`/task-intelligence.php?action=migrate_preview&project_ids=${selectedProjects.join(',')}`);
                  setPreview(d);
                }}>
                ดูตัวอย่าง ({selectedProjects.length} โปรเจค)
              </Button>
              {preview && (
                <Button size="sm" variant="destructive"
                  disabled={migrateMutation.isPending}
                  onClick={() => migrateMutation.mutate(selectedProjects)}>
                  ยืนยันการย้าย ({preview.projects?.reduce((a, p) => a + Number(p.task_count), 0)} งาน → {preview.target_calendar?.name})
                </Button>
              )}
            </div>
            {preview && (
              <div className="text-sm border rounded p-3 bg-muted space-y-1">
                {preview.projects?.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">{p.task_count} งาน</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t font-medium">→ {preview.target_calendar?.name}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project Edit Dialog */}
      <Dialog open={projectEditOpen} onOpenChange={setProjectEditOpen}>
        <DialogContent className="w-full sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>แก้ไขโปรเจค</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ชื่อโปรเจค</Label>
              <Input value={projectEditName} onChange={e => setProjectEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>สถานะ</Label>
              <Select value={projectEditStatus} onValueChange={setProjectEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-track">ตามแผน</SelectItem>
                  <SelectItem value="at-risk">มีความเสี่ยง</SelectItem>
                  <SelectItem value="delayed">ล่าช้า</SelectItem>
                  <SelectItem value="on-hold">พักไว้</SelectItem>
                  <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectEditOpen(false)}>ยกเลิก</Button>
            <Button onClick={() => {
              if (!projectEditName.trim()) {
                toast({ title: 'กรุณาระบุชื่อโปรเจค', variant: 'destructive' });
                return;
              }
              projectEditMutation.mutate({
                id: editingProject.id,
                name: projectEditName,
                status: projectEditStatus,
              });
            }} disabled={projectEditMutation.isPending}>
              {projectEditMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Validation Rules Tab ─────────────────────────────────────────────────────
function ValidationRulesTab() {
  const { data, isLoading } = useValidationRules();
  const { toast } = useToast();
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: number }) =>
      apiFetch<{ success: boolean }>(`/validation-rules.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation-rules'] }),
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">กำลังโหลด...</p>;
  const rules: ValidationRule[] = (Array.isArray(data) ? data as ValidationRule[] : []);

  return (
    <Card>
      <CardHeader><CardTitle>กฎการตรวจสอบข้อมูล</CardTitle></CardHeader>
      <CardContent>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {rules.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <Badge variant={r.rule_type === 'block' ? 'destructive' : 'secondary'}>
                    {r.rule_type === 'block' ? 'บล็อก' : 'เตือน'}
                  </Badge>
                  <Switch
                    checked={!!r.is_active}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, is_active: v ? 1 : 0 })}
                  />
                </div>
                <p className="text-xs font-mono mt-1.5 text-muted-foreground">
                  {r.condition_field} {r.condition_operator} {r.condition_value ?? ''}
                </p>
                <p className="text-sm mt-1">{r.message_th}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ประเภท</TableHead>
              <TableHead>เงื่อนไข</TableHead>
              <TableHead>ข้อความแจ้งเตือน</TableHead>
              <TableHead className="text-center">เปิดใช้</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant={r.rule_type === 'block' ? 'destructive' : 'secondary'}>
                    {r.rule_type === 'block' ? 'บล็อก' : 'เตือน'}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.condition_field} {r.condition_operator} {r.condition_value ?? ''}
                </TableCell>
                <TableCell className="text-sm">{r.message_th}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={!!r.is_active}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, is_active: v ? 1 : 0 })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TaskIntelligencePage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === 1;

  return (
    <PageShell title="ประเมินผลงาน" subtitle="ประเมินผล วิเคราะห์คุณภาพ และตรวจสอบข้อมูลงาน">
      <Tabs defaultValue="assessment" className="w-full">
        <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pb-1">
        <TabsList className="flex sm:grid sm:grid-cols-3 h-auto gap-1">
          <TabsTrigger value="assessment" className="shrink-0">ประเมินผล</TabsTrigger>
          <TabsTrigger value="quality" className="shrink-0">คุณภาพข้อมูล</TabsTrigger>
          {isAdmin && <TabsTrigger value="rules" className="shrink-0">กฎการตรวจสอบ</TabsTrigger>}
        </TabsList>
        </div>

        <TabsContent value="assessment" className="mt-6">
          <AssessmentTab />
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
          <DataQualityTab isAdmin={isAdmin} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="rules" className="mt-6">
            <ValidationRulesTab />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}
