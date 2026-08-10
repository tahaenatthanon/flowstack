import DOMPurify from 'dompurify';
import { FileText, Search, Eye, Check, RefreshCw, AlertCircle, Image, Video, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ContentItem, ArticleContent } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (content: ContentItem) => void;
}

export default function PullFromContentDialog({ open, onOpenChange, onSelect }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);

  const { data: items = [], isLoading, isError, refetch } = useQuery<ContentItem[]>({
    queryKey: ['content', 'items'],
    queryFn: () => apiFetch('/content-items.php'),
    enabled: open,
  });

  const filtered = search
    ? items.filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  const handleSelect = (item: ContentItem) => {
    onSelect(item);
    onOpenChange(false);
    setPreviewItem(null);
    toast({ title: 'นำเข้าบทความแล้ว', description: item.title });
  };

  const handlePreview = (item: ContentItem) => {
    setPreviewItem(prev => prev?.id === item.id ? null : item);
  };

  let previewArt: ArticleContent | null = null;
  if (previewItem?.article_content) {
    try { previewArt = JSON.parse(previewItem.article_content); } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreviewItem(null); }}>
      <DialogContent className="w-full sm:max-w-3xl sm:max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />ดึงจาก Content
          </DialogTitle>
          <DialogDescription>
            เลือกคอนเทนต์เพื่อนำไปใช้ในแคมเปญอีเมล — คลิกรายการเพื่อดูตัวอย่าง
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาบทความ..." className="pl-8" />
        </div>

        <div className="flex-1 flex gap-3 mt-2 min-h-0">
          {/* Article list */}
          <div className={cn('flex-1 overflow-y-auto space-y-2', previewItem ? 'w-1/2' : 'w-full')}>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</p>
            ) : isError ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-red-600 dark:text-red-400">โหลดข้อมูลไม่สำเร็จ</p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
                  <RefreshCw className="h-3.5 w-3.5" />ลองใหม่
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                {search ? 'ไม่พบคอนเทนต์ที่ค้นหา' : 'ยังไม่มีคอนเทนต์'}
              </p>
            ) : (
              filtered.map(item => {
                let excerpt = '';
                try { const art = JSON.parse(item.article_content || ''); excerpt = art.excerpt || ''; } catch {}
                const isPreviewed = previewItem?.id === item.id;
                const TypeIcon = item.type === 'image' ? Image : item.type === 'video' ? Video : item.type === 'article' ? BookOpen : FileText;

                return (
                  <button key={item.id}
                    onClick={() => handlePreview(item)}
                    className={cn('w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors space-y-1.5',
                      isPreviewed && 'ring-2 ring-primary border-primary')}>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm flex-1 truncate">{item.title}</span>
                      <Eye className={cn('h-3.5 w-3.5 shrink-0', isPreviewed ? 'text-primary' : 'text-muted-foreground')} />
                      {item.platform && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', PLATFORM_MAP[item.platform]?.color)}>
                          {PLATFORM_MAP[item.platform]?.label}
                        </span>
                      )}
                    </div>
                    {(excerpt || item.caption) && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{excerpt || item.caption}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('th-TH')}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Preview panel */}
          {previewItem && (
            <div className="w-1/2 flex flex-col border rounded-lg bg-muted/10 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
                <p className="text-xs font-semibold truncate">{(previewArt?.title) || previewItem.title}</p>
                <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => handleSelect(previewItem)}>
                  <Check className="h-3 w-3" />เลือกคอนเทนต์นี้
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {previewItem.generated_image_url && (
                  <img src={previewItem.generated_image_url} alt=""
                    className="w-full max-h-32 object-cover rounded-lg mb-3" loading="lazy" decoding="async" />
                )}
                {previewArt?.excerpt && (
                  <p className="text-xs text-muted-foreground italic mb-3">{previewArt.excerpt}</p>
                )}
                {previewArt?.html ? (
                  <div className="prose prose-xs max-w-none dark:prose-invert text-xs"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewArt.html, { USE_PROFILES: { html: true } }) }} />
                ) : previewItem.caption ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{previewItem.caption}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">ยังไม่มีเนื้อหา</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          {previewItem ? 'คลิก "เลือกคอนเทนต์นี้" เพื่อนำเข้า Email Editor' : 'คลิกรายการเพื่อดูตัวอย่างก่อนเลือก'}
        </div>
      </DialogContent>
    </Dialog>
  );
}
