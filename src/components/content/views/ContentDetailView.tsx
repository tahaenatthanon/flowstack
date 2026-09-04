import { ChevronRight, FileText, Play, Clock, Pencil, Sparkles, Loader2, Check, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

import { cn } from '@/lib/utils';
import type { ContentItem, PlanItem } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import ContentArticleView from './ContentArticleView';
import ContentVideoView from './ContentVideoView';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import { SchedulePublishDialog } from '@/components/content/SchedulePublishDialog';

export default function ContentDetailView({
  item,
  onBack,
  context = 'content',
}: {
  item: ContentItem;
  onBack: () => void;
  context?: 'approval' | 'content';
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isVideo = item.type === 'video' || ['tiktok', 'youtube', 'reels', 'shorts'].includes((item.platform ?? '').toLowerCase());
  const isApproval = context === 'approval';
  const canApprove = isApproval && item.status === 'pending_approval';
  // Authors send draft/revision work into the approval queue — never from the approver's side
  const canRequestApproval = !isApproval && (item.status === 'draft' || item.status === 'revision');
  // Publishing/scheduling require an approval timestamp for the current content version.
  const hasApproval = !!item.approved_at;
  const canSchedule = !isApproval && item.status === 'approved' && hasApproval;
  const canPublish = !isApproval && item.status === 'approved' && hasApproval;


  const [editOpen, setEditOpen] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);

  // Approval actions — 'revision' and 'rejected' collect an optional reason
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<'revision' | 'rejected' | null>(null);
  const [reason, setReason] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  // Auto-resize the reason textarea to fit its content
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeReason = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    if (reasonDialog && reasonRef.current) autoResizeReason(reasonRef.current);
  }, [reasonDialog]);

  // Request approval — author-side action, draft/revision → pending_approval
  const [requestApprovalConfirm, setRequestApprovalConfirm] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);

  // Publish — author-side action, approved → published
  const [publishDialog, setPublishDialog] = useState<'schedule' | 'send_now' | null>(null);

  // Approval decisions — one PUT per decision, then refresh both list views.
  // 'revision' and 'rejected' also persist the approver's reason.
  const applyDecision = async (status: 'approved' | 'revision' | 'rejected', note?: string) => {
    setSavingDecision(true);
    try {
      await apiFetch(`/content-items.php?id=${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          ...(status !== 'approved' && { reject_reason: note?.trim() ? note.trim() : null }),
        }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      return true;
    } catch (e: any) {
      toast({ title: 'ดำเนินการไม่สำเร็จ', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setSavingDecision(false);
    }
  };

  const handleApproveFromDetail = async () => {
    if (await applyDecision('approved')) {
      toast({ title: 'อนุมัติเรียบร้อย', description: `"${item.title}" ได้รับการอนุมัติแล้ว` });
      setApproveConfirm(false);
      onBack();
    }
  };

  const handleRevisionRequest = async () => {
    if (await applyDecision('revision', reason)) {
      toast({ title: 'ขอแก้ไขแล้ว', description: `"${item.title}" ถูกส่งกลับให้แก้ไข` });
      setReasonDialog(null);
      setReason('');
      onBack();
    }
  };

  const handleRejectFromDetail = async () => {
    if (await applyDecision('rejected', reason)) {
      toast({ title: 'ปฏิเสธแล้ว', description: `"${item.title}" ถูกเปลี่ยนสถานะเป็นปฏิเสธ` });
      setReasonDialog(null);
      setReason('');
      onBack();
    }
  };

  const handleRequestApproval = async () => {
    setSavingRequest(true);
    try {
      await apiFetch(`/content-items.php?id=${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'pending_approval' }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'ส่งอนุมัติแล้ว', description: `"${item.title}" ถูกส่งเข้าสู่การอนุมัติ` });
      setRequestApprovalConfirm(false);
    } catch (e: any) {
      toast({ title: 'ส่งอนุมัติไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSavingRequest(false);
    }
  };

  // Build a pseudo-PlanItem from ContentItem for the edit dialog
  const planItem: PlanItem = {
    id: item.id || '',
    plan_id: item.plan_id || '',
    topic: item.title || '',
    caption: item.caption || '',
    platform: item.platform || '',
    platforms: item.platforms ?? null,
    scheduled_date: item.scheduled_date || item.day_label || '',
    day_label: item.day_label || '',
    day_order: 0,
    image_brief: item.image_brief || '',
    generated_image_url: item.generated_image_url || '',
    image_gen_status: null,
    article_content: item.article_content || '',
    seo_title: item.seo_title || '',
    slug: item.slug || '',
    meta_description: item.meta_description || '',
    meta_keywords: item.meta_keywords || '',
    structured_data: item.structured_data || '',
    og_image: item.og_image || '',
    content_item_id: item.id,
    content_type: item.type,
  };

  const handleEditSave = async (data: {
    topic: string; caption: string; platform: string; platforms?: string[];
    scheduled_date: string; image_brief?: string; article_content?: string;
    seo_title?: string; slug?: string; meta_description?: string; meta_keywords?: string;
    og_image?: string; structured_data?: string;
  }) => {
    await apiFetch(`/content-items.php?id=${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: data.topic,
        caption: data.caption,
        platform: data.platform,
        platforms: data.platforms ?? [],
        scheduled_date: data.scheduled_date || null,
        image_brief: data.image_brief || '',
        ...(data.article_content !== undefined && { article_content: data.article_content }),
        seo_title: data.seo_title ?? '',
        slug: data.slug ?? '',
        meta_description: data.meta_description ?? '',
        meta_keywords: data.meta_keywords ?? '',
        og_image: data.og_image ?? '',
        structured_data: data.structured_data ?? '',
      }),
    });
    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
    toast({ title: 'อัพเดทคอนเทนต์แล้ว' });
  };

  const handleEditDelete = async (itemId: string) => {
    await apiFetch(`/content-items.php?id=${itemId}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
    toast({ title: 'ลบรายการแล้ว' });
    onBack();
  };

  const handleEditAI = async (data: { topic: string; platform: string; scheduled_date: string }) => {
    toast({ title: 'AI กำลังเขียนบทความ...', description: 'โปรดรอสักครู่ (อาจใช้เวลา 30-60 วินาที)' });
    try {
      const result = await apiFetch('/brand-content.php?action=generate-article', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({
        title: result?.generation_status === 'failed' ? 'สร้างไม่ผ่าน SEO — สถานะ revision' : 'AI เขียนบทความสำเร็จ!',
        description: result?.generation_status === 'failed' ? `คะแนน SEO ${result?.seo?.score ?? 0} — เนื้อหาถูกบันทึกเป็น revision กรุณาตรวจสอบ SEO Checklist` : undefined,
        variant: result?.generation_status === 'failed' ? 'destructive' : undefined,
      });
    } catch (e: any) {
      toast({ title: 'สร้างบทความไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  const handleGenerateArticle = async () => {
    setGeneratingArticle(true);
    toast({ title: 'AI กำลังเขียนเนื้อหา...', description: 'โปรดรอสักครู่ (อาจใช้เวลา 30-60 วินาที)' });
    try {
      const result = await apiFetch('/brand-content.php?action=generate-article', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({
        title: result?.generation_status === 'failed' ? 'สร้างไม่ผ่าน SEO — สถานะ revision' : 'สร้างเนื้อหาสำเร็จ!',
        description: result?.generation_status === 'failed' ? `คะแนน SEO ${result?.seo?.score ?? 0} — เนื้อหาถูกบันทึกเป็น revision กรุณาตรวจสอบ SEO Checklist` : undefined,
        variant: result?.generation_status === 'failed' ? 'destructive' : undefined,
      });
    } catch (e: any) {
      toast({ title: 'สร้างเนื้อหาไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingArticle(false);
    }
  };

  const handleEditGenerateImage = async (itemId: string, imageBrief: string) => {
    setGeneratingImage(true);
    try {
      const res = await apiFetch('/brand-content.php?action=generate-image', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, image_brief: imageBrief }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      if (res.image_url) {
        toast({ title: 'สร้างภาพสำเร็จ!', description: 'รีเฟรชเพื่อดูภาพ' });
      } else if (res.message) {
        toast({ title: 'สร้างภาพแล้ว', description: res.message });
      } else {
        toast({ title: 'สร้างภาพสำเร็จ' });
      }
    } catch (e: any) {
      toast({ title: 'สร้างภาพไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 shrink-0 -ml-1" onClick={onBack}>
          <ChevronRight className="h-4 w-4 rotate-180" />กลับ
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg leading-tight">{item.title}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isVideo ? <><Play className="h-3 w-3" />วิดีโอ</> : <><FileText className="h-3 w-3" />บทความ</>}
            </span>
            {(() => {
              const raw = item.platforms;
              const savedPlatforms = Array.isArray(raw)
                ? raw
                : typeof raw === 'string' && raw.trim()
                  ? (() => { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : raw.split(','); } catch { return raw.split(','); } })()
                  : item.platform ? item.platform.split(',') : [];
              const normalizedPlatforms = Array.from(new Set(savedPlatforms.map(p => String(p).trim().toLowerCase()).filter(Boolean)));
              return normalizedPlatforms.map(platform => (
                <span key={platform} className={cn('text-xs px-2 py-0.5 rounded font-medium', PLATFORM_MAP[platform]?.color ?? 'bg-muted text-muted-foreground')}>
                  {PLATFORM_MAP[platform]?.label ?? platform}
                </span>
              ));
            })()}
            {(item.scheduled_date || item.day_label) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.scheduled_date
                  ? new Date(item.scheduled_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                  : item.day_label}
              </span>
            )}
            {item.plan_title && (
              <span className="text-xs text-muted-foreground/60 truncate max-w-[180px]">{item.plan_title}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Approval context: only approve/revision/reject, and only while awaiting review */}
          {canApprove && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setApproveConfirm(true)}>
                <Check className="h-3.5 w-3.5" />อนุมัติ
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => { setReasonDialog('revision'); setReason(''); }}>
                <Pencil className="h-3.5 w-3.5" />ขอแก้ไข
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { setReasonDialog('rejected'); setReason(''); }}>
                <X className="h-3.5 w-3.5" />ปฏิเสธ
              </Button>
            </>
          )}
          {/* Content context keeps the authoring actions */}
          {!isApproval && (
            <>
              {!item.article_content && (
                <Button size="sm" variant="default" className="gap-1.5" onClick={handleGenerateArticle} disabled={generatingArticle}>
                  {generatingArticle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generatingArticle ? 'กำลังสร้าง...' : 'สร้างเนื้อหา AI'}
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />แก้ไข
              </Button>
              {item.plan_item_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!canSchedule}
                  title={canSchedule ? 'ตั้งเวลาโพสต์' : 'ต้องอนุมัติก่อนจึงจะตั้งเวลาได้'}
                  onClick={() => setPublishDialog('schedule')}
                >
                  <Clock className="h-3.5 w-3.5" />ตั้งเวลาโพสต์
                </Button>
              )}
              {canRequestApproval && (
                <Button size="sm" variant="outline" className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setRequestApprovalConfirm(true)}>
                  <Send className="h-3.5 w-3.5" />ขออนุมัติ
                </Button>
              )}
              {canPublish && (
                <Button size="sm" variant="default" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => setPublishDialog('send_now')}>
                  <Send className="h-3.5 w-3.5" />เผยแพร่
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {(item.status === 'revision' || item.status === 'rejected') && item.reject_reason && (
        <div className="rounded-lg border px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            {item.status === 'revision' ? 'เหตุผลที่ขอแก้ไข' : 'เหตุผลที่ปฏิเสธ'}
          </p>
          <p className="mt-1 text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">{item.reject_reason}</p>
        </div>
      )}

      {isVideo ? <ContentVideoView item={item} context={context} /> : <ContentArticleView item={item} context={context} />}

      {/* Approve confirmation — approval context only */}
      <Dialog open={approveConfirm} onOpenChange={open => { if (!open) setApproveConfirm(false); }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
            <DialogDescription>
              ต้องการอนุมัติ "{item.title}" ใช่หรือไม่? เนื้อหาจะถูกเปลี่ยนสถานะเป็นอนุมัติแล้ว
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApproveConfirm(false)}>ยกเลิก</Button>
            <Button disabled={savingDecision} onClick={handleApproveFromDetail}>
              {savingDecision ? 'กำลังบันทึก...' : 'ยืนยันการอนุมัติ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request approval confirmation — content context only */}
      <Dialog open={requestApprovalConfirm} onOpenChange={open => { if (!open) setRequestApprovalConfirm(false); }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการขออนุมัติ</DialogTitle>
            <DialogDescription>
              ต้องการส่ง "{item.title}" เข้าสู่การอนุมัติใช่หรือไม่? เนื้อหาจะถูกเปลี่ยนสถานะเป็นรออนุมัติ
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRequestApprovalConfirm(false)}>ยกเลิก</Button>
            <Button disabled={savingRequest} onClick={handleRequestApproval}>
              {savingRequest ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {publishDialog && (
        <SchedulePublishDialog
          open={!!publishDialog}
          onOpenChange={open => { if (!open) setPublishDialog(null); }}
          contentId={item.id}
          contentTitle={item.title}
          mode={publishDialog}
          defaultCaption={item.caption || ''}
          defaultBody={(() => { try { return JSON.parse(item.article_content || '{}')?.html || ''; } catch { return ''; } })()}
        />
      )}

      {/* Legacy publish confirmation removed: publishing must select a platform. */}

      {/* Reason dialog — shared by ขอแก้ไข and ปฏิเสธ; reason is optional */}
      <Dialog open={!!reasonDialog} onOpenChange={open => { if (!open) { setReasonDialog(null); setReason(''); } }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reasonDialog === 'revision' ? 'ขอแก้ไขเนื้อหา' : 'ปฏิเสธเนื้อหา'}</DialogTitle>
            <DialogDescription>
              {reasonDialog === 'revision'
                ? 'เนื้อหานี้จะถูกเปลี่ยนสถานะเป็น "รอแก้ไข" และส่งกลับให้ผู้สร้าง'
                : 'เนื้อหานี้จะถูกเปลี่ยนสถานะเป็น "ปฏิเสธ" และแสดงในแท็บปฏิเสธ'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{reasonDialog === 'revision' ? 'เหตุผลที่ขอแก้ไข (ไม่บังคับ)' : 'เหตุผลที่ปฏิเสธ (ไม่บังคับ)'}</Label>
            <Textarea
              placeholder="ระบุเหตุผลหรือคำแนะนำในการแก้ไข..."
              value={reason}
              onChange={e => { setReason(e.target.value); autoResizeReason(e.target); }}
              ref={reasonRef}
              className="resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setReasonDialog(null); setReason(''); }}>ยกเลิก</Button>
            <Button
              variant={reasonDialog === 'revision' ? 'default' : 'destructive'}
              disabled={savingDecision}
              onClick={reasonDialog === 'revision' ? handleRevisionRequest : handleRejectFromDetail}
            >
              {savingDecision ? 'กำลังบันทึก...' : reasonDialog === 'revision' ? 'ยืนยันขอแก้ไข' : 'ยืนยันการปฏิเสธ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — same ContentCardDialog used by planner page */}
      {!isApproval && (
        <ContentCardDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          date={null}
          planId={item.plan_id || ''}
          existingItem={planItem}
          contentStatus={item.status}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
          onRequestAI={handleEditAI}
          onGenerateImage={handleEditGenerateImage}
          isGeneratingImage={generatingImage}
        />
      )}
    </div>
  );
}
