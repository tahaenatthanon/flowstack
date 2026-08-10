import { ChevronRight, FileText, Play, Clock, Pencil, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { usePublishChannels } from '@/hooks/useContent';
import { cn } from '@/lib/utils';
import type { ContentItem, PlanItem } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import ContentArticleView from './ContentArticleView';
import ContentVideoView from './ContentVideoView';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';

export default function ContentDetailView({ item, onBack }: { item: ContentItem; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isVideo = item.type === 'video' || ['tiktok', 'youtube', 'reels', 'shorts'].includes((item.platform ?? '').toLowerCase());

  const [schedOpen, setSchedOpen] = useState(false);
  const [schedChannelId, setSchedChannelId] = useState('');
  const [schedDt, setSchedDt] = useState('');
  const [savingSched, setSavingSched] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);

  const { data: channels = [] } = usePublishChannels(schedOpen);

  const handleSchedule = async () => {
    if (!schedChannelId || !schedDt) return;
    if (new Date(schedDt) < new Date()) {
      toast({ title: 'เวลาที่เลือกผ่านมาแล้ว', description: 'กรุณาเลือกเวลาในอนาคต', variant: 'destructive' });
      return;
    }
    setSavingSched(true);
    try {
      await apiFetch('/brand-content.php?action=schedules', {
        method: 'POST',
        body: JSON.stringify({ plan_item_id: item.plan_item_id, channel_id: schedChannelId, scheduled_at: schedDt }),
      });
      toast({ title: 'ตั้งเวลาโพสต์แล้ว' });
      setSchedOpen(false);
      setSchedChannelId('');
      setSchedDt('');
      qc.invalidateQueries({ queryKey: ['content', 'schedules'] });
    } catch (e: any) {
      toast({ title: 'ตั้งเวลาไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSavingSched(false);
    }
  };

  // Build a pseudo-PlanItem from ContentItem for the edit dialog
  const planItem: PlanItem = {
    id: item.id || '',
    plan_id: item.plan_id || '',
    topic: item.title || '',
    caption: item.caption || '',
    platform: item.platform || 'facebook',
    scheduled_date: item.scheduled_date || item.day_label || '',
    day_label: item.day_label || '',
    day_order: 0,
    image_brief: item.image_brief || '',
    generated_image_url: item.generated_image_url || '',
    image_gen_status: null,
    article_content: item.article_content || '',
    content_item_id: item.id,
    content_type: item.type,
  };

  const handleEditSave = async (data: {
    topic: string; caption: string; platform: string;
    scheduled_date: string; image_brief?: string; article_content?: string;
  }) => {
    await apiFetch(`/content-items.php?id=${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: data.topic,
        caption: data.caption,
        platform: data.platform,
        scheduled_date: data.scheduled_date || null,
        image_brief: data.image_brief || '',
        ...(data.article_content !== undefined && { article_content: data.article_content }),
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
      await apiFetch('/brand-content.php?action=generate-article', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'AI เขียนบทความสำเร็จ!' });
    } catch (e: any) {
      toast({ title: 'สร้างบทความไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  const handleGenerateArticle = async () => {
    setGeneratingArticle(true);
    toast({ title: 'AI กำลังเขียนเนื้อหา...', description: 'โปรดรอสักครู่ (อาจใช้เวลา 30-60 วินาที)' });
    try {
      await apiFetch('/brand-content.php?action=generate-article', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'สร้างเนื้อหาสำเร็จ!' });
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
            {item.platform && (
              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', PLATFORM_MAP[item.platform]?.color ?? 'bg-muted text-muted-foreground')}>
                {PLATFORM_MAP[item.platform]?.label ?? item.platform}
              </span>
            )}
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
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSchedOpen(true)}>
              <Clock className="h-3.5 w-3.5" />ตั้งเวลาโพสต์
            </Button>
          )}
        </div>
      </div>

      {isVideo ? <ContentVideoView item={item} /> : <ContentArticleView item={item} />}

      {/* Schedule Dialog */}
      <Dialog open={schedOpen} onOpenChange={open => { setSchedOpen(open); if (!open) { setSchedChannelId(''); setSchedDt(''); } }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />ตั้งเวลาโพสต์</DialogTitle>
            <DialogDescription className="line-clamp-2">{item.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>ช่องทาง <span className="text-destructive">*</span></Label>
              <Select value={schedChannelId} onValueChange={setSchedChannelId}>
                <SelectTrigger><SelectValue placeholder="เลือกช่องทาง" /></SelectTrigger>
                <SelectContent>
                  {channels.length === 0 && <SelectItem value="__none__" disabled>ยังไม่มีช่องทาง</SelectItem>}
                  {channels.map((ch: any) => {
                    const pm = PLATFORM_MAP[ch.platform] ?? { label: ch.platform };
                    return <SelectItem key={ch.id} value={ch.id}>[{pm.label}] {ch.name}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>วันและเวลา <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" value={schedDt} onChange={e => setSchedDt(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSchedOpen(false)}>ยกเลิก</Button>
            <Button disabled={savingSched || !schedChannelId || !schedDt} onClick={handleSchedule} className="gap-1.5">
              {savingSched ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> : null}
              {savingSched ? 'กำลังบันทึก...' : 'ตั้งเวลา'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — same ContentCardDialog used by planner page */}
      <ContentCardDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        date={null}
        planId={item.plan_id || ''}
        existingItem={planItem}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
        onRequestAI={handleEditAI}
        onGenerateImage={handleEditGenerateImage}
        isGeneratingImage={generatingImage}
      />
    </div>
  );
}
