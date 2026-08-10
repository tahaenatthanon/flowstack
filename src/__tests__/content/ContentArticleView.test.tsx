import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentArticleView from '@/components/content/views/ContentArticleView';
import type { ContentItem } from '@/components/content/types';

// Mock clipboard
Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const mockArticleItem: ContentItem = {
  id: 'ci-1', title: 'บทความ AI', type: 'article', status: 'draft',
  views: 0, likes: 0, created_at: '2026-01-01',
  platform: 'email', plan_item_id: 'pi-1',
  generated_image_url: 'https://example.com/img.png',
  article_content: JSON.stringify({
    title: 'บทความ AI 2026',
    excerpt: 'สรุปเทรนด์ AI',
    html: '<article><h1>บทความ AI 2026</h1><p>เนื้อหา...</p></article>',
    hashtags: ['#AI', '#2026'],
  }),
};

describe('ContentArticleView', () => {
  it('renders article title, excerpt, and HTML body', () => {
    wrap(<ContentArticleView item={mockArticleItem} />);
    expect(screen.getAllByText('บทความ AI 2026').length).toBeGreaterThanOrEqual(1);
    // excerpt renders in both the excerpt block and the SEO meta panel
    expect(screen.getAllByText('สรุปเทรนด์ AI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('เนื้อหา...')).toBeTruthy();
  });

  it('renders hashtags', () => {
    wrap(<ContentArticleView item={mockArticleItem} />);
    expect(screen.getByText('#AI')).toBeTruthy();
    expect(screen.getByText('#2026')).toBeTruthy();
  });

  it('renders cover image', () => {
    wrap(<ContentArticleView item={mockArticleItem} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/img.png');
  });

  it('shows fallback on broken article_content', () => {
    const broken = { ...mockArticleItem, article_content: '{broken json' };
    wrap(<ContentArticleView item={broken} />);
    expect(screen.getByText('ข้อมูลบทความไม่สมบูรณ์')).toBeTruthy();
  });

  it('shows "Email Campaign" button', () => {
    wrap(<ContentArticleView item={mockArticleItem} />);
    expect(screen.getByText('Email Campaign')).toBeTruthy();
  });
});
