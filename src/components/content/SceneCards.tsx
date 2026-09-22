import { Image, AlertCircle, RefreshCw, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

export type SceneImageStatus = 'none' | 'done' | 'failed';

export interface Scene {
  visual_prompt?: string;
  video_prompt?: string;
  shot?: string;
  image_url?: string | null;
  image_gen_status?: SceneImageStatus;
  image_gen_error?: string | null;
}

// Backward-compatible derive rule (mirrors _deriveSceneImageStatus() in api/brand-content.php)
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
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [retryingSceneIndex, setRetryingSceneIndex] = useState<number | null>(null);
  const [writingPromptIndex, setWritingPromptIndex] = useState<number | null>(null);

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
        const isRetrying = retryingSceneIndex === idx;
        const isWritingPrompt = writingPromptIndex === idx;
        const isStale = !!staleImageIndexes?.has(idx);
        const isRegenerating = regeneratingIndex === idx;
        return (
          <div key={idx} className="rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/10 border-b">
              <span className="text-xs font-semibold">Scene {idx + 1}</span>
              {status === 'done' && <span className="text-[10px] text-emerald-600 font-medium">พร้อมใช้</span>}
              {status === 'failed' && <span className="text-[10px] text-destructive font-medium">ล้มเหลว</span>}
              {status === 'none' && <span className="text-[10px] text-muted-foreground">ยังไม่ได้สร้างภาพ</span>}
            </div>
            {scene.image_url ? (
              <img src={scene.image_url} alt={`Scene ${idx + 1}`} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-muted/20 flex items-center justify-center">
                <Image className="h-6 w-6 text-muted-foreground opacity-30" />
              </div>
            )}
            <div className="p-3 space-y-2">
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
