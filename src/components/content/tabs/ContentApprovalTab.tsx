import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check, X, Filter, Stamp, RotateCcw, FileText, Clock, XCircle, ArrowUpDown,
  Layers, Search, Shapes, Pencil, AlertTriangle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useContentItems, contentKeys } from '@/hooks/useContent';
import { apiFetch } from '@/lib/api';
import {
  STATUS_MAP, PLATFORM_MAP, TYPE_MAP, type ContentItem, type SeoChecklistResult,
} from '@/components/content/types';
import ContentDetailView from '@/components/content/views/ContentDetailView';

export default function ContentApprovalTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useContentItems();

  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending_approval' | 'revision' | 'rejected'>('all');
  const [sortOrder, setSortOrder] = useState<'requested_desc' | 'requested_asc'>('requested_desc');
  const [typeFilter, setTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonDialog, setReasonDialog] = useState<{ open: boolean; item: ContentItem | null; kind: 'revision' | 'rejected' }>({ open: false, item: null, kind: 'rejected' });
  const [rejectReason, setRejectReason] = useState('');
  const [confirmApprove, setConfirmApprove] = useState<ContentItem | null>(null);
  // ผลตรวจเกต SEO ของรายการที่กำลังจะอนุมัติ (ดึงเมื่อเปิด dialog)
  const [approveGate, setApproveGate] = useState<SeoChecklistResult | null>(null);
  const [approveGateLoading, setApproveGateLoading] = useState(false);
  // Row click opens a read-only detail dialog; null means closed
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);

  // Auto-resize the reason textarea to fit its content
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeReason = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    if (reasonDialog.open && reasonRef.current) autoResizeReason(reasonRef.current);
  }, [reasonDialog.open]);

  // ดึงผลตรวจเกต SEO เมื่อเปิด dialog อนุมัติ — ถ้าเกตเปิดและมีกฎไม่ผ่าน
  // เนื้อหานี้จะเผยแพร่ไม่ได้ จึงบล็อกการอนุมัติไว้ก่อนพร้อมแจ้งกฎที่ติด
  useEffect(() => {
    if (!confirmApprove) { setApproveGate(null); setApproveGateLoading(false); return; }
    let cancelled = false;
    setApproveGate(null);
    setApproveGateLoading(true);
    apiFetch<SeoChecklistResult>(
      '/brand-content.php?action=seo-checklist&item_id=' + encodeURIComponent(confirmApprove.id),
    )
      .then(res => { if (!cancelled) setApproveGate(res); })
      .catch(() => { if (!cancelled) setApproveGate(null); })
      .finally(() => { if (!cancelled) setApproveGateLoading(false); });
    return () => { cancelled = true; };
  }, [confirmApprove]);

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

  // Filter in stages: status → type → platform → search, then sort by request date
  const statusFiltered = approvalItems.filter(item => statusFilter === 'all' || item.status === statusFilter);

  const visibleItems = statusFiltered
    .filter(item => typeFilter === 'all' || item.type === typeFilter)
    .filter(item => platformFilter === 'all' || item.platform === platformFilter)
    .filter(item =>
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.requested_at ?? a.updated_at ?? a.created_at).getTime();
      const tb = new Date(b.requested_at ?? b.updated_at ?? b.created_at).getTime();
      return sortOrder === 'requested_desc' ? tb - ta : ta - tb;
    });

  // Stat cards use semantic tokens, matching the KpiCard pattern on the Home page
  const statCards = [
    { key: 'approved',         label: 'อนุมัติแล้ว', value: statusCounts.approved,         icon: Stamp,  color: 'text-teal-600' },
    { key: 'pending_approval', label: 'รออนุมัติ',   value: statusCounts.pending_approval, icon: Clock,       color: 'text-warning' },
    { key: 'revision',         label: 'ขอแก้ไข',     value: statusCounts.revision,         icon: RotateCcw,  color: 'text-info' },
    { key: 'rejected',         label: 'ปฏิเสธ',      value: statusCounts.rejected,         icon: XCircle,     color: 'text-destructive' },
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

  const handleDecision = async () => {
    const item = reasonDialog.item;
    if (!item) return;
    const kind = reasonDialog.kind;
    try {
      await apiFetch(`/content-items.php?id=${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: kind,
          reject_reason: rejectReason.trim() ? rejectReason.trim() : null,
        }),
      });
      toast({
        title: kind === 'revision' ? 'ขอแก้ไขแล้ว' : 'ปฏิเสธแล้ว',
        description: `"${item.title}" ${kind === 'revision' ? 'ถูกส่งกลับให้แก้ไข' : 'ถูกเปลี่ยนสถานะเป็นปฏิเสธ'}`,
      });
      qc.invalidateQueries({ queryKey: contentKeys.items() });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถดำเนินการได้', variant: 'destructive' });
    }
    setReasonDialog({ open: false, item: null, kind: 'rejected' });
    setRejectReason('');
  };

  const typeOptions = Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v.label }));
  const platformOptions = Object.entries(PLATFORM_MAP).map(([k, v]) => ({ value: k, label: v.label }));
  // Options come from the tab-filtered set so the current selection doesn't hide the alternatives
  const usedTypes = [...new Set(statusFiltered.map(i => i.type).filter(Boolean))];
  const usedPlatforms = [...new Set(statusFiltered.map(i => i.platform).filter(Boolean))];

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const EmptyIcon = FileText;
  const hasActiveFilters = !!searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || platformFilter !== 'all';

  // เกต SEO ของรายการที่กำลังจะอนุมัติ — mirror ตรรกะ seo_gate_check() ฝั่ง backend
  const approveFails = approveGate?.rules.filter(r => r.level === 'fail') ?? [];
  const approveGateOn = approveGate?.seo_gate_enabled === 1;
  const approveLowScore = !!approveGate && approveGate.score < approveGate.seo_gate_min_score;
  const approveBlocked = approveGateOn && (approveFails.length > 0 || approveLowScore);

  return (
    <>
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

      {/* Toolbar: Status / Type / Platform / Search / Sort filters */}
      <div className="space-y-3 mb-4">
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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'approved' | 'pending_approval' | 'revision' | 'rejected')}>
            <SelectTrigger className="w-[150px]">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
              <SelectItem value="pending_approval">รออนุมัติ</SelectItem>
              <SelectItem value="revision">ขอแก้ไข</SelectItem>
              <SelectItem value="rejected">ปฏิเสธ</SelectItem>
            </SelectContent>
          </Select>
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
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'requested_desc' | 'requested_asc')}>
            <SelectTrigger className="w-[150px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requested_desc">ล่าสุด-เก่าสุด</SelectItem>
              <SelectItem value="requested_asc">เก่าสุด-ล่าสุด</SelectItem>
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
          <p className="text-lg font-medium">ไม่มีรายการ</p>
          <p className="text-sm">
            {hasActiveFilters ? 'ลองปรับคำค้นหา ตัวกรองสถานะ ประเภท หรือแพลตฟอร์ม' : 'ยังไม่มีเนื้อหาในระบบ'}
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
                <TableHead className="text-right w-[240px]">จัดการ</TableHead>
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
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <Button
                            variant="ghost" size="sm"
                            onClick={(e) => { e.stopPropagation(); setConfirmApprove(item); }}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4 mr-1" />อนุมัติ
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={(e) => { e.stopPropagation(); setReasonDialog({ open: true, item, kind: 'revision' }); setRejectReason(''); }}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <Pencil className="h-4 w-4 mr-1" />ขอแก้ไข
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={(e) => { e.stopPropagation(); setReasonDialog({ open: true, item, kind: 'rejected' }); setRejectReason(''); }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-1" />ปฏิเสธ
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">ดำเนินการแล้ว</span>
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
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              {approveBlocked
                ? `"${confirmApprove?.title}" ยังไม่ผ่านเกณฑ์ SEO ที่บังคับ จึงยังอนุมัติไม่ได้`
                : `ต้องการอนุมัติ "${confirmApprove?.title}" ใช่หรือไม่? เนื้อหาจะถูกเปลี่ยนสถานะเป็นอนุมัติแล้ว`}
            </DialogDescription>
          </DialogHeader>

          {approveGateLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจเกณฑ์ SEO...
            </div>
          )}

          {!approveGateLoading && approveBlocked && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                เกต SEO เปิดอยู่ — ต้องแก้ก่อนอนุมัติ
              </div>
              {approveFails.length > 0 && (
                <>
                  <p className="text-xs text-destructive/90">รายการที่ยังไม่ผ่าน ({approveFails.length}):</p>
                  <ul className="space-y-1">
                    {approveFails.map(r => (
                      <li key={r.key} className="flex items-start gap-1.5 text-xs text-destructive">
                        <XCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                        <span>{r.message}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {approveLowScore && (
                <p className="text-xs text-destructive">
                  คะแนน SEO {approveGate?.score} ต่ำกว่าเกณฑ์ขั้นต่ำ {approveGate?.seo_gate_min_score}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                แก้ไขที่ SEO / AEO Metadata ของเนื้อหา แล้วบันทึกก่อนอนุมัติอีกครั้ง
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApprove(null)}>ยกเลิก</Button>
            <Button
              onClick={() => confirmApprove && handleApprove(confirmApprove)}
              disabled={approveGateLoading || approveBlocked}
            >
              ยืนยันการอนุมัติ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason Dialog — shared by "ขอแก้ไข" and "ปฏิเสธ" */}
      <Dialog open={reasonDialog.open} onOpenChange={(v) => { if (!v) setReasonDialog({ open: false, item: null, kind: 'rejected' }); }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reasonDialog.kind === 'revision' ? 'ขอแก้ไขเนื้อหา' : 'ปฏิเสธเนื้อหา'}</DialogTitle>
            <DialogDescription>
              {reasonDialog.kind === 'revision'
                ? 'เนื้อหานี้จะถูกส่งกลับให้ผู้สร้างแก้ไข'
                : 'เนื้อหานี้จะถูกเปลี่ยนสถานะเป็น "ปฏิเสธ"'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {reasonDialog.kind === 'revision' ? 'เหตุผลที่ขอแก้ไข (ไม่บังคับ)' : 'เหตุผลที่ปฏิเสธ (ไม่บังคับ)'}
            </p>
            <Textarea
              placeholder="ระบุเหตุผลหรือคำแนะนำในการแก้ไข..."
              value={rejectReason}
              onChange={e => { setRejectReason(e.target.value); autoResizeReason(e.target); }}
              ref={reasonRef}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog({ open: false, item: null, kind: 'rejected' })}>ยกเลิก</Button>
            <Button variant={reasonDialog.kind === 'revision' ? 'default' : 'destructive'} onClick={handleDecision}>
              {reasonDialog.kind === 'revision' ? 'ยืนยันขอแก้ไข' : 'ยืนยันการปฏิเสธ'}
            </Button>
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
    </>
  );
}
