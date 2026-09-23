import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clapperboard, Film, ListVideo, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { VideoSpecBadge } from '@/components/content/AspectRatioPicker';
import ClipCreditConfirmDialog from '@/components/content/ClipCreditConfirmDialog';
import type { GenerateClipsResult, VideoItemState, VideoSceneState } from '@/components/content/types';

/**
 * วิดีโอหลายคลิป (multi-clip-video) — 2 จังหวะ:
 *   1. สร้างคลิปรายฉาก (ใช้ credit, ยืนยันก่อนเสมอ) — ปุ่ม "สร้างคลิปทุกฉาก" ที่นี่ / ปุ่มรายฉากใน SceneCards
 *   2. สร้างวิดีโอรวม (ไม่ใช้ credit) — ผู้ใช้กดเองเมื่อทุกฉากพร้อม ไม่รวมอัตโนมัติ
 * ข้อมูลทั้งหมดมาจาก action video-state; ระหว่างมีคลิป generating จะ poll clip-status ทุก 5 วิ แล้วหยุดเอง
 */

const stateKey = (itemId?: string | null) => ['content', 'video-state', itemId] as const;

export interface VideoClipsController {
  state: VideoItemState | undefined;
  isLoading: boolean;
  /** เปิด dialog ยืนยัน credit สำหรับฉากที่ระบุ (ไม่ระบุ = ทุกฉากที่ต้องสร้าง) */
  requestGenerate: (sceneIds?: string[]) => void;
  combine: () => Promise<void>;
  combining: boolean;
  /** dialog ยืนยัน credit — ต้อง render ไว้ในหน้าที่ใช้ controller นี้ */
  confirmDialog: JSX.Element | null;
}

export function useVideoClips(itemId?: string | null): VideoClipsController {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = stateKey(itemId);

  const query = useQuery<VideoItemState>({
    queryKey: key,
    enabled: !!itemId,
    // มีคลิปกำลังสร้าง → clip-status (poll kie + ดาวน์โหลด แล้วคืนสถานะ) / ไม่มี → video-state (อ่านอย่างเดียว)
    queryFn: () => {
      const prev = qc.getQueryData<VideoItemState>(key);
      const action = prev?.any_generating ? 'clip-status' : 'video-state';
      return apiFetch(`/brand-content.php?action=${action}&item_id=${encodeURIComponent(itemId!)}`);
    },
    refetchInterval: q => (q.state.data?.any_generating ? 5000 : false),
  });
  const state = query.data;

  // แจ้งผลเมื่อคลิปเปลี่ยนจาก generating → done/failed (เทียบกับรอบก่อนหน้า)
  const prevRef = useRef<Record<string, VideoSceneState['latest']>>({});
  useEffect(() => {
    if (!state) return;
    const prev = prevRef.current;
    let finished = false;
    for (const s of state.scenes) {
      const before = prev[s.scene_id];
      const now = s.latest;
      if (before && now && before.id === now.id && before.status === 'generating' && now.status !== 'generating') {
        finished = true;
        if (now.status === 'done') toast({ title: `คลิปฉากที่ ${s.index + 1} เสร็จแล้ว` });
        else toast({ title: `สร้างคลิปฉากที่ ${s.index + 1} ไม่สำเร็จ`, description: now.error ?? undefined, variant: 'destructive' });
      }
    }
    prevRef.current = Object.fromEntries(state.scenes.map(s => [s.scene_id, s.latest]));
    if (finished) qc.invalidateQueries({ queryKey: ['content', 'items'] });
  }, [state, toast, qc]);

  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [combining, setCombining] = useState(false);

  const requestGenerate = (sceneIds?: string[]) => {
    if (!state) return;
    setConfirmIds(sceneIds ?? state.scenes_to_generate);
  };

  const submit = async (sceneIds: string[]) => {
    if (!itemId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<GenerateClipsResult>('/brand-content.php?action=generate-clips', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, scene_ids: sceneIds }),
      });
      qc.setQueryData(key, res.state);
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      const { submitted, skipped, failed } = res.summary;
      const reasons = res.results.filter(r => r.status !== 'submitted' && r.reason).map(r => r.reason).join(' · ');
      toast({
        title: submitted > 0 ? `ส่งสร้างคลิปแล้ว ${submitted} ฉาก` : 'ไม่ได้ส่งสร้างคลิป',
        description: [skipped ? `ข้าม ${skipped}` : '', failed ? `ล้มเหลว ${failed}` : '', reasons].filter(Boolean).join(' · ') || 'ระบบจะอัปเดตสถานะให้อัตโนมัติ',
        variant: failed > 0 || submitted === 0 ? 'destructive' : undefined,
      });
      setConfirmIds(null);
    } catch (e: any) {
      toast({ title: 'สร้างคลิปไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const combine = async () => {
    if (!itemId) return;
    setCombining(true);
    try {
      const res = await apiFetch<{ video_url: string; state: VideoItemState }>('/brand-content.php?action=combine-video', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId }),
      });
      qc.setQueryData(key, res.state);
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'สร้างวิดีโอรวมสำเร็จ!' });
    } catch (e: any) {
      toast({ title: 'สร้างวิดีโอรวมไม่สำเร็จ', description: e.message, variant: 'destructive' });
      qc.invalidateQueries({ queryKey: key });
    } finally {
      setCombining(false);
    }
  };

  const confirmScenes = state && confirmIds
    ? state.scenes.filter(s => confirmIds.includes(s.scene_id))
    : [];
  const confirmDialog = state ? (
    <ClipCreditConfirmDialog open={confirmIds !== null} onOpenChange={o => { if (!o) setConfirmIds(null); }}
      state={state} scenes={confirmScenes} submitting={submitting} onConfirm={submit} />
  ) : null;

  return { state, isLoading: query.isLoading, requestGenerate, combine, combining, confirmDialog };
}

/** เล่นคลิปของทุกฉากต่อกันบนหน้าเว็บ (ใช้เมื่อเซิร์ฟเวอร์ไม่มี ffmpeg) — ไม่สร้างไฟล์ ไม่ใช้ credit */
function SequentialPlayer({ urls, onClose }: { urls: string[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  return (
    <div className="mt-2 rounded-lg border overflow-hidden bg-black">
      <video key={urls[i]} src={urls[i]} controls autoPlay className="w-full max-h-72" data-testid="sequential-player"
        onEnded={() => { if (i < urls.length - 1) setI(i + 1); }} />
      <div className="flex items-center justify-between px-2 py-1 bg-background text-[11px] text-muted-foreground">
        <span>ฉาก {i + 1} / {urls.length}</span>
        <button className="underline" onClick={onClose}>ปิด</button>
      </div>
    </div>
  );
}

function Reasons({ reasons, testId }: { reasons: string[]; testId?: string }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground" data-testid={testId}>
      {reasons.map(r => <li key={r}>• {r}</li>)}
    </ul>
  );
}

/**
 * ส่วนหัว (สเปก, ตัวนับ, ปุ่มสร้างคลิปทุกฉาก) + ส่วนวิดีโอรวม
 * readOnly = หน้ารีวิว — ไม่มีปุ่มที่ยิง kie หรือเปลี่ยนข้อมูล (สร้างคลิป / รวม)
 * blockedReason = เหตุผลที่ห้ามใช้ปุ่มที่ใช้ credit ชั่วคราว (เช่น ฟอร์มยังไม่บันทึก)
 */
export default function VideoClipsPanel({ video, readOnly = false, blockedReason, aspectRatio, resolution }: {
  video: VideoClipsController;
  readOnly?: boolean;
  blockedReason?: string | null;
  aspectRatio?: string | null;
  resolution?: string | null;
}) {
  const { state } = video;
  const [playingAll, setPlayingAll] = useState(false);

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
        {video.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}กำลังโหลดสถานะวิดีโอ...
      </div>
    );
  }

  const { combine } = state;
  const genReasons = blockedReason ? [blockedReason, ...state.generate_all_reasons] : state.generate_all_reasons;
  const canGenerateAll = state.can_generate_all && !blockedReason;
  const clipUrls = state.scenes.map(s => s.active_clip?.clip_url).filter((u): u is string => !!u);
  const allClipsPlayable = state.scenes.length > 0 && clipUrls.length === state.scenes.length;

  return (
    <div className="space-y-3" data-testid="video-clips-panel">
      <div className="flex items-center justify-between gap-2">
        <VideoSpecBadge aspectRatio={aspectRatio} resolution={resolution} />
        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border',
          state.counts.total > 0 && state.counts.ready === state.counts.total ? 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300' : 'text-muted-foreground')}
          data-testid="video-clips-counter">
          คลิป {state.counts.ready}/{state.counts.total}
        </span>
      </div>

      {!readOnly && (
        <div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" disabled={!canGenerateAll}
            onClick={() => video.requestGenerate()}>
            {state.any_generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
            สร้างคลิปทุกฉาก{canGenerateAll ? ` (${state.scenes_to_generate.length})` : ''}
          </Button>
          {!canGenerateAll && <Reasons reasons={genReasons} testId="generate-all-reasons" />}
          {state.any_generating && <p className="mt-1 text-[11px] text-muted-foreground">กำลังสร้างคลิป — ระบบอัปเดตสถานะให้อัตโนมัติ ปิดหน้านี้ได้</p>}
        </div>
      )}

      <div className="rounded-lg border p-2.5 space-y-2" data-testid="combine-section">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Film className="h-3.5 w-3.5" />วิดีโอรวม
          {combine.latest?.stale && (
            <span className="ml-auto text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />ล้าสมัย
            </span>
          )}
        </div>
        {combine.latest ? (
          <>
            <video src={combine.latest.video_url} controls className="w-full max-h-72 rounded bg-black" data-testid="combined-player" />
            {combine.latest.stale && <Reasons reasons={combine.latest.stale_reasons} testId="combined-stale-reasons" />}
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">ยังไม่มีวิดีโอรวม</p>
        )}
        {combine.last_failed && !readOnly && (
          <p className="text-[11px] text-destructive">รวมครั้งล่าสุดไม่สำเร็จ: {combine.last_failed.error}</p>
        )}

        {!readOnly && (
          <div>
            <Button size="sm" className="w-full gap-1.5" disabled={!combine.can_combine || video.combining} onClick={() => video.combine()}>
              {video.combining || combine.combining ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังรวมวิดีโอ...</> : <><Film className="h-3.5 w-3.5" />{combine.latest ? 'สร้างวิดีโอรวมใหม่' : 'สร้างวิดีโอรวม'}</>}
            </Button>
            {!combine.can_combine && <Reasons reasons={combine.reasons} testId="combine-reasons" />}
          </div>
        )}

        {combine.ffmpeg_ok === false && allClipsPlayable && (
          playingAll
            ? <SequentialPlayer urls={clipUrls} onClose={() => setPlayingAll(false)} />
            : <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setPlayingAll(true)}>
                <ListVideo className="h-3.5 w-3.5" />เล่นต่อกันทุกฉาก
              </Button>
        )}
      </div>
      {!readOnly && video.confirmDialog}
    </div>
  );
}
