import { Play, FileText, Image, Search, Trash2, Loader2, ImageIcon, Send, Calendar, Layers, Edit3, RotateCcw, Stamp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useContentItems } from '@/hooks/useContent';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ContentItem, PlanItem } from '@/components/content/types';
import { TYPE_MAP, PLATFORM_MAP, STATUS_MAP } from '@/components/content/types';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import ImageViewer from '@/components/content/ImageViewer';
import { SchedulePublishDialog } from '@/components/content/SchedulePublishDialog';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { getPlatformColors } from '@/lib/platformConfig';

export default function ContentListTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'revision' | 'pending_approval' | 'approved' | 'published'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'article' | 'video' | 'image'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [publishDialog, setPublishDialog] = useState<{ contentId: string; contentTitle: string; mode: 'schedule' | 'send_now'; defaultCaption?: string; defaultBody?: string } | null>(null);
  const [imageViewerSrc, setImageViewerSrc] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ContentItem | null>(null);

  const { data: items = [], isLoading } = useContentItems();

  // Always use the freshest cached version when the dialog is open
  const editItemLatest = editItem ? (items.find(i => i.id === editItem.id) ?? editItem) : null;

  // Build the PlanItem shape ContentCardDialog expects
  const asPlanItem = (item: ContentItem): PlanItem => ({
    id: item.id,
    plan_id: item.plan_id || '',
    topic: item.title || '',
    caption: item.caption || '',
    platform: item.platform || 'facebook',
    scheduled_date: item.scheduled_date || '',
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
    reject_reason: item.reject_reason || null,
  });

  const handleSave = async (data: {
    topic: string;
    caption: string;
    platform: string;
    scheduled_date: string;
    image_brief?: string;
    article_content?: string;
    seo_title?: string;
    slug?: string;
    meta_description?: string;
    meta_keywords?: string;
    og_image?: string;
    structured_data?: string;
  }) => {
    if (!editItemLatest) return;
    await apiFetch(`/content-items.php?id=${editItemLatest.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: data.topic,
        caption: data.caption,
        platform: data.platform,
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

  const handleDelete = async (itemId: string) => {
    await apiFetch(`/content-items.php?id=${itemId}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
    toast({ title: 'ลบรายการแล้ว' });
    setEditItem(null);
  };

  const handleRequestAI = async (_data: { topic: string; platform: string; scheduled_date: string }) => {
    if (!editItemLatest) return;
    toast({ title: 'AI กำลังเขียนบทความ...', description: 'โปรดรอสักครู่ (อาจใช้เวลา 30-60 วินาที)' });
    try {
      const result = await apiFetch('/brand-content.php?action=generate-article', {
        method: 'POST',
        body: JSON.stringify({ item_id: editItemLatest.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({
        title: result?.generation_status === 'failed' ? 'สร้างไม่ผ่าน SEO/AEO — สถานะ revision' : 'AI เขียนบทความสำเร็จ — SEO + AEO ผ่าน',
        description: result?.generation_status === 'failed'
          ? `SEO ${result?.seo?.score ?? 0}/100 (${result?.seo?.gate ?? 'failed'}) · AEO ${result?.aeo?.score ?? 0}/100 (${result?.aeo?.gate ?? 'failed'}) — ตรวจ Checklist เพื่อดูข้อที่ต้องแก้`
          : `SEO ${result?.seo?.score ?? 0}/100 · AEO ${result?.aeo?.score ?? 0}/100`,
        variant: result?.generation_status === 'failed' ? 'destructive' : undefined,
      });
    } catch (e: any) {
      toast({ title: 'สร้างบทความไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  const handleGenerateImage = async (itemId: string, imageBrief: string) => {
    setGeneratingImage(true);
    try {
      const res = await apiFetch('/brand-content.php?action=generate-image', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, image_brief: imageBrief }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: res?.image_url ? 'สร้างภาพสำเร็จ!' : (res?.message ?? 'สร้างภาพสำเร็จ') });
    } catch (e: any) {
      toast({ title: 'สร้างภาพไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  };

  const getItemPlatforms = (item: ContentItem): string[] => {
    const normalize = (values: unknown[]): string[] => Array.from(new Set(
      values
        .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
        .flatMap(p => p.split(','))
        .map(p => p.trim().toLowerCase())
        .filter(Boolean),
    ));

    const raw = (item as ContentItem & { platforms?: unknown }).platforms;
    if (Array.isArray(raw)) return normalize(raw);

    if (typeof raw === 'string' && raw.trim() !== '') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return normalize(parsed);
      } catch {
        // Fall through and normalize the legacy platform field.
      }
    }

    return normalize([item.platform || '']);
  };

  const platformCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      for (const key of getItemPlatforms(item)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [items]);

  const counts = useMemo(() => ({
    all: items.length,
    article: items.filter(i => i.type === 'article').length,
    video: items.filter(i => i.type === 'video').length,
    image: items.filter(i => i.type === 'image').length,
  }), [items]);

  const statusCounts = useMemo(() => ({
    all: items.length,
    draft: items.filter(i => i.status === 'draft').length,
    revision: items.filter(i => i.status === 'revision').length,
    pending_approval: items.filter(i => i.status === 'pending_approval').length,
    approved: items.filter(i => i.status === 'approved').length,
    published: items.filter(i => i.status === 'published').length,
  }), [items]);

  const filtered = useMemo(() =>
    items.filter(c => {
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchType = typeFilter === 'all' || c.type === typeFilter;
      const matchPlatform = platformFilter === 'all' || getItemPlatforms(c).includes(platformFilter);
      const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchType && matchPlatform && matchSearch;
    }), [items, statusFilter, typeFilter, platformFilter, search]);

  return (
    <>
      <div className="space-y-4">
        {/* Type filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground shrink-0">ประเภท:</span>
          {([
            ['all', 'ทั้งหมด', Layers],
            ['article', 'บทความ', FileText],
            ['video', 'วีดีโอ', Play],
            ['image', 'รูปภาพ', Image],
          ] as const).map(([key, label, Icon]) => {
            const isActive = typeFilter === key;
            const count = counts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key)}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{label}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground shrink-0">สถานะ:</span>
          {([
            ['all', 'ทั้งหมด', Layers],
            ['draft', 'ฉบับร่าง', Edit3],
            ['revision', 'รอแก้ไข', RotateCcw],
            ['approved', 'รอเผยแพร่', Stamp],
            ['published', 'เผยแพร่แล้ว', CheckCircle2],
          ] as const).map(([key, label, Icon]) => {
            const isActive = statusFilter === key;
            const count = statusCounts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{label}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground shrink-0">แพลตฟอร์ม:</span>
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              platformFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            ทั้งหมด {items.length}
          </button>
          {Array.from(platformCounts.entries())
            .filter(([key]) => key !== '__none__')
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => {
              const colors = getPlatformColors(key);
              const isActive = platformFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlatformFilter(platformFilter === key ? 'all' : key)}
                  style={isActive ? undefined : { backgroundColor: colors.filterBg, color: colors.filterText, borderColor: colors.border }}
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:opacity-80'
                  }`}
                  title={PLATFORM_MAP[key]?.label ?? key}
                >
                  <PlatformIcon platform={key} size={12} />
                  <span>{count}</span>
                </button>
              );
            })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา content..."
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-xl border divide-y bg-background">
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                {typeFilter === 'video'
                  ? <Play className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  : <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />}
                <p className="font-medium">
                  {search
                    ? 'ไม่พบคอนเทนต์ที่ค้นหา'
                    : typeFilter === 'video' ? 'ยังไม่มีวิดีโอ'
                    : typeFilter === 'article' ? 'ยังไม่มีบทความ'
                    : 'ยังไม่มีคอนเทนต์'}
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  {typeFilter === 'video'
                    ? 'สร้างด้วย platform TikTok หรือ YouTube เพื่อรับวิดีโอสคริปต์'
                    : 'ใช้ "สร้างคอนเทนต์" หรือ "Batch สร้าง" ที่ด้านบน'}
                </p>
              </div>
            )}
            {filtered.map(item => {
              const t = TYPE_MAP[item.type] ?? TYPE_MAP.article;
              const TIcon = t.icon;
              const hasContent = !!item.article_content;
              const isVideo = item.type === 'video';
              // Redundant inside a status-filtered tab — every row there shares that status
              const showStatusBadge = statusFilter === 'all' || statusFilter !== item.status;
              const status = STATUS_MAP[item.status];
              // STATUS_MAP bundles bg-* fills for pill badges — the inline title badge takes text colors only
              const statusTextColor = status?.color
                .split(' ')
                .filter(c => c.startsWith('text-'))
                .join(' ');
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => setEditItem(item)}
                >
                  {item.generated_image_url ? (
                    <div
                      className="w-10 h-10 rounded-lg overflow-hidden border shrink-0 bg-muted cursor-zoom-in hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={e => { e.stopPropagation(); setImageViewerSrc(item.generated_image_url!); }}
                    >
                      <img src={item.generated_image_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </div>
                  ) : (
                    <div className={cn('p-2 rounded-lg shrink-0', t.color)}>
                      <TIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-snug truncate">
                      {item.title}
                      {showStatusBadge && status && (
                        <span className={cn('text-[11px] font-medium align-middle', statusTextColor)}>
                          {' '}({status.label})
                        </span>
                      )}
                    </p>
                    {(item.status === 'revision' || item.status === 'rejected') && item.reject_reason && (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                        <span className="font-semibold shrink-0">{item.status === 'revision' ? 'เหตุผลขอแก้ไข:' : 'เหตุผลปฏิเสธ:'}</span>
                        <span className="line-clamp-2" title={item.reject_reason}>{item.reject_reason}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full font-medium',
                        isVideo
                          ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
                      )}>
                        {isVideo ? '🎬 วิดีโอ' : '📝 บทความ'}
                      </span>
                      {getItemPlatforms(item).map(platform => {
                        const pc = getPlatformColors(platform);
                        return (
                          <span
                            key={platform}
                            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: pc.bg, color: pc.text }}
                            title={PLATFORM_MAP[platform]?.label ?? platform}
                          >
                            <PlatformIcon platform={platform} size={12} />
                          </span>
                        );
                      })}
                      {hasContent
                        ? <span className="text-[11px] px-1.5 py-0 rounded bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-medium">AI ✓</span>
                        : <span className="text-[11px] px-1.5 py-0 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium">รอสร้าง</span>
                      }
                    </div>
                    {item.caption && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">
                        {item.caption.replace(/<[^>]*>/g, '').slice(0, 80)}{item.caption.replace(/<[^>]*>/g, '').length > 80 ? '...' : ''}
                      </p>
                    )}
                    {!item.caption && item.image_brief && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1 flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 shrink-0" />
                        {item.image_brief.slice(0, 60)}{item.image_brief.length > 60 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(item.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    {item.status === 'approved' && item.approved_at && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:text-green-600 text-muted-foreground"
                          onClick={e => {
                            e.stopPropagation();
                            setPublishDialog({ contentId: item.id, contentTitle: item.title, mode: 'send_now', defaultCaption: item.caption || '', defaultBody: (() => { try { return JSON.parse(item.article_content || '{}')?.html || ''; } catch { return ''; } })() });
                          }}
                          title="ส่งทันที"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:text-primary text-muted-foreground"
                          onClick={e => {
                            e.stopPropagation();
                            setPublishDialog({ contentId: item.id, contentTitle: item.title, mode: 'schedule', defaultCaption: item.caption || '', defaultBody: (() => { try { return JSON.parse(item.article_content || '{}')?.html || ''; } catch { return ''; } })() });
                          }}
                          title="ตั้งเวลาโพสต์"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 hover:text-destructive text-muted-foreground"
                      onClick={e => {
                        e.stopPropagation();
                        setDeleteConfirmItem(item);
                      }}
                      title="ลบ"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation — same confirmation UI as Content Detail */}
      <Dialog open={!!deleteConfirmItem} onOpenChange={open => { if (!open) setDeleteConfirmItem(null); }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบคอนเทนต์</DialogTitle>
            <DialogDescription>
              ต้องการลบ "{deleteConfirmItem?.title || 'คอนเทนต์นี้'}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmItem(null)}>ยกเลิก</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteConfirmItem) return;
                const itemId = deleteConfirmItem.id;
                await handleDelete(itemId);
                setDeleteConfirmItem(null);
              }}
            >
              ยืนยันการลบ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editItemLatest && (
        <ContentCardDialog
          open={!!editItem}
          onOpenChange={open => { if (!open) setEditItem(null); }}
          date={editItemLatest.scheduled_date ? new Date(editItemLatest.scheduled_date + 'T00:00:00') : null}
          planId={editItemLatest.plan_id || ''}
          existingItem={asPlanItem(editItemLatest)}
          contentStatus={editItemLatest?.status}
          onSave={handleSave}
          onDelete={handleDelete}
          onRequestAI={handleRequestAI}
          onGenerateImage={handleGenerateImage}
          isGeneratingImage={generatingImage}
        />
      )}

      {/* Publish dialog */}
      {publishDialog && (
        <SchedulePublishDialog
          open={!!publishDialog}
          onOpenChange={open => { if (!open) setPublishDialog(null); }}
          contentId={publishDialog.contentId}
          contentTitle={publishDialog.contentTitle}
          mode={publishDialog.mode}
          defaultCaption={publishDialog.defaultCaption}
          defaultBody={publishDialog.defaultBody}
        />
      )}

      {/* Image viewer */}
      <ImageViewer src={imageViewerSrc ?? ''} alt="" open={!!imageViewerSrc} onOpenChange={v => { if (!v) setImageViewerSrc(null); }} />
    </>
  );
}
