import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { PlatformBadgeList } from '@/components/content/PlatformBadgeList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { PlanItem } from '@/components/content/types';
import { getCanonicalContentType, PLATFORM_MAP, platformsNeedScriptSections } from '@/components/content/types';
import { getThaiDayName, formatThaiDate } from './calendarUtils';
import { CalendarDays, Save, Trash2, Sparkles, ImagePlus, RefreshCw, Loader2, Image as ImageIcon, FileText, Hash, Lightbulb, Clapperboard, MessageSquare, Share2, BookOpen, ChevronDown, Video, Play, Send, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useQueryClient } from '@tanstack/react-query';
import { useContentGlobalSettings, useQualityRecheck } from '@/hooks/useContent';
import { useResearchRun, RESEARCH_STEP_LABELS, researchSeedTopic } from '@/hooks/useResearchRun';
import ArticleEditor from '@/components/content/ArticleEditor';
import ImageViewer from '@/components/content/ImageViewer';
import type { SeoFields } from '@/components/content/types';
import { emptySeoFields, SEO_GATE_LABEL } from '@/components/content/types';

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-sm font-medium w-full text-left py-1">
        <span className={cn('transition-transform', open ? 'rotate-90' : '')} style={{ display: 'inline-block' }}>▶</span>
        {title}
      </button>
      {open && children}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  planId: string;
  existingItem?: PlanItem | null;
  /** Status of the content item being edited — drives the "ขออนุมัติ" footer button */
  contentStatus?: string;
  onSave: (data: {
    item_id?: string;
    topic: string;
    caption: string;
    platform: string;
    platforms?: string[];
    scheduled_date: string;
    image_brief?: string;
    article_content?: string;
    seo_title?: string;
    slug?: string;
    meta_description?: string;
    meta_keywords?: string;
    og_image?: string;
    structured_data?: string;
  }) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  onRequestAI?: (data: { topic: string; platform: string; scheduled_date: string }) => Promise<void>;
  onGenerateImage?: (itemId: string, imageBrief: string) => Promise<void>;
  isGeneratingImage?: boolean;
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  facebook: Share2, instagram: Share2, tiktok: Clapperboard, youtube: Clapperboard,
};


export function ContentCardDialog({
  open, onOpenChange, date, planId, existingItem, contentStatus,
  onSave, onDelete, onRequestAI, onGenerateImage, isGeneratingImage,
}: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [imageBrief, setImageBrief] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [articleHtml, setArticleHtml] = useState('');
  const [seoFields, setSeoFields] = useState<SeoFields>(emptySeoFields());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedKbId, setSelectedKbId] = useState('');
  const [kbPickerOpen, setKbPickerOpen] = useState(false);
  const [regenImageOnSave, setRegenImageOnSave] = useState(false);
  const [localGenerating, setLocalGenerating] = useState(false);
  const [selectedRefUrls, setSelectedRefUrls] = useState<string[]>([]);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [generatingScenes, setGeneratingScenes] = useState(false);
  // Mandatory Research — ทุกการสร้างเนื้อหาต้องผ่าน Fetch/Reuse → Analyze → Generate
  const { run: runResearch, cancel: cancelResearch, step: researchStep } = useResearchRun();

  // ตรวจ Quality โดยไม่เขียนเนื้อหาใหม่ — ต่างจาก "AI เขียนให้" ที่ generate ทั้งชุด
  // ปุ่มนี้แค่ประเมิน SEO/AEO ซ้ำแล้วเซ็ต quality_checked_at เพื่อปลดล็อก publish gate
  const qualityRecheck = useQualityRecheck();
  // override ค่าจาก response ทันทีหลังกด — ไม่ต้องรอ invalidate query ของรายการ content ทั้งชุด
  const [qualityRecheckedAt, setQualityRecheckedAt] = useState<string | null>(null);

  // Snapshot ค่าก่อนกด "AI เขียนให้" สำหรับคืนค่าเมื่อยกเลิกแล้ว generate-article
  // เขียนผลลัพธ์ลง content_items ไปแล้วก่อน checkpoint จะทัน (ดู openspec cancel-ai-generation-rollback)
  const preAIStateRef = useRef<{
    articleContent: string | null;
    articleHtml: string;
    seoFields: SeoFields;
    title: string;
    type: string | null;
    caption: string;
    status: string | undefined;
  } | null>(null);
  const cancelledAIRef = useRef(false);

  // Request approval — author sends draft/revision work into the approval queue
  const [requestApprovalConfirm, setRequestApprovalConfirm] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const canRequestApproval = !!existingItem && (contentStatus === 'draft' || contentStatus === 'revision');

  const { data: kbArticles = [] } = useQuery<any[]>({
    queryKey: ['knowledge-base'],
    queryFn: () => apiFetch('/knowledge-base.php'),
    enabled: open,
  });

  const { data: globalSettings } = useContentGlobalSettings(open);
  const productRefs: Array<{ name: string; url: string }> = (() => {
    if (!globalSettings) return [];
    try {
      const refs = JSON.parse((globalSettings as any).product_refs || '[]');
      if (Array.isArray(refs) && refs.length > 0) return refs;
    } catch {}
    try {
      const urls = JSON.parse((globalSettings as any).product_ref_image_url || '[]');
      if (Array.isArray(urls)) return urls.map((u: string, i: number) => ({ name: `สินค้า #${i + 1}`, url: u }));
    } catch {}
    return [];
  })();

  const articleData = useMemo(() => {
    if (!existingItem?.article_content) return null;
    try { return JSON.parse(existingItem.article_content); } catch { return null; }
  }, [existingItem?.article_content]);

  const hasArticle = !!(articleData?.html || articleData?.title);
  // ค่านี้ใช้ทั้งโชว์ "ตรวจ Quality ล่าสุด" และเตือนที่ปุ่ม "บันทึก" ว่าการบันทึกจะล้างค่านี้ทิ้ง
  // (api/content-items.php ล้าง quality_checked_at ทุกครั้งที่ body มีฟิลด์เนื้อหา ไม่ว่าค่าจะเปลี่ยนจริงหรือไม่)
  const qualityCheckedAtValue = qualityRecheckedAt ?? articleData?.quality_checked_at ?? null;

  // Select all product refs by default when dialog opens or refs load
  useEffect(() => {
    setSelectedRefUrls(productRefs.map(r => r.url));
  }, [open, (globalSettings as any)?.product_refs, (globalSettings as any)?.product_ref_image_url]);

  useEffect(() => {
    if (open) {
      setLocalImageUrl(null);
      setQualityRecheckedAt(null);
      if (existingItem) {
        setTopic(existingItem.topic || '');
        setCaption(existingItem.caption || '');
        const rawPlatforms = (existingItem as PlanItem & { platforms?: string[] | string | null }).platforms;
        let savedPlatforms: string[] = [];
        if (Array.isArray(rawPlatforms)) {
          savedPlatforms = rawPlatforms;
        } else if (typeof rawPlatforms === 'string' && rawPlatforms.trim() !== '') {
          try {
            const parsed = JSON.parse(rawPlatforms);
            if (Array.isArray(parsed)) savedPlatforms = parsed;
          } catch {
            savedPlatforms = rawPlatforms.split(',');
          }
        }
        if (savedPlatforms.length === 0 && existingItem.platform) {
          savedPlatforms = existingItem.platform.split(',');
        }
        setPlatforms(Array.from(new Set(savedPlatforms.map(p => p.trim().toLowerCase()).filter(Boolean))));
        setImageBrief(existingItem.image_brief || '');
      } else {
        setTopic('');
        setCaption('');
        setPlatforms([]);
        setImageBrief('');
      }
      // Populate article HTML + SEO from article_content JSON
      if (existingItem?.article_content) {
        try {
          const art = JSON.parse(existingItem.article_content);
          setArticleHtml(art.html || '');
          setSeoFields({
            seo_title:        existingItem.seo_title        || art.seo_title        || '',
            slug:             existingItem.slug             || art.slug             || '',
            meta_description: existingItem.meta_description || art.meta_description || '',
            meta_keywords:    existingItem.meta_keywords    || art.meta_keywords    || '',
            og_image:         existingItem.og_image         || art.og_image         || '',
            structured_data:  existingItem.structured_data
              || (art.structured_data
                ? (typeof art.structured_data === 'string'
                    ? art.structured_data
                    : JSON.stringify(art.structured_data, null, 2))
                : ''),
          });
        } catch {
          setArticleHtml('');
          setSeoFields(emptySeoFields());
        }
      } else {
        setArticleHtml('');
        setSeoFields(emptySeoFields());
      }
      if (date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        setScheduledDate(`${y}-${m}-${d}`);
      } else if (existingItem?.scheduled_date) {
        setScheduledDate(existingItem.scheduled_date);
      } else {
        setScheduledDate(new Date().toISOString().split('T')[0]);
      }
    }
  }, [open, existingItem, date]);

  const effectiveDate = date || (existingItem?.scheduled_date ? new Date(existingItem.scheduled_date + 'T00:00:00') : null);
  const dateStr = effectiveDate ? formatThaiDate(effectiveDate) : (existingItem?.scheduled_date ?? '');

  const handleSave = async () => {
    if (!topic.trim()) return;
    setSaving(true);
    try {
      // Merge updated html + seo back into article_content JSON
      let updatedArticleContent: string | undefined;
      if (existingItem?.article_content || articleHtml) {
        let art: Record<string, any> = {};
        if (existingItem?.article_content) {
          try { art = JSON.parse(existingItem.article_content); } catch { /* ignore */ }
        }
        // Parse structured_data back to object if valid JSON
        let parsedSd: any = undefined;
        if (seoFields.structured_data.trim()) {
          try { parsedSd = JSON.parse(seoFields.structured_data); } catch { parsedSd = seoFields.structured_data; }
        }
        art = {
          ...art,
          html:             articleHtml,
          seo_title:        seoFields.seo_title        || undefined,
          slug:             seoFields.slug             || undefined,
          meta_description: seoFields.meta_description || undefined,
          meta_keywords:    seoFields.meta_keywords    || undefined,
          og_image:         seoFields.og_image         || undefined,
          structured_data:  parsedSd                  ?? undefined,
        };
        updatedArticleContent = JSON.stringify(art);
      }

      await onSave({
        ...(existingItem?.id && { item_id: existingItem.id }),
        topic: topic.trim(),
        caption,
        platform: platforms.length > 0 ? platforms.join(',') : '',
        platforms,
        scheduled_date: scheduledDate || new Date().toISOString().split('T')[0],
        image_brief: imageBrief.trim(),
        ...(updatedArticleContent !== undefined && { article_content: updatedArticleContent }),
        seo_title: seoFields.seo_title,
        slug: seoFields.slug,
        meta_description: seoFields.meta_description,
        meta_keywords: seoFields.meta_keywords,
        og_image: seoFields.og_image,
        structured_data: seoFields.structured_data,
      });
      if (regenImageOnSave && existingItem?.id && imageBrief.trim()) {
        handleGenerateImage();
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingItem) return;
    setDeleting(true);
    try { await onDelete?.(existingItem.id); onOpenChange(false); }
    finally { setDeleting(false); }
  };

  const handleRequestApproval = async () => {
    if (!existingItem) return;
    setRequestingApproval(true);
    try {
      await apiFetch(`/content-items.php?id=${existingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'pending_approval' }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'ส่งอนุมัติแล้ว', description: `"${topic}" ถูกส่งเข้าสู่การอนุมัติ` });
      setRequestApprovalConfirm(false);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'ส่งอนุมัติไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setRequestingApproval(false);
    }
  };

  const handleAI = async () => {
    if (!topic.trim() || !existingItem?.id) return;
    setAiGenerating(true);
    cancelledAIRef.current = false;
    // Snapshot ค่าก่อนกด — ใช้คืนค่าถ้ายกเลิกแล้ว backend เขียนผลลัพธ์ไปแล้วก่อน checkpoint จะทัน
    preAIStateRef.current = {
      articleContent: existingItem.article_content ?? null,
      articleHtml,
      seoFields: { ...seoFields },
      title: existingItem.topic,
      type: existingItem.content_type ?? null,
      caption: existingItem.caption,
      status: contentStatus,
    };
    toast({ title: 'AI กำลังค้นข้อมูลและเขียนเนื้อหา...', description: 'Research → วิเคราะห์ → เขียนบทความ' });
    try {
      // Research must always use the immutable Original User Topic, never the editable title/topic.
      const researchTopic = researchSeedTopic(existingItem.source_topic, topic);
      const res: any = await runResearch({
        topic: researchTopic,
        itemId: existingItem.id,
        kbArticleId: selectedKbId || null,
      });

      if (cancelledAIRef.current) {
        // ถูกยกเลิกไปแล้วระหว่างรอผล — ถ้า backend เขียนผลลัพธ์ลง content_items ไปแล้ว
        // ก่อน checkpoint ปลายทางจะทัน (res มี article จริง ไม่ใช่ {cancelled:true})
        // ให้คืนค่ากลับเป็น snapshot ก่อนกด "AI เขียนให้" ทันที
        if (res?.cancelled !== true && res?.article && preAIStateRef.current) {
          const snap = preAIStateRef.current;
          apiFetch('/brand-content.php?action=restore-item', {
            method: 'PUT',
            body: JSON.stringify({
              item_id: existingItem.id,
              article_content: snap.articleContent,
              title: snap.title,
              type: snap.type,
              caption: snap.caption,
              seo_title: snap.seoFields.seo_title,
              slug: snap.seoFields.slug,
              meta_description: snap.seoFields.meta_description,
              meta_keywords: snap.seoFields.meta_keywords,
              structured_data: snap.seoFields.structured_data,
              og_image: snap.seoFields.og_image,
              status: snap.status,
            }),
          }).catch(() => {}).finally(() => {
            qc.invalidateQueries({ queryKey: ['content', 'items'] });
            qc.invalidateQueries({ queryKey: ['content', 'plans'] });
          });
          setArticleHtml(snap.articleHtml);
          setSeoFields(snap.seoFields);
        }
        return;
      }

      const art = res?.article;
      if (art) {
        // Do not hydrate Quality from the AI response. Quality is shown only
        // from the persisted result for the current Content version.
        setArticleHtml(art.html || '');
        setSeoFields({
          seo_title:        art.seo_title        || '',
          slug:             art.slug             || '',
          meta_description: art.meta_description || '',
          meta_keywords:    art.meta_keywords    || '',
          og_image:         art.og_image         || '',
          structured_data:  art.structured_data
            ? (typeof art.structured_data === 'string' ? art.structured_data : JSON.stringify(art.structured_data, null, 2))
            : '',
        });
      }
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      if (res?.generation_status === 'failed') {
        toast({
          title: 'สร้างเนื้อหาแล้ว แต่ยังไม่ผ่าน Quality Gate',
          description: `SEO ${res?.seo?.score ?? 0}/100 · AEO ${res?.aeo?.score ?? 0}/100 · Script ${res?.script_passed === false ? 'ไม่ผ่าน' : 'ผ่าน'} — บันทึกเป็น “รอแก้ไข”`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'สร้างเนื้อหาสำเร็จ — SEO + AEO + Script ผ่าน',
          description: `SEO ${res?.seo?.score ?? 0}/100 · AEO ${res?.aeo?.score ?? 0}/100 · Script ทุก Platform ที่เลือกผ่าน`,
        });
      }
    } catch (e: any) {
      // ถ้ายกเลิกไปแล้ว error ที่ตามมา (เช่น checkpoint คืน 409 'ถูกยกเลิกแล้ว') เป็นผลที่คาดไว้
      // ไม่ใช่ความล้มเหลวจริง — ผู้ใช้เห็น toast "ยกเลิกแล้ว" จาก handleCancelAI ไปแล้ว
      if (!cancelledAIRef.current) {
        toast({ title: 'สร้างเนื้อหาไม่สำเร็จ', description: e?.message, variant: 'destructive' });
      }
    } finally {
      setAiGenerating(false);
    }
  };

  // ยกเลิกระหว่าง AI กำลังเขียนเนื้อหา: ตั้ง flag ฝั่ง backend (fire-and-forget) +
  // คืนปุ่มกลับสู่สถานะปกติทันทีโดยไม่รอ research/generate ที่กำลังรันอยู่จบ
  const handleCancelAI = () => {
    cancelledAIRef.current = true;
    if (existingItem?.id) cancelResearch(existingItem.id);
    toast({ title: 'ยกเลิกแล้ว' });
    setAiGenerating(false);
  };

  // ตรวจ Quality ซ้ำบนเนื้อหาที่บันทึกล่าสุด — ไม่เรียก AI ไม่แก้เนื้อหา แค่ประเมิน SEO/AEO
  // แล้วเซ็ต quality_checked_at เพื่อปลดล็อก publish gate (ดู openspec/changes/content-quality-recheck-action)
  const handleQualityRecheck = async () => {
    if (!existingItem?.id) return;
    try {
      const res = await qualityRecheck.mutateAsync({ item_id: existingItem.id });
      setQualityRecheckedAt(res.quality_checked_at);
      const seoGate = SEO_GATE_LABEL[res.seo.gate];
      const aeoGate = SEO_GATE_LABEL[res.aeo.gate];
      const failCount =
        res.seo.rules.filter(r => r.status === 'failed').length +
        res.aeo.rules.filter(r => r.status === 'failed').length;
      toast({
        title: 'ตรวจ Quality เสร็จแล้ว',
        description: `SEO: ${seoGate.label} · AEO: ${aeoGate.label}` + (failCount > 0 ? ` · มี ${failCount} ข้อไม่ผ่าน` : ''),
      });
    } catch (e: any) {
      toast({ title: 'ตรวจ Quality ไม่สำเร็จ', description: e?.message, variant: 'destructive' });
    }
  };

  const handleConfirmAndAI = async () => {
    if (!topic.trim() || !existingItem?.id) return;
    // ข้อความยืนยันต้องใช้ seed เดียวกับที่ handleAI จะส่งเข้า runResearch() จริง
    // ไม่ใช่ topic เฉยๆ — ไม่งั้นผู้ใช้เห็นหัวข้อคนละอันกับที่ระบบจะ research จริง
    const researchTopic = researchSeedTopic(existingItem.source_topic, topic);
    const platformLabel = platforms.length > 0
      ? platforms.map(key => PLATFORM_MAP[key]?.label || key).join(', ')
      : 'ยังไม่เลือก';
    const ok = await confirm({
      title: 'ยืนยันให้ AI เขียนเนื้อหา',
      description: `หัวข้อ (Research seed): "${researchTopic}" · แพลตฟอร์ม: ${platformLabel} — AI จะใช้เวลาประมาณ 30-60 วินาที`,
      confirmLabel: 'ยืนยันและให้ AI เขียน',
    });
    if (!ok) return;
    handleAI();
  };

  const handleGenerateImage = async () => {
    if (!existingItem?.id || !imageBrief.trim()) return;
    setLocalGenerating(true);
    try {
      const res: any = await apiFetch('/brand-content.php?action=generate-image', {
        method: 'POST',
        body: JSON.stringify({
          item_id: existingItem.id,
          image_brief: imageBrief.trim(),
          ...(selectedRefUrls.length > 0 && { ref_urls: selectedRefUrls }),
        }),
      });
      if (res?.image_url) setLocalImageUrl(res.image_url);
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'สร้างภาพสำเร็จ!' });
    } catch (e: any) {
      toast({ title: 'สร้างภาพไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setLocalGenerating(false);
    }
  };

  const displayImageUrl = localImageUrl || existingItem?.generated_image_url || null;
  const hasImage = !!displayImageUrl;
  const isGenFailed = !localImageUrl && existingItem?.image_gen_status === 'failed';
  const isGenPending = existingItem?.image_gen_status === 'generating' || isGeneratingImage || localGenerating;

  const handleGenerateScenes = async () => {
    if (!existingItem?.id) return;
    setGeneratingScenes(true);
    toast({ title: 'กำลังสร้างภาพทุกฉาก...', description: 'อาจใช้เวลา 1-3 นาที' });
    try {
      await apiFetch('/brand-content.php?action=generate-scene-images', {
        method: 'POST',
        body: JSON.stringify({ item_id: existingItem.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'สร้างภาพทุกฉากสำเร็จ!' });
    } catch (e: any) {
      toast({ title: 'สร้างภาพไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingScenes(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!existingItem?.id) return;
    setGeneratingVideo(true);
    try {
      const res: any = await apiFetch('/brand-content.php?action=generate-video', {
        method: 'POST',
        body: JSON.stringify({ item_id: existingItem.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      if (res?.status === 'done') {
        toast({ title: 'สร้างวิดีโอสำเร็จ!' });
      } else {
        toast({ title: 'ส่งคำขอสร้างวิดีโอแล้ว', description: 'กำลังสร้าง — รอสักครู่แล้วรีเฟรช' });
      }
    } catch (e: any) {
      toast({ title: 'สร้างวิดีโอไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const headlines = articleData?.headlines;
  // Show only scripts belonging to the Content Item's selected platforms.
  // This also hides legacy scripts that were generated before platform scoping was enforced.
  const scripts = useMemo(() => {
    const rawScripts = articleData?.scripts;
    if (!rawScripts || typeof rawScripts !== 'object') return {};
    return Object.fromEntries(
      Object.entries(rawScripts).filter(([key]) => platforms.includes(key.toLowerCase())),
    );
  }, [articleData?.scripts, platforms]);

  const scriptSections = articleData?.script_sections;
  const visuals: string[] = articleData?.visuals ?? [];
  const hashtags: string[] = articleData?.hashtags ?? [];
  // Content Type Source of Truth: content_items.type (projected as content_type).
  // Never route UI behavior from legacy article_content.platform_type.
  const contentType = existingItem ? getCanonicalContentType(existingItem) : 'article';
  const isVideo = contentType === 'video';
  // เผยแพร่ไปแล้วอย่างน้อย 1 แพลตฟอร์ม → ห้ามแก้วันที่ผ่านฟอร์มนี้เช่นกัน (ครอบคลุม
  // เส้นทางเดียวกับที่ล็อกการลากบนปฏิทิน — ดู openspec/changes/lock-published-content-date)
  const dateLocked = !!existingItem?.has_published_platform;

  // Check if all scene images are generated
  const scenes = (articleData?.scenes ?? []) as any[];
  const allScenesHaveImages = scenes.length > 0 && scenes.every((s: any) => !!s.image_url);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden"
        style={{ position: 'fixed', left: 0, top: 0, transform: 'none', animation: 'none', width: '100vw', height: '100vh', maxWidth: 'none', borderRadius: 0 }}
      >
        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {hasArticle ? <FileText className="h-5 w-5 text-blue-500" /> : <CalendarDays className="h-5 w-5" />}
            {existingItem ? (topic || existingItem.topic || 'แก้ไขคอนเทนต์') : 'สร้างคอนเทนต์ใหม่'}
          </DialogTitle>
          <DialogDescription>
            {dateStr}{effectiveDate ? ` — ${getThaiDayName(effectiveDate)}` : ''}
          </DialogDescription>
          {(platforms.length > 0 || isVideo) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {platforms.length > 0 && <PlatformBadgeList platforms={platforms} variant="pill" size={11} />}
              {isVideo && <Badge variant="outline" className="text-[10px]">วีดีโอ</Badge>}
            </div>
          )}
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {(contentStatus === 'revision' || contentStatus === 'rejected') && existingItem?.reject_reason && (
            <div className="px-6 pt-4">
              <div className="rounded-lg border px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  {contentStatus === 'revision' ? 'เหตุผลที่ขอแก้ไข' : 'เหตุผลที่ปฏิเสธ'}
                </p>
                <p className="mt-1 text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">{existingItem.reject_reason}</p>
              </div>
            </div>
          )}

          {/* ===== Article Editor ===== */}
          {hasArticle || existingItem ? (
            <div className="px-6 py-5 border-b">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">เนื้อหาบทความ</h3>
              </div>
              <ArticleEditor
                key={existingItem?.id ?? 'new'}
                html={articleHtml || articleData?.html || ''}
                onChange={setArticleHtml}
                seoFields={seoFields}
                onSeoChange={setSeoFields}
                contentItemId={existingItem?.id}
                platform={platforms.length > 0 ? platforms[0] : undefined}
                topic={topic}
              />
            </div>
          ) : null}

          {/* ===== Headlines ===== */}
          {headlines && (
            <div className="px-6 py-5 border-b space-y-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold">Headlines</h3>
              </div>
              {(['viral_clickbait', 'storytelling', 'educational'] as const).map(cat => {
                const items = headlines[cat];
                if (!items?.length) return null;
                const labels: Record<string, string> = { viral_clickbait: 'Viral / Clickbait', storytelling: 'Storytelling', educational: 'Educational' };
                return (
                  <CollapsibleSection key={cat} title={`${labels[cat]} (${items.length})`} defaultOpen={cat === 'viral_clickbait'}>
                    <div className="space-y-2 mt-2">
                      {items.map((h: { title: string; hook: string }, i: number) => (
                        <div key={i} className="border rounded-lg p-3 bg-muted/20">
                          <p className="text-sm font-semibold">{h.title}</p>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{h.hook}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                );
              })}
            </div>
          )}

          {/* ===== Multi-platform Scripts ===== */}
          {Object.keys(scripts).length > 0 && (
            <div className="px-6 py-5 border-b space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Scripts สำหรับ Platform ที่เลือก</h3>
              </div>
              <Tabs defaultValue={Object.keys(scripts)[0]}>
                <TabsList className="w-full justify-start gap-1 bg-transparent p-0 h-auto flex-wrap">
                  {Object.entries(scripts).map(([key]) => {
                    const Icon = PLATFORM_ICONS[key] || Share2;
                    return (
                      <TabsTrigger key={key} value={key} className="text-xs data-[state=active]:bg-muted gap-1.5 px-3 py-1.5 rounded-md">
                        <Icon className="h-3 w-3" />
                        {PLATFORM_MAP[key]?.label ?? key}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {Object.entries(scripts).map(([key, text]) => (
                  <TabsContent key={key} value={key} className="mt-3 space-y-3">
                    <div className="bg-muted/30 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text || `— ไม่มี script สำหรับ ${PLATFORM_MAP[key]?.label ?? key} —`}</p>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {/* ===== Script Sections ===== */}
          {scriptSections && Object.keys(scriptSections).length > 0 && platformsNeedScriptSections(platforms) && (
            <div className="px-6 py-5 border-b space-y-3">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">โครงสร้างบท (Script Sections)</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(scriptSections).map(([key, val]) => (
                  <div key={key} className="border rounded-lg p-3 bg-muted/20">
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground">{key}</span>
                    <p className="text-sm mt-1 leading-relaxed">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== Visuals + Hashtags ===== */}
          {(visuals.length > 0 || hashtags.length > 0) && (
            <div className="px-6 py-5 border-b">
              <div className="grid gap-4 sm:grid-cols-2">
                {visuals.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">ภาพประกอบ ({visuals.length})</h3>
                    </div>
                    <ul className="space-y-1">
                      {visuals.map((v, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2">
                          <span className="text-muted-foreground/40 tabular-nums w-4 shrink-0">{i + 1}.</span>
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {hashtags.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Hashtags ({hashtags.length})</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hashtags.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== Edit form ===== */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{existingItem ? 'แก้ไขรายละเอียด' : 'รายละเอียดคอนเทนต์'}</h3>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left column */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>หัวข้อ <span className="text-destructive">*</span></Label>
                  <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="หัวข้อคอนเทนต์..." />
                  {existingItem?.source_topic && (
                    <p className="text-[10px] text-muted-foreground">
                      Research ใช้ Original User Topic: <span className="font-medium text-foreground">{existingItem.source_topic}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>แพลตฟอร์ม <span className="text-xs text-muted-foreground font-normal">(เลือกได้หลายอัน)</span></Label>
                    {existingItem && platforms.length === 0 ? (
                      <div className="rounded-md border px-3 py-3 text-xs text-muted-foreground">
                        ยังไม่ได้กำหนด Platform สำหรับคอนเทนต์นี้
                      </div>
                    ) : (
                      <div className="rounded-md border divide-y">
                        {Object.entries(PLATFORM_MAP).map(([key, val]) => (
                          <label key={key} className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors ${platforms.includes(key) ? 'bg-primary/5' : ''}`}>
                            <Checkbox
                              checked={platforms.includes(key)}
                              onCheckedChange={(checked) =>
                                setPlatforms(prev => checked ? [...prev, key] : prev.filter(p => p !== key))
                              }
                            />
                            <PlatformIcon platform={key} size={13} />
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${val.color}`}>{val.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>วันที่โพสต์</Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      disabled={dateLocked}
                    />
                    {dateLocked && (
                      <p className="text-[11px] text-muted-foreground">
                        เผยแพร่ไปแล้วบางแพลตฟอร์ม ไม่สามารถเปลี่ยนวันที่ได้
                      </p>
                    )}
                  </div>
                </div>

                {/* Knowledge Base source */}
                {kbArticles.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      อ้างอิงจาก Knowledge Base (ใช้เป็น context ให้ AI)
                    </Label>
                    <div className="relative">
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
                        value={selectedKbId}
                        onChange={e => setSelectedKbId(e.target.value)}
                      >
                        <option value="">— ไม่ใช้ Knowledge Base —</option>
                        {kbArticles.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.title}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {selectedKbId && (
                      <p className="text-[11px] text-primary">AI จะใช้บทความนี้เป็น context เมื่อกด "สร้างเนื้อหา AI"</p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>แคปชั่น</Label>
                  <Textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="แคปชั่น (ใส่ภายหลังได้)..." className="min-h-[180px] text-sm resize-y" />
                </div>
              </div>

              {/* Right column: image generation */}
              {existingItem && (
                <div className="space-y-3 lg:border-l lg:pl-6">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4" />
                    ภาพประกอบ
                  </Label>

                  {hasImage && (
                    <div className="relative rounded-lg overflow-hidden border bg-muted/20 cursor-zoom-in group" onClick={() => setImageViewerOpen(true)}>
                      <img src={displayImageUrl!} alt="Generated" className="w-full max-h-96 object-cover" loading="lazy" decoding="async" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>
                  )}
                  <ImageViewer src={displayImageUrl ?? ''} alt="ภาพประกอบ" open={imageViewerOpen} onOpenChange={setImageViewerOpen} />
                  {isGenFailed && <p className="text-[11px] text-destructive">สร้างภาพไม่สำเร็จ — ลองอีกครั้ง</p>}
                  {isGenPending && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังสร้างภาพ...
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Image Prompt (อังกฤษ)</Label>
                    <Textarea value={imageBrief} onChange={e => setImageBrief(e.target.value)} placeholder="Detailed image prompt for DALL-E/Flux: scene, lighting, style, colors..." className="min-h-[100px] text-xs font-mono resize-y" />
                  </div>

                  {/* Product References — selectable */}
                  {productRefs.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          รูปสินค้าอ้างอิง — คลิกเลือกที่จะใช้เป็น reference
                        </Label>
                        <div className="flex gap-1 text-[10px]">
                          <button type="button" className="text-primary hover:underline" onClick={() => setSelectedRefUrls(productRefs.map(r => r.url))}>ทั้งหมด</button>
                          <span className="text-muted-foreground">·</span>
                          <button type="button" className="text-muted-foreground hover:underline" onClick={() => setSelectedRefUrls([])}>ล้าง</button>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {productRefs.map((ref, i) => {
                          const isSelected = selectedRefUrls.includes(ref.url);
                          return (
                            <button
                              key={i}
                              type="button"
                              title={ref.name}
                              onClick={() => setSelectedRefUrls(prev =>
                                isSelected ? prev.filter(u => u !== ref.url) : [...prev, ref.url]
                              )}
                              className={cn(
                                'relative rounded overflow-hidden border-2 transition-all',
                                isSelected ? 'border-primary ring-1 ring-primary' : 'border-border opacity-40 grayscale'
                              )}
                            >
                              <img
                                src={ref.url}
                                alt={ref.name}
                                className="h-14 w-14 object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              {isSelected && (
                                <div className="absolute top-0.5 right-0.5 bg-primary rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold">✓</span>
                                </div>
                              )}
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 px-0.5 py-0.5">
                                <span className="text-[8px] text-white leading-none truncate block">{ref.name}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        เลือก {selectedRefUrls.length}/{productRefs.length} รูป{selectedRefUrls.length === 0 ? ' (ไม่ใช้ reference)' : ''}
                      </p>
                    </div>
                  )}

                  {hasImage && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={regenImageOnSave}
                        onCheckedChange={(v) => setRegenImageOnSave(!!v)}
                      />
                      สร้างภาพใหม่อัตโนมัติเมื่อบันทึก
                    </label>
                  )}

                  <Button variant="outline" size="sm" className={cn('w-full gap-1.5', hasImage && 'border-primary/50 text-primary')} disabled={isGenPending || !imageBrief.trim() || !existingItem?.id} onClick={handleGenerateImage}>
                    {isGenPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังสร้าง...</> : hasImage ? <><RefreshCw className="h-3.5 w-3.5" />สร้างภาพใหม่</> : <><ImagePlus className="h-3.5 w-3.5" />สร้างภาพด้วย AI</>}
                  </Button>

                  {/* Video Section — visible only for video script content */}
                  {isVideo && (
                  <div className="pt-3 mt-3 border-t">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Clapperboard className="h-4 w-4" />
                      วิดีโอ
                    </Label>
                    {existingItem?.video_url ? (
                      <div className="mt-2 rounded-lg overflow-hidden border bg-muted/20">
                        <video src={existingItem.video_url} controls className="w-full max-h-48"
                          poster={displayImageUrl ?? undefined} />
                      </div>
                    ) : existingItem?.video_gen_status === 'generating' ? (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2 mt-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังสร้างวิดีโอ...
                      </div>
                    ) : !allScenesHaveImages ? (
                      <p className="text-[11px] text-muted-foreground mt-1">ต้องสร้างภาพให้ครบทุกฉากก่อน จึงจะสามารถสร้างวิดีโอได้</p>
                    ) : null}
                    <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2" disabled={generatingScenes || !existingItem?.id} onClick={handleGenerateScenes}>
                      {generatingScenes ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังสร้างภาพทุกฉาก...</> : <><ImageIcon className="h-3.5 w-3.5" />สร้างภาพทุกฉาก</>}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2" disabled={generatingVideo || existingItem?.video_gen_status === 'generating' || !existingItem?.id || !allScenesHaveImages} onClick={handleGenerateVideo}>
                      {generatingVideo ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังสร้าง...</> : existingItem?.video_url ? <><RefreshCw className="h-3.5 w-3.5" />สร้างวิดีโอใหม่</> : <><Clapperboard className="h-3.5 w-3.5" />สร้างวิดีโอด้วย AI</>}
                    </Button>
                  </div>
                  )}
                </div>
              )}
              {!existingItem && (
                <div className="hidden lg:flex items-center justify-center border-l border-dashed pl-6 text-muted-foreground">
                  <div className="text-center">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">บันทึกก่อนเพื่อเพิ่มภาพประกอบ</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          {existingItem && (
            <Button variant="outline" className="gap-1.5 text-destructive border-destructive/30 mr-auto" disabled={deleting} onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />ลบ
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          {qualityCheckedAtValue && (
            <span className="text-[11px] text-muted-foreground self-center hidden sm:inline">
              ตรวจ Quality ล่าสุด {formatThaiDate(new Date(String(qualityCheckedAtValue).replace(' ', 'T')))}
            </span>
          )}
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleQualityRecheck}
            disabled={!existingItem?.id || qualityRecheck.isPending}
          >
            {qualityRecheck.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            ตรวจ Quality
          </Button>
          {aiGenerating ? (
            <Button variant="outline" className="gap-1.5" onClick={handleCancelAI}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ยกเลิก ({RESEARCH_STEP_LABELS[researchStep] ?? 'กำลังสร้าง'})
            </Button>
          ) : (
            <Button variant="outline" className="gap-1.5" onClick={handleConfirmAndAI} disabled={!topic.trim()}>
              <Sparkles className="h-3.5 w-3.5" />AI เขียนให้
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !topic.trim()}
            className="gap-1.5"
            title={qualityCheckedAtValue ? 'การบันทึกจะล้างผลตรวจ Quality เดิม ต้องกด "ตรวจ Quality" ใหม่ก่อนเผยแพร่' : undefined}
          >
            <Save className="h-3.5 w-3.5" />{saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
          {canRequestApproval && (
            <Button variant="default" className="gap-1.5" onClick={() => setRequestApprovalConfirm(true)}>
              <Send className="h-3.5 w-3.5" />ขออนุมัติ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete confirmation — explicit confirmation before destructive action */}
    <Dialog open={deleteConfirmOpen} onOpenChange={open => { if (!open) setDeleteConfirmOpen(false); }}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ยืนยันการลบคอนเทนต์</DialogTitle>
          <DialogDescription>
            ต้องการลบ "{topic || existingItem?.topic || 'คอนเทนต์นี้'}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>ยกเลิก</Button>
          <Button variant="destructive" disabled={deleting} onClick={async () => {
            await handleDelete();
            setDeleteConfirmOpen(false);
          }}>
            {deleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Request approval confirmation — sibling so it survives the edit dialog closing */}
    <Dialog open={requestApprovalConfirm} onOpenChange={open => { if (!open) setRequestApprovalConfirm(false); }}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ยืนยันการขออนุมัติ</DialogTitle>
          <DialogDescription>
            ต้องการส่ง "{topic}" เข้าสู่การอนุมัติใช่หรือไม่? เนื้อหาจะถูกเปลี่ยนสถานะเป็นรอเผยแพร่
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRequestApprovalConfirm(false)}>ยกเลิก</Button>
          <Button disabled={requestingApproval} onClick={handleRequestApproval}>
            {requestingApproval ? 'กำลังบันทึก...' : 'ยืนยัน'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
