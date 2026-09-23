import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentVideoView, { allVideoScenesHaveImages } from '@/components/content/views/ContentVideoView';
import type { ContentItem } from '@/components/content/types';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({ status: 'generating', video_job_id: 't1' })) }));

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

  beforeEach(() => { vi.mocked(apiFetch).mockClear(); });

  it('แสดง badge จากค่าของ item และไม่มีปุ่มเลือกอัตราส่วน/ความละเอียด', () => {
    wrap(<ContentVideoView item={readyItem} />);
    expect(screen.getByTestId('video-spec-badge').textContent).toContain('16:9 · 1080p');
    expect(screen.getByTestId('aspect-shape-16:9')).toBeTruthy();
    for (const name of ['9:16', '16:9', '720p', '1080p', 'Auto']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('คอนเทนต์เก่าไม่มีค่า → badge 9:16 · 720p', () => {
    wrap(<ContentVideoView item={{ ...readyItem, video_aspect_ratio: null, video_resolution: null }} />);
    expect(screen.getByTestId('video-spec-badge').textContent).toContain('9:16 · 720p');
  });

  it('กดสร้างวิดีโอ → คำขอมีแค่ item_id', async () => {
    wrap(<ContentVideoView item={readyItem} />);
    fireEvent.click(screen.getByRole('button', { name: 'สร้างวิดีโอ' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [url, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toContain('action=generate-video');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ item_id: readyItem.id });
  });

  it('scene card แสดงบทพากย์ ตัวนับ และคำเตือนเมื่อเกิน 100 ตัวอักษร', () => {
    wrap(<ContentVideoView item={readyItem} />);
    expect(screen.getByDisplayValue('ชาไทยแก้วนี้หอมมาก')).toBeTruthy();
    expect(screen.getByTestId('narration-count-0').textContent).toBe('18/100');
    expect(screen.getByTestId('narration-count-1').textContent).toBe('130/100');
    expect(screen.getAllByText(/อาจพูดไม่จบใน 8 วินาที/)).toHaveLength(1);
  });
});
