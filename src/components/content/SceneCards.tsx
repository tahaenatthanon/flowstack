import { Image, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
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
  onGenerateAll,
  generatingAll = false,
}: {
  itemId: string;
  scenes: Scene[];
  readOnly?: boolean;
  onGenerateAll?: () => void;
  generatingAll?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [videoPromptDrafts, setVideoPromptDrafts] = useState<Record<number, string>>({});
  const [savingSceneIndex, setSavingSceneIndex] = useState<number | null>(null);
  const [retryingSceneIndex, setRetryingSceneIndex] = useState<number | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
  };

  const handleSaveVideoPrompt = async (sceneIndex: number, videoPrompt: string) => {
    setSavingSceneIndex(sceneIndex);
    try {
      await apiFetch('/brand-content.php?action=update-scene', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, scene_index: sceneIndex, video_prompt: videoPrompt }),
      });
      invalidate();
      toast({ title: 'บันทึก Video Prompt แล้ว' });
    } catch (e: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSavingSceneIndex(null);
    }
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

  if (scenes.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-muted-foreground">
        <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">ยังไม่มีฉาก กด "สร้างภาพทุกฉาก" เพื่อเริ่มสร้าง</p>
        {!readOnly && onGenerateAll && (
          <Button variant="outline" size="sm" className="mt-3" disabled={generatingAll} onClick={onGenerateAll}>
            {generatingAll ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Image className="h-3.5 w-3.5 mr-1.5" />}
            สร้างภาพทุกฉาก
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      {scenes.map((scene, idx) => {
        const status = deriveSceneImageStatus(scene);
        const draft = videoPromptDrafts[idx] ?? scene.video_prompt ?? '';
        const isSaving = savingSceneIndex === idx;
        const isRetrying = retryingSceneIndex === idx;
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
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Video Prompt</span>
                <Textarea value={draft} disabled={readOnly}
                  onChange={e => setVideoPromptDrafts(prev => ({ ...prev, [idx]: e.target.value }))}
                  placeholder="คำสั่งการเคลื่อนไหว/มุมกล้องของฉากนี้..."
                  className="min-h-[70px] text-xs resize-y" />
              </div>
              {!readOnly && (
                <Button variant="secondary" size="sm" className="w-full" disabled={isSaving}
                  onClick={() => handleSaveVideoPrompt(idx, draft)}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  บันทึก Video Prompt
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
