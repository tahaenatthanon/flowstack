import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentVideoView from '@/components/content/views/ContentVideoView';
import type { ContentItem } from '@/components/content/types';

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
