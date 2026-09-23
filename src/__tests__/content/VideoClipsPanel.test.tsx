import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VideoClipsPanel, { useVideoClips } from '@/components/content/VideoClipsPanel';
import SceneCards from '@/components/content/SceneCards';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import type { PlanItem, VideoItemState } from '@/components/content/types';
import { apiFetch } from '@/lib/api';
import { makeClip, makeSceneState, makeVideoState } from './videoStateFixture';

/**
 * spec: multi-clip-video / video-clips-ui — หน้าจอ 2 จังหวะ (สร้างคลิปรายฉาก → สร้างวิดีโอรวม)
 */

const toast = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
  useQualityRecheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

const scenes = [0, 1, 2].map(i => ({ id: `sc_${i}`, visual_prompt: `ภาพ ${i}`, video_prompt: `motion ${i}`, narration: `บท ${i}`, image_url: `/s${i}.jpg`, image_gen_status: 'done' as const }));

function mockState(state: VideoItemState, extra: Record<string, unknown> = {}) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    const u = String(url);
    for (const [k, v] of Object.entries(extra)) if (u.includes(k)) return typeof v === 'function' ? (v as () => unknown)() : v;
    if (u.includes('video-state')) return state;
    return {};
  });
}

function Harness({ blockedReason = null, readOnly = false }: { blockedReason?: string | null; readOnly?: boolean }) {
  const video = useVideoClips('item-1');
  const clipStates = Object.fromEntries((video.state?.scenes ?? []).map(s => [s.scene_id, s]));
  return (
    <>
      <SceneCards itemId="item-1" scenes={scenes} clipStates={clipStates} clipsReadOnly={readOnly}
        onGenerateClip={id => video.requestGenerate([id])} clipBlockedReason={blockedReason} />
      <VideoClipsPanel video={video} blockedReason={blockedReason} readOnly={readOnly} aspectRatio="9:16" resolution="720p" />
    </>
  );
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Harness {...props} /></QueryClientProvider>);
}

const callsTo = (action: string) => vi.mocked(apiFetch).mock.calls.filter(([u]) => String(u).includes(`action=${action}`));

beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiFetch).mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('VideoClipsPanel — สร้างคลิปรายฉาก', () => {
  it('ตัวนับ "คลิป X/N" นับเฉพาะคลิปพร้อมใช้ที่ไม่ล้าสมัย', async () => {
    mockState(makeVideoState({
      scenes: [
        makeSceneState(0, { active_clip: makeClip(), needs_generation: false }),
        makeSceneState(1, { active_clip: makeClip({ id: 'c2' }), stale: true, stale_reasons: ['บทพากย์เปลี่ยน'] }),
        makeSceneState(2),
      ],
    }));
    renderHarness();
    expect((await screen.findByTestId('video-clips-counter')).textContent).toBe('คลิป 1/3');
    expect(within(screen.getByTestId('clip-status-1')).getByText('ล้าสมัย — บทพากย์เปลี่ยน')).toBeTruthy();
    expect(within(screen.getByTestId('clip-status-1')).getByRole('button', { name: /สร้างคลิปฉากนี้ใหม่/ })).toBeTruthy();
  });

  it('สร้างคลิปทุกฉากกดไม่ได้ → แสดงเหตุผลของทุกฉากที่ไม่พร้อม', async () => {
    mockState(makeVideoState({ can_generate_all: false, generate_all_reasons: ['ฉาก 2 ยังไม่มีภาพ', 'ฉาก 3 ยังไม่มี Video Prompt'], scenes_to_generate: [] }));
    renderHarness();
    const btn = await screen.findByRole('button', { name: /สร้างคลิปทุกฉาก/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('generate-all-reasons').textContent).toContain('ฉาก 2 ยังไม่มีภาพ');
    expect(screen.getByTestId('generate-all-reasons').textContent).toContain('ฉาก 3 ยังไม่มี Video Prompt');
  });

  it('dialog ยืนยัน credit: แสดงจำนวนคลิป/credit และส่ง scene_ids ชุดที่แสดงเท่านั้น', async () => {
    const state = makeVideoState({
      scenes: [makeSceneState(0, { active_clip: makeClip(), needs_generation: false }), makeSceneState(1, { narration_length: 130, narration_too_long: true }), makeSceneState(2)],
    });
    mockState(state, { 'generate-clips': { results: [], summary: { submitted: 2, skipped: 0, failed: 0 }, state } });
    renderHarness();
    fireEvent.click(await screen.findByRole('button', { name: /สร้างคลิปทุกฉาก \(2\)/ }));
    expect(screen.getByTestId('clip-confirm-count').textContent).toContain('2 คลิป');
    expect(screen.getByTestId('clip-confirm-count').textContent).toContain('ฉาก 2, 3');
    expect(screen.getByTestId('clip-confirm-credits').textContent).toBe('รวมประมาณ 60 credit');
    expect(screen.getByText(/ฉาก 2 บทพากย์ยาว 130 ตัวอักษร/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันสร้าง' }));
    await waitFor(() => expect(callsTo('generate-clips')).toHaveLength(1));
    expect(JSON.parse((callsTo('generate-clips')[0][1] as RequestInit).body as string)).toEqual({ item_id: 'item-1', scene_ids: ['sc_1', 'sc_2'] });
  });

  it('model ไม่มีราคา → "ไม่ทราบจำนวน credit"; ยกเลิก → ไม่ยิง generate-clips', async () => {
    mockState(makeVideoState({ model: { id: 'm', name: 'Veo', credits_per_clip: null } }));
    renderHarness();
    fireEvent.click(await screen.findByRole('button', { name: /สร้างคลิปทุกฉาก/ }));
    expect(screen.getByTestId('clip-confirm-credits').textContent).toBe('ไม่ทราบจำนวน credit');
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    await waitFor(() => expect(screen.queryByTestId('clip-confirm-count')).toBeNull());
    expect(callsTo('generate-clips')).toHaveLength(0);
  });

  it('ปุ่มรายฉากเปิด dialog ของฉากนั้นฉากเดียว', async () => {
    mockState(makeVideoState({ scenes: [makeSceneState(0), makeSceneState(1, { latest: makeClip({ status: 'failed', clip_url: null, error: 'nsfw' }) })] }));
    renderHarness();
    const card = await screen.findByTestId('clip-status-1');
    expect(within(card).getByText('nsfw')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: /ลองใหม่/ }));
    expect(screen.getByTestId('clip-confirm-count').textContent).toBe('1 คลิป ');
    expect(screen.getByText('สร้างคลิปฉากที่ 2')).toBeTruthy();
  });

  it('มีการแก้ไขที่ยังไม่บันทึก → ปุ่มที่ใช้ credit ทุกปุ่มกดไม่ได้ พร้อมข้อความ', async () => {
    mockState(makeVideoState());
    renderHarness({ blockedReason: 'กรุณาบันทึกก่อนสร้างคลิป' });
    const all = await screen.findByRole('button', { name: /สร้างคลิปทุกฉาก/ });
    expect((all as HTMLButtonElement).disabled).toBe(true);
    const sceneBtn = within(screen.getByTestId('clip-status-0')).getByRole('button', { name: /สร้างคลิปฉากนี้/ });
    expect((sceneBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('กรุณาบันทึกก่อนสร้างคลิป').length).toBeGreaterThan(0);
  });

  it('สลับดูภาพ/คลิปไม่เรียก API', async () => {
    mockState(makeVideoState({ scenes: [makeSceneState(0, { active_clip: makeClip(), needs_generation: false })] }));
    renderHarness();
    expect(await screen.findByTestId('scene-clip-0')).toBeTruthy();
    const before = vi.mocked(apiFetch).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'ดูภาพ' }));
    expect(screen.queryByTestId('scene-clip-0')).toBeNull();
    expect(screen.getByAltText('Scene 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ดูคลิป' }));
    expect(screen.getByTestId('scene-clip-0')).toBeTruthy();
    expect(vi.mocked(apiFetch).mock.calls.length).toBe(before);
  });
});

describe('VideoClipsPanel — polling และวิดีโอรวม', () => {
  it('มีคลิป generating → poll clip-status ทุก 5 วิ แล้วหยุดเมื่อเสร็จ และไม่รวมเอง', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const generating = makeVideoState({ scenes: [makeSceneState(0, { generating: true, latest: makeClip({ status: 'generating', clip_url: null }), needs_generation: false })] });
    const done = makeVideoState({ scenes: [makeSceneState(0, { active_clip: makeClip(), latest: makeClip(), needs_generation: false })],
      combine: { can_combine: true, reasons: [], ffmpeg_ok: true, combining: false, latest: null, last_failed: null } });
    mockState(generating, { 'clip-status': done });
    renderHarness();
    await screen.findByTestId('video-clips-counter');
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    await waitFor(() => expect(callsTo('clip-status')).toHaveLength(1));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'คลิปฉากที่ 1 เสร็จแล้ว' })));
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(callsTo('clip-status')).toHaveLength(1);
    expect(callsTo('combine-video')).toHaveLength(0);
  });

  it('รวมไม่ได้ → ปุ่มกดไม่ได้พร้อมเหตุผล; รวมได้ → กดแล้วเรียก combine-video', async () => {
    const ready = makeVideoState({ combine: { can_combine: true, reasons: [], ffmpeg_ok: true, combining: false, latest: null, last_failed: null } });
    mockState(makeVideoState(), { 'combine-video': { video_url: '/x.mp4', state: ready } });
    const { unmount } = renderHarness();
    const disabled = await screen.findByRole('button', { name: /สร้างวิดีโอรวม/ });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('combine-reasons').textContent).toContain('ฉาก 1 ยังไม่มีคลิป');
    unmount();

    mockState(ready, { 'combine-video': { video_url: '/x.mp4', state: ready } });
    renderHarness();
    fireEvent.click(await screen.findByRole('button', { name: /สร้างวิดีโอรวม/ }));
    await waitFor(() => expect(callsTo('combine-video')).toHaveLength(1));
    expect(JSON.parse((callsTo('combine-video')[0][1] as RequestInit).body as string)).toEqual({ item_id: 'item-1' });
  });

  it('วิดีโอรวมล้าสมัย → ป้าย + เหตุผล; ไม่มี ffmpeg → ปุ่มรวมกดไม่ได้และ "เล่นต่อกันทุกฉาก"', async () => {
    mockState(makeVideoState({
      scenes: [makeSceneState(0, { active_clip: makeClip(), needs_generation: false }), makeSceneState(1, { active_clip: makeClip({ id: 'c2', clip_url: '/c2.mp4' }), needs_generation: false })],
      combine: { can_combine: false, reasons: ['เซิร์ฟเวอร์ยังไม่รองรับการรวมคลิป (ไม่พบ ffmpeg) — ดูคลิปต่อกันแทนได้'], ffmpeg_ok: false, combining: false,
        latest: { id: 'cb', video_url: '/old.mp4', created_at: '', stale: true, stale_reasons: ['ฉาก 1 มีคลิปใหม่'] }, last_failed: null },
    }));
    renderHarness();
    expect((await screen.findByTestId('combined-stale-reasons')).textContent).toContain('ฉาก 1 มีคลิปใหม่');
    expect(((screen.getByRole('button', { name: /สร้างวิดีโอรวมใหม่/ })) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /เล่นต่อกันทุกฉาก/ }));
    expect((screen.getByTestId('sequential-player') as HTMLVideoElement).getAttribute('src')).toBe('/uploads/content/videos/clip-1.mp4');
    fireEvent.ended(screen.getByTestId('sequential-player'));
    expect((screen.getByTestId('sequential-player') as HTMLVideoElement).getAttribute('src')).toBe('/c2.mp4');
  });
});

describe('ContentCardDialog — วิดีโอหลายคลิป', () => {
  function makeItem(): PlanItem {
    return {
      id: 'item-1', plan_id: 'plan-1', day_label: 'Day 1', day_order: 1, scheduled_date: '2026-09-23',
      platform: 'tiktok', platforms: ['tiktok'], topic: 'วิดีโอทดสอบ', caption: 'แคปชั่น', image_brief: '',
      generated_image_url: null, image_gen_status: '', content_type: 'video', video_aspect_ratio: '9:16', video_resolution: '720p',
      article_content: JSON.stringify({ title: 'วิดีโอทดสอบ', scripts: { tiktok: 'Hook' }, scenes }),
    };
  }
  function renderDialog(onSave = vi.fn(async () => {})) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><ContentCardDialog open onOpenChange={() => {}} date={null} planId="plan-1" existingItem={makeItem()} onSave={onSave} /></QueryClientProvider>);
    return onSave;
  }

  it('ไม่มีปุ่ม "สร้างวิดีโอด้วย AI" เดิม และแก้บทแล้วยังไม่บันทึก → ปุ่มสร้างคลิปกดไม่ได้', async () => {
    mockState(makeVideoState({ scenes: scenes.map((_, i) => makeSceneState(i)) }));
    renderDialog();
    const all = await screen.findByRole('button', { name: /สร้างคลิปทุกฉาก/ });
    expect((all as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: /สร้างวิดีโอด้วย AI/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('บทพากย์ฉากที่ 2'), { target: { value: 'บทใหม่' } });
    await waitFor(() => expect((screen.getByRole('button', { name: /สร้างคลิปทุกฉาก/ }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getAllByText('กรุณาบันทึกก่อนสร้างคลิป').length).toBeGreaterThan(0);
  });

  it('บันทึก dialog คง scene.id ของทุกฉาก', async () => {
    mockState(makeVideoState({ scenes: scenes.map((_, i) => makeSceneState(i)) }));
    const onSave = renderDialog();
    fireEvent.change(await screen.findByLabelText('บทพากย์ฉากที่ 2'), { target: { value: 'บทใหม่' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const art = JSON.parse((onSave.mock.calls[0][0] as { article_content: string }).article_content);
    expect(art.scenes.map((s: { id: string }) => s.id)).toEqual(['sc_0', 'sc_1', 'sc_2']);
  });
});
