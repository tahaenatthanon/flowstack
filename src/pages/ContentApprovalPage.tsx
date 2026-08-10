import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X, Filter, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export default function ContentApprovalPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useContentItems();

  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; item: ContentItem | null }>({ open: false, item: null });
  const [rejectReason, setRejectReason] = useState('');
  const [confirmApprove, setConfirmApprove] = useState<ContentItem | null>(null);

  // Filter: only items with review status
  const pendingItems = items
    .filter(item => item.status === 'review')
    .filter(item => platformFilter === 'all' || item.platform === platformFilter)
    .filter(item =>
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleApprove = async (item: ContentItem) => {
    try {
      await apiFetch(`/content-items.php?id=${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'published' }),
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
        body: JSON.stringify({ status: 'draft' }),
      });
      toast({ title: 'ปฏิเสธแล้ว', description: `"${item.title}" ถูกส่งกลับไปแก้ไข` });
      qc.invalidateQueries({ queryKey: contentKeys.items() });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถปฏิเสธได้', variant: 'destructive' });
    }
    setRejectDialog({ open: false, item: null });
    setRejectReason('');
  };

  const platformOptions = Object.entries(PLATFORM_MAP).map(([k, v]) => ({ value: k, label: v.label }));
  const usedPlatforms = [...new Set(pendingItems.map(i => i.platform).filter(Boolean))];

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="ค้นหาชื่อคอนเทนต์..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8"
          />
          <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
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
        <Badge variant="secondary" className="ml-auto">
          {pendingItems.length} รายการ
        </Badge>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">กำลังโหลด...</div>
      ) : pendingItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <AlertTriangle className="h-10 w-10 opacity-30" />
          <p className="text-lg font-medium">ไม่มีรายการรออนุมัติ</p>
          <p className="text-sm">เนื้อหาทั้งหมดได้รับการจัดการเรียบร้อยแล้ว</p>
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
              {pendingItems.map((item) => {
                const platform = PLATFORM_MAP[item.platform ?? ''] ?? null;
                const type = TYPE_MAP[item.type] ?? TYPE_MAP.article;
                const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <TableRow key={item.id}>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setConfirmApprove(item)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="h-4 w-4 mr-1" />อนุมัติ
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setRejectDialog({ open: true, item }); setRejectReason(''); }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4 mr-1" />ปฏิเสธ
                        </Button>
                      </div>
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
              ต้องการอนุมัติ "{confirmApprove?.title}" ใช่หรือไม่? เนื้อหาจะถูกเปลี่ยนสถานะเป็นเผยแพร่แล้ว
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
              เนื้อหานี้จะถูกส่งกลับไปยังสถานะ "ร่าง" เพื่อให้ผู้สร้างแก้ไข
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
    </PageShell>
  );
}
