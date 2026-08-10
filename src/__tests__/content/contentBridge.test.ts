import { describe, it, expect } from 'vitest';
import { contentToEmailPayload } from '@/lib/contentBridge';
import type { ContentItem, ArticleContent } from '@/components/content/types';

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
