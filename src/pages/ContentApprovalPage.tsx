import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check, X, Filter, AlertTriangle, FileText, Clock, CheckCircle2, XCircle, ArrowUpDown,
  Layers, Search, Shapes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useContentItems } from '@/hooks/useContent';
import { apiFetch } from '@/lib/api';
import { contentKeys } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';
import {
  STATUS_MAP, PLATFORM_MAP, TYPE_MAP, type ContentItem,
} from '@/components/content/types';
import ContentDetailView from '@/components/content/views/ContentDetailView';

// Tab definitions — 'all' shows every approval-relevant status, the rest filter by ContentItem.status
const TABS: { value: string; label: string; icon: React.ElementType }[] = [
  { value: 'all',              label: 'ทั้งหมด',     icon: Layers },
  { value: 'pending_approval', label: 'รออนุมัติ',    icon: Clock },
  { value: 'approved',         label: 'อนุมัติแล้ว',  icon: CheckCircle2 },
  { value: 'revision',         label: 'ขอแก้ไข',     icon: AlertTriangle },
  { value: 'rejected',         label: 'ปฏิเสธ',      icon: XCircle },
];

// Empty state copy per tab
const EMPTY_STATE: Record<string, { icon: React.ElementType; title: string; hint: string }> = {
  all:              { icon: FileText,      title: 'ไม่มีรายการคอนเทนต์',       hint: 'ยังไม่มีคอนเทนต์ในระบบ' },
  pending_approval: { icon: Clock,         title: 'ไม่มีรายการรออนุมัติ',       hint: 'เนื้อหาทั้งหมดได้รับการจัดการเรียบร้อยแล้ว' },
  approved:         { icon: CheckCircle2,  title: 'ไม่มีรายการที่อนุมัติแล้ว',  hint: 'ยังไม่มีเนื้อหาที่ได้รับการอนุมัติ' },
  revision:         { icon: AlertTriangle, title: 'ไม่มีรายการที่ขอแก้ไข',     hint: 'ยังไม่มีเนื้อหาที่ต้องแก้ไข' },
  rejected:         { icon: XCircle,       title: 'ไม่มีรายการที่ถูกปฏิเสธ',    hint: 'ยังไม่มีเนื้อหาที่ถูกปฏิเสธ' },
};

export default function ContentApprovalPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useContentItems();

  const [activeTab, setActiveTab] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [typeFilter, setTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; item: ContentItem | null }>({ open: false, item: null });
  const [rejectReason, setRejectReason] = useState('');
  const [confirmApprove, setConfirmApprove] = useState<ContentItem | null>(null);
  // Row click opens a read-only detail dialog; null means closed
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);

  // Stat counts — computed from all items, independent of the active tab/filters
  const statusCounts = {
    pending_approval: items.filter(i => i.status === 'pending_approval').length,
    approved:         items.filter(i => i.status === 'approved').length,
    revision:         items.filter(i => i.status === 'revision').length,
    rejected:         items.filter(i => i.status === 'rejected').length,
  };

  // Only approval-relevant statuses belong on this page — 'draft' has not entered
  // the workflow yet and 'published' has already left it
  const approvalItems = items.filter(i => !['draft', 'published'].includes(i.status));

  // Tab counts — 'all' counts every approval-relevant item, others count their own status
  const tabCounts: Record<string, number> = {
    all:              approvalItems.length,
    pending_approval: statusCounts.pending_approval,
    approved:         statusCounts.approved,
    revision:         statusCounts.revision,
    rejected:         statusCounts.rejected,
  };

  // Filter in stages: tab → type → platform → search, then sort by created_at
  const tabItems = approvalItems.filter(item => activeTab === 'all' || item.status === activeTab);

  const visibleItems = tabItems
    .filter(item => typeFilter === 'all' || item.type === typeFilter)
    .filter(item => platformFilter === 'all' || item.platform === platformFilter)
    .filter(item =>
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

  // Stat cards use semantic tokens, matching the KpiCard pattern on the Home page
  const statCards = [
    { key: 'pending_approval', label: 'รออนุมัติ',   value: statusCounts.pending_approval, icon: Clock,         color: 'text-warning' },
    { key: 'approved',         label: 'อนุมัติแล้ว', value: statusCounts.approved,         icon: CheckCircle2,  color: 'text-success' },
    { key: 'revision',         label: 'ขอแก้ไข',     value: statusCounts.revision,         icon: AlertTriangle, color: 'text-info' },
    { key: 'rejected',         label: 'ปฏิเสธ',      value: statusCounts.rejected,         icon: XCircle,       color: 'text-destructive' },
  ];

  const handleApprove = async (item: ContentItem) => {
    try {
      await apiFetch(`/content-items.php?id=${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'approved' }),
      });
      toast({ title: 'อนุมัติเรียบร้อย', description: `"${item.title}" ได้รับการอนุมัติแล้ว` });
      qc.invalidateQueries({ queryKey: contentKeys.items() });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอนุมัติได้', variant: 'destructive' });
    }
    setConfirmApprove(null);
  };

  const handleReject = async () => {
    const item = rejectDialog.item;
    if (!item) return;
    try {
      await apiFetch(`/content-items.php?id=${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected' }),
      });
      toast({ title: 'ปฏิเสธแล้ว', description: `"${item.title}" ถูกเปลี่ยนสถานะเป็นปฏิเสธ` });
      qc.invalidateQueries({ queryKey: contentKeys.items() });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถปฏิเสธได้', variant: 'destructive' });
    }
    setRejectDialog({ open: false, item: null });
    setRejectReason('');
  };

  const typeOptions = Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v.label }));
  const platformOptions = Object.entries(PLATFORM_MAP).map(([k, v]) => ({ value: k, label: v.label }));
  // Options come from the tab-filtered set so the current selection doesn't hide the alternatives
  const usedTypes = [...new Set(tabItems.map(i => i.type).filter(Boolean))];
  const usedPlatforms = [...new Set(tabItems.map(i => i.platform).filter(Boolean))];

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const emptyState = EMPTY_STATE[activeTab] ?? EMPTY_STATE.all;
  const EmptyIcon = emptyState.icon;
  const hasActiveFilters = !!searchQuery || typeFilter !== 'all' || platformFilter !== 'all';

  return (
    <PageShell
      breadcrumbs={[
        { label: 'การตลาด', href: '/marketing' },
        { label: 'คอนเทนต์โซเชียล' },
        { label: 'รายการอนุมัติ', isCurrent: true },
      ]}
      title="รายการอนุมัติ"
      description="ตรวจสอบและอนุมัติเนื้อหาก่อนเผยแพร่"
    >
      {/* Stat Cards — Title + Icon on one row, count below (KpiCard pattern) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Toolbar: Tabs (top row) + Type / Platform / Search / Sort (bottom row) */}
      <div className="space-y-3 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto p-1 flex flex-wrap gap-0.5">
            {TABS.map(tab => {
              const TabIcon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs sm:text-sm">
                  <TabIcon className="h-3.5 w-3.5" />{tab.label}
                  <span className="ml-1 text-[10px] px-1.5 py-0 rounded-full bg-muted font-semibold">{tabCounts[tab.value] ?? 0}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Input
              placeholder="ค้นหา content..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <Shapes className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="ทุกประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              {typeOptions
                .filter(t => usedTypes.includes(t.value))
                .map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="ทุกแพลตฟอร์ม" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
              {platformOptions
                .filter(p => usedPlatforms.includes(p.value))
                .map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
            <SelectTrigger className="w-[150px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">ใหม่ → เก่า</SelectItem>
              <SelectItem value="oldest">เก่า → ใหม่</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="ml-auto">
            {visibleItems.length} รายการ
          </Badge>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">กำลังโหลด...</div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <EmptyIcon className="h-10 w-10 opacity-30" />
          <p className="text-lg font-medium">{emptyState.title}</p>
          <p className="text-sm">
            {hasActiveFilters ? 'ลองปรับคำค้นหา ตัวกรองประเภท หรือแพลตฟอร์ม' : emptyState.hint}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อคอนเทนต์</TableHead>
                <TableHead className="hidden md:table-cell">ประเภท</TableHead>
                <TableHead className="hidden md:table-cell">แพลตฟอร์ม</TableHead>
                <TableHead className="hidden sm:table-cell">วันที่สร้าง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((item) => {
                const platform = PLATFORM_MAP[item.platform ?? ''] ?? null;
                const type = TYPE_MAP[item.type] ?? TYPE_MAP.article;
                const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                const isPending = item.status === 'pending_approval';
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setDetailItem(item)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">{item.title}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={type.color}>{type.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {platform ? (
                        <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.color}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={(e) => { e.stopPropagation(); setConfirmApprove(item); }}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4 mr-1" />อนุมัติ
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={(e) => { e.stopPropagation(); setRejectDialog({ open: true, item }); setRejectReason(''); }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-1" />ปฏิเสธ
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">ดำเนินการแล้ว</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Approve Confirm Dialog */}
      <Dialog open={!!confirmApprove} onOpenChange={(v) => { if (!v) setConfirmApprove(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              ต้องการอนุมัติ "{confirmApprove?.title}" ใช่หรือไม่? เนื้อหาจะถูกเปลี่ยนสถานะเป็นอนุมัติแล้ว
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApprove(null)}>ยกเลิก</Button>
            <Button onClick={() => confirmApprove && handleApprove(confirmApprove)}>ยืนยันการอนุมัติ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(v) => { if (!v) setRejectDialog({ open: false, item: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปฏิเสธเนื้อหา</DialogTitle>
            <DialogDescription>
              เนื้อหานี้จะถูกเปลี่ยนสถานะเป็น "ปฏิเสธ" และแสดงในแท็บปฏิเสธ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">เหตุผลที่ปฏิเสธ (ไม่บังคับ)</p>
            <Textarea
              placeholder="ระบุเหตุผลหรือคำแนะนำในการแก้ไข..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, item: null })}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleReject}>ยืนยันการปฏิเสธ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Content Detail Dialog — full content view opened by clicking a row */}
      <Dialog open={!!detailItem} onOpenChange={(v) => { if (!v) setDetailItem(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดคอนเทนต์</DialogTitle>
            <DialogDescription>ตรวจสอบเนื้อหาก่อนอนุมัติ ขอแก้ไข หรือปฏิเสธ</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <ContentDetailView
              item={detailItem}
              context="approval"
              onBack={() => setDetailItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
