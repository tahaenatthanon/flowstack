import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageShell from '@/components/PageShell';
import CompanyCombobox from '@/components/CompanyCombobox';
import RichTextEditor from '@/components/RichTextEditor';
import SafeHtml from '@/components/SafeHtml';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, apiUpload, getFileUrl } from '@/lib/api';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/lib/labels';
import {
  LifeBuoy, Plus, Search, X, FileText, Upload, Download, Trash2,
  Phone, Mail, AlertTriangle, CheckCircle2, Clock, Calendar,
  RefreshCw, Paperclip, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Building2, Shield, Cpu, Package, Headphones, Filter,
  Sparkles, Settings2, BookOpen, TrendingUp, Zap, Check, ChevronsUpDown,
} from 'lucide-react';
import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { differenceInDays, format, parseISO, isValid } from 'date-fns';
import { safeFmt } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useProjects';

async function uploadFile(formData: FormData) {
  return apiUpload('/support-upload.php', formData);
}

// ── Labels / Colors ─────────────────────────────────────────────────────────
const TICKET_STATUS: Record<string, { label: string; color: string }> = {
  'open':        { label: TICKET_STATUS_LABELS.open,        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'in-progress': { label: TICKET_STATUS_LABELS['in-progress'], color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'pending':     { label: TICKET_STATUS_LABELS.pending,     color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'resolved':    { label: TICKET_STATUS_LABELS.resolved,    color: 'bg-green-100 text-green-700 border-green-200' },
  'closed':      { label: TICKET_STATUS_LABELS.closed,      color: 'bg-gray-100 text-gray-600 border-gray-200' },
};
const TICKET_PRIORITY: Record<string, { label: string; color: string }> = {
  'critical': { label: TICKET_PRIORITY_LABELS.critical, color: 'bg-red-500 text-white' },
  'high':     { label: TICKET_PRIORITY_LABELS.high,     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  'medium':   { label: TICKET_PRIORITY_LABELS.medium,   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  'low':      { label: TICKET_PRIORITY_LABELS.low,      color: 'bg-gray-100 text-gray-600 border-gray-200' },
};
const TICKET_TYPE: Record<string, string> = {
  incident: 'Incident', request: 'Service Request', problem: 'Problem', change: 'Change',
};
const CHANNEL_ICON: Record<string, React.ElementType> = {
  phone: Phone, email: Mail, 'walk-in': Building2, line: MessageSquare, system: Headphones,
};
const CONTRACT_TYPE: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  hardware: { label: 'Hardware MA', icon: Cpu,      color: 'text-blue-600 bg-blue-50' },
  software: { label: 'Software MA', icon: Package,  color: 'text-violet-600 bg-violet-50' },
  ma:       { label: 'MA / บำรุงรักษา', icon: Shield, color: 'text-teal-600 bg-teal-50' },
  support:  { label: 'Support',     icon: Headphones, color: 'text-amber-600 bg-amber-50' },
  other:    { label: 'อื่นๆ',       icon: FileText,  color: 'text-gray-600 bg-gray-50' },
};
const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  active:    { label: 'ใช้งาน',     color: 'bg-green-100 text-green-700 border-green-200' },
  expiring:  { label: 'ใกล้หมดอายุ', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  expired:   { label: 'หมดอายุ',    color: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'ยกเลิก',     color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function fileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('word')) return '📝';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
  return '📎';
}

// ── File Uploader ─────────────────────────────────────────────────────────────
function FileUploader({ ticketId, contractId, onUploaded }: {
  ticketId?: string; contractId?: string; onUploaded: () => void;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      if (ticketId)   fd.append('ticket_id', ticketId);
      if (contractId) fd.append('contract_id', contractId);
      try { await uploadFile(fd); ok++; } catch (e: any) { toast({ title: `${file.name}: ${e.message}`, variant: 'destructive' }); }
    }
    setUploading(false);
    if (ok > 0) { toast({ title: `อัปโหลดสำเร็จ ${ok} ไฟล์` }); onUploaded(); }
  };

  return (
    <div
      className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
    >
      <input ref={ref} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      {uploading
        ? <><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-1" />กำลังอัปโหลด...</>
        : <><Upload className="h-5 w-5 mx-auto mb-1" />คลิกหรือลากไฟล์มาวาง (สูงสุด 20MB / ไฟล์)</>
      }
    </div>
  );
}

// ── Attachments list ──────────────────────────────────────────────────────────
function AttachmentList({ attachments }: { attachments: any[] }) {
  if (!attachments?.length) return <p className="text-xs text-muted-foreground">ไม่มีไฟล์แนบ</p>;
  return (
    <div className="space-y-1.5">
      {attachments.map((a) => (
        <a key={a.id} href={getFileUrl(a.file_path)} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
          <span>{fileIcon(a.mime_type)}</span>
          <span className="flex-1 truncate font-medium">{a.file_name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{fileSize(a.file_size)}</span>
          <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </a>
      ))}
    </div>
  );
}

// ── STATUS badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; color: string }> }) {
  const c = map[status] ?? { label: status, color: 'bg-muted text-muted-foreground' };
  return <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', c.color)}>{c.label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TICKET DETAIL DIALOG
// ─────────────────────────────────────────────────────────────────────────────
interface AiSuggestion {
  category_suggested?: string;
  priority_suggested?: 'critical'|'high'|'medium'|'low';
  priority_reason?: string;
  first_response_th?: string;
  checklist?: string[];
  estimated_hours?: number;
}

function TicketDetailDialog({ ticketId, onClose, onDelete }: { ticketId: string; onClose: () => void; onDelete?: (id: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [comment, setComment]     = useState('');
  const [isInternal, setInternal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState({ title: '', description: '', type: '', priority: '' });
  const [custOpen, setCustOpen]   = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [resolutionDraft, setResolutionDraft] = useState('');
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => apiFetch(`/support-tickets.php?id=${ticketId}`),
  });

  // Lookup data for editable fields
  const { data: users = [] } = useQuery({ queryKey: ['users-active'], queryFn: () => apiFetch('/users.php?active_only=1') });

  const companyId = ticket?.company_id ?? '';
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-company', companyId],
    queryFn: () => companyId ? apiFetch(`/customers.php?company_id=${companyId}&active_only=1`) : Promise.resolve([]),
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-all'],
    queryFn: () => apiFetch('/support-contracts.php'),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateTicket = useMutation({
    mutationFn: (body: any) => apiFetch(`/support-tickets.php?id=${ticketId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: 'อัปเดตสำเร็จ' });
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['tickets-all'] });
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const addComment = useMutation({
    mutationFn: () => apiFetch(`/support-tickets.php?action=comment&ticket_id=${ticketId}`, {
      method: 'POST', body: JSON.stringify({ comment, is_internal: isInternal ? 1 : 0 }),
    }),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['ticket', ticketId] }); },
  });

  const updateComment = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      apiFetch(`/support-tickets.php?action=comment&comment_id=${commentId}`, {
        method: 'PUT', body: JSON.stringify({ comment: content }),
      }),
    onSuccess: () => {
      toast({ title: 'อัปเดตความคิดเห็นแล้ว' });
      setEditCommentId(null);
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
    onError: (e: any) => toast({ title: 'อัปเดตล้มเหลว', description: e.message, variant: 'destructive' }),
  });

  // ── Add to Knowledge Base mutation ─────────────────────────────────────────
  const addToKb = useMutation({
    mutationFn: () => apiFetch('/knowledge-base.php', {
      method: 'POST',
      body: JSON.stringify({
        title: ticket.title,
        content: `${ticket.description || ''}\n\n---\n**วิธีแก้ไข:** ${ticket.resolution || 'ยังไม่ได้บันทึก'}\n\nที่มา: ${ticket.ticket_number}`,
        category: 'จาก Ticket',
      }),
    }),
    onSuccess: () => toast({ title: 'เพิ่มเข้า Knowledge Base สำเร็จ' }),
    onError: (e: any) => toast({ title: 'เพิ่ม KB ล้มเหลว', description: e.message, variant: 'destructive' }),
  });

  // ── AI Suggest: call /api/support-tickets.php?action=ai-suggest ───────────
  const aiSuggest = useMutation<AiSuggestion, Error>({
    mutationFn: () => apiFetch(`/support-tickets.php?action=ai-suggest&ticket_id=${ticketId}`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'AI วิเคราะห์เสร็จแล้ว' });
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
    onError: (e) => toast({
      title: 'AI วิเคราะห์ล้มเหลว',
      description: e.message || 'ตรวจสอบการตั้งค่า AI ใน Admin > AI Settings',
      variant: 'destructive',
    }),
  });

  // Parse cached AI suggestion if present
  let aiCached: AiSuggestion | null = null;
  if (ticket?.ai_suggested_json) {
    try { aiCached = typeof ticket.ai_suggested_json === 'string' ? JSON.parse(ticket.ai_suggested_json) : ticket.ai_suggested_json; }
    catch { aiCached = null; }
  }
  const aiResult: AiSuggestion | null = aiSuggest.data ?? aiCached;

  if (isLoading || !ticket) return null;

  const sla = ticket.sla_breached === '1';

  // Helper: update a single field immediately on select change
  const updateField = (field: string, value: string) =>
    updateTicket.mutate({ [field]: value || null });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full sm:max-w-[98vw] w-full sm:max-h-[98dvh] overflow-y-auto sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <span className="text-muted-foreground font-mono text-sm">{ticket.ticket_number}</span>
            <span className="flex-1 truncate">{ticket.title}</span>
            {sla && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠ SLA Breach</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {/* Left: details */}
          <div className="md:col-span-2 space-y-4">
            {/* Meta badges */}
            <div className="flex flex-wrap gap-2">
              {editMode ? (
                <Select value={editForm.priority} onValueChange={(v) => setEditForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TICKET_PRIORITY).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <StatusBadge status={ticket.priority} map={TICKET_PRIORITY} />
              )}
              <StatusBadge status={ticket.status} map={TICKET_STATUS} />
              {editMode ? (
                <Select value={editForm.type} onValueChange={(v) => setEditForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TICKET_TYPE).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs border rounded-full px-2 py-0.5 text-muted-foreground">{TICKET_TYPE[ticket.type] ?? ticket.type}</span>
              )}
            </div>

            {editMode ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">หัวข้อ</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">รายละเอียด</Label>
                  <Textarea value={editForm.description} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} className="text-sm" />
                </div>
                <Button size="sm" onClick={() => {
                  updateTicket.mutate(editForm, { onSuccess: () => setEditMode(false) });
                }} disabled={updateTicket.isPending || !editForm.title.trim()}>
                  {updateTicket.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </Button>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="whitespace-pre-wrap text-sm">{ticket.description || '(ไม่มีรายละเอียด)'}</p>
              </div>
            )}

            {/* Resolution */}
            {(ticket.status === 'resolved' || ticket.status === 'closed') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">วิธีแก้ไข</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setResolutionDraft(resolutionDraft ? '' : (ticket.resolution || ''))}
                  >
                    {resolutionDraft ? 'ยกเลิก' : 'แก้ไข'}
                  </Button>
                </div>
                {resolutionDraft ? (
                  <div className="space-y-2">
                    <RichTextEditor
                      value={resolutionDraft}
                      onChange={setResolutionDraft}
                      placeholder="วิธีแก้ไข..."
                      ticketId={ticketId}
                      minHeight="160px"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        updateTicket.mutate({ resolution: resolutionDraft });
                        setResolutionDraft('');
                      }}
                      disabled={updateTicket.isPending}
                    >
                      {updateTicket.isPending ? 'กำลังบันทึก...' : 'บันทึกวิธีแก้ไข'}
                    </Button>
                  </div>
                ) : ticket.resolution ? (
                  <SafeHtml html={ticket.resolution} className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg p-3 text-sm prose prose-sm max-w-none prose-img:max-w-full prose-img:rounded-md prose-table:border-collapse prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:p-2 prose-a:text-primary" />
                ) : (
                  <p className="text-muted-foreground text-sm italic">ยังไม่ได้บันทึกวิธีแก้ไข</p>
                )}
                {ticket.resolution_note && (
                  <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 rounded-lg p-3 text-sm">
                    <span className="flex items-center gap-1 text-xs text-violet-600 font-medium mb-1">
                      <Sparkles className="h-3 w-3" />AI สรุปการแก้ไข
                    </span>
                    <SafeHtml html={ticket.resolution_note} className="whitespace-pre-wrap text-violet-900 dark:text-violet-100 prose prose-sm max-w-none" />
                  </div>
                )}
              </div>
            )}

            {/* Comments */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">กิจกรรม ({ticket.comments?.length ?? 0})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {ticket.comments?.map((c) => (
                  <div key={c.id} className={cn('rounded-lg p-3 text-sm', c.is_internal ? 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200' : 'bg-muted/40')}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{c.user_name}</span>
                      {c.is_internal && <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 rounded">Internal</span>}
                      <span className="text-[10px] text-muted-foreground ml-auto mr-1">{safeFmt(c.created_at, 'd MMM yy HH:mm')}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 shrink-0"
                        title={editCommentId === c.id ? 'ยกเลิก' : 'แก้ไข'}
                        onClick={() => {
                          if (editCommentId === c.id) {
                            setEditCommentId(null);
                          } else {
                            setEditCommentId(c.id);
                            setEditCommentContent(c.comment);
                          }
                        }}
                      >
                        {editCommentId === c.id ? <X className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      </Button>
                    </div>
                    {editCommentId === c.id ? (
                      <div className="space-y-2">
                        <RichTextEditor
                          value={editCommentContent}
                          onChange={setEditCommentContent}
                          placeholder="แก้ไขความคิดเห็น..."
                          ticketId={ticketId}
                          minHeight="80px"
                        />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditCommentId(null)}>
                            ยกเลิก
                          </Button>
                          <Button size="sm" className="h-6 text-xs"
                            onClick={() => updateComment.mutate({ commentId: c.id, content: editCommentContent })}
                            disabled={updateComment.isPending}>
                            {updateComment.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <SafeHtml html={c.comment} className="prose prose-sm max-w-none prose-img:max-w-full prose-img:rounded-md prose-table:border-collapse prose-th:border prose-th:border-border prose-th:p-1 prose-td:border prose-td:border-border prose-td:p-1 prose-a:text-primary" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-2">
                <RichTextEditor value={comment} onChange={setComment} placeholder="เพิ่ม comment..." ticketId={ticketId} minHeight="100px" />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={isInternal} onChange={(e) => setInternal(e.target.checked)} />
                    Internal note (ไม่แสดงลูกค้า)
                  </label>
                  <Button size="sm" onClick={() => addComment.mutate()} disabled={!comment.trim() || addComment.isPending}>
                    {addComment.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">ไฟล์แนบ</p>
              <AttachmentList attachments={ticket.attachments ?? []} />
              <div className="mt-2">
                <FileUploader ticketId={ticketId} onUploaded={() => qc.invalidateQueries({ queryKey: ['ticket', ticketId] })} />
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="space-y-3 text-xs">

            {/* Workflow */}
            <WorkflowInstanceCard entityType="support_ticket" entityId={ticketId} />

            {/* AI Assist */}
            <div className="rounded-lg border p-3 space-y-2 bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                  AI ช่วยจัดการ
                </p>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                  onClick={() => aiSuggest.mutate()}
                  disabled={aiSuggest.isPending}>
                  {aiSuggest.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {aiResult ? 'วิเคราะห์ใหม่' : 'ขอ AI วิเคราะห์'}
                </Button>
              </div>
              {!aiResult && !aiSuggest.isPending && (
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  ให้ AI แนะนำ priority, ขั้นตอนแก้ปัญหา และร่างข้อความตอบลูกค้าฉบับแรก
                  <span className="block mt-1 text-[10px] opacity-70">หากไม่ได้ผลลัพธ์ กรุณาตั้งค่า AI ใน Admin &gt; AI Settings</span>
                </p>
              )}
              {aiResult && (
                <div className="space-y-2">
                  {aiResult.priority_suggested && aiResult.priority_suggested !== ticket.priority && (
                    <div className="flex items-center justify-between bg-white/60 dark:bg-black/20 rounded p-1.5">
                      <span className="text-[11px]">
                        แนะนำ priority: <strong className="text-violet-700">{TICKET_PRIORITY[aiResult.priority_suggested]?.label ?? aiResult.priority_suggested}</strong>
                      </span>
                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                        onClick={() => updateTicket.mutate({ priority: aiResult.priority_suggested })}>
                        ใช้
                      </Button>
                    </div>
                  )}
                  {aiResult.priority_reason && (
                    <p className="text-[10px] text-muted-foreground italic">{aiResult.priority_reason}</p>
                  )}
                  {aiResult.first_response_th && (
                    <div className="bg-white/60 dark:bg-black/20 rounded p-2 space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground">ข้อความตอบลูกค้า</p>
                      <SafeHtml html={aiResult.first_response_th} className="text-[11px] prose prose-sm max-w-none prose-img:max-w-full prose-img:rounded-md prose-table:border-collapse prose-th:border prose-th:border-border prose-th:p-1 prose-td:border prose-td:border-border prose-td:p-1 prose-a:text-primary" />
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 w-full"
                        onClick={() => {
                          setComment(aiResult.first_response_th!);
                          toast({ title: 'นำข้อความเข้าช่อง comment แล้ว' });
                        }}>
                        วางในช่อง comment
                      </Button>
                    </div>
                  )}
                  {aiResult.checklist && aiResult.checklist.length > 0 && (
                    <div className="bg-white/60 dark:bg-black/20 rounded p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">ขั้นตอนแนะนำ</p>
                      <ul className="space-y-0.5 list-disc list-inside text-[11px]">
                        {aiResult.checklist.map((s, i) => <li key={i}><SafeHtml html={s} as="span" className="prose prose-sm max-w-none" /></li>)}
                      </ul>
                    </div>
                  )}
                  {aiResult.estimated_hours !== undefined && (
                    <p className="text-[10px] text-muted-foreground">
                      ประเมินเวลา: <strong>{aiResult.estimated_hours}</strong> ชั่วโมง
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Linked Task */}
            {ticket.task_id && (
              <div className="rounded-lg border p-3 space-y-1 bg-amber-50/50 dark:bg-amber-950/10">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-600" />
                  งานที่ผูกอัตโนมัติ
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ระบบสร้างงาน <code className="text-[10px] bg-muted px-1 rounded">interrupt</code> ใน
                  ปฏิทินทีม เมื่อ ticket เปลี่ยนเป็น "กำลังดำเนินการ" — ปิด ticket จะ mark งานเสร็จ + บันทึก actual_hours
                </p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">task: {ticket.task_id}</p>
              </div>
            )}

            {/* Status */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="font-semibold text-sm">อัปเดตสถานะ</p>
              <Select value={newStatus || ticket.status} onValueChange={setNewStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TICKET_STATUS).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {newStatus && newStatus !== ticket.status && (
                <Button size="sm" className="w-full h-7 text-xs"
                  onClick={() => updateTicket.mutate({ status: newStatus })}
                  disabled={updateTicket.isPending}>
                  ยืนยันเปลี่ยนสถานะ
                </Button>
              )}
            </div>

            {/* Assignee — editable select */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="font-semibold text-sm">มอบหมายให้</p>
              <Select
                value={ticket.assigned_to || '__none__'}
                onValueChange={(v) => updateField('assigned_to', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="ยังไม่ระบุ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ยังไม่ระบุ —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ticket.assignee_name && (
                <p className="text-muted-foreground">ปัจจุบัน: <strong>{ticket.assignee_name}</strong></p>
              )}
            </div>

            {/* Company + Customer — editable */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="font-semibold text-sm">ลูกค้า</p>

              <div>
                <p className="text-muted-foreground mb-1">บริษัท</p>
                <CompanyCombobox
                  value={ticket.company_id || ''}
                  onChange={(id) => updateField('company_id', id === 'none' ? '' : id)}
                  placeholder="ค้นหาบริษัท..."
                />
              </div>

              <div>
                <p className="text-muted-foreground mb-1">ผู้ติดต่อ</p>
                <Popover open={custOpen} onOpenChange={setCustOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={!ticket.company_id}
                      className="h-8 w-full justify-between text-xs font-normal"
                    >
                      {ticket.customer_id
                        ? <span className="truncate">{customers.find(c => c.id === ticket.customer_id)?.first_name} {customers.find(c => c.id === ticket.customer_id)?.last_name}</span>
                        : <span className="text-muted-foreground">{ticket.company_id ? 'เลือกผู้ติดต่อ' : 'เลือกบริษัทก่อน'}</span>
                      }
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={true}>
                      <CommandInput placeholder="ค้นหาผู้ติดต่อ..." className="h-8 text-xs" />
                      <CommandList>
                        <CommandEmpty>ไม่พบผู้ติดต่อ</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => { updateField('customer_id', ''); setCustOpen(false); }}
                            className="text-xs"
                          >
                            <Check className={cn('mr-2 h-3.5 w-3.5', !ticket.customer_id ? 'opacity-100' : 'opacity-0')} />
                            — ไม่ระบุ —
                          </CommandItem>
                          {customers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.first_name} ${c.last_name}`}
                              onSelect={() => { updateField('customer_id', c.id); setCustOpen(false); }}
                              className="text-xs"
                            >
                              <Check className={cn('mr-2 h-3.5 w-3.5', ticket.customer_id === c.id ? 'opacity-100' : 'opacity-0')} />
                              {c.first_name} {c.last_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <p className="text-muted-foreground mb-1">สัญญา</p>
                <Popover open={contractOpen} onOpenChange={setContractOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="h-8 w-full justify-between text-xs font-normal"
                    >
                      {ticket.contract_id
                        ? <span className="truncate">{contracts.find(c => c.id === ticket.contract_id)?.contract_number} — {contracts.find(c => c.id === ticket.contract_id)?.title}</span>
                        : <span className="text-muted-foreground">เลือกสัญญา</span>
                      }
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={true}>
                      <CommandInput placeholder="ค้นหาสัญญา..." className="h-8 text-xs" />
                      <CommandList>
                        <CommandEmpty>ไม่พบสัญญา</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => { updateField('contract_id', ''); setContractOpen(false); }}
                            className="text-xs"
                          >
                            <Check className={cn('mr-2 h-3.5 w-3.5', !ticket.contract_id ? 'opacity-100' : 'opacity-0')} />
                            — ไม่ระบุ —
                          </CommandItem>
                          {contracts.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.contract_number} ${c.title}`}
                              onSelect={() => { updateField('contract_id', c.id); setContractOpen(false); }}
                              className="text-xs"
                            >
                              <Check className={cn('mr-2 h-3.5 w-3.5', ticket.contract_id === c.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="truncate">{c.contract_number} — {c.title}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Static info */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="font-semibold text-sm mb-2">ข้อมูล</p>
              <InfoRow label="ผู้แจ้ง"    value={ticket.reported_by || '-'} />
              <InfoRow label="โทร"        value={ticket.reporter_phone || '-'} />
              <InfoRow label="SLA"        value={`${ticket.sla_hours} ชม.`} />
              <InfoRow label="เวลาที่ใช้"  value={`${ticket.elapsed_hours} ชม.`} />
              <InfoRow label="เปิดเมื่อ"  value={safeFmt(ticket.created_at, 'd MMM yy HH:mm')} />
              {ticket.resolved_at && <InfoRow label="แก้ไขเมื่อ" value={safeFmt(ticket.resolved_at, 'd MMM yy HH:mm')} />}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 border-t pt-3 mt-2">
          {onDelete ? (
            <Button variant="outline" className="gap-2 text-destructive hover:text-destructive"
              onClick={async () => {
                if (await confirm({ title: 'ลบ Ticket', description: `ลบ ${ticket.ticket_number} ใช่หรือไม่?`, variant: 'destructive' })) {
                  onDelete(ticketId);
                  onClose();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />ลบรายการ
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2"
              onClick={() => addToKb.mutate()}
              disabled={addToKb.isPending}
            >
              {addToKb.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              เพิ่มเข้า Knowledge Base
            </Button>
            <Button variant="outline" className="gap-2"
              onClick={() => {
                if (!editMode) setEditForm({ title: ticket.title || '', description: ticket.description || '', type: ticket.type || '', priority: ticket.priority || '' });
                setEditMode(!editMode);
              }}
            >
              {editMode ? <><X className="h-4 w-4" />ยกเลิกแก้ไข</> : <><FileText className="h-4 w-4" />แก้ไขรายการ</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE TICKET DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function CreateTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => apiFetch('/companies.php') });
  const { data: users = [] }     = useQuery({ queryKey: ['users-active'], queryFn: () => apiFetch('/users.php?active_only=1') });

  const [form, setForm] = useState({
    title: '', description: '', type: 'incident', priority: 'medium', channel: 'phone',
    reported_by: '', reporter_phone: '', reporter_email: '',
    company_id: '', customer_id: '', contract_id: '', assigned_to: '', project_id: '',
  });
  const { data: allProjects = [] } = useProjects();
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Load customers when company changes
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-company', form.company_id],
    queryFn: () => form.company_id
      ? apiFetch(`/customers.php?company_id=${form.company_id}&active_only=1`)
      : Promise.resolve([]),
    enabled: true,
  });

  // Load contracts filtered by company
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-for-company', form.company_id],
    queryFn: () => form.company_id
      ? apiFetch(`/support-contracts.php?company_id=${form.company_id}`)
      : apiFetch('/support-contracts.php'),
  });

  // Reset customer/contract when company changes
  const handleCompanyChange = (v: string) => {
    const val = v === '__none__' ? '' : v;
    setForm((p) => ({ ...p, company_id: val, customer_id: '', contract_id: '' }));
  };

  // Files queued for upload after ticket creation
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingRef = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: () => apiFetch('/support-tickets.php', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async (d) => {
      // Upload any queued files
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('ticket_id', d.id);
          try { await uploadFile(fd); } catch { /* ignore individual upload errors */ }
        }
      }
      toast({ title: `สร้าง Ticket ${d.ticket_number} สำเร็จ` });
      onCreated(d.id);
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setPendingFiles((prev) => [...prev, ...Array.from(files)]);
  };
  const removeFile = (i: number) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-heading">สร้าง Ticket ใหม่</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">

            {/* Title */}
            <div className="col-span-2">
              <Label>หัวข้อปัญหา <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="สรุปปัญหาสั้นๆ" />
            </div>

            {/* Type */}
            <div>
              <Label>ประเภท</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="request">Service Request</SelectItem>
                  <SelectItem value="problem">Problem</SelectItem>
                  <SelectItem value="change">Change</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label>ความเร่งด่วน</Label>
              <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">🔴 วิกฤต (SLA 2 ชม.)</SelectItem>
                  <SelectItem value="high">🟠 สูง (SLA 4 ชม.)</SelectItem>
                  <SelectItem value="medium">🟡 ปานกลาง (SLA 8 ชม.)</SelectItem>
                  <SelectItem value="low">🟢 ต่ำ (SLA 24 ชม.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel */}
            <div>
              <Label>ช่องทางรับแจ้ง</Label>
              <Select value={form.channel} onValueChange={(v) => set('channel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">📞 โทรศัพท์</SelectItem>
                  <SelectItem value="email">📧 อีเมล</SelectItem>
                  <SelectItem value="walk-in">🚶 Walk-in</SelectItem>
                  <SelectItem value="line">💬 LINE</SelectItem>
                  <SelectItem value="system">🖥️ ระบบ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned to */}
            <div>
              <Label>มอบหมายให้</Label>
              <Select value={form.assigned_to || '__none__'} onValueChange={(v) => set('assigned_to', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="ยังไม่ระบุ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ยังไม่ระบุ —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company */}
            <div>
              <Label>บริษัทลูกค้า</Label>
              <CompanyCombobox
                value={form.company_id || ''}
                onChange={(id) => handleCompanyChange(id)}
                placeholder="ค้นหาบริษัท..."
              />
            </div>

            {/* Customer — only shown when company selected */}
            <div>
              <Label>ผู้ติดต่อ / ลูกค้า</Label>
              <Select
                value={form.customer_id || '__none__'}
                onValueChange={(v) => set('customer_id', v === '__none__' ? '' : v)}
                disabled={!form.company_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.company_id ? 'เลือกผู้ติดต่อ' : 'เลือกบริษัทก่อน'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{c.position ? ` (${c.position})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contract — filtered by company */}
            <div>
              <Label>สัญญา (ถ้ามี)</Label>
              <Select
                value={form.contract_id || '__none__'}
                onValueChange={(v) => set('contract_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="เลือกสัญญา" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.contract_number} — {c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project link */}
            <div className="col-span-2">
              <Label>โปรเจกต์ที่เกี่ยวข้อง (ถ้ามี)</Label>
              <Select
                value={form.project_id || '__none__'}
                onValueChange={(v) => set('project_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="เลือกโปรเจกต์" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {allProjects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reported by */}
            <div>
              <Label>ชื่อผู้แจ้ง</Label>
              <Input value={form.reported_by} onChange={(e) => set('reported_by', e.target.value)} placeholder="ชื่อ-นามสกุล" />
            </div>

            {/* Phone */}
            <div>
              <Label>เบอร์โทร</Label>
              <Input value={form.reporter_phone} onChange={(e) => set('reporter_phone', e.target.value)} placeholder="0xx-xxx-xxxx" />
            </div>

            {/* Email */}
            <div className="col-span-2">
              <Label>อีเมลผู้แจ้ง</Label>
              <Input type="email" value={form.reporter_email} onChange={(e) => set('reporter_email', e.target.value)} placeholder="email@example.com" />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label>รายละเอียดปัญหา</Label>
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
                placeholder="อธิบายรายละเอียดปัญหา ขั้นตอนที่เกิดเหตุ สิ่งที่คาดหวัง" />
            </div>

            {/* File attachment */}
            <div className="col-span-2">
              <Label className="mb-2 block">ไฟล์แนบ (อัปโหลดหลังสร้าง ticket)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-3 text-center text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => pendingRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              >
                <input ref={pendingRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                <Upload className="h-4 w-4 mx-auto mb-1" />
                คลิกหรือลากไฟล์มาวาง (สูงสุด 20MB / ไฟล์)
              </div>
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{fileSize(f.size)}</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
          <Button className="w-full" onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
            {create.isPending ? 'กำลังสร้าง...' : `สร้าง Ticket${pendingFiles.length > 0 ? ` + อัปโหลด ${pendingFiles.length} ไฟล์` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE / EDIT CONTRACT DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function ContractDialog({ contract, onClose, onSaved }: {
  contract?: any; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => apiFetch('/companies.php') });
  const isEdit = !!contract;

  const [form, setForm] = useState({
    title:               contract?.title              ?? '',
    contract_number:     contract?.contract_number    ?? '',
    type:                contract?.type               ?? 'support',
    status:              contract?.status             ?? 'active',
    company_id:          contract?.company_id         ?? '',
    customer_id:         contract?.customer_id        ?? '',
    vendor:              contract?.vendor             ?? '',
    contact_name:        contract?.contact_name       ?? '',
    contact_phone:       contract?.contact_phone      ?? '',
    contact_email:       contract?.contact_email      ?? '',
    start_date:          contract?.start_date         ?? format(new Date(), 'yyyy-MM-dd'),
    end_date:            contract?.end_date           ?? format(new Date(Date.now() + 365*24*60*60*1000), 'yyyy-MM-dd'),
    value:               contract?.value              ?? '',
    renewal_alert_days:  contract?.renewal_alert_days ?? '30',
    description:         contract?.description        ?? '',
    notes:               contract?.notes              ?? '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Customers for selected company
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-company', form.company_id],
    queryFn: () => form.company_id
      ? apiFetch(`/customers.php?company_id=${form.company_id}&active_only=1`)
      : Promise.resolve([]),
    enabled: true,
  });

  const handleCompanyChange = (v: string) => {
    const val = v === '__none__' ? '' : v;
    setForm((p) => ({ ...p, company_id: val, customer_id: '' }));
  };

  // Files queued for create mode
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingRef = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setPendingFiles((prev) => [...prev, ...Array.from(files)]);
  };
  const removeFile = (i: number) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));

  const save = useMutation({
    mutationFn: () => isEdit
      ? apiFetch(`/support-contracts.php?id=${contract.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : apiFetch('/support-contracts.php', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async (d) => {
      // Upload pending files (create mode)
      if (!isEdit && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('contract_id', d.id);
          try { await uploadFile(fd); } catch { /* ignore */ }
        }
      }
      toast({ title: isEdit ? 'อัปเดตสัญญาสำเร็จ' : `สร้างสัญญา ${d.contract_number} สำเร็จ` });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      onSaved();
    },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-heading">{isEdit ? 'แก้ไขสัญญา' : 'เพิ่มสัญญาใหม่'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">

            <div className="col-span-2">
              <Label>ชื่อสัญญา <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="ชื่อสัญญา / ขอบเขตงาน" />
            </div>

            <div>
              <Label>เลขที่สัญญา</Label>
              <Input value={form.contract_number} onChange={(e) => set('contract_number', e.target.value)} placeholder="(สร้างอัตโนมัติ)" />
            </div>

            <div>
              <Label>ประเภทสัญญา</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardware">🖥️ Hardware MA</SelectItem>
                  <SelectItem value="software">💾 Software MA</SelectItem>
                  <SelectItem value="ma">🔧 MA / บำรุงรักษา</SelectItem>
                  <SelectItem value="support">🎧 Support</SelectItem>
                  <SelectItem value="other">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Company */}
            <div>
              <Label>บริษัทลูกค้า</Label>
              <CompanyCombobox
                value={form.company_id || ''}
                onChange={(id) => handleCompanyChange(id)}
                placeholder="ค้นหาบริษัท..."
              />
            </div>

            {/* Customer */}
            <div>
              <Label>ผู้ติดต่อ</Label>
              <Select
                value={form.customer_id || '__none__'}
                onValueChange={(v) => set('customer_id', v === '__none__' ? '' : v)}
                disabled={!form.company_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.company_id ? 'เลือกผู้ติดต่อ' : 'เลือกบริษัทก่อน'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{c.position ? ` (${c.position})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vendor / ผู้ให้บริการ</Label>
              <Input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="ชื่อบริษัท vendor" />
            </div>

            <div>
              <Label>สถานะสัญญา</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">✅ ใช้งาน</SelectItem>
                  <SelectItem value="expiring">⚠️ ใกล้หมดอายุ</SelectItem>
                  <SelectItem value="expired">❌ หมดอายุ</SelectItem>
                  <SelectItem value="cancelled">🚫 ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>วันที่เริ่มต้น</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>

            <div>
              <Label>วันที่สิ้นสุด <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
            </div>

            <div>
              <Label>มูลค่าสัญญา (บาท)</Label>
              <Input type="number" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="0" />
            </div>

            <div>
              <Label>แจ้งเตือนก่อนหมดอายุ (วัน)</Label>
              <Input type="number" value={form.renewal_alert_days} onChange={(e) => set('renewal_alert_days', e.target.value)} min="1" max="365" />
            </div>

            <div>
              <Label>ชื่อผู้ติดต่อ (vendor)</Label>
              <Input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
            </div>

            <div>
              <Label>เบอร์โทร (vendor)</Label>
              <Input value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
            </div>

            <div className="col-span-2">
              <Label>อีเมล (vendor)</Label>
              <Input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
            </div>

            <div className="col-span-2">
              <Label>ขอบเขตงาน / รายละเอียด</Label>
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
            </div>

            <div className="col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
            </div>
          </div>

          {/* File attachments */}
          <div>
            <Label className="mb-2 block">ไฟล์แนบ</Label>
            {isEdit && <AttachmentList attachments={contract.attachments ?? []} />}
            {isEdit ? (
              <div className="mt-2">
                <FileUploader contractId={contract.id} onUploaded={onSaved} />
              </div>
            ) : (
              <>
                <div
                  className="border-2 border-dashed rounded-lg p-3 text-center text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => pendingRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                >
                  <input ref={pendingRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                  <Upload className="h-4 w-4 mx-auto mb-1" />
                  คลิกหรือลากไฟล์มาวาง
                </div>
                {pendingFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{fileSize(f.size)}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <Button className="w-full" onClick={() => save.mutate()} disabled={!form.title || !form.end_date || save.isPending}>
            {save.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้างสัญญา'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = parseISO(dateStr);
  if (!isValid(d)) return '-';
  const days = differenceInDays(new Date(), d);
  if (days === 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  if (days < 7)  return `${days} วันที่ผ่านมา`;
  if (days < 14) return '1 สัปดาห์ที่ผ่านมา';
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ที่ผ่านมา`;
  if (days < 60) return 'ประมาณ 1 เดือนที่ผ่านมา';
  return `${Math.floor(days / 30)} เดือนที่ผ่านมา`;
}

// ── Priority icon ────────────────────────────────────────────────────────────
function PriorityIcon({ priority, type }: { priority: string; type: string }) {
  if (priority === 'critical') return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
  if (priority === 'high')     return <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />;
  if (type === 'request')      return <Clock className="h-4 w-4 text-blue-400 shrink-0" />;
  return <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ── Migration dialog (admin only) ────────────────────────────────────────────
function MigrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [withAttachments, setWithAttachments] = useState(true);
  const [sel, setSel] = useState({ contracts: true, tickets: true, library: false });
  const toggle = (k: 'contracts' | 'tickets' | 'library') => setSel((s) => ({ ...s, [k]: !s[k] }));

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['support-migrate-status'],
    queryFn: () => apiFetch('/support-migrate.php?action=status'),
    enabled: open,
  });

  const buildTypes = () => {
    const types: string[] = [];
    if (sel.contracts) types.push('Contract', 'ContractExpired');
    if (sel.tickets)   types.push('Ticket');
    if (sel.library)   types.push('AttachFile');
    return types.join(',');
  };
  const nothingSelected = !sel.contracts && !sel.tickets && !sel.library;

  const run = useMutation({
    mutationFn: () => apiFetch('/support-migrate.php', {
      method: 'POST',
      body: JSON.stringify({ types: buildTypes(), attachments: withAttachments }),
    }),
    onSuccess: (res: any) => {
      const r = res?.report;
      const t = r?.types || {};
      const imported = Object.values(t).reduce((s: number, x: any) => s + (x?.imported || 0), 0);
      const lib = r?.attachfile?.rows ?? 0;
      toast({ title: 'ดึง/อัปเดตข้อมูลสำเร็จ', description: `นำเข้า ${imported} รายการ, ไฟล์แนบ ${r?.attachments ?? 0}${lib ? `, คู่มือ ${lib}` : ''}` });
      refetch();
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['tickets-all'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['contracts-all'] });
      qc.invalidateQueries({ queryKey: ['support-library'] });
    },
    onError: (e: any) => toast({ title: 'ดึงข้อมูลไม่สำเร็จ', description: e?.message || 'เกิดข้อผิดพลาด', variant: 'destructive' }),
  });

  const src = status?.source?.types || {};
  const db = status?.db || {};
  const srcContracts = (src.Contract || 0) + (src.ContractExpired || 0);

  const Row = ({ label, source, imported }: { label: string; source: number; imported: number }) => (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">ต้นทาง <b className="text-foreground">{source}</b></span>
        <span className="text-muted-foreground">นำเข้าแล้ว <b className={cn(source === imported ? 'text-green-600' : 'text-amber-600')}>{imported}</b></span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> ดึง / อัปเดตข้อมูลจาก Domino (support.nsf)</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">กำลังตรวจสอบสถานะ…</div>
        ) : (
          <div className="space-y-4">
            {status && !status.reachable && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                เชื่อมต่อต้นทางไม่ได้: {status.error || 'ไม่ทราบสาเหตุ'}
              </div>
            )}

            <div className="rounded-lg border p-3">
              <Row label="Tickets" source={src.Ticket || 0} imported={db.tickets || 0} />
              <Row label="สัญญา (Contract + Expired)" source={srcContracts} imported={db.contracts || 0} />
              <Row label="ไฟล์แนบ (Ticket)" source={src.AttachFile ?? 0} imported={db.attachments || 0} />
              <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                <span>Tickets ที่ผูกกับสัญญา</span><span><b className="text-foreground">{db.tickets_linked || 0}</b></span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">เลือกรายการที่ต้องการดึง</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={sel.contracts} onChange={() => toggle('contracts')} />
                สัญญา (Contract + Expired) — {srcContracts} รายการ
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={sel.tickets} onChange={() => toggle('tickets')} />
                Tickets — {src.Ticket || 0} รายการ
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={sel.library} onChange={() => toggle('library')} />
                คู่มือ (AttachFile) — {src.AttachFile || 0} ไฟล์
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer pl-6 text-muted-foreground">
                <input type="checkbox" className="h-4 w-4" checked={withAttachments} onChange={(e) => setWithAttachments(e.target.checked)}
                  disabled={!sel.contracts && !sel.tickets} />
                ดึงไฟล์แนบของ Ticket/สัญญาด้วย (ช้ากว่า)
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <p className="text-xs text-muted-foreground">การนำเข้าซ้ำจะอัปเดตข้อมูลเดิม (ไม่สร้างซ้ำ)</p>
              <Button onClick={() => run.mutate()} disabled={run.isPending || nothingSelected || (status && !status.reachable)} className="gap-2">
                {run.isPending
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> กำลังดึงข้อมูล…</>
                  : <><Download className="h-4 w-4" /> ดึง / อัปเดตข้อมูล</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Manual / handbook library tab (คู่มือ) ───────────────────────────────────
function LibraryTab() {
  const [search, setSearch] = useState('');
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['support-library', search],
    queryFn: () => apiFetch(`/support-library.php?${params}`),
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาคู่มือ (หัวข้อ / บริษัท / ชื่อไฟล์)..." className="pl-8" />
      </div>

      {isLoading
        ? <div className="text-center py-12 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        : docs.length === 0
          ? <div className="text-center py-16 text-muted-foreground"><BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>ไม่พบคู่มือ</p></div>
          : (
            <>
              <p className="text-xs text-muted-foreground">{docs.length} รายการ</p>
              <div className="rounded-lg border divide-y">
                {docs.map((d: any) => (
                  <a key={d.id} href={getFileUrl(d.file_path)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <span className="text-2xl shrink-0">{fileIcon(d.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{d.subject || d.file_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[d.company_name || d.company, d.file_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">{fileSize(d.file_size)}</span>
                      {d.doc_date && <span className="text-xs text-muted-foreground hidden md:block w-24 text-right">{safeFmt(d.doc_date, 'd MMM yy')}</span>}
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SupportPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const isAdmin = Number(user?.is_admin) === 1;
  const [showMigrate, setShowMigrate] = useState(false);

  // Ticket state
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatus, setTicketStatus] = useState('');
  const [ticketYear, setTicketYear] = useState('');
  const [ticketCompany, setTicketCompany] = useState('');
  const [ticketPage, setTicketPage] = useState(1);
  const TICKETS_PER_PAGE = 25;
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  // Contract state
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatus, setContractStatus] = useState('');
  const [contractType, setContractType] = useState('');
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [editContract, setEditContract] = useState<any | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [showContractFiltersMobile, setShowContractFiltersMobile] = useState(false);

  // ── Data queries ─────────────────────────────────────────────────────────
  const ticketParams = new URLSearchParams();
  if (ticketSearch)  ticketParams.set('search', ticketSearch);
  if (ticketStatus)  ticketParams.set('status', ticketStatus);
  if (ticketYear)    ticketParams.set('year', ticketYear);
  if (ticketCompany) ticketParams.set('company_id', ticketCompany);

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', ticketSearch, ticketStatus, ticketYear, ticketCompany],
    queryFn: () => apiFetch(`/support-tickets.php?${ticketParams}`),
  });

  // Reset to page 1 whenever any ticket filter changes.
  useEffect(() => { setTicketPage(1); }, [ticketSearch, ticketStatus, ticketYear, ticketCompany]);

  // Unfiltered for stat cards — always shows total counts regardless of active filters
  const { data: allTicketsRaw = [] } = useQuery({
    queryKey: ['tickets-all'],
    queryFn:  () => apiFetch('/support-tickets.php'),
  });

  const contractParams = new URLSearchParams();
  if (contractSearch) contractParams.set('search', contractSearch);
  if (contractStatus) contractParams.set('status', contractStatus);
  if (contractType)   contractParams.set('type', contractType);

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', contractSearch, contractStatus, contractType],
    queryFn: () => apiFetch(`/support-contracts.php?${contractParams}`),
  });

  const deleteTicket = useMutation({
    mutationFn: (id: string) => apiFetch(`/support-tickets.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'ลบ Ticket สำเร็จ' });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['tickets-all'] });
    },
  });
  const deleteContract = useMutation({
    mutationFn: (id: string) => apiFetch(`/support-contracts.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast({ title: 'ลบสัญญาสำเร็จ' }); qc.invalidateQueries({ queryKey: ['contracts'] }); },
  });

  // ── Available years (from all tickets' created_at) ────────────────────────
  const availableYears = Array.from(
    new Set(allTicketsRaw.map((t) => (t.created_at ? new Date(t.created_at).getFullYear() : null)).filter(Boolean) as number[])
  ).sort((a, b) => b - a);

  // ── Tickets: newest first, then paginated ─────────────────────────────────
  const sortedTickets = [...tickets].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
  const ticketTotalPages = Math.max(1, Math.ceil(sortedTickets.length / TICKETS_PER_PAGE));
  const currentPage = Math.min(ticketPage, ticketTotalPages);
  const allTickets   = sortedTickets.slice((currentPage - 1) * TICKETS_PER_PAGE, currentPage * TICKETS_PER_PAGE);
  const allContracts = contracts;
  const statsBase    = ticketYear
    ? allTicketsRaw.filter((t) => t.created_at && new Date(t.created_at).getFullYear() === Number(ticketYear))
    : allTicketsRaw;
  const countBy = (s: string) => statsBase.filter((t) => t.status === s).length;
  const stats = {
    total:      statsBase.length,
    open:       countBy('open'),
    inProgress: countBy('in-progress'),
    pending:    countBy('pending'),
    resolved:   countBy('resolved'),
    closed:     countBy('closed'),
    slaBreach:  statsBase.filter((t) => t.sla_breached === '1').length,
    // "ปิดงานแล้ว" = resolved + closed (for resolution-rate purposes)
    done:       countBy('resolved') + countBy('closed'),
  };

  const STATUS_FILTERS = [
    { label: 'ทั้งหมด',         value: '' },
    { label: 'เปิด',            value: 'open' },
    { label: 'กำลังดำเนินการ',  value: 'in-progress' },
    { label: 'รอดำเนินการ',     value: 'pending' },
    { label: 'แก้ไขแล้ว',       value: 'resolved' },
    { label: 'ปิดแล้ว',         value: 'closed' },
  ];

  // Status cards — full breakdown so every status is visible
  const STATUS_CARDS = [
    { key: 'total',      label: 'ทั้งหมด',        value: stats.total,      color: 'text-foreground' },
    { key: 'open',       label: 'เปิดอยู่',        value: stats.open,       color: 'text-blue-600' },
    { key: 'inProgress', label: 'กำลังดำเนินการ',  value: stats.inProgress, color: 'text-amber-500' },
    { key: 'pending',    label: 'รอดำเนินการ',     value: stats.pending,    color: 'text-purple-600' },
    { key: 'resolved',   label: 'แก้ไขแล้ว',       value: stats.resolved,   color: 'text-green-600' },
    { key: 'closed',     label: 'ปิดแล้ว',         value: stats.closed,     color: 'text-gray-600' },
    { key: 'slaBreach',  label: 'เกิน SLA',        value: stats.slaBreach,  color: stats.slaBreach > 0 ? 'text-red-500' : 'text-muted-foreground' },
  ];

  const filtersContent = (
    <>
      {STATUS_FILTERS.map((f) => (
        <button key={f.value}
          onClick={() => setTicketStatus(f.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            ticketStatus === f.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >{f.label}</button>
      ))}
    </>
  );

  const contractFiltersContent = (
    <Select value={contractStatus || '__all__'} onValueChange={(v) => setContractStatus(v === '__all__' ? '' : v)}>
      <SelectTrigger className="w-40"><SelectValue placeholder="สถานะ" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">ทุกสถานะ</SelectItem>
        {Object.entries(CONTRACT_STATUS).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <PageShell
      breadcrumbs={[{ label: 'Helpdesk', isCurrent: true }]}
      title="Helpdesk"
      description={`${allTicketsRaw.length} tickets ทั้งหมด`}
      actions={<>
        {isAdmin && (
          <Button variant="outline" className="gap-2" onClick={() => setShowMigrate(true)}>
            <Download className="h-4 w-4" />ดึง / อัปเดตข้อมูล
          </Button>
        )}
        <Button className="gap-2" onClick={() => setShowCreateTicket(true)}>
          <Plus className="h-4 w-4" />สร้าง Ticket
        </Button>
      </>}
    >
      {isAdmin && <MigrationDialog open={showMigrate} onOpenChange={setShowMigrate} />}

      {/* Stats cards — full status breakdown (reflects selected year) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {STATUS_CARDS.map((s) => {
          const filterVal = s.key === 'total' ? '' : (s.key === 'inProgress' ? 'in-progress' : s.key);
          const clickable = s.key !== 'slaBreach';
          return (
            <Card
              key={s.key}
              className={cn('border shadow-sm', clickable && 'cursor-pointer hover:border-primary/50 transition-colors',
                clickable && ticketStatus === filterVal && 'border-primary ring-1 ring-primary')}
              onClick={clickable ? () => setTicketStatus(filterVal) : undefined}
            >
              <CardContent className="pt-4 pb-3 px-3">
                <p className="text-[11px] text-muted-foreground mb-1 truncate">{s.label}</p>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="tickets">
        <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          <TabsList className="flex overflow-x-auto sm:grid sm:grid-cols-4 border-b rounded-none bg-transparent h-auto p-0 gap-0 w-full justify-start">
            <TabsTrigger value="tickets"
              className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">
              <Headphones className="h-4 w-4" />Tickets
            </TabsTrigger>
            <TabsTrigger value="ai"
              className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">
              <Sparkles className="h-4 w-4" />AI Insights
            </TabsTrigger>
            <TabsTrigger value="sla"
              className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">
              <Settings2 className="h-4 w-4" />SLA Policies
            </TabsTrigger>
            <TabsTrigger value="library"
              className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">
              <BookOpen className="h-4 w-4" />คู่มือ
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TICKETS TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="tickets" className="mt-4 space-y-4">
          {/* Search + Filter */}
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                <Input value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="ค้นหา ticket..." className="pl-8" />
              </div>
              <div className="hidden md:flex items-center gap-1 shrink-0 w-52">
                <CompanyCombobox value={ticketCompany} onChange={(id) => setTicketCompany(id)} placeholder="ทุกบริษัท" />
                {ticketCompany && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setTicketCompany('')} title="ล้างตัวกรองบริษัท">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select value={ticketYear || '__all__'} onValueChange={(v) => setTicketYear(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-28 shrink-0 gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="ปี" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทุกปี</SelectItem>
                  {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="shrink-0 sm:hidden"
                onClick={() => setShowFiltersMobile(v => !v)}>
                <Filter className="h-4 w-4" />
              </Button>
              <div className="hidden sm:flex gap-1 flex-wrap">
                {filtersContent}
              </div>
            </div>
            {showFiltersMobile && (
              <div className="sm:hidden flex flex-wrap items-center gap-1 pt-1 border-t">
                {filtersContent}
              </div>
            )}
            <div className="md:hidden flex items-center gap-1">
              <CompanyCombobox value={ticketCompany} onChange={(id) => setTicketCompany(id)} placeholder="ทุกบริษัท" />
              {ticketCompany && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setTicketCompany('')} title="ล้างตัวกรองบริษัท">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Ticket list */}
          {ticketsLoading
            ? <div className="text-center py-12 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
            : allTickets.length === 0
              ? <div className="text-center py-16 text-muted-foreground"><Headphones className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>ไม่มี Ticket</p></div>
              : (
                <div className="rounded-lg border divide-y">
                  {allTickets.map((t: any) => (
                    <div key={t.id}
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setOpenTicketId(t.id)}
                    >
                      <PriorityIcon priority={t.priority} type={t.type} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {[t.company_name, t.reported_by || (t.cust_first ? `${t.cust_first} ${t.cust_last}` : null)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {Number(t.attachment_count) > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground" title={`${t.attachment_count} ไฟล์แนบ`}>
                            <Paperclip className="h-3.5 w-3.5" />{t.attachment_count}
                          </span>
                        )}
                        {Number(t.comment_count) > 0 && (
                          <span className="hidden sm:flex items-center gap-0.5 text-xs text-muted-foreground" title={`${t.comment_count} ความคิดเห็น`}>
                            <MessageSquare className="h-3.5 w-3.5" />{t.comment_count}
                          </span>
                        )}
                        <StatusBadge status={t.priority} map={TICKET_PRIORITY} />
                        <StatusBadge status={t.status}   map={TICKET_STATUS}   />
                        <span className="text-xs text-muted-foreground hidden sm:block w-28 text-right">{relativeTime(t.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }

          {/* Pager */}
          {!ticketsLoading && sortedTickets.length > TICKETS_PER_PAGE && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                แสดง {(currentPage - 1) * TICKETS_PER_PAGE + 1}–{Math.min(currentPage * TICKETS_PER_PAGE, sortedTickets.length)} จาก {sortedTickets.length} รายการ
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="gap-1" disabled={currentPage <= 1}
                  onClick={() => setTicketPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />ก่อนหน้า
                </Button>
                <span className="text-sm px-2 tabular-nums">{currentPage} / {ticketTotalPages}</span>
                <Button variant="outline" size="sm" className="gap-1" disabled={currentPage >= ticketTotalPages}
                  onClick={() => setTicketPage((p) => Math.min(ticketTotalPages, p + 1))}>
                  ถัดไป<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── AI INSIGHTS TAB ─────────────────────────────────────────────── */}
        <TabsContent value="ai" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-violet-500" />AI แนะนำการจัดการ Ticket
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.slaBreach > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    ⚠️ มี <strong>{stats.slaBreach} ticket</strong> เกิน SLA — ควรมอบหมายทันที
                  </div>
                )}
                {stats.open > 3 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    📊 Ticket เปิดอยู่ {stats.open} รายการ — พิจารณาเพิ่มทีมช่วยจัดการ
                  </div>
                )}
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  💡 อัตราการปิดงานปัจจุบัน {stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0}% ของ tickets ทั้งหมด
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-green-500" />สรุปภาพรวม
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  { label: 'Ticket ทั้งหมด', value: statsBase.length },
                  { label: 'กำลังดำเนินการ', value: stats.inProgress },
                  { label: 'รอดำเนินการ', value: statsBase.filter(t => t.status === 'pending').length },
                  { label: 'ปิดแล้ว', value: statsBase.filter(t => t.status === 'closed').length },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center py-1 border-b last:border-0">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold">{r.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── SLA POLICIES (CONTRACTS) TAB ────────────────────────────────── */}
        <TabsContent value="sla" className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                <Input value={contractSearch} onChange={(e) => setContractSearch(e.target.value)}
                  placeholder="ค้นหาสัญญา..." className="pl-8" />
              </div>
              <Button variant="outline" size="icon" className="shrink-0 sm:hidden"
                onClick={() => setShowContractFiltersMobile(v => !v)}>
                <Filter className="h-4 w-4" />
              </Button>
              <div className="hidden sm:flex gap-2 items-center">
                {contractFiltersContent}
              </div>
              <Button variant="outline" className="gap-2 shrink-0" onClick={() => setShowCreateContract(true)}>
                <Plus className="h-4 w-4" />เพิ่มสัญญา
              </Button>
            </div>
            {showContractFiltersMobile && (
              <div className="sm:hidden flex flex-wrap items-center gap-2 pt-1 border-t">
                {contractFiltersContent}
              </div>
            )}
          </div>

          {contractsLoading
            ? <div className="text-center py-12 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
            : allContracts.length === 0
              ? <div className="text-center py-16 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>ไม่มีสัญญา</p></div>
              : (
                <div className="rounded-lg border divide-y">
                  {allContracts.map((c) => {
                    const ct = CONTRACT_TYPE[c.type] ?? CONTRACT_TYPE.other;
                    const CIcon = ct.icon;
                    const days = parseInt(c.days_until_expiry ?? '999');
                    return (
                      <div key={c.id} className={cn(
                        'flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors',
                        c.status === 'expired'  && 'bg-red-50/30',
                        c.status === 'expiring' && 'bg-amber-50/30',
                      )}>
                        <div className={cn('p-1.5 rounded-lg shrink-0', ct.color)}>
                          <CIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.company_name && `${c.company_name} · `}{c.contract_number}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={c.status} map={CONTRACT_STATUS} />
                          <span className={cn('text-xs', days < 0 ? 'text-red-600 font-medium' : days < 30 ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                            {days >= 0 ? `เหลือ ${days} วัน` : `เกิน ${Math.abs(days)} วัน`}
                          </span>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={async () => { const full = await apiFetch(`/support-contracts.php?id=${c.id}`); setEditContract(full); }}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={async () => { if (await confirm({ title: 'ลบสัญญา', description: 'ลบสัญญานี้?', variant: 'destructive' })) deleteContract.mutate(c.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          }
        </TabsContent>

        {/* ── LIBRARY TAB (คู่มือ) ─────────────────────────────────────────── */}
        <TabsContent value="library" className="mt-4">
          <LibraryTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showCreateTicket && (
        <CreateTicketDialog
          onClose={() => setShowCreateTicket(false)}
          onCreated={(id) => {
            setShowCreateTicket(false);
            setOpenTicketId(id);
            qc.invalidateQueries({ queryKey: ['tickets'] });
            qc.invalidateQueries({ queryKey: ['tickets-all'] });
          }}
        />
      )}
      {openTicketId && (
        <TicketDetailDialog
          ticketId={openTicketId}
          onClose={() => {
            setOpenTicketId(null);
            qc.invalidateQueries({ queryKey: ['tickets'] });
            qc.invalidateQueries({ queryKey: ['tickets-all'] });
          }}
          onDelete={(id) => deleteTicket.mutate(id)}
        />
      )}
      {showCreateContract && (
        <ContractDialog
          onClose={() => setShowCreateContract(false)}
          onSaved={() => { setShowCreateContract(false); qc.invalidateQueries({ queryKey: ['contracts'] }); }}
        />
      )}
      {editContract && (
        <ContractDialog
          contract={editContract}
          onClose={() => setEditContract(null)}
          onSaved={() => { setEditContract(null); qc.invalidateQueries({ queryKey: ['contracts'] }); }}
        />
      )}
    </PageShell>
  );
}
