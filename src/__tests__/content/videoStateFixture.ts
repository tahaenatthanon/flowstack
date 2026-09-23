import type { VideoClipSummary, VideoItemState, VideoSceneState } from '@/components/content/types';

/** fixture ของ response action video-state (multi-clip-video) สำหรับเทสต์ */

export function makeClip(over: Partial<VideoClipSummary> = {}): VideoClipSummary {
  return {
    id: 'clip-1', status: 'done', clip_url: '/uploads/content/videos/clip-1.mp4', error: null,
    credits_estimated: 30, credits_actual: null, migrated: false, created_at: '2026-09-23 10:00:00', completed_at: '2026-09-23 10:02:00',
    ...over,
  };
}

export function makeSceneState(index: number, over: Partial<VideoSceneState> = {}): VideoSceneState {
  return {
    scene_id: `sc_${index}`, index, ready: true, not_ready_reasons: [], narration_length: 20, narration_too_long: false,
    active_clip: null, latest: null, generating: false, stale: false, stale_reasons: [], needs_generation: true, retry_hint: null,
    ...over,
  };
}

export function makeVideoState(over: Partial<VideoItemState> = {}): VideoItemState {
  const scenes = over.scenes ?? [makeSceneState(0), makeSceneState(1)];
  return {
    item_id: 'item-1', aspect_ratio: '9:16', resolution: '720p',
    model: { id: 'm-lite', name: 'Veo 3.1 Lite', credits_per_clip: 30 }, model_error: null, public_url_ok: true,
    scenes,
    counts: { ready: scenes.filter(s => s.active_clip && !s.stale).length, total: scenes.length },
    any_generating: scenes.some(s => s.generating),
    can_generate_all: true, generate_all_reasons: [],
    scenes_to_generate: scenes.filter(s => s.needs_generation).map(s => s.scene_id),
    combine: { can_combine: false, reasons: ['ฉาก 1 ยังไม่มีคลิป'], ffmpeg_ok: true, combining: false, latest: null, last_failed: null },
    ...over,
  };
}
