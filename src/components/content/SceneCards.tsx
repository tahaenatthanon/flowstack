import { Image, AlertCircle, RefreshCw, Loader2, Sparkles, Wand2, Clapperboard, AlertTriangle } from 'lucide-react';
import type { VideoSceneState } from '@/components/content/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

/** บทพากย์ฉาก 8 วินาที — ภาษาไทยพูดได้ราว 12.7 ตัวอักษร/วินาที (วัดจาก TTS จริง) */
export const NARRATION_MAX_CHARS = 100;

/**
 * ช่องแก้บทพากย์ของฉาก + ตัวนับตัวอักษร + คำเตือนเมื่อยาวเกิน (ไม่บล็อกการบันทึก)
 * ใช้ร่วมกันระหว่าง "ลำดับฉาก" ใน ContentCardDialog และ scene card ใน ContentVideoView
 */
export function NarrationField({ index, value, onChange, disabled = false, durationSec }: {
  index: number;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  durationSec?: number;
}) {
  const length = [...value].length;
  const tooLong = length > NARRATION_MAX_CHARS;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">🎙 บทพากย์</span>
        <span data-testid={`narration-count-${index}`}
          className={cn('text-[10px]', tooLong ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground')}>
          {length}/{NARRATION_MAX_CHARS}
        </span>
      </div>
      <Textarea value={value} disabled={disabled} aria-label={`บทพากย์ฉากที่ ${index + 1}`}
        onChange={e => onChange?.(e.target.value)}
        placeholder="บทพากย์ภาษาไทยของฉากนี้ (ผู้บรรยายในวิดีโอจะพูดตามนี้) — เว้นว่างได้ถ้าฉากนี้ไม่ต้องพูด"
        className="min-h-[48px] text-xs resize-y" />
      {tooLong && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">บทพากย์ยาวเกิน {NARRATION_MAX_CHARS} ตัวอักษร อาจพูดไม่จบใน {durationSec ?? 8} วินาที</p>
      )}
    </div>
  );
}

/**
 * สถานะคลิปวิดีโอของฉาก (multi-clip-video): ยังไม่มี / กำลังสร้าง / พร้อมใช้ / ล้มเหลว / ล้าสมัย
 * ปุ่มสร้าง/ลองใหม่เปิด dialog ยืนยัน credit ของ parent — ปุ่มสลับภาพ/คลิปไม่เรียก API
 */
function ClipStatus({ clip, index, showingClip, canToggle, onToggle, readOnly, blockedReason, onGenerate }: {
  clip: VideoSceneState;
  index: number;
  showingClip: boolean;
  canToggle: boolean;
  onToggle: () => void;
  readOnly: boolean;
  blockedReason: string | null;
  onGenerate?: () => void;
}) {
  const latestFailed = clip.latest?.status === 'failed';
  const label = clip.generating ? 'กำลังสร้างคลิป'
    : clip.stale ? 'คลิปล้าสมัย'
    : clip.active_clip ? 'คลิปพร้อมใช้'
    : latestFailed ? 'สร้างคลิปไม่สำเร็จ'
    : 'ยังไม่มีคลิป';
  const tone = clip.generating ? 'text-muted-foreground'
    : clip.stale ? 'text-amber-600 dark:text-amber-400'
    : clip.active_clip ? 'text-emerald-600'
    : latestFailed ? 'text-destructive' : 'text-muted-foreground';
  const buttonLabel = clip.stale ? 'สร้างคลิปฉากนี้ใหม่' : latestFailed ? 'ลองใหม่' : 'สร้างคลิปฉากนี้';
  const showButton = !readOnly && !!onGenerate && clip.needs_generation;
  const disabledReason = blockedReason ?? (!clip.ready ? clip.not_ready_reasons.join(' · ') : null);

  return (
    <div className="space-y-1 rounded-md border bg-muted/10 px-2 py-1.5" data-testid={`clip-status-${index}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[11px] font-medium flex items-center gap-1', tone)}>
          {clip.generating ? <Loader2 className="h-3 w-3 animate-spin" /> : clip.stale ? <AlertTriangle className="h-3 w-3" /> : <Clapperboard className="h-3 w-3" />}
          {label}
        </span>
        {canToggle && (
          <button type="button" className="text-[10px] underline text-muted-foreground hover:text-foreground" onClick={onToggle}>
            {showingClip ? 'ดูภาพ' : 'ดูคลิป'}
          </button>
        )}
      </div>
      {clip.stale && <p className="text-[10px] text-amber-600 dark:text-amber-400">ล้าสมัย — {clip.stale_reasons.join(', ')}</p>}
      {latestFailed && clip.latest?.error && <p className="text-[10px] text-destructive">{clip.latest.error}</p>}
      {clip.retry_hint && <p className="text-[10px] text-amber-600 dark:text-amber-400">{clip.retry_hint}</p>}
      {showButton && (
        <>
          <Button variant="outline" size="sm" className="w-full h-7 text-[11px]" disabled={!!disabledReason} onClick={onGenerate}>
            <Clapperboard className="h-3 w-3 mr-1" />{buttonLabel}
          </Button>
          {disabledReason && <p className="text-[10px] text-muted-foreground">{disabledReason}</p>}
        </>
      )}
    </div>
  );
}

export type SceneImageStatus = 'none' | 'done' | 'failed';

export interface Scene {
  /** id ถาวรของฉาก — คลิปวิดีโออ้างอิงฉากด้วย id นี้ (multi-clip-video) ห้ามหายตอนบันทึก */
  id?: string;
  visual_prompt?: string;
  video_prompt?: string;
  /** บทพากย์ภาษาไทยของฉาก (≤ 100 ตัวอักษร เพื่อพูดจบใน 8 วินาที) */
  narration?: string;
  duration_sec?: number;
  shot?: string;
  image_url?: string | null;
  image_gen_status?: SceneImageStatus;
  image_gen_error?: string | null;
}

// Backward-compatible derive rule (mirrors _deriveSceneImageStatus() in api/lib/video-clips.php)
// — scenes saved before image_gen_status existed must not be misread as "none".
export function deriveSceneImageStatus(scene: Scene): SceneImageStatus {
  if (scene.image_gen_status) return scene.image_gen_status;
  return scene.image_url ? 'done' : 'none';
}

// Scene cards — ภาพ + สถานะ + video_prompt ต่อฉาก. ใช้ร่วมกันระหว่าง ContentVideoView
// (หน้ารีวิวอนุมัติ) และ ContentCardDialog (หน้าแก้ไข content ทั่วไป) เพื่อไม่ให้ 2 จุด
// เขียน logic บันทึก/retry แยกกันแล้ว drift
export default function SceneCards({
  itemId,
  scenes,
  readOnly = false,
  staleImageIndexes,
  onRegenerateScene,
  regeneratingIndex,
  videoPromptDrafts,
  onVideoPromptChange,
  onVideoPromptGenerated,
  narrationDrafts,
  onNarrationChange,
  showNarration = true,
  clipStates,
  onGenerateClip,
  clipBlockedReason,
  clipsReadOnly = false,
}: {
  itemId: string;
  scenes: Scene[];
  readOnly?: boolean;
  /** scene index ที่เพิ่งบันทึก visual_prompt ใหม่ (แก้จากช่อง "ลำดับฉาก" รวมด้านบน) แต่ภาพยังเป็นของเดิม — แสดงปุ่ม "สร้างภาพฉากนี้ใหม่" */
  staleImageIndexes?: Set<number>;
  onRegenerateScene?: (index: number) => void;
  regeneratingIndex?: number | null;
  /** ค่า draft ของ video_prompt ต่อ scene index — ควบคุมจาก parent (ContentCardDialog) เพื่อรวมบันทึกกับปุ่ม "บันทึก" หลัก ไม่มีปุ่มบันทึกของตัวเองอีกต่อไป */
  videoPromptDrafts?: Record<number, string>;
  onVideoPromptChange?: (index: number, value: string) => void;
  /** เรียกหลัง AI เขียน video_prompt สำเร็จ ให้ parent เคลียร์ draft ทิ้งเพื่อกลับไปอ่านค่าที่ persist แล้วจาก scene */
  onVideoPromptGenerated?: (index: number) => void;
  /** ค่า draft ของบทพากย์ต่อ scene index — ควบคุมจาก parent แบบเดียวกับ videoPromptDrafts */
  narrationDrafts?: Record<number, string>;
  onNarrationChange?: (index: number, value: string) => void;
  /** false = ไม่แสดงช่องบทพากย์ในการ์ด (ContentCardDialog แก้บทพากย์ที่ "ลำดับฉาก" แทน — มีที่แก้ที่เดียว) */
  showNarration?: boolean;
  /** สถานะคลิปวิดีโอต่อ scene.id (จาก video-state) — ไม่ส่ง = ไม่แสดงส่วนคลิป */
  clipStates?: Record<string, VideoSceneState>;
  /** เปิด dialog ยืนยัน credit ของฉากนี้ (ไม่ยิงเองโดยตรง) */
  onGenerateClip?: (sceneId: string) => void;
  /** เหตุผลที่ห้ามกดสร้างคลิปชั่วคราว เช่น ฟอร์มยังไม่บันทึก / ไม่มี URL สาธารณะ */
  clipBlockedReason?: string | null;
  /** หน้ารีวิว — ดูคลิปได้ แต่ไม่มีปุ่มสร้าง/ลองใหม่ */
  clipsReadOnly?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [retryingSceneIndex, setRetryingSceneIndex] = useState<number | null>(null);
  const [writingPromptIndex, setWritingPromptIndex] = useState<number | null>(null);
  // การ์ดที่ผู้ใช้สลับกลับไปดูภาพ (ค่าเริ่มต้นแสดงคลิปเมื่อมี) — สลับแค่ฝั่งหน้าจอ ไม่เรียก API
  const [showImageFor, setShowImageFor] = useState<Set<number>>(new Set());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
  };

  const handleRetryScene = async (sceneIndex: number) => {
    setRetryingSceneIndex(sceneIndex);
    try {
      await apiFetch('/brand-content.php?action=generate-scene-image', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, scene_index: sceneIndex }),
      });
      invalidate();
      toast({ title: `สร้างภาพฉากที่ ${sceneIndex + 1} สำเร็จ!` });
    } catch (e: any) {
      toast({ title: 'สร้างภาพไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setRetryingSceneIndex(null);
    }
  };

  const handleWriteVideoPrompt = async (sceneIndex: number) => {
    setWritingPromptIndex(sceneIndex);
    try {
      const res: any = await apiFetch('/brand-content.php?action=generate-scene-video-prompt', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, scene_index: sceneIndex }),
      });
      // เคลียร์ draft ที่ยังไม่บันทึกทิ้ง ให้ใช้ค่าที่ AI เขียนแล้ว (persist ไว้แล้วจาก backend)
      onVideoPromptGenerated?.(sceneIndex);
      invalidate();
      toast({ title: `AI เขียน Video Prompt ฉากที่ ${sceneIndex + 1} สำเร็จ!` });
    } catch (e: any) {
      toast({ title: 'AI เขียน Video Prompt ไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setWritingPromptIndex(null);
    }
  };

  if (scenes.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-muted-foreground">
        <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">ยังไม่มีฉาก กด "สร้างภาพทุกฉาก" เพื่อเริ่มสร้าง</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      {scenes.map((scene, idx) => {
        const status = deriveSceneImageStatus(scene);
        const videoPromptDraft = videoPromptDrafts?.[idx] ?? scene.video_prompt ?? '';
        const narrationDraft = narrationDrafts?.[idx] ?? scene.narration ?? '';
        const isRetrying = retryingSceneIndex === idx;
        const isWritingPrompt = writingPromptIndex === idx;
        const isStale = !!staleImageIndexes?.has(idx);
        const isRegenerating = regeneratingIndex === idx;
        const clip = scene.id ? clipStates?.[scene.id] : undefined;
        const clipUrl = clip?.active_clip?.clip_url ?? null;
        const showClip = !!clipUrl && !showImageFor.has(idx);
        const toggleMedia = () => setShowImageFor(prev => {
          const next = new Set(prev);
          if (next.has(idx)) next.delete(idx); else next.add(idx);
          return next;
        });
        return (
          <div key={idx} className="rounded-lg border overflow-hidden" data-testid={`scene-card-${idx}`}>
            <div className="flex items-center justify-between px-3 py-2 bg-muted/10 border-b">
              <span className="text-xs font-semibold">Scene {idx + 1}</span>
              {status === 'done' && <span className="text-[10px] text-emerald-600 font-medium">พร้อมใช้</span>}
              {status === 'failed' && <span className="text-[10px] text-destructive font-medium">ล้มเหลว</span>}
              {status === 'none' && <span className="text-[10px] text-muted-foreground">ยังไม่ได้สร้างภาพ</span>}
            </div>
            {showClip ? (
              <video src={clipUrl!} controls className="w-full h-32 bg-black object-contain" data-testid={`scene-clip-${idx}`} />
            ) : scene.image_url ? (
              <img src={scene.image_url} alt={`Scene ${idx + 1}`} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-muted/20 flex items-center justify-center">
                <Image className="h-6 w-6 text-muted-foreground opacity-30" />
              </div>
            )}
            <div className="p-3 space-y-2">
              {clip && (
                <ClipStatus clip={clip} index={idx} showingClip={showClip} canToggle={!!clipUrl} onToggle={toggleMedia}
                  readOnly={clipsReadOnly} blockedReason={clipBlockedReason ?? null}
                  onGenerate={onGenerateClip && scene.id ? () => onGenerateClip(scene.id!) : undefined} />
              )}
              {status === 'failed' && scene.image_gen_error && (
                <div className="flex items-start gap-1.5 text-[11px] text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{scene.image_gen_error}</span>
                </div>
              )}
              {status === 'failed' && !readOnly && (
                <Button variant="outline" size="sm" className="w-full" disabled={isRetrying}
                  onClick={() => handleRetryScene(idx)}>
                  {isRetrying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  สร้างใหม่เฉพาะฉากนี้
                </Button>
              )}
              {isStale && !readOnly && (
                <Button variant="outline" size="sm" className="w-full" disabled={isRegenerating}
                  onClick={() => onRegenerateScene?.(idx)}>
                  {isRegenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                  สร้างภาพฉากนี้ใหม่
                </Button>
              )}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Video Prompt</span>
                <Textarea value={videoPromptDraft} disabled={readOnly}
                  onChange={e => onVideoPromptChange?.(idx, e.target.value)}
                  placeholder="คำสั่งการเคลื่อนไหว/มุมกล้องของฉากนี้..."
                  className="min-h-[70px] text-xs resize-y" />
              </div>
              {showNarration && (
                <NarrationField index={idx} value={narrationDraft} disabled={readOnly}
                  durationSec={scene.duration_sec} onChange={v => onNarrationChange?.(idx, v)} />
              )}
              {!readOnly && (
                <Button variant="outline" size="sm" className="w-full" disabled={isWritingPrompt}
                  onClick={() => handleWriteVideoPrompt(idx)}>
                  {isWritingPrompt ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  AI เขียน Video Prompt
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
