import { FileText, Send, ExternalLink, MessageCircle, Search, Code, Share2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { ContentItem, ArticleContent } from '@/components/content/types';
import CopyButton from './CopyButton';
import SendToCampaignDialog from '@/components/content/dialogs/SendToCampaignDialog';
import { SchedulePublishDialog } from '@/components/content/SchedulePublishDialog';
import ImageViewer from '@/components/content/ImageViewer';
import { cn } from '@/lib/utils';

function SEOMetaPanel({ item, art }: { item: ContentItem; art: ArticleContent }) {
  const seoTitle = item.seo_title || art.seo_title || item.title;
  const metaDesc = item.meta_description || art.meta_description || art.excerpt || '';
  const slug = item.slug || art.slug || '';
  const keywords = item.meta_keywords || art.meta_keywords || '';
  const structData = item.structured_data || art.structured_data || null;

  if (!metaDesc && !keywords && !structData) return null;

  return (
    <details className="rounded-lg border bg-muted/5 overflow-hidden">
      <summary className="px-4 py-2.5 cursor-pointer select-none flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <Search className="h-3.5 w-3.5" />
        SEO / AEO Metadata
      </summary>
      <div className="px-4 py-3 space-y-2 border-t bg-muted/10 text-xs">
        {seoTitle && (
          <div>
            <span className="font-semibold text-muted-foreground">SEO Title: </span>
            <span className="text-foreground">{seoTitle}</span>
            <span className="text-muted-foreground ml-1">({seoTitle.length} chars)</span>
          </div>
        )}
        {slug && (
          <div>
            <span className="font-semibold text-muted-foreground">Slug: </span>
            <code className="text-foreground bg-muted px-1 rounded">{slug}</code>
          </div>
        )}
        {metaDesc && (
          <div>
            <span className="font-semibold text-muted-foreground">Meta Description: </span>
            <span className="text-foreground">{metaDesc}</span>
            <span className="text-muted-foreground ml-1">({metaDesc.length}/160 chars)</span>
          </div>
        )}
        {keywords && (
          <div>
            <span className="font-semibold text-muted-foreground">Keywords: </span>
            <span className="text-foreground">{keywords}</span>
          </div>
        )}
        {art.og_image && (
          <div>
            <span className="font-semibold text-muted-foreground">OG Image: </span>
            <span className="text-foreground">{art.og_image}</span>
          </div>
        )}
        {structData && (
          <details className="mt-1">
            <summary className="cursor-pointer flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Code className="h-3 w-3" />
              Structured Data (JSON-LD)
            </summary>
            <pre className="mt-1 p-2 rounded bg-slate-900 text-slate-100 text-[10px] overflow-x-auto max-h-48">
              {typeof structData === 'string' ? structData : JSON.stringify(structData, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </details>
  );
}

export default function ContentArticleView({ item }: { item: ContentItem }) {
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<'schedule' | 'send_now'>('send_now');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  let art: ArticleContent | null = null;
  let parseError = false;
  if (item.article_content) {
    try { art = JSON.parse(item.article_content); } catch { parseError = true; }
  }

  if (!art || parseError) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/10 py-16 text-center text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">{parseError ? 'ข้อมูลบทความไม่สมบูรณ์' : 'ยังไม่มีเนื้อหา'}</p>
        <p className="text-sm mt-1">กด "สร้างเนื้อหา AI" ด้านบนเพื่อให้ AI เขียนให้</p>
      </div>
    );
  }

  const isSocial = ['facebook', 'instagram', 'lineoa', 'linkedin', 'twitter', 'tiktok']
    .includes((item.platform ?? '').toLowerCase()) || art.platform_type === 'social';

  const displayCaption = item.caption || art.html || art.caption;

  return (
    <div className="space-y-6">
      {/* Cover image */}
      {item.generated_image_url && (
        <div className={cn(
          'rounded-xl overflow-hidden border bg-muted/20 cursor-zoom-in group',
          isSocial && 'max-w-lg mx-auto'
        )} onClick={() => setImageViewerOpen(true)}>
          <img src={item.generated_image_url} alt={art.title || item.title}
            className="w-full max-h-80 object-cover" loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Search className="h-6 w-6 text-white drop-shadow-lg" />
          </div>
        </div>
      )}
      <ImageViewer src={item.generated_image_url ?? ''} alt={art?.title || item.title} open={imageViewerOpen} onOpenChange={setImageViewerOpen} />

      {/* Title & excerpt */}
      <div>
        <h2 className={cn(
          'font-bold font-heading',
          isSocial ? 'text-lg' : 'text-2xl'
        )}>
          {item.title || art.title}
        </h2>
        {art.excerpt && (
          <div className="mt-2 text-muted-foreground italic leading-relaxed"
            dangerouslySetInnerHTML={art.excerpt.includes('<') ? { __html: DOMPurify.sanitize(art.excerpt) } : undefined}>
            {!art.excerpt.includes('<') ? art.excerpt : undefined}
          </div>
        )}
      </div>

      {/* Social caption card */}
      {isSocial ? (
        <div className="rounded-xl border bg-muted/5 overflow-hidden max-w-lg mx-auto">
          <div className="px-4 py-3 border-b bg-muted/10 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">แคปชั่นโซเชียล</span>
          </div>
          <div className="px-4 py-4">
            {displayCaption ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={displayCaption.includes('<') ? { __html: DOMPurify.sanitize(displayCaption) } : undefined}>
                {!displayCaption.includes('<') ? displayCaption : undefined}
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-sm py-4">
                ไม่มีแคปชั่น
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Long-form article body */
        <>
          {item.caption && (
            <div className="rounded-xl border bg-muted/5 overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/10 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">แคปชั่น</span>
              </div>
              <div className="px-4 py-4">
                <div className="text-sm leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={item.caption.includes('<') ? { __html: DOMPurify.sanitize(item.caption) } : undefined}>
                  {!item.caption.includes('<') ? item.caption : undefined}
                </div>
              </div>
            </div>
          )}

          {/* SEO Metadata Panel */}
          <SEOMetaPanel item={item} art={art} />

          {/* Article body with semantic HTML */}
          {art.html ? (
            <div className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(art.html) }} />
          ) : (
            <div className="rounded-lg border p-6 text-center text-muted-foreground text-sm">
              ไม่มีเนื้อหาบทความ
            </div>
          )}
        </>
      )}

      {/* Hashtags */}
      {art.hashtags && art.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {art.hashtags.map((tag, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap border-t pt-4">
        <CopyButton text={isSocial ? (displayCaption || '') : (art.html || '')} label={isSocial ? 'คัดลอกแคปชั่น' : 'คัดลอกบทความ'} />
        <Button size="sm" variant="default" className="gap-1.5" onClick={() => { setPublishMode('send_now'); setPublishDialogOpen(true); }}>
          <Share2 className="h-3.5 w-3.5" />
          โพสต์เดี๋ยวนี้
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setPublishMode('schedule'); setPublishDialogOpen(true); }}>
          <Send className="h-3.5 w-3.5" />
          ตั้งเวลาโพสต์
        </Button>
        {!isSocial && (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setSendDialogOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            Email Campaign
          </Button>
        )}
        {item.generated_image_url && (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setImageViewerOpen(true)}>
            <Eye className="h-3.5 w-3.5" />
            ดูรูปเต็ม
          </Button>
        )}
      </div>

      <SendToCampaignDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen} contentItem={item} />
      <SchedulePublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        contentId={item.id}
        contentTitle={item.title || item.topic || ''}
        defaultCaption={item.caption || ''}
        defaultBody={art?.html || ''}
        mode={publishMode}
      />
    </div>
  );
}
