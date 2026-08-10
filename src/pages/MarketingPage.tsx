import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { ContentItem } from '@/components/content/types';
import ScrollableKanban from '@/components/ScrollableKanban';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import ArticleEditor from '@/components/content/ArticleEditor';
import type { SeoFields } from '@/components/content/types';
import { emailTemplates } from '@/data/emailTemplates';
import { Loader2, Plus, Send, Eye, MousePointer, X, Search, Mail, Users, Pencil, Trash2, UserMinus, Copy, TrendingUp, TrendingDown, BarChart3, Building2, FileText, LayoutTemplate, Palette, Route } from 'lucide-react';
import AttributionTab from '@/components/marketing/AttributionTab';
import PullFromContentDialog from '@/components/content/dialogs/PullFromContentDialog';
import PageShell from '@/components/PageShell';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { apiFetch, APP_URL } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCustomers } from '@/hooks/useProjectData';
import {
  useEmailCampaigns,
  useEmailGroups,
  useEmailGroup,
  useCustomerEmailStats,
  useRecipientLog,
  useMailSettings,
  useCreateEmailCampaign,
  useUpdateEmailCampaign,
  useDeleteEmailCampaign,
  useCopyEmailCampaign,
  useSendEmailCampaign,

  useCreateEmailGroup,
  useUpdateEmailGroup,
  useDeleteEmailGroup,
  useAddGroupMembers,
  useRemoveGroupMember,
  type EmailCampaign,
  type EmailGroup,
  type GroupMember,
} from '@/hooks/useMarketing';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  company_business_type?: string;
}

const STATUS_CONFIG = {
  draft:     { label: 'ฉบับร่าง',   color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  scheduled: { label: 'กำหนดเวลา', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  sending:   { label: 'กำลังส่ง',   color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  sent:      { label: 'ส่งแล้ว',    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  cancelled: { label: 'ยกเลิก',     color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};


function CustomerList({
  customers,
  selected,
  onToggle,
  onToggleAll,
  searchValue,
  onSearchChange,
  placeholder = 'ค้นหาผู้ติดต่อ...',
  emptyText = 'ไม่พบผู้ติดต่อ',
  maxHeight = 'max-h-56',
}: {
  customers: Customer[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  maxHeight?: string;
}) {
  const allChecked = customers.length > 0 && customers.every(c => selected.has(c.id));
  const someChecked = customers.some(c => selected.has(c.id));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>
      <div className={`border rounded-lg overflow-y-auto ${maxHeight}`}>
        {customers.length === 0 ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground py-6">{emptyText}</div>
        ) : (
          <>
            {/* Select-all row */}
            <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30 sticky top-0">
              <Checkbox
                id="select-all"
                checked={allChecked}
                onCheckedChange={(v) => onToggleAll(customers.map(c => c.id), !!v)}
                className="shrink-0"
                data-state={!allChecked && someChecked ? 'indeterminate' : undefined}
              />
              <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                เลือกทั้งหมด ({customers.length} คน)
              </label>
            </div>
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-muted/40 cursor-pointer"
                onClick={() => onToggle(c.id)}
              >
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={() => onToggle(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.email}{c.company_name ? ` · ${c.company_name}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Server base URL (XAMPP port 80, no Vite :8080) — used to make upload paths absolute for email
function getServerBase(): string {
  try {
    const u = new URL(APP_URL);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return window.location.origin.replace(/:8080$/, '');
  }
}

// Make relative /uploads/ or /api/ paths absolute so images work in email clients
function makeUploadsAbsolute(html: string): string {
  const base = getServerBase();
  return html
    .replace(/src="\/uploads\//g, `src="${base}/uploads/`)
    .replace(/src='\/uploads\//g, `src='${base}/uploads/`)
    .replace(/src="\/flowstack\/uploads\//g, `src="${base}/uploads/`);
}

// Build email body from a ContentItem — structured as hero image → title → excerpt → body.
// Keeps relative /uploads/ paths for in-browser preview; call makeUploadsAbsolute() at send time.
function buildBodyFromContent(item: ContentItem): string {
  let bodyHtml = '';
  let excerpt = '';
  if (item.article_content) {
    try { const art = JSON.parse(item.article_content); bodyHtml = art.html || ''; excerpt = art.excerpt || ''; } catch {}
  }

  const parts: string[] = [];
  if (item.generated_image_url) {
    parts.push(`<img src="${item.generated_image_url}" alt="${item.title}" style="width:100%;max-width:600px;height:auto;border-radius:8px;display:block;margin:0 0 24px;">`);
  }

  if (bodyHtml) {
    // article_content.html already contains title + body — use as-is
    parts.push(bodyHtml);
  } else {
    // Fallback: build minimal structure from title + excerpt + caption
    parts.push(`<h1>${item.title}</h1>`);
    if (excerpt) parts.push(`<p class="lead">${excerpt}</p>`);
    if (item.caption) parts.push(`<p>${item.caption}</p>`);
  }

  return parts.join('\n');
}

// Build a full email preview HTML (mirrors PHP wrapEmailHtml) for client-side iframe rendering.
function buildEmailPreviewHtml(html: string, subject: string, companyName: string): string {
  const base = getServerBase();
  let body = html
    .replace(/src="\/uploads\//g, `src="${base}/uploads/`)
    .replace(/src='\/uploads\//g, `src='${base}/uploads/`)
    .replace(/src="\/flowstack\/uploads\//g, `src="${base}/uploads/`);

  // Extract leading hero <img> for full-bleed rendering (mirrors PHP wrapEmailHtml)
  let heroHtml = '';
  const heroMatch = body.trimStart().match(/^(<img\s[^>]*>)/si);
  if (heroMatch) {
    const tag = heroMatch[1].replace(/\s*style="[^"]*"/gi, '');
    heroHtml = `<div><img${tag.slice(4, -1)} style="width:100%;max-width:100%;height:auto;display:block;"></div>`;
    body = body.trimStart().slice(heroMatch[0].length).trimStart();
  }

  const co = companyName || 'Flowstack';
  const header = `<div style="padding:20px 32px 14px;border-bottom:1px solid #e4e4e7;"><span style="font-size:18px;font-weight:700;color:#3b82f6;">${co}</span></div>`;
  const footer = `<div style="padding:16px 32px;border-top:1px solid #e4e4e7;background:#fafafa;font-size:12px;color:#71717a;text-align:center;"><p style="margin:0 0 6px;">${co}</p><p style="margin:0;color:#a1a1aa;font-size:11px;">คุณได้รับอีเมลนี้เพราะสมัครรับข้อมูลจากเรา</p></div>`;
  const styles = `h1{font-size:22px;font-weight:700;color:#18181b;margin:0 0 16px;line-height:1.3}h2{font-size:18px;font-weight:600;color:#18181b;margin:24px 0 12px}h3{font-size:16px;font-weight:600;color:#18181b;margin:20px 0 8px}p{margin:0 0 16px}ul,ol{padding-left:24px;margin:0 0 16px}li{margin-bottom:4px}img{max-width:100%;height:auto;border-radius:6px;display:block;margin:16px auto}a{color:#3b82f6;text-decoration:underline}blockquote{border-left:4px solid #e4e4e7;padding:8px 16px;margin:16px 0;color:#71717a;font-style:italic}strong,b{font-weight:600}.lead{font-size:16px;color:#52525b;font-style:italic;margin-bottom:24px}`;
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"><div style="background:#f4f4f5;padding:24px 0;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">${header}${heroHtml}<div style="padding:32px;font-size:15px;line-height:1.75;color:#27272a;"><style>${styles}</style>${body}</div>${footer}</div></div></body></html>`;
}

export default function MarketingPage() {
  const { user } = useAuth();
  const isAdmin = Number(user?.is_admin) === 1;
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // ── React Query data hooks ──────────────────────────────────
  const { data: campaigns = [], isLoading } = useEmailCampaigns();
  const { data: groups = [] } = useEmailGroups();
  const { data: mailSettings } = useMailSettings();
  const { data: customerStatsData, isLoading: customerStatsLoading } = useCustomerEmailStats();
  const customerStats = customerStatsData?.customers ?? [];
  const customerStatsTotal = customerStatsData?.total ?? 0;
  const { data: allCustomersRaw = [], isLoading: isCustomersLoading } = useCustomers(undefined, true);

  // SMTP defaults
  const smtpFromName = mailSettings?.mail_from_name ?? '';
  const companyWebsite = mailSettings?.company_website ?? '';
  const smtpFromEmail = mailSettings?.mail_from_address ?? '';

  // Keep a ref so the effect below always reads the latest SMTP values
  // without needing them in the dependency array (adding them would re-trigger
  // the dialog every time mailSettings loads).
  const smtpRef = useRef({ name: smtpFromName, email: smtpFromEmail });
  smtpRef.current = { name: smtpFromName, email: smtpFromEmail };

  // ── Pre-populate campaign from content (via navigate state) ──
  const location = useLocation();
  useEffect(() => {
    const fromContent = (location.state as any)?.fromContent as ContentItem | undefined;
    if (!fromContent) return;
    let name = fromContent.title;
    let subject = fromContent.title;
    try {
      const art = JSON.parse(fromContent.article_content || '');
      name = art.title || fromContent.title;
      subject = art.title || fromContent.title;
    } catch {}
    const body = buildBodyFromContent(fromContent);
    setEditingCampaignId(null);
    setCampaignName(name);
    setCampaignSubject(subject);
    setCampaignBody(body);
    setSenderName(smtpRef.current.name);
    setSenderEmail(smtpRef.current.email);
    setSelectedCampaignGroups([]);
    setIsCampaignDialogOpen(true);
    // Clear state to prevent re-opening on back/forward
    window.history.replaceState({}, '');
  }, [location.state]);

  // ── UI state ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('campaigns');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);

  // Campaign recipient log dialog
  const [recipientLogOpen, setRecipientLogOpen] = useState(false);
  const [recipientLogCampaignId, setRecipientLogCampaignId] = useState<string | null>(null);
  const [recipientLogTab, setRecipientLogTab] = useState<'list' | 'preview'>('list');
  const { data: recipientLogData, isLoading: recipientLogLoading } = useRecipientLog(recipientLogCampaignId);

  // Campaign form (create + edit)
  const [pullContentOpen, setPullContentOpen] = useState(false);
  const [templatePreviewId, setTemplatePreviewId] = useState<string | null>(null);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [selectedCampaignGroups, setSelectedCampaignGroups] = useState<string[]>([]);
  const [enableTrackOpens, setEnableTrackOpens]   = useState(true);
  const [enableTrackClicks, setEnableTrackClicks] = useState(true);
  const pullFromDialogRef = useRef<boolean>(false);
  // Group form (create / edit)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EmailGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  // Customer list (from React Query)
  const allCustomers: Customer[] = allCustomersRaw.map((c) => ({
    id: c.id, first_name: c.first_name, last_name: c.last_name,
    email: c.email, company_name: c.company_name, company_business_type: c.company_business_type,
  }));
  const [createSearch, setCreateSearch] = useState('');
  const [createCompanyFilter, setCreateCompanyFilter] = useState('');
  const [createSelected, setCreateSelected] = useState<Set<string>>(new Set());

  // Manage members dialog
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isMembersMaximized, setIsMembersMaximized] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { data: selectedGroupDetail, isLoading: isMembersLoading } = useEmailGroup(selectedGroupId);
  const members: GroupMember[] = useMemo(() => selectedGroupDetail?.members ?? [], [selectedGroupDetail]);
  const [memberSearch, setMemberSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [addCompanyFilter, setAddCompanyFilter] = useState('');
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());

  // ── Mutation hooks ──────────────────────────────────────────
  const createCampaign = useCreateEmailCampaign();
  const updateCampaign = useUpdateEmailCampaign();
  const deleteCampaign = useDeleteEmailCampaign();
  const copyCampaign = useCopyEmailCampaign();
  const sendCampaign = useSendEmailCampaign();
  const createGroup = useCreateEmailGroup();
  const updateGroup = useUpdateEmailGroup();
  const deleteGroup = useDeleteEmailGroup();
  const addMembers = useAddGroupMembers();
  const removeMember = useRemoveGroupMember();

  // ── Campaign handlers ──────────────────────────────────────
  const openCreateCampaign = () => {
    setEditingCampaignId(null);
    setCampaignName(''); setCampaignSubject(''); setCampaignBody('');
    setSenderName(smtpRef.current.name); setSenderEmail(smtpRef.current.email); setSelectedCampaignGroups([]);
    setEnableTrackOpens(true); setEnableTrackClicks(true);
    setIsCampaignDialogOpen(true);
  };

  const openEditCampaign = async (campaign: EmailCampaign) => {
    setEditingCampaignId(campaign.id);
    // Fetch full detail (includes body_html, sender_*, group_ids)
    try {
      const full = await apiFetch(`/email-campaigns.php?id=${campaign.id}`);
      const c = full?.campaign ?? full;
      setCampaignName(c.name ?? '');
      setCampaignSubject(c.subject ?? '');
      setCampaignBody(c.body_html ?? '');
      setSenderName(c.sender_name ?? '');
      setSenderEmail(c.sender_email ?? '');
      setEnableTrackOpens(c.enable_track_opens !== 0);
      setEnableTrackClicks(c.enable_track_clicks !== 0);
      const groupIds = (full?.groups ?? []).map((g: any) => g.id);
      setSelectedCampaignGroups(groupIds);
    } catch {
      setCampaignName(campaign.name);
      setCampaignSubject(campaign.subject);
      setCampaignBody(campaign.body_html ?? '');
      setSenderName(campaign.sender_name ?? '');
      setSenderEmail(campaign.sender_email ?? '');
      setEnableTrackOpens(campaign.enable_track_opens !== 0);
      setEnableTrackClicks(campaign.enable_track_clicks !== 0);
      setSelectedCampaignGroups([]);
    }
    setIsCampaignDialogOpen(true);
  };

  const handleSubmitCampaign = async () => {
    if (!campaignName || !campaignSubject) {
      toast({ title: 'กรุณากรอกชื่อแคมเปญและหัวข้ออีเมล', variant: 'destructive' });
      return;
    }
    if (!campaignBody.trim()) {
      toast({ title: 'กรุณากรอกเนื้อหาอีเมล', variant: 'destructive' });
      return;
    }
    const payload = {
      name: campaignName, subject: campaignSubject,
      body_html: makeUploadsAbsolute(campaignBody), sender_name: senderName,
      sender_email: senderEmail, group_ids: selectedCampaignGroups,
      enable_track_opens: enableTrackOpens ? 1 : 0,
      enable_track_clicks: enableTrackClicks ? 1 : 0,
    };
    try {
      if (editingCampaignId) {
        await updateCampaign.mutateAsync({ ...payload, id: editingCampaignId });
        toast({ title: 'แก้ไขแคมเปญสำเร็จ' });
      } else {
        await createCampaign.mutateAsync(payload);
        toast({ title: 'สร้างแคมเปญสำเร็จ' });
      }
      setIsCampaignDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleSubmitAndSend = async () => {
    if (!campaignName || !campaignSubject) {
      toast({ title: 'กรุณากรอกชื่อแคมเปญและหัวข้ออีเมล', variant: 'destructive' });
      return;
    }
    if (!campaignBody.trim()) {
      toast({ title: 'กรุณากรอกเนื้อหาอีเมล', variant: 'destructive' });
      return;
    }
    if (!selectedCampaignGroups.length) {
      toast({ title: 'กรุณาเลือกกลุ่มผู้รับ', variant: 'destructive' });
      return;
    }
    const payload = {
      name: campaignName, subject: campaignSubject,
      body_html: makeUploadsAbsolute(campaignBody), sender_name: senderName,
      sender_email: senderEmail, group_ids: selectedCampaignGroups,
      enable_track_opens: enableTrackOpens ? 1 : 0,
      enable_track_clicks: enableTrackClicks ? 1 : 0,
    };
    try {
      let id: string;
      if (editingCampaignId) {
        await updateCampaign.mutateAsync({ ...payload, id: editingCampaignId });
        id = editingCampaignId;
      } else {
        const res = await createCampaign.mutateAsync(payload);
        id = res?.id ?? res?.campaign?.id;
      }
      setIsCampaignDialogOpen(false);
      setSendingId(id);
      try {
        const res = await sendCampaign.mutateAsync(id);
        const msg = res?.failed > 0
          ? `ส่งสำเร็จ ${res.recipients} ฉบับ, ล้มเหลว ${res.failed} ฉบับ`
          : `ส่งสำเร็จ ${res.recipients} ฉบับ ✓`;
        toast({ title: msg });
      } catch (e: any) {
        toast({ title: 'ส่งไม่สำเร็จ', description: e.message, variant: 'destructive' });
      } finally {
        setSendingId(null);
      }
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleSendCampaign = async (id: string) => {
    const ok = await confirm({ title: 'ส่งแคมเปญ', description: 'ต้องการส่งแคมเปญนี้ใช่หรือไม่?', variant: 'default' });
    if (!ok) return;
    setSendingId(id);
    try {
      const res = await sendCampaign.mutateAsync(id);
      const msg = res?.failed > 0
        ? `ส่งสำเร็จ ${res.recipients} ฉบับ, ล้มเหลว ${res.failed} ฉบับ`
        : `ส่งสำเร็จ ${res.recipients} ฉบับ ✓`;
      toast({ title: msg });
    } catch (e: any) {
      toast({ title: 'ส่งไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSendingId(null);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    const ok2 = await confirm({ title: 'ลบแคมเปญ', description: 'ต้องการลบแคมเปญนี้ใช่หรือไม่?', variant: 'destructive' });
    if (!ok2) return;
    try {
      await deleteCampaign.mutateAsync(id);
      toast({ title: 'ลบแคมเปญสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleCopyCampaign = async (campaign: EmailCampaign) => {
    try {
      await copyCampaign.mutateAsync(campaign.id);
      toast({ title: 'คัดลอกแคมเปญสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'คัดลอกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  // ── Group handlers ─────────────────────────────────────────
  const openCreateGroup = () => {
    setGroupName(''); setGroupDesc(''); setCreateSearch(''); setCreateCompanyFilter(''); setCreateSelected(new Set());
    setIsCreateGroupOpen(true);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({ title: 'กรุณากรอกชื่อกลุ่ม', variant: 'destructive' });
      return;
    }
    try {
      await createGroup.mutateAsync({
        name: groupName.trim(),
        description: groupDesc.trim(),
        customer_ids: createSelected.size > 0 ? Array.from(createSelected) : undefined,
      });
      toast({ title: `สร้างกลุ่มสำเร็จ${createSelected.size > 0 ? ` (${createSelected.size} ผู้ติดต่อ)` : ''}` });
      setIsCreateGroupOpen(false);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const openEditGroup = (group: EmailGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDesc(group.description || '');
    setIsEditGroupOpen(true);
  };

  const handleEditGroup = async () => {
    if (!editingGroup || !groupName.trim()) return;
    try {
      await updateGroup.mutateAsync({
        id: editingGroup.id,
        name: groupName.trim(),
        description: groupDesc.trim(),
      });
      toast({ title: 'แก้ไขกลุ่มสำเร็จ' });
      setIsEditGroupOpen(false);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteGroup = async (group: EmailGroup) => {
    const ok3 = await confirm({ title: 'ลบกลุ่ม', description: `ต้องการลบกลุ่ม "${group.name}" ใช่หรือไม่?`, variant: 'destructive' });
    if (!ok3) return;
    try {
      await deleteGroup.mutateAsync(group.id);
      toast({ title: 'ลบกลุ่มสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  // ── Members dialog ─────────────────────────────────────────
  const openMembers = (group: EmailGroup) => {
    setSelectedGroupId(group.id);
    setMemberSearch(''); setAddSearch(''); setAddCompanyFilter(''); setAddSelected(new Set());
    setIsMembersOpen(true);
  };

  const handleAddSelected = async () => {
    if (!selectedGroupId || addSelected.size === 0) return;
    try {
      await addMembers.mutateAsync({
        groupId: selectedGroupId,
        customerIds: Array.from(addSelected),
      });
      setAddSelected(new Set());
      setAddSearch('');
      toast({ title: `เพิ่ม ${addSelected.size} ผู้ติดต่อสำเร็จ` });
    } catch (e: any) {
      toast({ title: 'เพิ่มสมาชิกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (customerId: string) => {
    if (!selectedGroupId) return;
    try {
      await removeMember.mutateAsync({ groupId: selectedGroupId, customerId });
      toast({ title: 'ลบสมาชิกสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'ลบสมาชิกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  // ── Checkbox helpers ───────────────────────────────────────
  const toggleOne = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const toggleAll = (set: Set<string>, ids: string[], checked: boolean): Set<string> => {
    const next = new Set(set);
    ids.forEach(id => checked ? next.add(id) : next.delete(id));
    return next;
  };

  // ── Derived lists ──────────────────────────────────────────
  const memberIds = useMemo(() => new Set(members.map(m => m.customer_id)), [members]);

  const filteredCampaigns = useMemo(() =>
    campaigns.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase())
    ), [campaigns, search]);

  const filteredGroups = useMemo(() =>
    groups.filter(g =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.description || '').toLowerCase().includes(search.toLowerCase())
    ), [groups, search]);

  const filteredMembers: Customer[] = useMemo(() =>
    members
      .filter(m => `${m.first_name} ${m.last_name} ${m.email} ${m.company_name}`.toLowerCase().includes(memberSearch.toLowerCase()))
      .map(m => ({ id: m.customer_id, first_name: m.first_name, last_name: m.last_name, email: m.email, company_name: m.company_name })),
    [members, memberSearch]);

  const customersToAdd: Customer[] = useMemo(() =>
    allCustomers.filter(c =>
      !memberIds.has(c.id) &&
      `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(addSearch.toLowerCase()) &&
      (addCompanyFilter === '' || (c.company_name ?? '').toLowerCase().includes(addCompanyFilter.toLowerCase()) || (c.company_business_type ?? '').toLowerCase().includes(addCompanyFilter.toLowerCase()))
    ), [allCustomers, memberIds, addSearch, addCompanyFilter]);

  const createCustomers: Customer[] = useMemo(() =>
    allCustomers.filter(c =>
      `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(createSearch.toLowerCase()) &&
      (createCompanyFilter === '' || (c.company_name ?? '').toLowerCase().includes(createCompanyFilter.toLowerCase()) || (c.company_business_type ?? '').toLowerCase().includes(createCompanyFilter.toLowerCase()))
    ), [allCustomers, createSearch, createCompanyFilter]);

  // Analytics calculations
  const sentCampaigns = useMemo(() =>
    campaigns.filter(c => c.status === 'sent' && c.total_sent > 0),
    [campaigns]
  );

  const totalSent = useMemo(() =>
    sentCampaigns.reduce((sum, c) => sum + c.total_sent, 0),
    [sentCampaigns]
  );

  const totalOpens = useMemo(() =>
    sentCampaigns.reduce((sum, c) => sum + c.total_opens, 0), [sentCampaigns]);

  const totalClicks = useMemo(() =>
    sentCampaigns.reduce((sum, c) => sum + c.total_clicks, 0), [sentCampaigns]);

  const avgOpenRate = useMemo(() =>
    totalSent > 0 ? Math.round(totalOpens / totalSent * 100) : 0,
    [totalOpens, totalSent]);

  const avgClickRate = useMemo(() =>
    totalSent > 0 ? Math.round(totalClicks / totalSent * 100) : 0,
    [totalClicks, totalSent]);

  const bestCampaigns = useMemo(() =>
    [...sentCampaigns]
      .sort((a, b) => {
        const rateA = a.total_sent > 0 ? a.total_opens / a.total_sent : 0;
        const rateB = b.total_sent > 0 ? b.total_opens / b.total_sent : 0;
        return rateB - rateA;
      })
      .slice(0, 3),
    [sentCampaigns]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Recipient Log ──────────────────────────────────────────
  const openRecipientLog = (campaignId: string) => {
    setRecipientLogTab('list');
    setRecipientLogCampaignId(campaignId);
    setRecipientLogOpen(true);
  };

  return (
    <PageShell
      breadcrumbs={[{ label: 'Marketing', isCurrent: true }]}
      title="Marketing"
      description={`จัดการแคมเปญอีเมลและกลุ่มลูกค้า · ${campaigns.length} แคมเปญ · ${groups.length} กลุ่ม`}
      actions={<>{(activeTab === 'campaigns' || activeTab === 'templates') ? (
<div className="flex gap-2">
  <Button variant="outline" className="gap-2" onClick={() => setPullContentOpen(true)}>
    <FileText className="w-4 h-4" /><span className="hidden sm:inline">ดึงคอนเทนท์</span>
  </Button>
  <Button className="gap-2" onClick={() => openCreateCampaign()}>
    <Plus className="w-4 h-4" /><span className="hidden sm:inline">สร้างแคมเปญ</span>
  </Button>
</div>
) : activeTab === 'groups' ? (
<Button className="gap-2" onClick={openCreateGroup}>
<Plus className="w-4 h-4" /><span className="hidden sm:inline">สร้างกลุ่ม</span>
</Button>
) : null}</>}
    >

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(''); }} className="space-y-4">
        <TabsList className="flex flex-nowrap overflow-x-auto sm:grid w-full sm:grid-cols-6">
          <TabsTrigger value="campaigns" className="gap-1.5 shrink-0">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">แคมเปญ</span>
            {campaigns.length > 0 && <Badge variant="secondary" className="text-xs px-1.5 py-0">{campaigns.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 shrink-0">
            <LayoutTemplate className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5 shrink-0">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">กลุ่มลูกค้า</span>
            {groups.length > 0 && <Badge variant="secondary" className="text-xs px-1.5 py-0">{groups.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5 shrink-0">
            <Users className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ลูกค้า</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 shrink-0">
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">รายงาน</span>
          </TabsTrigger>
          <TabsTrigger value="attribution" className="gap-1.5 shrink-0">
            <Route className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Attribution</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Campaigns Tab ── */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">แคมเปญทั้งหมด</p><p className="text-2xl font-bold text-primary">{campaigns.length}</p></CardContent></Card>
            <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">ส่งทั้งหมด</p><p className="text-2xl font-bold text-blue-500">{totalSent.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">เปิดอ่าน</p><p className="text-2xl font-bold text-green-500">{totalOpens.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">คลิกทั้งหมด</p><p className="text-2xl font-bold text-amber-500">{totalClicks.toLocaleString()}</p></CardContent></Card>
          </div>
          {/* Search bar inside tab */}
          <div className="rounded-lg border bg-card p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ค้นหาแคมเปญ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
          {filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">ยังไม่มีแคมเปญ</h3>
                <p className="text-muted-foreground mb-4">สร้างแคมเปญแรกของคุณ</p>
                <Button onClick={() => openCreateCampaign()}>สร้างแคมเปญ</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCampaigns.map((campaign) => (
                <Card key={campaign.id} className="hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col gap-3 min-w-0">
                      {/* Info */}
                      <div className="min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold truncate min-w-0">{campaign.name}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[campaign.status].color}`}>
                            {STATUS_CONFIG[campaign.status].label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          <span>{campaign.total_recipients} ผู้รับ</span>
                          {campaign.sent_at && <span>ส่งเมื่อ {new Date(campaign.sent_at).toLocaleDateString('th-TH')}</span>}
                        </div>
                      </div>

                      {/* Opens/Clicks stats */}
                      {campaign.status === 'sent' && (
                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm overflow-hidden">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground text-xs shrink-0">เปิดอ่าน</span>
                            <span className="font-semibold text-xs ml-auto shrink-0">{campaign.total_opens} <span className="font-normal text-muted-foreground">({campaign.total_sent > 0 ? Math.round(campaign.total_opens / campaign.total_sent * 100) : 0}%)</span></span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MousePointer className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground text-xs shrink-0">คลิก</span>
                            <span className="font-semibold text-xs ml-auto shrink-0">{campaign.total_clicks} <span className="font-normal text-muted-foreground">({campaign.total_sent > 0 ? Math.round(campaign.total_clicks / campaign.total_sent * 100) : 0}%)</span></span>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {campaign.status === 'sent' && (
                          <Button variant="outline" size="sm" onClick={() => openRecipientLog(campaign.id)} disabled={sendCampaign.isPending} className="gap-1.5">
                            <Eye className="w-3.5 h-3.5" />ดู Log
                          </Button>
                        )}
                        {campaign.status === 'draft' && (
                          <>
                            <Button size="sm" onClick={() => handleSendCampaign(campaign.id)} disabled={sendCampaign.isPending} className="gap-1.5">
                              {sendingId === campaign.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              {sendCampaign.isPending ? 'กำลังส่ง...' : 'ส่ง'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEditCampaign(campaign)} disabled={sendCampaign.isPending} className="gap-1.5">
                              <Pencil className="w-3.5 h-3.5" />แก้ไข
                            </Button>
                          </>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleCopyCampaign(campaign)} disabled={sendCampaign.isPending} className="gap-1.5">
                          <Copy className="w-3.5 h-3.5" />คัดลอก
                        </Button>
                        {isAdmin && (
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteCampaign(campaign.id)} disabled={sendCampaign.isPending}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Templates Tab ── */}
        <TabsContent value="templates" className="space-y-4">
          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Email Templates</h3>
            </div>
            <p className="text-xs text-muted-foreground">เลือก template เพื่อสร้างแคมเปญ รองรับ merge tags เช่น {'{{'+'first_name'+'}}'}  {'{{'+'company_name'+'}}'}  และอื่นๆ</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {emailTemplates.map((tpl) => (
              <Card key={tpl.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setTemplatePreviewId(tpl.id)}>
                <div className="bg-gradient-to-br from-muted/60 to-muted/20 flex items-center justify-center h-28 sm:h-36 text-5xl sm:text-6xl border-b group-hover:from-primary/10 transition-colors">
                  {tpl.thumbnail}
                </div>
                <CardContent className="p-3">
                  <p className="font-medium text-xs sm:text-sm truncate">{tpl.nameTH}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{tpl.name}</p>
                  <div className="flex gap-1.5 mt-2">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); setTemplatePreviewId(tpl.id); }}>
                      <Eye className="w-3 h-3 mr-1" />ดู
                    </Button>
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={(e) => {
                      e.stopPropagation();
                      setEditingCampaignId(null);
                      setCampaignName('');
                      setCampaignSubject('');
                      setCampaignBody(tpl.html);
                      setSenderName('');
                      setSenderEmail('');
                      setSelectedCampaignGroups([]);
                      setSelectedTemplate(tpl.id);
                      setIsCampaignDialogOpen(true);
                    }}>
                      <Plus className="w-3 h-3 mr-1" />ใช้
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Groups Tab ── */}
        <TabsContent value="groups" className="space-y-4">
          {/* Search bar inside tab */}
          <div className="rounded-lg border bg-card p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ค้นหากลุ่ม..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">ยังไม่มีกลุ่มลูกค้า</h3>
                <p className="text-muted-foreground mb-4">สร้างกลุ่มเพื่อจัดการรายชื่อส่งอีเมล</p>
                <Button onClick={openCreateGroup}>สร้างกลุ่ม</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGroups.map((group) => (
                <Card key={group.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-3">
                      <h3 className="font-semibold truncate">{group.name}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        <Users className="w-3.5 h-3.5 inline mr-1" />{group.member_count} สมาชิก
                      </p>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{group.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => openMembers(group)}>
                        <Users className="w-3.5 h-3.5 mr-1" />จัดการสมาชิก
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditGroup(group)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {isAdmin && (
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteGroup(group)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Customers Tab (Email Analytics) ── */}
        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">ความสนใจของลูกค้าจากอีเมล</h3>
              {customerStatsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : customerStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีข้อมูลการส่งอีเมลให้ลูกค้า</p>
                </div>
              ) : (
                <>
                  {/* Mobile card list */}
                  <div className="sm:hidden space-y-2">
                    {customerStats.map((customer) => {
                      const handleClick = async () => {
                        try {
                          const data: any = await apiFetch(`/customer-email-stats.php?customer_id=${customer.id}`);
                          setSelectedCustomer({ ...customer, recent_emails: data?.recent_emails || [] });
                          setCustomerDetailOpen(true);
                        } catch {
                          toast({ title: 'โหลดข้อมูลไม่สำเร็จ', variant: 'destructive' });
                        }
                      };
                      return (
                        <div key={customer.id} className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors" onClick={handleClick}>
                          <div className="font-medium text-sm">{customer.first_name} {customer.last_name}</div>
                          <div className="text-xs text-muted-foreground mb-2">{customer.company_name || '-'}</div>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                            <div><span className="text-muted-foreground">ส่ง </span><strong>{customer.delivered}</strong></div>
                            <div><span className="text-muted-foreground">เปิด </span><strong>{customer.opened}</strong></div>
                            <div><span className="text-muted-foreground">คลิก </span><strong>{customer.clicked}</strong></div>
                            <div className={customer.open_rate >= 30 ? 'text-green-600' : customer.open_rate >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                              เปิด {customer.open_rate}%
                            </div>
                            <div className={customer.click_rate >= 10 ? 'text-green-600' : customer.click_rate >= 5 ? 'text-yellow-600' : 'text-red-600'}>
                              คลิก {customer.click_rate}%
                            </div>
                            {customer.last_sent && (
                              <div className="text-muted-foreground">{new Date(customer.last_sent).toLocaleDateString('th-TH')}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">ลูกค้า</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">อีเมล</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">เปิด</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">คลิก</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">%เปิด</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">%คลิก</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">ล่าสุด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerStats.map((customer) => (
                          <tr
                            key={customer.id}
                            className="border-b hover:bg-muted/50 cursor-pointer"
                            onClick={async () => {
                              try {
                                const data: any = await apiFetch(`/customer-email-stats.php?customer_id=${customer.id}`);
                                setSelectedCustomer({ ...customer, recent_emails: data?.recent_emails || [] });
                                setCustomerDetailOpen(true);
                              } catch {
                                toast({ title: 'โหลดข้อมูลไม่สำเร็จ', variant: 'destructive' });
                              }
                            }}
                          >
                            <td className="py-3 px-2">
                              <div className="font-medium">{customer.first_name} {customer.last_name}</div>
                              <div className="text-xs text-muted-foreground">{customer.company_name || '-'}</div>
                            </td>
                            <td className="py-3 px-2 text-right">{customer.delivered}</td>
                            <td className="py-3 px-2 text-right">{customer.opened}</td>
                            <td className="py-3 px-2 text-right">{customer.clicked}</td>
                            <td className="py-3 px-2 text-right">
                              <span className={`inline-flex items-center gap-1 ${customer.open_rate >= 30 ? 'text-green-600' : customer.open_rate >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {customer.open_rate}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <span className={`inline-flex items-center gap-1 ${customer.click_rate >= 10 ? 'text-green-600' : customer.click_rate >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {customer.click_rate}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                              {customer.last_sent ? new Date(customer.last_sent).toLocaleDateString('th-TH') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">แคมเปญที่ส่งแล้ว</p>
                    <p className="text-2xl font-bold">{sentCampaigns.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">อีเมลที่ส่งทั้งหมด</p>
                    <p className="text-2xl font-bold">{totalSent.toLocaleString()}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Send className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">อัตราการเปิด (เฉลี่ย)</p>
                    <p className="text-2xl font-bold">{avgOpenRate}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Eye className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">อัตราการคลิก (เฉลี่ย)</p>
                    <p className="text-2xl font-bold">{avgClickRate}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <MousePointer className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaign Performance Table */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">ประสิทธิภาพแคมเปญ</h3>
              {sentCampaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีข้อมูลการส่งอีเมล</p>
                </div>
              ) : (
                <>
                  {/* Mobile card list */}
                  <div className="sm:hidden space-y-2">
                    {sentCampaigns
                      .sort((a, b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime())
                      .map((campaign) => {
                        const openRate = campaign.total_sent > 0 ? Math.round(campaign.total_opens / campaign.total_sent * 100) : 0;
                        const clickRate = campaign.total_sent > 0 ? Math.round(campaign.total_clicks / campaign.total_sent * 100) : 0;
                        return (
                          <div key={campaign.id} className="border rounded-lg p-3">
                            <div className="font-medium text-sm truncate">{campaign.name}</div>
                            <div className="text-xs text-muted-foreground truncate mb-2">{campaign.subject}</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div><span className="text-muted-foreground">ส่ง: </span><strong>{campaign.total_sent.toLocaleString()}</strong></div>
                              <div className="flex items-center gap-1">
                                <Eye className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">เปิด: </span><strong>{campaign.total_opens.toLocaleString()}</strong>
                              </div>
                              <div className={`flex items-center gap-1 ${openRate >= 30 ? 'text-green-600' : openRate >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {openRate >= 30 ? <TrendingUp className="w-3 h-3" /> : openRate < 15 ? <TrendingDown className="w-3 h-3" /> : null}
                                อัตราเปิด {openRate}%
                              </div>
                              <div className={`flex items-center gap-1 ${clickRate >= 10 ? 'text-green-600' : clickRate >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {clickRate >= 10 ? <TrendingUp className="w-3 h-3" /> : clickRate < 5 ? <TrendingDown className="w-3 h-3" /> : null}
                                อัตราคลิก {clickRate}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">แคมเปญ</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">ส่ง</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">เปิด</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">คลิก</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">อัตราเปิด</th>
                          <th className="text-right py-3 px-2 font-medium text-sm text-muted-foreground">อัตราคลิก</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sentCampaigns
                          .sort((a, b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime())
                          .map((campaign) => {
                            const openRate = campaign.total_sent > 0 ? Math.round(campaign.total_opens / campaign.total_sent * 100) : 0;
                            const clickRate = campaign.total_sent > 0 ? Math.round(campaign.total_clicks / campaign.total_sent * 100) : 0;
                            return (
                              <tr key={campaign.id} className="border-b last:border-b-0 hover:bg-muted/50">
                                <td className="py-3 px-2">
                                  <div className="font-medium truncate max-w-[200px]">{campaign.name}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{campaign.subject}</div>
                                </td>
                                <td className="py-3 px-2 text-right">{campaign.total_sent.toLocaleString()}</td>
                                <td className="py-3 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Eye className="w-3 h-3 text-muted-foreground" />
                                    {campaign.total_opens.toLocaleString()}
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <MousePointer className="w-3 h-3 text-muted-foreground" />
                                    {campaign.total_clicks.toLocaleString()}
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <span className={`inline-flex items-center gap-1 ${openRate >= 30 ? 'text-green-600' : openRate >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {openRate >= 30 ? <TrendingUp className="w-3 h-3" /> : openRate >= 15 ? null : <TrendingDown className="w-3 h-3" />}
                                    {openRate}%
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <span className={`inline-flex items-center gap-1 ${clickRate >= 10 ? 'text-green-600' : clickRate >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {clickRate >= 10 ? <TrendingUp className="w-3 h-3" /> : clickRate >= 5 ? null : <TrendingDown className="w-3 h-3" />}
                                    {clickRate}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Best Performing Campaigns */}
          {bestCampaigns.length > 0 && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4">แคมเปญที่มีประสิทธิภาพดีที่สุด</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {bestCampaigns.map((campaign, index) => (
                    <div key={campaign.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' :
                          'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium truncate">{campaign.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">เปิด:</span>{' '}
                          <span className="font-medium">{campaign.total_sent > 0 ? Math.round(campaign.total_opens / campaign.total_sent * 100) : 0}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">คลิก:</span>{' '}
                          <span className="font-medium">{campaign.total_sent > 0 ? Math.round(campaign.total_clicks / campaign.total_sent * 100) : 0}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Attribution Tab ── */}
        <TabsContent value="attribution" className="space-y-4">
          <AttributionTab />
        </TabsContent>
      </Tabs>

      <PullFromContentDialog
        open={pullContentOpen}
        onOpenChange={setPullContentOpen}
        onSelect={(item) => {
          if (pullFromDialogRef.current) {
            // Called from inside the dialog — only update body, keep other fields
            pullFromDialogRef.current = false;
            setCampaignBody(buildBodyFromContent(item));
            setPullContentOpen(false);
          } else {
            // Called from page header — open a new campaign dialog
            setCampaignName(item.title);
            setCampaignSubject(item.title);
            setCampaignBody(buildBodyFromContent(item));
            setEditingCampaignId(null);
            setSelectedCampaignGroups([]);
            setSenderName(smtpRef.current.name);
            setSenderEmail(smtpRef.current.email);
            setIsCampaignDialogOpen(true);
            setPullContentOpen(false);
          }
        }}
      />

      {/* ── Template Preview Dialog ── */}
      {templatePreviewId && (() => {
        const tpl = emailTemplates.find(t => t.id === templatePreviewId);
        if (!tpl) return null;
        return (
          <Dialog open={!!templatePreviewId} onOpenChange={(v) => { if (!v) setTemplatePreviewId(null); }}>
            <DialogContent className="w-full sm:max-w-3xl sm:max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8">
                  <span className="text-xl">{tpl.thumbnail}</span>
                  {tpl.nameTH}
                  <span className="text-xs text-muted-foreground font-normal ml-1">({tpl.name})</span>
                </DialogTitle>
                <DialogDescription>ตัวอย่าง template — merge tags จะถูกแทนที่ด้วยข้อมูลจริงเมื่อส่งอีเมล</DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-auto border rounded-md">
                <iframe
                  srcDoc={`<meta charset="UTF-8">${tpl.html}`}
                  className="w-full h-full min-h-[50vh]"
                  sandbox="allow-same-origin"
                  title="Template preview"
                />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <Button variant="outline" onClick={() => setTemplatePreviewId(null)}>ปิด</Button>
                <Button onClick={() => {
                  setEditingCampaignId(null);
                  setCampaignName('');
                  setCampaignSubject('');
                  setCampaignBody(tpl.html);
                  setSenderName('');
                  setSenderEmail('');
                  setSelectedCampaignGroups([]);
                  setSelectedTemplate(tpl.id);
                  setIsCampaignDialogOpen(true);
                  setTemplatePreviewId(null);
                }}>
                  <Plus className="w-4 h-4 mr-1" />ใช้ template นี้
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Create / Edit Campaign Dialog ── */}
      <Dialog open={isCampaignDialogOpen} onOpenChange={(v) => { setIsCampaignDialogOpen(v); if (!v) { setCampaignName(''); setCampaignSubject(''); setCampaignBody(''); setSenderName(''); setSenderEmail(''); setSelectedCampaignGroups([]); setSelectedTemplate(''); setEditingCampaignId(null); } }}>
        <DialogContent className="w-full overflow-x-hidden overflow-y-auto sm:max-w-[95vw] sm:max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              {editingCampaignId ? 'แก้ไขแคมเปญ' : 'สร้างแคมเปญใหม่'}
            </DialogTitle>
            <DialogDescription>
              {editingCampaignId ? 'แก้ไขข้อมูลแคมเปญ (เฉพาะสถานะ ฉบับร่าง)' : 'สร้างแคมเปญอีเมลเพื่อส่งให้กลุ่มลูกค้า'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">

            {/* ── Section 1: Campaign basics ── */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center shrink-0">1</span>
                ข้อมูลแคมเปญ
              </p>
              <div className="grid gap-1.5">
                <Label>ชื่อแคมเปญ <span className="text-destructive">*</span></Label>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="เช่น แคมเปญส่งท้ายปี 2567" />
              </div>
              <div className="grid gap-1.5">
                <Label>หัวข้ออีเมล (Subject Line) <span className="text-destructive">*</span></Label>
                <Input value={campaignSubject} onChange={(e) => setCampaignSubject(e.target.value)} placeholder="เช่น สิทธิพิเศษสำหรับคุณ {{first_name}} 🎁" />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    💡 หัวข้อที่ดีควรกระชับ (40–60 ตัวอักษร) ใส่ชื่อผู้รับ <code className="bg-muted px-1 rounded">{'{{first_name}}'}</code> เพื่อเพิ่ม open rate
                  </p>
                  <span className={`text-[11px] font-medium shrink-0 ml-2 ${
                    campaignSubject.length === 0 ? 'text-muted-foreground'
                    : campaignSubject.length <= 60 ? 'text-green-600 dark:text-green-400'
                    : campaignSubject.length <= 90 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-destructive'
                  }`}>{campaignSubject.length} ตัวอักษร</span>
                </div>
              </div>
            </div>

            {/* ── Section 2: From + Recipients ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center shrink-0">2</span>
                  ผู้ส่ง
                </p>
                <div className="grid gap-1.5">
                  <Label>ชื่อผู้ส่ง</Label>
                  <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder={smtpFromName || 'Flowstack Team'} />
                </div>
                <div className="grid gap-1.5">
                  <Label>อีเมลผู้ส่ง</Label>
                  <Input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder={smtpFromEmail || 'marketing@company.com'} />
                </div>
                {(smtpFromName || smtpFromEmail) && (
                  <p className="text-[11px] text-muted-foreground">หากเว้นว่างใช้จาก SMTP: <span className="font-medium">{smtpFromName}</span>{smtpFromName && smtpFromEmail ? ' · ' : ''}<span className="font-medium">{smtpFromEmail}</span></p>
                )}
              </div>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center shrink-0">3</span>
                  ผู้รับ
                </p>
                <div className="grid gap-1.5">
                  <Label>กลุ่มผู้รับ</Label>
                  <Select value={selectedCampaignGroups[0] || ''} onValueChange={(v) => setSelectedCampaignGroups([v])}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกกลุ่มผู้รับ" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name} ({g.member_count} คน)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCampaignGroups[0] && (() => {
                    const g = groups.find(x => x.id === selectedCampaignGroups[0]);
                    return g ? <p className="text-[11px] text-muted-foreground">จะส่งถึง {g.member_count} คน</p> : null;
                  })()}
                </div>
                <div className="grid gap-1.5">
                  <Label>Template เริ่มต้น</Label>
                  <ScrollableKanban className="gap-2">
                    {emailTemplates.map((template) => (
                      <button key={template.id} type="button"
                        onClick={() => { setSelectedTemplate(template.id); setCampaignBody(template.html); }}
                        className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl transition-all ${selectedTemplate === template.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' : 'border-gray-200 hover:border-gray-300'}`}
                        title={template.nameTH}
                      >{template.thumbnail}</button>
                    ))}
                  </ScrollableKanban>
                  {selectedTemplate && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">✓ {emailTemplates.find(t => t.id === selectedTemplate)?.nameTH}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 4: Content editor ── */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center shrink-0">4</span>
                  เนื้อหาอีเมล
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-muted-foreground hidden sm:block">
                    merge tags: <code className="bg-muted px-1 rounded text-[10px]">{'{{first_name}}'}</code> <code className="bg-muted px-1 rounded text-[10px]">{'{{company_name}}'}</code>
                  </p>
                  <Button
                    variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                    onClick={() => { pullFromDialogRef.current = true; setPullContentOpen(true); }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">ดึงคอนเทนท์</span>
                  </Button>
                </div>
              </div>
              <Tabs defaultValue="edit">
                <TabsList className="h-8 w-full sm:w-auto">
                  <TabsTrigger value="edit" className="text-xs flex-1 sm:flex-none">✏️ แก้ไข</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs flex-1 sm:flex-none">👁 ตัวอย่าง</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-2">
                  <div className="min-w-0 w-full overflow-x-hidden">
                    <ArticleEditor
                      html={campaignBody}
                      onChange={setCampaignBody}
                      seoFields={{ seo_title: '', slug: '', meta_description: '', meta_keywords: '', og_image: '', structured_data: '' }}
                      onSeoChange={() => {}}
                      topic={campaignName}
                      platform="email"
                      trackOpens={enableTrackOpens}
                      trackClicks={enableTrackClicks}
                      onTrackOpensChange={setEnableTrackOpens}
                      onTrackClicksChange={setEnableTrackClicks}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    💡 toolbar: <strong>ใส่ลิงค์</strong> เพื่อ hyperlink, <strong>อ่านต่อ</strong> เพื่อปุ่ม Read More, <strong>กดลิงค์</strong> เพื่อปุ่ม CTA สี
                  </p>
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <div className="border rounded-lg overflow-hidden bg-[#f4f4f5]">
                    <iframe
                      srcDoc={buildEmailPreviewHtml(campaignBody, campaignSubject, senderName || smtpFromName)}
                      className="w-full"
                      style={{ height: 560, border: 'none' }}
                      title="ตัวอย่างอีเมล"
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">ตัวอย่างนี้แสดงรูปแบบอีเมลที่ผู้รับจะเห็น (merge tags จะถูกแทนที่เมื่อส่งจริง)</p>
                </TabsContent>
              </Tabs>
            </div>

          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsCampaignDialogOpen(false)} className="sm:mr-auto">
              ยกเลิก
            </Button>
            <Button
              variant="outline"
              onClick={handleSubmitCampaign}
              disabled={createCampaign.isPending || updateCampaign.isPending}
            >
              {(createCampaign.isPending || updateCampaign.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingCampaignId ? 'บันทึกการแก้ไข' : 'บันทึกร่าง'}
            </Button>
            {!editingCampaignId && (
              <Button
                onClick={handleSubmitAndSend}
                disabled={createCampaign.isPending || updateCampaign.isPending || sendCampaign.isPending}
              >
                {(createCampaign.isPending || sendCampaign.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <Send className="w-4 h-4 mr-1.5" />
                ส่งทันที
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Group Dialog ── */}
      <Dialog open={isCreateGroupOpen} onOpenChange={(v) => { setIsCreateGroupOpen(v); if (!v) { setGroupName(''); setGroupDesc(''); setCreateSelected(new Set()); setCreateSearch(''); setCreateCompanyFilter(''); } }}>
        <DialogContent className="w-full sm:max-w-lg sm:max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>สร้างกลุ่มใหม่</DialogTitle>
            <DialogDescription>กรอกชื่อกลุ่มและเลือกผู้ติดต่อ</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
            <div className="grid gap-2">
              <Label>ชื่อกลุ่ม *</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="เช่น ลูกค้า VIP" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>คำอธิบาย</Label>
              <Textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="รายละเอียดกลุ่ม..." rows={2} />
            </div>

            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">ผู้ติดต่อ</Label>
                {createSelected.size > 0 && (
                  <span className="text-xs text-primary font-medium">เลือก {createSelected.size} คน</span>
                )}
              </div>
              {isCustomersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="กรองตามชื่อบริษัท หรือ ประเภทธุรกิจ..."
                      value={createCompanyFilter}
                      onChange={(e) => setCreateCompanyFilter(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <CustomerList
                    customers={createCustomers}
                    selected={createSelected}
                    onToggle={(id) => setCreateSelected(prev => toggleOne(prev, id))}
                    onToggleAll={(ids, checked) => setCreateSelected(prev => toggleAll(prev, ids, checked))}
                    searchValue={createSearch}
                    onSearchChange={setCreateSearch}
                    placeholder="ค้นหาชื่อ / อีเมลผู้ติดต่อ..."
                    emptyText={allCustomers.length === 0 ? 'ไม่มีข้อมูลผู้ติดต่อ' : 'ไม่พบผู้ติดต่อ'}
                    maxHeight="max-h-44"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateGroupOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleCreateGroup} disabled={createGroup.isPending}>
              {createGroup.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              สร้างกลุ่ม{createSelected.size > 0 ? ` (${createSelected.size} คน)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Group Dialog ── */}
      <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขกลุ่ม</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>ชื่อกลุ่ม *</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>คำอธิบาย</Label>
              <Textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditGroupOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEditGroup} disabled={updateGroup.isPending}>
              {updateGroup.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Members Dialog ── */}
      <Dialog open={isMembersOpen} onOpenChange={(v) => { setIsMembersOpen(v); if (!v) setIsMembersMaximized(false); }}>
        <DialogContent className={isMembersMaximized ? 'w-full max-w-none h-screen max-h-screen rounded-none flex flex-col' : 'w-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-16">
              <Users className="w-5 h-5" />{selectedGroupDetail?.name || groups.find(g => g.id === selectedGroupId)?.name || ''}
              <button
                onClick={() => setIsMembersMaximized(p => !p)}
                className="ml-auto p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title={isMembersMaximized ? 'ย่อหน้าต่าง' : 'ขยายหน้าต่าง'}
              >
                {isMembersMaximized
                  ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                  : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                }
              </button>
            </DialogTitle>
            <DialogDescription>{members.length} สมาชิกในกลุ่ม</DialogDescription>
          </DialogHeader>

          {isMembersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-5 overflow-hidden flex-1 min-h-0">

              {/* Current members */}
              <div className="flex flex-col min-h-0">
                <Label className="text-sm font-medium mb-2">สมาชิกปัจจุบัน ({members.length} คน)</Label>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาสมาชิก..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className={`border rounded-lg overflow-y-auto min-h-[72px] ${isMembersMaximized ? 'max-h-80' : 'max-h-44'}`}>
                  {filteredMembers.length === 0 ? (
                    <div className="flex items-center justify-center text-sm text-muted-foreground py-6">
                      {members.length === 0 ? 'ยังไม่มีสมาชิก' : 'ไม่พบสมาชิก'}
                    </div>
                  ) : filteredMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}{m.company_name ? ` · ${m.company_name}` : ''}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="ml-2 shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="นำออกจากกลุ่ม"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add members */}
              <div className="flex flex-col min-h-0 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">
                    เพิ่มผู้ติดต่อ
                    {customersToAdd.length > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">({customersToAdd.length} คนที่ยังไม่ได้เพิ่ม)</span>
                    )}
                  </Label>
                  {addSelected.size > 0 && (
                    <span className="text-xs text-primary font-medium">เลือก {addSelected.size} คน</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="กรองตามชื่อบริษัท หรือ ประเภทธุรกิจ..."
                      value={addCompanyFilter}
                      onChange={(e) => setAddCompanyFilter(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <CustomerList
                    customers={customersToAdd}
                    selected={addSelected}
                    onToggle={(id) => setAddSelected(prev => toggleOne(prev, id))}
                    onToggleAll={(ids, checked) => setAddSelected(prev => toggleAll(prev, ids, checked))}
                    searchValue={addSearch}
                    onSearchChange={setAddSearch}
                    placeholder="ค้นหาชื่อ / อีเมลผู้ติดต่อ..."
                    emptyText={addSearch || addCompanyFilter ? 'ไม่พบผู้ติดต่อ' : 'ผู้ติดต่อทุกคนอยู่ในกลุ่มแล้ว'}
                    maxHeight={isMembersMaximized ? 'max-h-80' : 'max-h-44'}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsMembersOpen(false)}>ปิด</Button>
            {addSelected.size > 0 && (
              <Button onClick={handleAddSelected} disabled={addMembers.isPending}>
                {addMembers.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                เพิ่ม {addSelected.size} ผู้ติดต่อ
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Customer Email Detail Dialog ── */}
      <Dialog open={customerDetailOpen} onOpenChange={setCustomerDetailOpen}>
        <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ประวัติอีเมลของลูกค้า</DialogTitle>
            <DialogDescription>
              {selectedCustomer && (
                <span>{selectedCustomer.first_name} {selectedCustomer.last_name} - {selectedCustomer.email}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{selectedCustomer.delivered}</div>
                  <div className="text-xs text-muted-foreground">ส่งสำเร็จ</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{selectedCustomer.opened}</div>
                  <div className="text-xs text-muted-foreground">เปิดอ่าน</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{selectedCustomer.clicked}</div>
                  <div className="text-xs text-muted-foreground">คลิกลิงค์</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{selectedCustomer.open_rate}%</div>
                  <div className="text-xs text-muted-foreground">อัตราเปิด</div>
                </div>
              </div>

              {/* Recent Emails */}
              <div>
                <h4 className="font-semibold mb-2">อีเมลที่ส่งล่าสุด</h4>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {selectedCustomer.recent_emails?.length > 0 ? (
                    selectedCustomer.recent_emails.map((email: any) => (
                      <div key={email.id} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{email.campaign_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {email.sent_at ? new Date(email.sent_at).toLocaleString('th-TH') : '-'}
                          </div>
                        </div>
                        <div className="flex gap-3 shrink-0">
                          {email.opened_at && (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <Eye className="w-4 h-4" /> {new Date(email.opened_at).toLocaleDateString('th-TH')}
                            </span>
                          )}
                          {email.clicked_at && (
                            <span className="flex items-center gap-1 text-blue-600 text-sm">
                              <MousePointer className="w-4 h-4" /> {new Date(email.clicked_at).toLocaleDateString('th-TH')}
                            </span>
                          )}
                          {!email.opened_at && email.status === 'sent' && (
                            <span className="text-muted-foreground text-sm">รอเปิด</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">ไม่มีประวัติอีเมล</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDetailOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Recipient Log Dialog ── */}
      <Dialog open={recipientLogOpen} onOpenChange={setRecipientLogOpen}>
        <DialogContent className="w-full sm:max-w-4xl sm:max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg pr-6">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="truncate">Log การส่งอีเมล — {recipientLogData?.campaign?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {recipientLogData?.campaign?.subject}
              {recipientLogData?.campaign?.sent_at && ` · ส่งเมื่อ ${new Date(recipientLogData.campaign.sent_at).toLocaleDateString('th-TH')}`}
            </DialogDescription>
          </DialogHeader>

          {recipientLogLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recipientLogData ? (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Tab switcher */}
              <div className="flex gap-2 mb-3">
                <Button
                  size="sm"
                  variant={recipientLogTab === 'list' ? 'default' : 'outline'}
                  onClick={() => setRecipientLogTab('list')}
                  className="text-xs sm:text-sm"
                >
                  <Users className="w-3.5 h-3.5 mr-1" />ผู้รับ ({recipientLogData.total})
                </Button>
                <Button
                  size="sm"
                  variant={recipientLogTab === 'preview' ? 'default' : 'outline'}
                  onClick={() => setRecipientLogTab('preview')}
                  className="text-xs sm:text-sm"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />ตัวอย่างอีเมล
                </Button>
              </div>

              {recipientLogTab === 'list' ? (
                <div className="flex-1 overflow-y-auto">
                  {/* Mobile card list */}
                  <div className="sm:hidden space-y-2">
                    {recipientLogData.recipients.map((r) => {
                      const statusMap: Record<string, { label: string; cls: string }> = {
                        sent:      { label: 'ส่งแล้ว',  cls: 'bg-blue-100 text-blue-700' },
                        delivered: { label: 'ถึงแล้ว',  cls: 'bg-green-100 text-green-700' },
                        bounced:   { label: 'ตีกลับ',   cls: 'bg-red-100 text-red-700' },
                        failed:    { label: 'ล้มเหลว',  cls: 'bg-red-100 text-red-700' },
                        queued:    { label: 'รอส่ง',    cls: 'bg-yellow-100 text-yellow-700' },
                      };
                      const st = statusMap[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-700' };
                      const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '-';
                      return (
                        <div key={r.id} className="border rounded-lg p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{name}</div>
                              <div className="text-xs text-muted-foreground truncate">{r.to_email}</div>
                              {r.company_name && <div className="text-xs text-muted-foreground">{r.company_name}</div>}
                            </div>
                            <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">เปิด: </span>
                              {r.opened_at
                                ? <span className="text-green-600">{new Date(r.opened_at).toLocaleDateString('th-TH')}</span>
                                : <span className="text-muted-foreground">-</span>}
                            </div>
                            <div>
                              <span className="text-muted-foreground">คลิก: </span>
                              {r.clicked_at
                                ? <span className="text-purple-600">{Number(r.click_count) > 0 ? `${r.click_count} ครั้ง` : '✓'}</span>
                                : <span className="text-muted-foreground">-</span>}
                            </div>
                            <div className="text-muted-foreground col-span-2">
                              ส่ง: {r.sent_at ? new Date(r.sent_at).toLocaleString('th-TH') : '-'}
                            </div>
                          </div>
                          {r.bounce_reason && <div className="text-xs text-red-500">{r.bounce_reason}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background border-b">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">ผู้รับ</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">อีเมล</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">สถานะ</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">เปิดอ่าน</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">คลิก</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">วันที่ส่ง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipientLogData.recipients.map((r) => {
                          const statusMap: Record<string, { label: string; cls: string }> = {
                            sent:      { label: 'ส่งแล้ว',    cls: 'bg-blue-100 text-blue-700' },
                            delivered: { label: 'ถึงแล้ว',    cls: 'bg-green-100 text-green-700' },
                            bounced:   { label: 'ตีกลับ',     cls: 'bg-red-100 text-red-700' },
                            failed:    { label: 'ล้มเหลว',    cls: 'bg-red-100 text-red-700' },
                            queued:    { label: 'รอส่ง',      cls: 'bg-yellow-100 text-yellow-700' },
                          };
                          const st = statusMap[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-700' };
                          const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '-';
                          return (
                            <tr key={r.id} className="border-b hover:bg-muted/40">
                              <td className="py-2 px-3">
                                <div className="font-medium">{name}</div>
                                {r.company_name && <div className="text-xs text-muted-foreground">{r.company_name}</div>}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">{r.to_email}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                                {r.bounce_reason && (
                                  <div className="text-xs text-red-500 mt-0.5 max-w-[120px] truncate" title={r.bounce_reason}>{r.bounce_reason}</div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {r.opened_at
                                  ? <span className="text-green-600 text-xs">{new Date(r.opened_at).toLocaleString('th-TH')}</span>
                                  : <span className="text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {r.clicked_at
                                  ? <span className="text-purple-600 text-xs">{Number(r.click_count) > 0 ? `${r.click_count} ครั้ง` : '✓'}</span>
                                  : <span className="text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 px-3 text-right text-xs text-muted-foreground">
                                {r.sent_at ? new Date(r.sent_at).toLocaleString('th-TH') : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto border rounded-md">
                  {recipientLogData.campaign?.body_html ? (
                    <iframe
                      srcDoc={`<meta charset="UTF-8">${recipientLogData.campaign.body_html}`}
                      className="w-full h-full min-h-[480px]"
                      sandbox="allow-same-origin"
                      title="Email preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">ไม่มีเนื้อหาอีเมล</div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setRecipientLogOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
