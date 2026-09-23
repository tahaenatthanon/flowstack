import { AlertTriangle, Clapperboard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { VideoItemState, VideoSceneState } from '@/components/content/types';

/**
 * ยืนยัน credit ก่อนยิง kie.ai (multi-clip-video) — แสดงฉากที่จะยิง, model/ความละเอียด, credit ประมาณการ
 * ปุ่มยืนยันส่ง scene_ids ของฉากที่แสดงในนี้เท่านั้น (backend ตรวจซ้ำและไม่ยิงเกินรายการนี้)
 */
export default function ClipCreditConfirmDialog({
  open, onOpenChange, state, scenes, submitting, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: VideoItemState;
  /** ฉากที่จะยิง เรียงตามลำดับฉาก */
  scenes: VideoSceneState[];
  submitting: boolean;
  onConfirm: (sceneIds: string[]) => void;
}) {
  const perClip = state.model?.credits_per_clip ?? null;
  const total = perClip !== null ? perClip * scenes.length : null;
  const sceneList = scenes.map(s => s.index + 1).join(', ');
  const longNarration = scenes.filter(s => s.narration_too_long);

  return (
    <Dialog open={open} onOpenChange={o => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4" />
            {scenes.length === 1 ? `สร้างคลิปฉากที่ ${scenes[0].index + 1}` : 'สร้างคลิปวิดีโอ'}
          </DialogTitle>
          <DialogDescription>การสร้างคลิปใช้ credit ของ kie.ai — ตรวจสอบก่อนยืนยัน</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <p className="font-medium" data-testid="clip-confirm-count">
              {scenes.length} คลิป {scenes.length > 1 && <span className="text-muted-foreground font-normal">(ฉาก {sceneList})</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {state.model?.name ?? 'model วิดีโอ'} · {state.resolution}
              {perClip !== null && <> · {perClip} credit/คลิป</>}
            </p>
            <p className="font-semibold" data-testid="clip-confirm-credits">
              {total !== null ? `รวมประมาณ ${total.toLocaleString()} credit` : 'ไม่ทราบจำนวน credit'}
            </p>
          </div>

          {longNarration.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {longNarration.map(s => (
                  <p key={s.scene_id}>ฉาก {s.index + 1} บทพากย์ยาว {s.narration_length} ตัวอักษร อาจพูดไม่จบใน 8 วินาที</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button disabled={submitting || scenes.length === 0} onClick={() => onConfirm(scenes.map(s => s.scene_id))}>
            {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />กำลังส่ง...</> : 'ยืนยันสร้าง'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
