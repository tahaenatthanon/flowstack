import { describe, it, expect } from 'vitest';
import { contentToEmailPayload } from '@/lib/contentBridge';
import type { ContentItem, ArticleContent } from '@/components/content/types';
import { getCanonicalContentType } from '@/components/content/types';

const mockItem: ContentItem = {
  id: 'test-id', title: 'Test Title', type: 'article', status: 'draft',
  views: 0, likes: 0, created_at: '2026-01-01',
  platform: 'facebook',
};

const mockArt: ArticleContent = {
  title: 'บทความทดสอบ',
  excerpt: 'คำโปรย',
  html: '<p>เนื้อหา HTML</p>',
  hashtags: ['#test', '#demo'],
};

describe('Content Type Source of Truth', () => {
  it('uses content_items.type when resolving a ContentItem', () => {
    expect(getCanonicalContentType({ type: 'video' })).toBe('video');
    expect(getCanonicalContentType({ type: 'article' })).toBe('article');
  });

  it('uses the API projection content_type for PlanItem data', () => {
    expect(getCanonicalContentType({ content_type: 'video' })).toBe('video');
    expect(getCanonicalContentType({ content_type: 'article' })).toBe('article');
  });

  it('never lets legacy article_content.platform_type affect the canonical type', () => {
    const item = { type: 'article', content_type: 'article' } as ContentItem & { content_type: string };
    expect(getCanonicalContentType(item)).toBe('article');
  });
});

describe('contentToEmailPayload', () => {
  it('transforms ContentItem + ArticleContent to email payload', () => {
    const result = contentToEmailPayload(mockItem, mockArt);
    expect(result.name).toBe('บทความทดสอบ');
    expect(result.subject).toBe('บทความทดสอบ');
    expect(result.body_html).toBe('<p>เนื้อหา HTML</p>');
    expect(result.body_text).toBe('เนื้อหา HTML');
    expect(result.footer_tags).toBe('#test #demo');
    expect(result.source_content_id).toBe('test-id');
    expect(result.source_platform).toBe('facebook');
  });

  it('falls back to item.title when art.title is empty', () => {
    const result = contentToEmailPayload(mockItem, { html: '<p>x</p>' });
    expect(result.name).toBe('Test Title');
    expect(result.subject).toBe('Test Title');
  });

  it('handles empty hashtags', () => {
    const result = contentToEmailPayload(mockItem, { html: '<p>x</p>' });
    expect(result.footer_tags).toBe('');
  });
});
