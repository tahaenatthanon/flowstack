import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import PageShell from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Sparkles, Search, Loader2, MoreHorizontal, Building2, Target,
  Trash2, Pencil, UserSearch, ChevronDown, Globe, Share2, ScanLine,
  FileSpreadsheet, Mail, Inbox,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { cn } from '@/lib/utils';
import ImportLeadsDialog from '@/components/leads/ImportLeadsDialog';
import ScanCardLeadDialog from '@/components/leads/ScanCardLeadDialog';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  name: string;
  contact_name: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  company_desc: string | null;
  business_type: string | null;
  company_type: string | null;
  source: string;
  status: string;
  ai_confidence: string | null;
  source_note: string | null;
  notes: string | null;
  converted_company_id: string | null;
  converted_opportunity_id: string | null;
  created_at: string;
}

interface CompanyMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface ApiError extends Error {
  status?: number;
  duplicate?: boolean;
  matches?: CompanyMatch[] | null;
}

interface LinkState {
  lead: Lead;
  target: 'company' | 'opportunity';
  matches: CompanyMatch[];
}

interface AiResult {
  name: string;
  contact_name: string;
  department?: string;
  email: string;
  phone: string;
  website: string;
  address?: string;
  business_type: string;
  company_desc: string;
  notes?: string;
  ai_confidence: string;
  source_note: string;
  source: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'กรอกเอง',
  ai_search: 'ค้นจากอินเทอร์เน็ต',
  business_card: 'นามบัตร',
  csv: 'นำเข้าไฟล์',
  email: 'อีเมล',
};

const COMPANY_TYPE_META: Record<string, { label: string; className: string }> = {
  customer:     { label: 'ลูกค้า', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partner:      { label: 'คู่ค้า', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  manufacturer: { label: 'ผู้ผลิต', className: 'bg-orange-100 text-orange-700 border-orange-200' },
};
const COMPANY_TYPES = ['customer', 'partner', 'manufacturer'] as const;

const STATUS_META: Record<string, { label: string; className: string }> = {
  new:       { label: 'ใหม่',         className: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'ติดต่อแล้ว',   className: 'bg-amber-100 text-amber-700' },
  qualified: { label: 'ผ่านคุณสมบัติ', className: 'bg-violet-100 text-violet-700' },
  converted: { label: 'แปลงแล้ว',     className: 'bg-green-100 text-green-700' },
  rejected:  { label: 'ปฏิเสธ',       className: 'bg-gray-200 text-gray-600' },
};

const emptyForm = {
  name: '', contact_name: '', department: '', email: '', phone: '', website: '', address: '',
  business_type: '', company_type: 'customer', company_desc: '', notes: '',
};

export default function LeadGenerationPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [companyTypeFilter, setCompanyTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResults, setAiResults] = useState<AiResult[] | null>(null);
  const [searchMode, setSearchMode] = useState<'web' | 'social' | 'email'>('web');
  const [imapYear, setImapYear] = useState(String(new Date().getFullYear())); // ปีที่ดึงอีเมล ('0' = ทั้งหมด)
  const [discoverCompanyType, setDiscoverCompanyType] = useState('customer'); // ประเภทที่จะใช้บันทึกผลลัพธ์ค้นหา/อีเมล

  const [importOpen, setImportOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  const [linkState, setLinkState] = useState<LinkState | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const openDiscover = (mode: 'web' | 'social' | 'email') => {
    setSearchMode(mode);
    setAiResults(null);
    setAiQuery('');
    setAiOpen(true);
  };

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['leads', statusFilter, sourceFilter, companyTypeFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (companyTypeFilter !== 'all') params.set('company_type', companyTypeFilter);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString();
      return apiFetch<Lead[]>(`/leads.php${qs ? `?${qs}` : ''}`);
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leads'] });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload: typeof form & { id?: string }) => {
      if (payload.id) {
        return apiFetch(`/leads.php?id=${payload.id}`, {
          method: 'PUT', body: JSON.stringify(payload),
        });
      }
      return apiFetch('/leads.php', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      toast({ title: editId ? 'แก้ไข lead สำเร็จ' : 'เพิ่ม lead สำเร็จ' });
    },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/leads.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => { invalidate(); toast({ title: 'อัปเดตสถานะแล้ว' }); },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/leads.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast({ title: 'ลบ lead แล้ว' }); },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const convertMutation = useMutation({
    mutationFn: ({ lead, target, company_id }: { lead: Lead; target: 'company' | 'opportunity'; company_id?: string }) =>
      apiFetch('/leads.php?action=convert', {
        method: 'POST',
        body: JSON.stringify({ id: lead.id, target, ...(company_id ? { company_id } : {}) }),
      }),
    onSuccess: (_d, vars) => {
      invalidate();
      setLinkState(null);
      toast({ title: vars.target === 'company' ? 'แปลงเป็นบริษัทแล้ว' : 'แปลงเป็น Opportunity แล้ว' });
    },
    onError: (e: ApiError, vars) => {
      // ชื่อบริษัทซ้ำ → เปิด dialog ให้เลือกเชื่อมกับบริษัทเดิม
      if (e?.duplicate && Array.isArray(e.matches) && e.matches.length > 0) {
        setLinkState({ lead: vars.lead, target: vars.target, matches: e.matches });
        return;
      }
      toast({ title: 'แปลงไม่สำเร็จ', description: e.message, variant: 'destructive' });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiFetch<{ updated: number }>('/leads.php?action=bulk_update', {
        method: 'POST', body: JSON.stringify({ ids, status }),
      }),
    onSuccess: (res) => {
      invalidate();
      setSelectedIds(new Set());
      toast({ title: `อัปเดต ${res.updated} รายการแล้ว` });
    },
    onError: (e: Error) => toast({ title: 'อัปเดตไม่สำเร็จ', description: e.message, variant: 'destructive' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ deleted: number }>('/leads.php?action=bulk_delete', {
        method: 'POST', body: JSON.stringify({ ids }),
      }),
    onSuccess: (res) => {
      invalidate();
      setSelectedIds(new Set());
      toast({ title: `ลบ ${res.deleted} รายการแล้ว` });
    },
    onError: (e: Error) => toast({ title: 'ลบไม่สำเร็จ', description: e.message, variant: 'destructive' }),
  });

  const aiSearchMutation = useMutation({
    mutationFn: (query: string) =>
      apiFetch<{ results: AiResult[] }>('/leads.php?action=ai_search', {
        method: 'POST', body: JSON.stringify({ query, channel: searchMode === 'social' ? 'social' : 'web' }),
      }),
    onSuccess: (data) => setAiResults(data.results || []),
    onError: (e: Error) => toast({ title: 'ค้นหาไม่สำเร็จ', description: e.message, variant: 'destructive' }),
  });

  const imapFetchMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ results: AiResult[] }>('/leads.php?action=imap_fetch', {
        method: 'POST', body: JSON.stringify({ year: Number(imapYear) }),
      }),
    onSuccess: (data) => {
      setAiResults(data.results || []);
      if ((data.results || []).length === 0) {
        toast({ title: 'ไม่พบอีเมลใหม่', description: 'อีเมลในช่วงที่เลือกถูกเพิ่มเป็น lead ไปแล้วทั้งหมด' });
      }
    },
    onError: (e: Error) => toast({ title: 'ดึงอีเมลไม่สำเร็จ', description: e.message, variant: 'destructive' }),
  });

  const saveAiResultMutation = useMutation({
    mutationFn: (r: AiResult) => apiFetch('/leads.php', {
      method: 'POST',
      body: JSON.stringify({
        name: r.name, contact_name: r.contact_name, department: r.department ?? '',
        email: r.email, phone: r.phone, website: r.website, address: r.address ?? '',
        business_type: r.business_type, company_type: discoverCompanyType, company_desc: r.company_desc, notes: r.notes ?? '',
        source: r.source || 'ai_search', ai_confidence: r.ai_confidence, source_note: r.source_note,
      }),
    }),
    onSuccess: () => { invalidate(); toast({ title: 'บันทึกเป็น lead แล้ว' }); },
    onError: (e: Error) => toast({ title: 'บันทึกไม่สำเร็จ', description: e.message, variant: 'destructive' }),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setFormOpen(true); };
  const openEdit = (lead: Lead) => {
    setEditId(lead.id);
    setForm({
      name: lead.name, contact_name: lead.contact_name ?? '', department: lead.department ?? '',
      email: lead.email ?? '', phone: lead.phone ?? '', website: lead.website ?? '',
      address: lead.address ?? '', business_type: lead.business_type ?? '',
      company_type: lead.company_type ?? 'customer',
      company_desc: lead.company_desc ?? '', notes: lead.notes ?? '',
    });
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!form.name.trim()) { toast({ title: 'กรุณาระบุชื่อ', variant: 'destructive' }); return; }
    saveMutation.mutate(editId ? { ...form, id: editId } : form);
  };

  const handleDelete = async (lead: Lead) => {
    const ok = await confirm({
      title: 'ลบ lead', description: `ต้องการลบ "${lead.name}" ใช่หรือไม่?`,
      confirmLabel: 'ลบ',
    });
    if (ok) deleteMutation.mutate(lead.id);
  };

  const handleConvert = async (lead: Lead, target: 'company' | 'opportunity') => {
    const label = target === 'company' ? 'บริษัท/ลูกค้า' : 'Opportunity ในไปป์ไลน์';
    const ok = await confirm({
      title: `แปลงเป็น${label}`,
      description: `แปลง "${lead.name}" เป็น${label}? การกระทำนี้จะตั้งสถานะ lead เป็น "แปลงแล้ว"`,
    });
    if (ok) convertMutation.mutate({ lead, target });
  };

  // ── Bulk selection ────────────────────────────────────────────────────────────
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    const ok = await confirm({
      title: 'ลบ leads ที่เลือก',
      description: `ต้องการลบ ${ids.length} รายการที่เลือกใช่หรือไม่?`,
      confirmLabel: 'ลบ',
    });
    if (ok) bulkDeleteMutation.mutate(ids);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageShell
      title="ค้นหาลูกค้าใหม่"
      description="คลังรวม leads — ค้นหาจากอินเทอร์เน็ต กรอกเอง แล้วแปลงเป็นบริษัทหรือ Opportunity"
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Sparkles className="h-4 w-4 mr-2" /> เพิ่ม lead <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => openDiscover('web')}>
                <Globe className="h-4 w-4 mr-2" /> ค้นหาจากอินเทอร์เน็ต
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDiscover('social')}>
                <Share2 className="h-4 w-4 mr-2" /> ค้นจากโซเชียล (Social Selling)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCardOpen(true)}>
                <ScanLine className="h-4 w-4 mr-2" /> สแกนนามบัตร
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> นำเข้า CSV/Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDiscover('email')}>
                <Mail className="h-4 w-4 mr-2" /> ดึงจากกล่องอีเมล
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> เพิ่มเอง
          </Button>
        </>
      }
    >
      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { key: 'all', label: 'ทั้งหมด', value: leads.length, icon: Inbox },
          { key: 'new', label: STATUS_META.new.label, value: leads.filter((l) => l.status === 'new').length, icon: Sparkles },
          { key: 'contacted', label: STATUS_META.contacted.label, value: leads.filter((l) => l.status === 'contacted').length, icon: Mail },
          { key: 'qualified', label: STATUS_META.qualified.label, value: leads.filter((l) => l.status === 'qualified').length, icon: Target },
          { key: 'converted', label: STATUS_META.converted.label, value: leads.filter((l) => l.status === 'converted').length, icon: Building2 },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50',
              statusFilter === s.key && 'border-primary ring-1 ring-primary',
            )}
          >
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xl font-bold leading-none">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อ / อีเมล / เบอร์โทร"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแหล่งที่มา</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyTypeFilter} onValueChange={setCompanyTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภทบริษัท</SelectItem>
            {COMPANY_TYPES.map((ct) => (
              <SelectItem key={ct} value={ct}>{COMPANY_TYPE_META[ct].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">เลือก {selectedIds.size} รายการ</span>
          <div className="flex-1" />
          <Select
            value="__none__"
            onValueChange={(v) => { if (v !== '__none__') bulkStatusMutation.mutate({ ids: [...selectedIds], status: v }); }}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="เปลี่ยนสถานะเป็น..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" disabled>เปลี่ยนสถานะเป็น...</SelectItem>
              {Object.entries(STATUS_META)
                .filter(([k]) => k !== 'converted')
                .map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            ยกเลิกการเลือก
          </Button>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
            {bulkDeleteMutation.isPending
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Trash2 className="h-4 w-4 mr-1" />}
            ลบที่เลือก
          </Button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> กำลังโหลด...
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserSearch className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground mb-4">ยังไม่มี lead — เริ่มค้นหาลูกค้าใหม่จากอินเทอร์เน็ต</p>
          <Button onClick={() => { setAiResults(null); setAiQuery(''); setAiOpen(true); }}>
            <Sparkles className="h-4 w-4 mr-2" /> ค้นหาจากอินเทอร์เน็ต
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="เลือกทั้งหมด"
                  />
                </TableHead>
                <TableHead>บริษัท</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead className="hidden md:table-cell">ผู้ติดต่อ</TableHead>
                <TableHead className="hidden lg:table-cell">ติดต่อ</TableHead>
                <TableHead>แหล่งที่มา</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const meta = STATUS_META[lead.status] ?? STATUS_META.new;
                const converted = lead.status === 'converted';
                return (
                  <TableRow key={lead.id} data-state={selectedIds.has(lead.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleOne(lead.id)}
                        aria-label={`เลือก ${lead.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{lead.name}</div>
                      {lead.business_type && (
                        <div className="text-xs text-muted-foreground">{lead.business_type}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', COMPANY_TYPE_META[lead.company_type || 'customer']?.className)}>
                        {COMPANY_TYPE_META[lead.company_type || 'customer']?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>{lead.contact_name || '—'}</div>
                      {lead.department && (
                        <div className="text-xs text-muted-foreground">{lead.department}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {lead.email || lead.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{SOURCE_LABELS[lead.source] ?? lead.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', meta.className)}>
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(lead)}>
                            <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                          </DropdownMenuItem>
                          {!converted && (
                            <>
                              <DropdownMenuItem onClick={() => statusMutation.mutate({ id: lead.id, status: 'contacted' })}>
                                ทำเครื่องหมาย: ติดต่อแล้ว
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => statusMutation.mutate({ id: lead.id, status: 'qualified' })}>
                                ทำเครื่องหมาย: ผ่านคุณสมบัติ
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleConvert(lead, 'company')}>
                                <Building2 className="h-4 w-4 mr-2" /> แปลงเป็นบริษัท
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleConvert(lead, 'opportunity')}>
                                <Target className="h-4 w-4 mr-2" /> แปลงเป็น Opportunity
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(lead)}>
                            <Trash2 className="h-4 w-4 mr-2" /> ลบ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'แก้ไข lead' : 'เพิ่ม lead'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input placeholder="ชื่อบริษัท / ลูกค้า *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">ประเภทบริษัท</label>
              <Select value={form.company_type} onValueChange={(v) => setForm({ ...form, company_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>{COMPANY_TYPE_META[ct].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="ชื่อผู้ติดต่อ" value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              <Input placeholder="ฝ่าย / แผนก" value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="อีเมล" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="เบอร์โทร" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="เว็บไซต์" value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <Input placeholder="ประเภทธุรกิจ" value={form.business_type}
                onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
            </div>
            <Textarea placeholder="ที่อยู่" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Textarea placeholder="รายละเอียด" value={form.company_desc}
              onChange={(e) => setForm({ ...form, company_desc: e.target.value })} />
            <Textarea placeholder="โน้ต" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>ยกเลิก</Button>
            <Button onClick={submitForm} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discover dialog (web / social / email) */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {searchMode === 'email' ? 'ดึง leads จากกล่องอีเมล'
                : searchMode === 'social' ? 'ค้นหาลูกค้าใหม่จากโซเชียล'
                : 'ค้นหาลูกค้าใหม่จากอินเทอร์เน็ต'}
            </DialogTitle>
            <DialogDescription>
              {searchMode === 'email'
                ? 'ดึงผู้ส่งอีเมลจากกล่องอีเมล (IMAP) มาเป็น lead — เลือกปีแล้วดึงทั้งปีให้ครบ ระบบจะตัดอีเมลซ้ำและที่เป็น lead อยู่แล้วออก รวมหลายฉบับของผู้ส่งคนเดียวกันเพื่อเก็บข้อมูลให้ครบที่สุด แล้วใช้ AI สกัดฟิลด์และสรุปเนื้อความให้'
                : searchMode === 'social'
                ? 'ใส่ชื่อ/อุตสาหกรรม/บทบาท ระบบจะใช้ AI ค้นจากโปรไฟล์สาธารณะบนโซเชียลและเว็บ'
                : 'ใส่คีย์เวิร์ด ชื่อบริษัท หรืออุตสาหกรรม ระบบจะใช้ AI ค้นหารายชื่อให้'}
            </DialogDescription>
          </DialogHeader>

          {searchMode === 'email' ? (
            <div className="flex items-end gap-2">
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">เลือกปี</label>
                <Select value={imapYear} onValueChange={setImapYear}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <SelectItem key={y} value={String(y)}>ปี {y + 543}</SelectItem>
                    ))}
                    <SelectItem value="0">ทั้งหมด</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => imapFetchMutation.mutate()}
                disabled={imapFetchMutation.isPending}
              >
                {imapFetchMutation.isPending
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Inbox className="h-4 w-4 mr-2" />}
                ดึงอีเมล
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder={searchMode === 'social' ? 'เช่น ผู้จัดการฝ่ายจัดซื้อ อุตสาหกรรมอาหาร' : 'เช่น บริษัทโลจิสติกส์ในกรุงเทพ'}
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && aiQuery.trim()) aiSearchMutation.mutate(aiQuery.trim()); }}
              />
              <Button
                onClick={() => aiQuery.trim() && aiSearchMutation.mutate(aiQuery.trim())}
                disabled={aiSearchMutation.isPending || !aiQuery.trim()}
              >
                {aiSearchMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {aiResults && aiResults.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">บันทึกเป็นประเภท</span>
              <Select value={discoverCompanyType} onValueChange={setDiscoverCompanyType}>
                <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>{COMPANY_TYPE_META[ct].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {(aiSearchMutation.isPending || imapFetchMutation.isPending) && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {searchMode === 'email' ? 'กำลังดึงอีเมลและสรุปด้วย AI...' : 'AI กำลังค้นหา...'}
              </div>
            )}
            {aiResults && aiResults.length === 0 && !aiSearchMutation.isPending && !imapFetchMutation.isPending && (
              <p className="text-center py-10 text-muted-foreground">ไม่พบผลลัพธ์</p>
            )}
            {aiResults?.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.contact_name, r.department, r.business_type, r.email, r.phone].filter(Boolean).join(' · ')}
                  </div>
                  {r.website && <div className="text-xs mt-1 truncate text-blue-600">{r.website}</div>}
                  {r.address && <div className="text-xs mt-0.5 text-muted-foreground truncate">📍 {r.address}</div>}
                  {r.company_desc && <div className="text-xs mt-1">{r.company_desc}</div>}
                </div>
                <Button size="sm" variant="outline"
                  onClick={() => saveAiResultMutation.mutate(r)}
                  disabled={saveAiResultMutation.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> บันทึก
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Link to existing company dialog (เมื่อชื่อบริษัทซ้ำ) */}
      <Dialog open={!!linkState} onOpenChange={(v) => { if (!v) setLinkState(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>มีบริษัทชื่อนี้อยู่แล้ว</DialogTitle>
            <DialogDescription>
              ไม่สามารถสร้างบริษัทใหม่ชื่อ "{linkState?.lead.name}" ได้เพราะมีอยู่แล้ว —
              เลือกบริษัทเดิมเพื่อเชื่อม{linkState?.target === 'opportunity' ? 'แล้วสร้าง Opportunity' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {linkState?.matches.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => linkState && convertMutation.mutate({ lead: linkState.lead, target: linkState.target, company_id: c.id })}
                  disabled={convertMutation.isPending}
                >
                  {convertMutation.isPending
                    ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    : <Building2 className="h-4 w-4 mr-1" />}
                  เชื่อม
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkState(null)}>ยกเลิก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import + business card dialogs */}
      <ImportLeadsDialog open={importOpen} onOpenChange={setImportOpen} onImported={invalidate} />
      <ScanCardLeadDialog open={cardOpen} onOpenChange={setCardOpen} onSaved={invalidate} />
    </PageShell>
  );
}
