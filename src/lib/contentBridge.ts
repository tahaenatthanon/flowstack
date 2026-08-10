import type { ContentItem, ArticleContent } from '@/components/content/types';

export interface EmailCampaignPayload {
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  footer_tags?: string;
  source_content_id: string;
  source_platform?: string | null;
}

export function contentToEmailPayload(item: ContentItem, art: ArticleContent): EmailCampaignPayload {
  const bodyHtml = art.html || '';
  const bodyText = bodyHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  return {
    name: art.title || item.title,
    subject: art.title || item.title,
    body_html: bodyHtml,
    body_text: bodyText,
    footer_tags: art.hashtags?.join(' ') || '',
    source_content_id: item.id,
    source_platform: item.platform,
  };
}
