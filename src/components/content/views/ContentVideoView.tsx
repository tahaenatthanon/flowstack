import { Play, ChevronDown, ChevronRight, Loader2, Image, Video, RefreshCw, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import DOMPurify from 'dompurify';
import type { ContentItem, ArticleContent } from '@/components/content/types';
import CopyButton from './CopyButton';
import SceneCards from '@/components/content/SceneCards';
import { cn } from '@/lib/utils';

const SCENE_LABELS: Record<string, string> = {
  opening: 'Opening Hook', bridge: 'Bridge', twist: 'Twist', ending: 'CTA',
};

export function allVideoScenesHaveImages(scenes: Array<{ image_url?: string | null }> | null | undefined): boolean {
  return Array.isArray(scenes) && scenes.length > 0 && scenes.every((scene) => Boolean(scene?.image_url?.trim()));
}

// ตั้งใจแยกจาก catalog กลางใน platformConfig.ts — badge นี้ทับอยู่บนตัวเล่นวิดีโอ
// จึงต้องใช้โทนสีทึบเข้มให้คมชัด ต่างจากโทนอ่อนที่ catalog กลางใช้ทั่วทั้งแอป
// ซึ่งจะกลืนไปกับพื้นหลังวิดีโอ — ไม่ใช่ความซ้ำซ้อนที่ต้องรวม (ดู
// openspec/changes/platform-color-catalog/design.md Decision 4)
const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'bg-black text-white', youtube: 'bg-red-600 text-white',
  instagram: 'bg-pink-500 text-white', facebook: 'bg-indigo-600 text-white',
  lineoa: 'bg-green-600 text-white', linkedin: 'bg-sky-700 text-white',
  twitter: 'bg-neutral-800 text-white',
};
const DEFAULT_PLATFORM_COLOR = 'bg-muted text-foreground';

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook',
  lineoa: 'LINE OA', linkedin: 'LinkedIn', twitter: 'Twitter/X',
};

export default function ContentVideoView({
  item,
  context = 'content',
}: {
  item: ContentItem;
  context?: 'approval' | 'content';
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  // Approvers review only — AI generation stays with the content authors
  const isApproval = context === 'approval';
  const [showSections, setShowSections] = useState(true);
  const [generatingScenes, setGeneratingScenes] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [pollingVideo, setPollingVideo] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ค่าจริงที่ใช้ถูก derive ทีหลัง (หลัง art.scripts พร้อมใช้) จาก effectiveActivePlatform
  // ด้านล่าง — เก็บแค่ค่าที่ผู้ใช้เลือกเอง (ถ้ามี) ไว้ในนี้
  const [activePlatform, setActivePlatform] = useState<string>('');

  // Poll video status when generating
  useEffect(() => {
    if (item.video_gen_status === 'generating' && item.video_job_id) {
      setPollingVideo(true);
      pollRef.current = setInterval(async () => {
        try {
          const res = await apiFetch(`/brand-content.php?action=video-status&item_id=${item.id}`);
          if (res.status === 'done') {
            clearInterval(pollRef.current!);
            setPollingVideo(false);
            qc.invalidateQueries({ queryKey: ['content', 'items'] });
            toast({ title: 'สร้างวิดีโอสำเร็จ!' });
          } else if (res.status === 'failed') {
            clearInterval(pollRef.current!);
            setPollingVideo(false);
            qc.invalidateQueries({ queryKey: ['content', 'items'] });
            toast({ title: 'สร้างวิดีโอไม่สำเร็จ', description: res.error, variant: 'destructive' });
          }
        } catch { /* ignore poll errors */ }
      }, 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [item.video_gen_status, item.video_job_id, item.id]);

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleGenerateScenes = async () => {
    setGeneratingScenes(true);
    toast({ title: 'กำลังสร้างภาพทุกฉาก...', description: 'อาจใช้เวลา 1-3 นาที' });
    try {
      await apiFetch('/brand-content.php?action=generate-scene-images', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
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
    setGeneratingVideo(true);
    toast({ title: 'กำลังส่งสร้างวิดีโอ...', description: 'ระบบกำลังประมวลผลวิดีโอในพื้นหลัง' });
    try {
      const res = await apiFetch('/brand-content.php?action=generate-video', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      if (res.status === 'done') {
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

  let art: ArticleContent | null = null;
  let parseError = false;
  if (item.article_content) {
    try { art = JSON.parse(item.article_content); } catch { parseError = true; }
  }

  if (!art) {
    const hasVideo = !!item.video_url;
    const isGenerating = item.video_gen_status === 'generating' || pollingVideo;

    return (
      <div className="rounded-xl border border-dashed bg-muted/10 py-16 text-center text-muted-foreground">
        {hasVideo ? (
          <div className="space-y-4 px-4">
            <Video className="h-10 w-10 mx-auto mb-3 text-red-500" />
            <p className="font-medium">วิดีโอพร้อมเล่น</p>
            <video src={item.video_url!} controls className="max-w-full mx-auto rounded-lg max-h-96"
              poster={item.generated_image_url || undefined} />
          </div>
        ) : isGenerating ? (
          <div className="space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
            <p className="font-medium">กำลังสร้างวิดีโอ...</p>
            <p className="text-xs">ระบบกำลังประมวลผล — หน้านี้จะอัปเดตอัตโนมัติเมื่อเสร็จ</p>
          </div>
        ) : (
          <>
            <Play className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{parseError ? 'ข้อมูลไม่สมบูรณ์' : 'ยังไม่มีเนื้อหา'}</p>
            <p className="text-xs mt-2">กด "สร้างสคริปต์" ในหน้าวางแผนเพื่อเริ่ม</p>
          </>
        )}
        {/* Generation actions — authoring only, hidden while approving */}
        {!isApproval && (
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            <Button variant="outline" size="sm" disabled={generatingScenes}
              onClick={handleGenerateScenes}>
              {generatingScenes ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Image className="h-3.5 w-3.5 mr-1.5" />}
              สร้างภาพทุกฉาก
            </Button>
            <Button variant="default" size="sm" disabled={generatingVideo || isGenerating}
              onClick={handleGenerateVideo}>
              {generatingVideo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Video className="h-3.5 w-3.5 mr-1.5" />}
              {isGenerating ? 'กำลังสร้าง...' : 'สร้างวิดีโอ'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const videoScenes = Array.isArray(art?.scenes) ? art.scenes : [];
  const allScenesHaveImages = allVideoScenesHaveImages(videoScenes);

  // Sub-tab แสดงเฉพาะ platform ที่มี script อยู่จริง (ตรงกับ platform ที่เลือกไว้บน
  // content item) แทนรายชื่อ hardcode ตายตัว — ดู
  // openspec/changes/wire-platform-scripts-to-publish/specs/content-video-ui-section/spec.md
  const scriptPlatformKeys = Object.keys(art.scripts ?? {}).filter(k => art!.scripts?.[k]);
  const effectiveActivePlatform = scriptPlatformKeys.includes(activePlatform)
    ? activePlatform
    : (scriptPlatformKeys[0] ?? '');

  return (
    <div className="space-y-6">
      {/* Video player */}
      {item.video_url ? (
        <div className="rounded-xl overflow-hidden border bg-black">
          <video src={item.video_url} controls className="w-full max-h-96"
            poster={item.generated_image_url || undefined} />
        </div>
      ) : item.video_gen_status === 'generating' || pollingVideo ? (
        <div className="rounded-xl border border-dashed bg-muted/10 py-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-muted-foreground" />
          <p className="font-medium text-muted-foreground">กำลังสร้างวิดีโอ...</p>
          <p className="text-xs text-muted-foreground mt-1">ระบบจะอัปเดตอัตโนมัติเมื่อเสร็จ</p>
          {pollingVideo && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              กำลังตรวจสอบสถานะ...
            </div>
          )}
        </div>
      ) : (
        /* Cover / preview when no video yet */
        item.generated_image_url && (
          <div className="flex justify-center">
            <div className="relative inline-block rounded-xl overflow-hidden border bg-muted/20">
              <img src={item.generated_image_url} alt={art.title || item.title}
                className="block w-auto max-w-full max-h-[32rem] h-auto object-contain" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="p-4 rounded-full bg-white/80 shadow-lg">
                  <Play className="h-8 w-8 text-black fill-black" />
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Title */}
      <h2 className="text-2xl font-bold font-heading">{item.title || art.title}</h2>

      {/* Caption (matches planner) */}
      {item.caption && (
        <div className="rounded-xl border bg-muted/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/10 border-b">
            <span className="text-xs font-semibold text-muted-foreground">แคปชั่น</span>
            <CopyButton text={item.caption} label="คัดลอก" />
          </div>
          <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={item.caption.includes('<') ? { __html: DOMPurify.sanitize(item.caption) } : undefined}>
            {!item.caption.includes('<') ? item.caption : undefined}
          </div>
        </div>
      )}

      {/* Platform sub-tabs — เฉพาะ platform ที่มี script อยู่จริง */}
      {scriptPlatformKeys.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {scriptPlatformKeys.map(p => (
            <button key={p}
              onClick={() => setActivePlatform(p)}
              className={cn('px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                effectiveActivePlatform === p
                  ? (PLATFORM_COLORS[p] ?? DEFAULT_PLATFORM_COLOR)
                  : 'bg-background text-muted-foreground border-border hover:bg-muted')}>
              {PLATFORM_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      )}

      {/* Full script for selected platform */}
      {art.scripts?.[effectiveActivePlatform] && (
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-b">
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', PLATFORM_COLORS[effectiveActivePlatform] ?? DEFAULT_PLATFORM_COLOR)}>
              🎬 สคริปต์ {PLATFORM_LABELS[effectiveActivePlatform] ?? effectiveActivePlatform}
            </span>
            <CopyButton text={art.scripts[effectiveActivePlatform]!} label="คัดลอก" />
          </div>
          <div className="px-4 py-4">
            <div className="text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={(art.scripts?.[effectiveActivePlatform] ?? '').includes('<') ? { __html: DOMPurify.sanitize(art.scripts[effectiveActivePlatform]!) } : undefined}>
              {!(art.scripts?.[effectiveActivePlatform] ?? '').includes('<') ? art.scripts[effectiveActivePlatform] : undefined}
            </div>
          </div>
        </div>
      )}

      {/* Scene cards */}
      {art.script_sections && Object.values(art.script_sections).some(v => v) && (
        <>
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowSections(s => !s)}>
            {showSections ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            แยกฉาก
          </button>

          {showSections && (
            <div className="space-y-3">
              {(['opening', 'bridge', 'twist', 'ending'] as const).map((sec, i) => {
                const text = art?.script_sections?.[sec];
                if (!text) return null;
                const timecodes = ['0:00-0:15', '0:15-0:35', '0:35-0:55', '0:55-1:00'];
                return (
                  <div key={sec} className="rounded-xl border overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b">
                      <span className="text-xs font-bold text-muted-foreground">
                        Scene {i + 1}
                      </span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {timecodes[i]}
                      </span>
                      <span className="text-xs font-semibold">{SCENE_LABELS[sec]}</span>
                      <div className="flex-1" />
                      <CopyButton text={text} label="" />
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={text.includes('<') ? { __html: DOMPurify.sanitize(text) } : undefined}>
                        {!text.includes('<') ? text : undefined}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Scene cards — ภาพ + สถานะ + video_prompt ต่อฉาก */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/10 border-b">
          <Clapperboard className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">ฉากวิดีโอ{videoScenes.length > 0 ? ` (${videoScenes.length})` : ''}</span>
        </div>
        <SceneCards itemId={item.id} scenes={videoScenes} readOnly={isApproval}
          onGenerateAll={handleGenerateScenes} generatingAll={generatingScenes} />
      </div>

      {/* Hashtags */}
      {art.hashtags && art.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {art.hashtags.map((tag, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap border-t pt-4">
        <CopyButton text={art.scripts?.[activePlatform] || ''} label="คัดลอกสคริปต์" />
        <div className="flex-1" />
        {!isApproval && (
          <>
            <Button variant="outline" size="sm" disabled={generatingScenes}
              onClick={handleGenerateScenes}>
              {generatingScenes ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Image className="h-3.5 w-3.5 mr-1.5" />}
              สร้างภาพทุกฉาก
            </Button>
            <Button variant="default" size="sm" disabled={generatingVideo || pollingVideo || !allScenesHaveImages}
              onClick={handleGenerateVideo} title={!allScenesHaveImages ? 'กรุณาสร้างภาพให้ครบทุก Scene ก่อน' : undefined}>
              {generatingVideo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Video className="h-3.5 w-3.5 mr-1.5" />}
              {item.video_gen_status === 'generating' || pollingVideo ? 'กำลังสร้าง...' : 'สร้างวิดีโอ'}
            </Button>
            {!allScenesHaveImages && videoScenes.length > 0 && (
              <span className="text-xs text-destructive">กรุณาสร้างภาพให้ครบทุก Scene ก่อนสร้างวิดีโอ</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
