import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentVideoView, { allVideoScenesHaveImages } from '@/components/content/views/ContentVideoView';
import type { ContentItem } from '@/components/content/types';
import { apiFetch } from '@/lib/api';
import { makeClip, makeSceneState, makeVideoState } from './videoStateFixture';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const mockVideoItem: ContentItem = {
  id: 'ci-2', title: 'วิดีโอ AI', type: 'video', status: 'draft',
  views: 0, likes: 0, created_at: '2026-01-01',
  platform: 'tiktok', plan_item_id: 'pi-2',
  generated_image_url: 'https://example.com/thumb.png',
  article_content: JSON.stringify({
    title: 'TikTok AI 2026',
    scripts: {
      tiktok: 'Hook: AI เปลี่ยนโลก\nScene 1: ...\nCTA: กดติดตาม',
      youtube: 'Intro: ...',
    },
    script_sections: {
      opening: 'Hook 3 วิ',
      bridge: 'เชื่อมต่อ',
      twist: 'จุดพลิก',
      ending: 'CTA',
    },
    hashtags: ['#TikTok', '#AI'],
  }),
};

describe('ContentVideoView', () => {
  it('requires every scene to have an image', () => {
    expect(allVideoScenesHaveImages([
      { image_url: 'https://example.com/1.png' },
      { image_url: 'https://example.com/2.png' },
    ])).toBe(true);
    expect(allVideoScenesHaveImages([
      { image_url: 'https://example.com/1.png' },
      { image_url: '' },
    ])).toBe(false);
    expect(allVideoScenesHaveImages([{ image_url: null }])).toBe(false);
    expect(allVideoScenesHaveImages([])).toBe(false);
  });

  it('renders scene cards with sections', () => {
    wrap(<ContentVideoView item={mockVideoItem} />);
    expect(screen.getByText('Hook 3 วิ')).toBeTruthy();
    expect(screen.getByText('เชื่อมต่อ')).toBeTruthy();
  });

  it('renders platform tabs', () => {
    wrap(<ContentVideoView item={mockVideoItem} />);
    expect(screen.getByText('TikTok')).toBeTruthy();
    expect(screen.getByText('YouTube')).toBeTruthy();
  });

  // spec: content-video-ui-section — "Platform sub-tab ของ script แสดงเฉพาะ platform ที่มีจริง"
  it('เลือกไว้ 2 platform (tiktok/youtube) เห็นแค่ 2 แท็บ ไม่มี Instagram/Facebook', () => {
    wrap(<ContentVideoView item={mockVideoItem} />);
    expect(screen.queryByText('Instagram')).toBeNull();
    expect(screen.queryByText('Facebook')).toBeNull();
  });

  it('ไม่มี script เลยไม่มี sub-tab', () => {
    const noScripts: ContentItem = {
      ...mockVideoItem,
      article_content: JSON.stringify({ title: 'ไม่มีสคริปต์', scripts: {} }),
    };
    wrap(<ContentVideoView item={noScripts} />);
    expect(screen.queryByText('TikTok')).toBeNull();
    expect(screen.queryByText('YouTube')).toBeNull();
  });

  it('เพิ่ม platform ใหม่ (linkedin) ที่ไม่เคยอยู่ในรายชื่อ hardcode เดิม — ยังแสดงแท็บได้', () => {
    const withLinkedIn: ContentItem = {
      ...mockVideoItem,
      article_content: JSON.stringify({
        title: 'มี LinkedIn',
        scripts: { linkedin: 'Professional post: ทดสอบ\nCTA: ทักแชท' },
      }),
    };
    wrap(<ContentVideoView item={withLinkedIn} />);
    expect(screen.getByText('LinkedIn')).toBeTruthy();
  });

  it('renders cover image', () => {
    wrap(<ContentVideoView item={mockVideoItem} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/thumb.png');
  });

  it('shows empty state when no article_content', () => {
    const empty = { ...mockVideoItem, article_content: null };
    wrap(<ContentVideoView item={empty} />);
    expect(screen.getByText('ยังไม่มีเนื้อหา')).toBeTruthy();
  });
});

// spec: video-creation-options / content-video-ui-section — อัตราส่วน/ความละเอียดวิดีโอล็อกตั้งแต่ตอนสร้าง
describe('ContentVideoView — badge อัตราส่วน/ความละเอียดวิดีโอ และบทพากย์', () => {
  const readyItem: ContentItem = {
    ...mockVideoItem,
    video_aspect_ratio: '16:9',
    video_resolution: '1080p',
    article_content: JSON.stringify({
      title: 'พร้อมสร้างวิดีโอ',
      scripts: { tiktok: 'Hook' },
      scenes: [
        { visual_prompt: 'แก้วชาไทย', video_prompt: 'slow push-in', narration: 'ชาไทยแก้วนี้หอมมาก', image_gen_status: 'none' },
        { visual_prompt: 'ร้านกาแฟ', video_prompt: 'pan', narration: 'ก'.repeat(130), image_gen_status: 'none' },
      ],
    }),
  };

  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockImplementation(async (url: string) => (String(url).includes('video-state') ? makeVideoState() : {}));
  });

  it('แสดง badge จากค่าของ item และไม่มีปุ่มเลือกอัตราส่วน/ความละเอียด', async () => {
    wrap(<ContentVideoView item={readyItem} />);
    expect((await screen.findByTestId('video-spec-badge')).textContent).toContain('16:9 · 1080p');
    expect(screen.getByTestId('aspect-shape-16:9')).toBeTruthy();
    for (const name of ['9:16', '16:9', '720p', '1080p', 'Auto']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('คอนเทนต์เก่าไม่มีค่า → badge 9:16 · 720p', async () => {
    wrap(<ContentVideoView item={{ ...readyItem, video_aspect_ratio: null, video_resolution: null }} />);
    expect((await screen.findByTestId('video-spec-badge')).textContent).toContain('9:16 · 720p');
  });

  // spec: video-clips-ui — "หน้ารีวิวดูได้อย่างเดียว"
  it('หน้ารีวิว: เห็นคลิป/ตัวนับ/วิดีโอรวม แต่ไม่มีปุ่มสร้างคลิป ลองใหม่ หรือสร้างวิดีโอรวม', async () => {
    const withIds = { ...readyItem, article_content: JSON.stringify({ ...JSON.parse(readyItem.article_content!), scenes: JSON.parse(readyItem.article_content!).scenes.map((s: object, i: number) => ({ ...s, id: `sc_${i}` })) }) };
    vi.mocked(apiFetch).mockImplementation(async (url: string) => (String(url).includes('video-state') ? makeVideoState({
      scenes: [
        makeSceneState(0, { active_clip: makeClip(), latest: makeClip(), needs_generation: false }),
        makeSceneState(1, { latest: makeClip({ id: 'c2', status: 'failed', clip_url: null, error: 'nsfw' }) }),
      ],
      combine: { can_combine: false, reasons: ['ฉาก 2 ยังไม่มีคลิป'], ffmpeg_ok: true, combining: false,
        latest: { id: 'cb1', video_url: '/uploads/content/videos/x_combined.mp4', created_at: '', stale: true, stale_reasons: ['ฉาก 2 มีคลิปใหม่'] }, last_failed: null },
    }) : {}));
    wrap(<ContentVideoView item={withIds} />);
    expect((await screen.findByTestId('video-clips-counter')).textContent).toBe('คลิป 1/2');
    expect(screen.getByTestId('scene-clip-0')).toBeTruthy();
    expect(screen.getByText('nsfw')).toBeTruthy();
    expect(screen.getByTestId('combined-player')).toBeTruthy();
    for (const name of [/สร้างคลิปทุกฉาก/, /สร้างคลิปฉากนี้/, /ลองใหม่/, /สร้างวิดีโอรวม/, /^สร้างวิดีโอ$/]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(vi.mocked(apiFetch).mock.calls.some(([u]) => /generate-clips|combine-video/.test(String(u)))).toBe(false);
  });

  it('scene card แสดงบทพากย์ ตัวนับ และคำเตือนเมื่อเกิน 100 ตัวอักษร', () => {
    wrap(<ContentVideoView item={readyItem} />);
    expect(screen.getByDisplayValue('ชาไทยแก้วนี้หอมมาก')).toBeTruthy();
    expect(screen.getByTestId('narration-count-0').textContent).toBe('18/100');
    expect(screen.getByTestId('narration-count-1').textContent).toBe('130/100');
    expect(screen.getAllByText(/อาจพูดไม่จบใน 8 วินาที/)).toHaveLength(1);
  });
});
