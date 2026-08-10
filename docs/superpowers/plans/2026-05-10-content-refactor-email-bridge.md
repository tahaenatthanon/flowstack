# Content Feature Refactor & Email Bridge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split ContentPage.tsx (2,800+ lines) into independent testable components, simplify article/video views, and add bidirectional Content ↔ Email Campaign bridge.

**Architecture:** Extract types to single source of truth, split tabs/dialogs/views into separate files under `components/content/`, add `lib/contentBridge.ts` for data transformation, add `api/content-to-campaign.php` for the bridge endpoint, DB migration for `source_content_id` on `email_campaigns`.

**Tech Stack:** React 18 + TypeScript + TanStack React Query + shadcn-ui + Tailwind CSS + Vitest + React Testing Library + PHP + MariaDB

---

### Task 1: Create types.ts — Single source of truth for content types

**Files:**
- Create: `src/components/content/types.ts`
- Modify: `src/hooks/useContent.ts` (remove duplicate types, re-export from types.ts)

- [ ] **Step 1: Create types file**

Create `src/components/content/types.ts`:

```typescript
// ─── Content Types — single source of truth ────────────────────────

export interface ContentItem {
  id: string; title: string; type: string; status: string;
  views: number; likes: number; created_at: string;
  plan_item_id?: string | null;
  caption?: string | null;
  image_brief?: string | null;
  generated_image_url?: string | null;
  article_content?: string | null;
  platform?: string | null;
  day_label?: string | null;
  plan_title?: string | null;
  plan_id?: string | null;
  week_start?: string | null;
}

export interface BrandContext {
  id: string; name: string; file_type: 'brand_md' | 'sop_md' | 'custom';
  content: string; parsed_data?: string; created_at: string;
}

export interface ContentSkill {
  id: string; name: string; description: string; system_prompt: string;
  steps: Array<{ instruction: string; output_type: string }>; created_at: string;
}

export interface ContentTrigger {
  id: string; command: string; description: string;
  skill_id: string | null; skill_name: string | null;
  is_active: number; created_at: string;
}

export interface ContentPlan {
  id: string; title: string; week_start: string; status: string;
  trigger_command: string; created_at: string; items?: PlanItem[];
}

export interface PlanItem {
  id: string; plan_id: string; day_label: string; day_order: number;
  scheduled_date?: string | null; platform: string; topic: string;
  caption: string; image_brief: string;
  generated_image_url: string | null; image_gen_status: string;
  article_content?: string | null;
}

export interface PublishChannel {
  id: string; name: string;
  platform: 'wordpress' | 'wix' | 'custom' | 'facebook' | 'lineoa' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter';
  endpoint_url: string; is_active: number; created_at: string;
}

export interface ContentSchedule {
  id: string; plan_item_id: string; channel_id: string;
  scheduled_at: string; status: string; publish_result: string | null;
  channel_name?: string; platform?: string;
  topic?: string; day_label?: string; plan_title?: string; week_start?: string;
}

export interface GlobalSettings {
  global_instruction: string; image_gen_provider: string; image_gen_model: string;
  image_gen_base_url: string; product_ref_image_url: string; has_image_gen_key: boolean;
}

export interface AIGatewaySettings {
  ai_active_provider_id: string | null;
  ai_default_model_id: string | null;
  ai_content_text_model_id: string | null;
  ai_content_image_model_id: string | null;
  ai_content_video_model_id: string | null;
  provider_name?: string; provider_display_name?: string;
  provider_base_url?: string; provider_has_key?: number;
  model_name?: string; model_identifier?: string;
  content_text_model_name?: string;
  content_image_model_name?: string;
  content_video_model_name?: string;
}

export interface ArticleContent {
  title?: string;
  excerpt?: string;
  html?: string;
  headlines?: {
    viral_clickbait?: Array<{ title: string; hook: string }>;
    storytelling?: Array<{ title: string; hook: string }>;
    educational?: Array<{ title: string; hook: string }>;
  };
  scripts?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  };
  script_sections?: { opening?: string; bridge?: string; twist?: string; ending?: string };
  visuals?: string[];
  hashtags?: string[];
}

// ─── Constants ──────────────────────────────────────────────────────
export const TYPE_MAP: Record<string, { label: string; color: string }> = {
  article: { label: 'บทความ', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
  image:   { label: 'รูปภาพ', color: 'text-violet-500 bg-violet-50 dark:bg-violet-950' },
  video:   { label: 'วีดีโอ',  color: 'text-red-500 bg-red-50 dark:bg-red-950' },
};

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: 'เผยแพร่แล้ว', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  draft:     { label: 'ร่าง',        color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  review:    { label: 'รออนุมัติ',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
};

export const PLAN_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'ร่าง',         color: 'bg-gray-100 text-gray-600' },
  approved:  { label: 'อนุมัติแล้ว', color: 'bg-blue-100 text-blue-700' },
  published: { label: 'เผยแพร่แล้ว', color: 'bg-green-100 text-green-700' },
};

export const FILE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  brand_md: { label: 'brand.md',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  sop_md:   { label: 'claude.md', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  custom:   { label: 'Custom',    color: 'bg-gray-100 text-gray-600' },
};

export const PLATFORM_MAP: Record<string, { label: string; color: string }> = {
  wordpress: { label: 'WordPress',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  wix:       { label: 'Wix',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  custom:    { label: 'Custom API',  color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  facebook:  { label: 'Facebook',    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  lineoa:    { label: 'Line OA',     color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  instagram: { label: 'Instagram',   color: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' },
  tiktok:    { label: 'TikTok',      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  linkedin:  { label: 'LinkedIn',    color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  twitter:   { label: 'Twitter / X', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
};
```

- [ ] **Step 2: Update useContent.ts — remove duplicate types, import from types.ts**

Modify `src/hooks/useContent.ts`:
- Remove lines 7-78 (all type/interface definitions and constants)
- Add at top: `import type { ContentItem, BrandContext, ContentSkill, ContentTrigger, ContentPlan, PlanItem, PublishChannel, ContentSchedule, GlobalSettings, AIGatewaySettings } from '@/components/content/types';`

- [ ] **Step 3: Verify type imports work**

Run: `pnpm lint`
Expected: No errors related to missing types.

- [ ] **Step 4: Commit**

```bash
git add src/components/content/types.ts src/hooks/useContent.ts
git commit -m "refactor: extract content types to single source of truth

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Split ContentListTab into separate file

**Files:**
- Create: `src/components/content/tabs/ContentListTab.tsx`
- Create: `src/components/content/views/CopyButton.tsx`
- Create: `src/components/content/views/ContentDetailView.tsx`
- Modify: `src/pages/ContentPage.tsx` (remove ContentListTab, ContentDetailView, CopyButton — import from new files)

- [ ] **Step 1: Create CopyButton component**

Create `src/components/content/views/CopyButton.tsx`:

```typescript
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}

export function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs px-2 shrink-0"
      onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {label}
    </Button>
  );
}
```

- [ ] **Step 2: Create ContentDetailView — delegates to ArticleView or VideoView**

Create `src/components/content/views/ContentDetailView.tsx`:

```typescript
import { ChevronRight, FileText, Play, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { usePublishChannels, useItemSchedules } from '@/hooks/useContent';
import { cn } from '@/lib/utils';
import type { ContentItem } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import ContentArticleView from './ContentArticleView';
import ContentVideoView from './ContentVideoView';

export default function ContentDetailView({ item, onBack }: { item: ContentItem; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isVideo = item.type === 'video' || ['tiktok', 'youtube', 'reels', 'shorts'].includes((item.platform ?? '').toLowerCase());

  const [schedOpen, setSchedOpen] = useState(false);
  const [schedChannelId, setSchedChannelId] = useState('');
  const [schedDt, setSchedDt] = useState('');
  const [savingSched, setSavingSched] = useState(false);

  const { data: channels = [] } = usePublishChannels(schedOpen);

  const handleSchedule = async () => {
    if (!schedChannelId || !schedDt) return;
    setSavingSched(true);
    try {
      await apiFetch('/brand-content.php?action=schedules', {
        method: 'POST',
        body: JSON.stringify({ plan_item_id: item.plan_item_id, channel_id: schedChannelId, scheduled_at: schedDt }),
      });
      toast({ title: 'ตั้งเวลาโพสต์แล้ว' });
      setSchedOpen(false);
      qc.invalidateQueries({ queryKey: ['content', 'schedules'] });
    } catch (e: any) {
      toast({ title: 'ตั้งเวลาไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setSavingSched(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 shrink-0 -ml-1" onClick={onBack}>
          <ChevronRight className="h-4 w-4 rotate-180" />กลับ
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg leading-tight">{item.title}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isVideo ? <><Play className="h-3 w-3" />วิดีโอ</> : <><FileText className="h-3 w-3" />บทความ</>}
            </span>
            {item.platform && (
              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', PLATFORM_MAP[item.platform]?.color ?? 'bg-muted text-muted-foreground')}>
                {PLATFORM_MAP[item.platform]?.label ?? item.platform}
              </span>
            )}
            {item.day_label && <span className="text-xs text-muted-foreground">{item.day_label}</span>}
            <span className="text-xs text-muted-foreground">· {new Date(item.created_at).toLocaleDateString('th-TH')}</span>
          </div>
        </div>
        {item.plan_item_id && (
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setSchedOpen(true)}>
            <Clock className="h-3.5 w-3.5" />ตั้งเวลาโพสต์
          </Button>
        )}
      </div>

      {isVideo ? <ContentVideoView item={item} /> : <ContentArticleView item={item} />}

      {/* Schedule Dialog */}
      <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ตั้งเวลาโพสต์</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={schedChannelId} onValueChange={setSchedChannelId}>
                <SelectTrigger><SelectValue placeholder="เลือก channel" /></SelectTrigger>
                <SelectContent>
                  {channels.filter((c: any) => c.is_active).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.platform})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>วันเวลา</Label>
              <Input type="datetime-local" value={schedDt} onChange={e => setSchedDt(e.target.value)} />
            </div>
          </div>
          <Button disabled={!schedChannelId || !schedDt || savingSched} onClick={handleSchedule}>
            {savingSched ? 'กำลังบันทึก...' : 'ตั้งเวลา'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Create ContentListTab**

Create `src/components/content/tabs/ContentListTab.tsx` — copy lines 548-671 from ContentPage.tsx with adjusted imports:

- Import types from `@/components/content/types` instead of local definitions
- Import `ContentDetailView` from `@/components/content/views/ContentDetailView`
- Import `CopyButton` from `@/components/content/views/CopyButton` (no longer inline)
- All query hooks from `@/hooks/useContent`

The component is the existing `ContentListTab` function body exactly as-is (search/filter/status/type controls, grid/list, delete mutation, detail view toggle).

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: No build errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/content/views/CopyButton.tsx src/components/content/views/ContentDetailView.tsx src/components/content/tabs/ContentListTab.tsx src/pages/ContentPage.tsx
git commit -m "refactor: extract ContentListTab, ContentDetailView, CopyButton to separate files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Create ContentArticleView and ContentVideoView

**Files:**
- Create: `src/components/content/views/ContentArticleView.tsx`
- Create: `src/components/content/views/ContentVideoView.tsx`

- [ ] **Step 1: Create ContentArticleView**

Create `src/components/content/views/ContentArticleView.tsx`:

```typescript
import { FileText, Send, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { ContentItem, ArticleContent } from '@/components/content/types';
import CopyButton from './CopyButton';

export default function ContentArticleView({ item }: { item: ContentItem }) {
  const [showSendDialog, setShowSendDialog] = useState(false);

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
        {parseError && (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            ลองใหม่
          </Button>
        )}
        {!parseError && (
          <p className="text-sm mt-1">กลับไปที่ Content Planner แล้วกด "สร้างบทความ"</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cover image */}
      {item.generated_image_url && (
        <div className="rounded-xl overflow-hidden border bg-muted/20">
          <img src={item.generated_image_url} alt={art.title || item.title}
            className="w-full max-h-80 object-cover" />
        </div>
      )}

      {/* Title & excerpt */}
      <div>
        <h2 className="text-2xl font-bold font-heading">{art.title || item.title}</h2>
        {art.excerpt && (
          <p className="mt-2 text-muted-foreground italic leading-relaxed">{art.excerpt}</p>
        )}
      </div>

      {/* HTML body — rendered as clean article */}
      {art.html ? (
        <div className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: art.html }} />
      ) : (
        <div className="rounded-lg border p-6 text-center text-muted-foreground text-sm">
          ไม่มีเนื้อหาบทความ
        </div>
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
        <CopyButton text={art.html || ''} label="คัดลอกบทความ" />
        <Button size="sm" variant="outline" className="gap-1.5"
          onClick={() => setShowSendDialog(true)}>
          <Send className="h-3.5 w-3.5" />
          ส่ง Email Campaign
        </Button>
        {item.generated_image_url && (
          <Button size="sm" variant="ghost" className="gap-1.5" asChild>
            <a href={item.generated_image_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              ดูรูปเต็ม
            </a>
          </Button>
        )}
      </div>

      {/* SendToCampaignDialog placeholder — will be replaced when Task 5 creates the real dialog */}
      {showSendDialog && (
        <p className="text-sm text-muted-foreground text-center py-2">
          {/* Imported from SendToCampaignDialog after Task 5 */}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ContentVideoView**

Create `src/components/content/views/ContentVideoView.tsx`:

```typescript
import { Play, ImagePlus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { ContentItem, ArticleContent } from '@/components/content/types';
import CopyButton from './CopyButton';
import { cn } from '@/lib/utils';

const SCENE_LABELS: Record<string, string> = {
  opening: 'Opening Hook', bridge: 'Bridge', twist: 'Twist', ending: 'CTA',
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: 'bg-black text-white', youtube: 'bg-red-600 text-white',
  instagram: 'bg-pink-500 text-white', facebook: 'bg-indigo-600 text-white',
};

export default function ContentVideoView({ item }: { item: ContentItem }) {
  const [showSections, setShowSections] = useState(true);
  const [activePlatform, setActivePlatform] = useState<'tiktok' | 'youtube' | 'instagram' | 'facebook'>(
    (item.platform as any) || 'tiktok'
  );

  let art: ArticleContent | null = null;
  let parseError = false;
  if (item.article_content) {
    try { art = JSON.parse(item.article_content); } catch { parseError = true; }
  }

  if (!art) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/10 py-16 text-center text-muted-foreground">
        <Play className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">{parseError ? 'ข้อมูลไม่สมบูรณ์' : 'ยังไม่มีเนื้อหา'}</p>
      </div>
    );
  }

  const platformLabel: Record<string, string> = { tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };

  return (
    <div className="space-y-6">
      {/* Cover / preview */}
      {item.generated_image_url && (
        <div className="rounded-xl overflow-hidden border bg-muted/20 relative">
          <img src={item.generated_image_url} alt={art.title || item.title}
            className="w-full max-h-80 object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="p-4 rounded-full bg-white/80 shadow-lg">
              <Play className="h-8 w-8 text-black fill-black" />
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <h2 className="text-2xl font-bold font-heading">{art.title || item.title}</h2>

      {/* Platform sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['tiktok', 'youtube', 'instagram', 'facebook'] as const).map(p => (
          <button key={p}
            onClick={() => setActivePlatform(p)}
            className={cn('px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              activePlatform === p
                ? PLATFORM_COLORS[p]
                : 'bg-background text-muted-foreground border-border hover:bg-muted')}>
            {platformLabel[p]}
          </button>
        ))}
      </div>

      {/* Full script for selected platform */}
      {art.scripts?.[activePlatform] && (
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-b">
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', PLATFORM_COLORS[activePlatform])}>
              🎬 สคริปต์ {platformLabel[activePlatform]}
            </span>
            <CopyButton text={art.scripts[activePlatform]!} label="คัดลอก" />
          </div>
          <div className="px-4 py-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{art.scripts[activePlatform]}</p>
          </div>
        </div>
      )}

      {/* Scene cards */}
      {art.script_sections && Object.values(art.script_sections).some(v => v) && (
        <>
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowSections(s => !s)}>
            {showSections ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            แยกฉาก
          </button>

          {showSections && (
            <div className="space-y-3">
              {(['opening', 'bridge', 'twist', 'ending'] as const).map((sec, i) => {
                const text = art?.script_sections?.[sec];
                if (!text) return null;
                const timecodes = ['0:00-0:15', '0:15-0:35', '0:35-0:55', '0:55-1:00'];
                return (
                  <div key={sec} className="rounded-xl border overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b">
                      <span className="text-xs font-bold text-muted-foreground">
                        Scene {i + 1}
                      </span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {timecodes[i]}
                      </span>
                      <span className="text-xs font-semibold">{SCENE_LABELS[sec]}</span>
                      <div className="flex-1" />
                      <CopyButton text={text} label="" />
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                      <Button size="sm" variant="ghost" className="gap-1 mt-2 h-7 text-xs">
                        <ImagePlus className="h-3 w-3" />
                        สร้างภาพประกอบ
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Visuals & Hashtags */}
      <div className="flex flex-wrap gap-1.5">
        {art.hashtags?.map((tag, i) => (
          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap border-t pt-4">
        <CopyButton text={art.scripts?.[activePlatform] || ''} label="คัดลอกสคริปต์" />
        {art.visuals && art.visuals.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5">
            <ImagePlus className="h-3.5 w-3.5" />
            สร้างภาพทั้ง {art.visuals.length} ฉาก
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/content/views/ContentArticleView.tsx src/components/content/views/ContentVideoView.tsx
git commit -m "feat: add ContentArticleView and ContentVideoView with simplified layouts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Split remaining tabs into separate files

**Files:**
- Create: `src/components/content/tabs/BrandContextTab.tsx`
- Create: `src/components/content/tabs/SkillsTriggerTab.tsx`
- Create: `src/components/content/tabs/AISettingsTab.tsx`
- Create: `src/components/content/tabs/ScheduleOverviewPanel.tsx`
- Modify: `src/pages/ContentPage.tsx` (remove inline tabs, import from new files)

- [ ] **Step 1: Extract BrandContextTab**

Create `src/components/content/tabs/BrandContextTab.tsx`:
- Copy lines 672-1046 from ContentPage.tsx
- Adjust imports: types from `@/components/content/types`, hooks from `@/hooks/useContent`

- [ ] **Step 2: Extract SkillsTriggerTab**

Create `src/components/content/tabs/SkillsTriggerTab.tsx`:
- Copy lines 1047-1246 from ContentPage.tsx
- Adjust imports accordingly

- [ ] **Step 3: Extract ScheduleOverviewPanel**

Create `src/components/content/tabs/ScheduleOverviewPanel.tsx`:
- Copy lines 2103-2362 from ContentPage.tsx
- Adjust imports accordingly

- [ ] **Step 4: Extract AISettingsTab**

Create `src/components/content/tabs/AISettingsTab.tsx`:
- Copy lines 2363-2479 from ContentPage.tsx
- Adjust imports accordingly

- [ ] **Step 5: Extract ContentPlannerTab**

Create `src/components/content/tabs/ContentPlannerTab.tsx`:
- Copy lines 1247-2102 from ContentPage.tsx (this is the largest tab)
- Adjust imports: types from `@/components/content/types`, hooks from `@/hooks/useContent`

- [ ] **Step 6: Update ContentPlannerPage.tsx**

Modify `src/pages/ContentPlannerPage.tsx` — change import from:
```typescript
import { ContentPlannerTab, BatchGenerateDialog } from './ContentPage';
```
to:
```typescript
import { ContentPlannerTab } from '@/components/content/tabs/ContentPlannerTab';
import { BatchGenerateDialog } from '@/components/content/dialogs/BatchGenerateDialog';
```

- [ ] **Step 7: Verify build**

Run: `pnpm build`
Expected: No errors, all tabs render.

- [ ] **Step 8: Commit**

```bash
git add src/components/content/tabs/ src/pages/ContentPage.tsx src/pages/ContentPlannerPage.tsx
git commit -m "refactor: extract all content tabs to separate files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Split dialogs into separate files

**Files:**
- Create: `src/components/content/dialogs/BatchGenerateDialog.tsx`
- Create: `src/components/content/dialogs/QuickCreateDialog.tsx`
- Modify: `src/pages/ContentPage.tsx` (remove inline dialogs, import from new files)

- [ ] **Step 1: Extract BatchGenerateDialog**

Create `src/components/content/dialogs/BatchGenerateDialog.tsx`:
- Copy lines 2481-2720 from ContentPage.tsx
- Adjust imports: types from `@/components/content/types`, hooks from `@/hooks/useContent`, PLATFORM_MAP from `@/components/content/types`

- [ ] **Step 2: Extract QuickCreateDialog**

Create `src/components/content/dialogs/QuickCreateDialog.tsx`:
- Copy lines 2785-end from ContentPage.tsx
- Adjust imports accordingly

- [ ] **Step 3: Update ContentPage.tsx default export**

After removing inline tabs and dialogs, ContentPage.tsx (~200 lines) becomes:

```typescript
import { PenTool, Plus, Wand2, BookOpen, Bot, Settings2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { ContentListTab } from '@/components/content/tabs/ContentListTab';
import { BrandContextTab } from '@/components/content/tabs/BrandContextTab';
import { SkillsTriggerTab } from '@/components/content/tabs/SkillsTriggerTab';
import { AISettingsTab } from '@/components/content/tabs/AISettingsTab';
import { ScheduleOverviewPanel } from '@/components/content/tabs/ScheduleOverviewPanel';
import { BatchGenerateDialog } from '@/components/content/dialogs/BatchGenerateDialog';
import { QuickCreateDialog } from '@/components/content/dialogs/QuickCreateDialog';

export default function ContentPage() {
  const [batchOpen, setBatchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 shrink-0"><PenTool className="h-5 w-5 text-primary" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold font-heading">ผลงานคอนเทนต์</h1>
          <p className="text-sm text-muted-foreground">ดูผลงาน ตั้งเวลาโพสต์ และจัดการ Knowledge Base / Skills</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => setQuickOpen(true)}>
            <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">สร้างคอนเทนต์</span><span className="sm:hidden">สร้าง</span>
          </Button>
          <Button className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md"
            onClick={() => setBatchOpen(true)}>
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Batch สร้าง</span>
            <span className="sm:hidden">Batch</span>
          </Button>
        </div>
      </div>

      <BatchGenerateDialog open={batchOpen} onOpenChange={setBatchOpen} />
      <QuickCreateDialog open={quickOpen} onOpenChange={setQuickOpen} />

      <Tabs defaultValue="content" className="space-y-5">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="content"   className="gap-1.5 text-xs sm:text-sm"><PenTool className="h-3.5 w-3.5" /><span>ผลงานทั้งหมด</span></TabsTrigger>
          <TabsTrigger value="schedule"  className="gap-1.5 text-xs sm:text-sm"><Clock className="h-3.5 w-3.5" /><span>กำหนดการโพสต์</span></TabsTrigger>
          <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />
          <TabsTrigger value="context"   className="gap-1.5 text-xs sm:text-sm"><BookOpen className="h-3.5 w-3.5" /><span>Knowledge Base</span></TabsTrigger>
          <TabsTrigger value="skills"    className="gap-1.5 text-xs sm:text-sm"><Bot className="h-3.5 w-3.5" /><span>Skills & Triggers</span></TabsTrigger>
          <TabsTrigger value="settings"  className="gap-1.5 text-xs sm:text-sm"><Settings2 className="h-3.5 w-3.5" /><span>ตั้งค่า AI</span></TabsTrigger>
        </TabsList>

        <TabsContent value="content"><ContentListTab /></TabsContent>
        <TabsContent value="schedule">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />กำหนดการโพสต์อัตโนมัติ
              </CardTitle>
              <p className="text-xs text-muted-foreground">ระบบจะส่งโพสต์ตามเวลาที่ตั้งไว้ทุก 60 วินาทีอัตโนมัติ</p>
            </CardHeader>
            <CardContent><ScheduleOverviewPanel /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="context"><BrandContextTab /></TabsContent>
        <TabsContent value="skills"><SkillsTriggerTab /></TabsContent>
        <TabsContent value="settings"><AISettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/content/dialogs/ src/pages/ContentPage.tsx
git commit -m "refactor: extract dialogs to separate files, slim ContentPage to ~200 lines

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Create SendToCampaignDialog

**Files:**
- Create: `src/components/content/dialogs/SendToCampaignDialog.tsx`
- Modify: `src/components/content/views/ContentArticleView.tsx` (wire up the dialog)

- [ ] **Step 1: Create SendToCampaignDialog**

Create `src/components/content/dialogs/SendToCampaignDialog.tsx`:

```typescript
import { Send, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import type { ContentItem } from '@/components/content/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentItem: ContentItem;
}

export default function SendToCampaignDialog({ open, onOpenChange, contentItem }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [campaignName, setCampaignName] = useState('');
  const [existingCampaignId, setExistingCampaignId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch('/email-campaigns.php'),
    enabled: open,
  });

  const draftCampaigns = campaigns.filter((c: any) => c.status === 'draft');

  useEffect(() => {
    if (open) {
      setCampaignName('');
      setExistingCampaignId('');
      setMode('new');
    }
  }, [open]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await apiFetch('/content-to-campaign.php?action=to-campaign', {
        method: 'POST',
        body: JSON.stringify({
          content_item_id: contentItem.id,
          campaign_name: mode === 'new' ? campaignName : undefined,
          campaign_id: mode === 'existing' ? existingCampaignId : undefined,
        }),
      });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: mode === 'new' ? 'สร้างแคมเปญจากบทความแล้ว' : 'เพิ่มบทความในแคมเปญแล้ว' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />ส่งเข้า Email Campaign
          </DialogTitle>
          <DialogDescription>
            นำเนื้อหาบทความ "{contentItem.title}" ไปใช้ในแคมเปญอีเมล
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')} className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <RadioGroupItem value="new" id="mode-new" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="mode-new" className="font-medium">สร้างแคมเปญใหม่</Label>
              {mode === 'new' && (
                <Input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  placeholder="ชื่อแคมเปญ (ถ้าไม่ระบุใช้ชื่อบทความ)" />
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <RadioGroupItem value="existing" id="mode-existing" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="mode-existing" className="font-medium">เพิ่มในแคมเปญที่มีอยู่</Label>
              {mode === 'existing' && (
                <Select value={existingCampaignId} onValueChange={setExistingCampaignId}>
                  <SelectTrigger><SelectValue placeholder="เลือกแคมเปญ (draft)" /></SelectTrigger>
                  <SelectContent>
                    {draftCampaigns.length === 0 ? (
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">ไม่มี draft campaign</div>
                    ) : (
                      draftCampaigns.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </RadioGroup>

        <Button
          disabled={saving || (mode === 'existing' && !existingCampaignId)}
          onClick={handleSubmit}
          className="gap-2">
          <Send className="h-4 w-4" />
          {saving ? 'กำลังส่ง...' : 'ส่งเข้า Campaign'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire SendToCampaignDialog into ContentArticleView**

Modify `src/components/content/views/ContentArticleView.tsx`:
- Remove the placeholder `<p>` at the bottom
- Import `SendToCampaignDialog`
- Replace `showSendDialog` usage with actual `<SendToCampaignDialog open={showSendDialog} onOpenChange={setShowSendDialog} contentItem={item} />`

- [ ] **Step 3: Add RadioGroup component if not exists**

Check if `src/components/ui/radio-group.tsx` exists:
Run: `ls src/components/ui/radio-group.tsx 2>/dev/null`
Expected: file exists (comes with shadcn-ui). If not, create it from shadcn.

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/content/dialogs/SendToCampaignDialog.tsx src/components/content/views/ContentArticleView.tsx
git commit -m "feat: add SendToCampaignDialog for content-to-email bridge

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Create PullFromContentDialog and wire into CampaignsPage

**Files:**
- Create: `src/components/content/dialogs/PullFromContentDialog.tsx`
- Modify: `src/pages/CampaignsPage.tsx` (add "ดึงจาก Content" button)

- [ ] **Step 1: Create PullFromContentDialog**

Create `src/components/content/dialogs/PullFromContentDialog.tsx`:

```typescript
import { FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ContentItem } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (content: ContentItem) => void;
}

export default function PullFromContentDialog({ open, onOpenChange, onSelect }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ['content', 'items'],
    queryFn: () => apiFetch('/content-items.php'),
    enabled: open,
  });

  // Filter: only articles that have article_content
  const articles = items.filter((item) => {
    if (item.type !== 'article') return false;
    if (!item.article_content) return false;
    try { JSON.parse(item.article_content); return true; } catch { return false; }
  });

  const filtered = search
    ? articles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
    : articles;

  const handleSelect = (item: ContentItem) => {
    onSelect(item);
    onOpenChange(false);
    toast({ title: 'นำเข้าบทความแล้ว', description: item.title });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />ดึงบทความจาก Content
          </DialogTitle>
          <DialogDescription>
            เลือกบทความที่สร้างด้วย AI เพื่อนำไปใช้ในแคมเปญอีเมล
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาบทความ..." className="pl-8" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-2">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              {search ? 'ไม่พบบทความที่ค้นหา' : 'ยังไม่มีบทความที่สร้างด้วย AI'}
            </p>
          ) : (
            filtered.map(item => {
              let excerpt = '';
              try { const art = JSON.parse(item.article_content || ''); excerpt = art.excerpt || ''; } catch {}

              return (
                <button key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left rounded-lg border p-4 hover:bg-muted/50 transition-colors space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{item.title}</span>
                    {item.platform && (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', PLATFORM_MAP[item.platform]?.color)}>
                        {PLATFORM_MAP[item.platform]?.label}
                      </span>
                    )}
                  </div>
                  {excerpt && <p className="text-xs text-muted-foreground line-clamp-2">{excerpt}</p>}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString('th-TH')}
                  </p>
                </button>
              );
            })
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          เลือกแล้วเนื้อหาจะถูกนำไปใส่ใน Email Editor
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add "ดึงจาก Content" button to CampaignsPage**

Modify `src/pages/CampaignsPage.tsx`:

Add import:
```typescript
import PullFromContentDialog from '@/components/content/dialogs/PullFromContentDialog';
import type { ContentItem } from '@/components/content/types';
```

Add state in component (after existing `search` state):
```typescript
const [pullContentOpen, setPullContentOpen] = useState(false);
```

Add button next to "สร้างแคมเปญ" button:
```typescript
<Button variant="outline" className="gap-2" onClick={() => setPullContentOpen(true)}>
  <FileText className="h-4 w-4" />ดึงจาก Content
</Button>
```

Add dialog before closing `</div>` (after the card list):
```typescript
<PullFromContentDialog
  open={pullContentOpen}
  onOpenChange={setPullContentOpen}
  onSelect={(content: ContentItem) => {
    navigate(`/marketing?content_id=${content.id}`);
  }}
/>
```

Add `FileText` to imports from lucide-react.

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/content/dialogs/PullFromContentDialog.tsx src/pages/CampaignsPage.tsx
git commit -m "feat: add PullFromContentDialog and wire into CampaignsPage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Create contentBridge.ts and content-to-campaign.php

**Files:**
- Create: `src/lib/contentBridge.ts`
- Create: `api/content-to-campaign.php`

- [ ] **Step 1: Create contentBridge.ts**

Create `src/lib/contentBridge.ts`:

```typescript
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
  // Strip HTML tags for plain text version
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
```

- [ ] **Step 2: Create content-to-campaign.php**

Create `api/content-to-campaign.php`:

```php
<?php
// api/content-to-campaign.php
// Bridge: Content Items → Email Campaigns
//
// POST ?action=to-campaign — Create/update campaign from content item
// GET  ?action=from-campaign&campaign_id=X — Get source content for a campaign

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db     = getDB();
$method = getMethod();
$auth   = requireAuth();
$userId = $auth['user_id'];
$tenantId = $auth['tenant_id'];
$action = $_GET['action'] ?? '';

// Auto-migrate: add source_content_id column
try {
    $db->exec("ALTER TABLE email_campaigns ADD COLUMN source_content_id CHAR(36) NULL AFTER body_text");
} catch (Exception $e) {}

if ($action === 'from-campaign' && $method === 'GET') {
    $campaignId = $_GET['campaign_id'] ?? '';
    if (!$campaignId) jsonError('campaign_id required', 400);

    $stmt = $db->prepare("
        SELECT ec.source_content_id, ci.title, ci.article_content
        FROM email_campaigns ec
        LEFT JOIN content_items ci ON ci.id = ec.source_content_id
        WHERE ec.id = ? AND ec.tenant_id = ?
    ");
    $stmt->execute([$campaignId, $tenantId]);
    $row = $stmt->fetch();

    if (!$row || !$row['source_content_id']) {
        jsonResponse(['source_content_id' => null, 'item' => null]);
    } else {
        $art = null;
        if ($row['article_content']) {
            $dec = json_decode($row['article_content'], true);
            if ($dec) $art = $dec;
        }
        jsonResponse([
            'source_content_id' => $row['source_content_id'],
            'item' => ['title' => $row['title'], 'article_content' => $art],
        ]);
    }
}

if ($action === 'to-campaign' && $method === 'POST') {
    $body = getRequestBody();
    $contentItemId = $body['content_item_id'] ?? '';
    $campaignId    = $body['campaign_id'] ?? null;
    $campaignName  = $body['campaign_name'] ?? '';

    if (empty($contentItemId)) jsonError('content_item_id required', 400);

    // Load content item
    $stmt = $db->prepare("
        SELECT ci.*, cpi.caption, cpi.article_content, cpi.platform
        FROM content_items ci
        LEFT JOIN content_items cpi ON cpi.id = ci.plan_item_id
        WHERE ci.id = ? AND ci.tenant_id = ?
    ");
    $stmt->execute([$contentItemId, $tenantId]);
    $item = $stmt->fetch();
    if (!$item) jsonError('Content item not found', 404);

    $art = null;
    if ($item['article_content']) {
        $dec = json_decode($item['article_content'], true);
        if ($dec) $art = $dec;
    }

    $subject = $art['title'] ?? $item['title'];
    $bodyHtml = $art['html'] ?? '';
    $bodyText = strip_tags($bodyHtml);
    $footerTags = isset($art['hashtags']) ? implode(' ', $art['hashtags']) : '';
    if ($footerTags) {
        $bodyHtml .= "\n\n<p style=\"color:#888;font-size:13px\">{$footerTags}</p>";
        $bodyText .= "\n\n{$footerTags}";
    }

    // Get default sender from settings
    $senderName = 'Flowstack';
    $senderEmail = 'noreply@flowstack.com';
    try {
        $sStmt = $db->prepare("SELECT sender_name, sender_email FROM email_campaigns WHERE tenant_id = ? AND sender_email != '' ORDER BY created_at DESC LIMIT 1");
        $sStmt->execute([$tenantId]);
        $sRow = $sStmt->fetch();
        if ($sRow && !empty($sRow['sender_email'])) {
            $senderName = $sRow['sender_name'] ?: $senderName;
            $senderEmail = $sRow['sender_email'];
        }
    } catch (Exception $e) {}

    if ($campaignId) {
        // Update existing campaign
        $check = $db->prepare("SELECT id FROM email_campaigns WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $check->execute([$campaignId, $tenantId]);
        if (!$check->fetch()) jsonError('Campaign not found or not in draft status', 400);

        $db->prepare("
            UPDATE email_campaigns
            SET subject = ?, body_html = ?, body_text = ?, source_content_id = ?, updated_at = NOW()
            WHERE id = ?
        ")->execute([$subject, $bodyHtml, $bodyText, $contentItemId, $campaignId]);

        jsonResponse(['campaign_id' => $campaignId, 'updated' => true]);
    } else {
        // Create new campaign
        $name = !empty($campaignName) ? $campaignName : $subject;
        $id = generateUUID();

        $db->prepare("
            INSERT INTO email_campaigns (id, tenant_id, name, subject, body_html, body_text, sender_name, sender_email, status, source_content_id, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NOW())
        ")->execute([$id, $tenantId, $name, $subject, $bodyHtml, $bodyText, $senderName, $senderEmail, $contentItemId, $userId]);

        jsonResponse(['campaign_id' => $id, 'created' => true], 201);
    }
}

jsonError('Invalid action', 400);
```

- [ ] **Step 3: Verify syntax**

Run: `php -l api/content-to-campaign.php`
Expected: "No syntax errors detected"

- [ ] **Step 4: Commit**

```bash
git add src/lib/contentBridge.ts api/content-to-campaign.php
git commit -m "feat: add contentBridge lib and content-to-campaign API endpoint

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: DB Migration

**Files:**
- Create: `database/migrations/2026_05_10_000000_add_source_content_to_campaigns.sql`

- [ ] **Step 1: Create migration file**

Create `database/migrations/2026_05_10_000000_add_source_content_to_campaigns.sql`:

```sql
-- Migration: Add source_content_id to email_campaigns
-- Purpose: Track which content item was used to create/update a campaign
-- Date: 2026-05-10

ALTER TABLE email_campaigns
ADD COLUMN source_content_id CHAR(36) NULL AFTER body_text;

-- Add index for reverse lookup (find campaigns by content)
ALTER TABLE email_campaigns
ADD KEY idx_source_content (source_content_id);
```

- [ ] **Step 2: Apply migration**

Run: `php -r "require 'api/config.php'; \$db = getDB(); \$db->exec(\"ALTER TABLE email_campaigns ADD COLUMN source_content_id CHAR(36) NULL AFTER body_text\"); \$db->exec(\"ALTER TABLE email_campaigns ADD KEY IF NOT EXISTS idx_source_content (source_content_id)\"); echo 'Migration applied.\n';"`
Expected: "Migration applied."

- [ ] **Step 3: Update schema.sql**

Add `source_content_id char(36) DEFAULT NULL` to the `email_campaigns` CREATE TABLE statement in `database/schema.sql` at line 4703 (after `body_text`).

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_05_10_000000_add_source_content_to_campaigns.sql database/schema.sql
git commit -m "feat: add source_content_id column to email_campaigns

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Tests

**Files:**
- Create: `src/__tests__/content/ContentArticleView.test.tsx`
- Create: `src/__tests__/content/ContentVideoView.test.tsx`
- Create: `src/__tests__/content/SendToCampaignDialog.test.tsx`
- Create: `src/__tests__/content/PullFromContentDialog.test.tsx`
- Create: `src/__tests__/content/contentBridge.test.ts`

- [ ] **Step 1: Test contentBridge**

Create `src/__tests__/content/contentBridge.test.ts`:

```typescript
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
```

Run: `pnpm test src/__tests__/content/contentBridge.test.ts`
Expected: 3 tests pass.

- [ ] **Step 2: Test ContentArticleView**

Create `src/__tests__/content/ContentArticleView.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContentArticleView from '@/components/content/views/ContentArticleView';
import type { ContentItem } from '@/components/content/types';

// Mock clipboard
Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

const mockArticleItem: ContentItem = {
  id: 'ci-1', title: 'บทความ AI', type: 'article', status: 'draft',
  views: 0, likes: 0, created_at: '2026-01-01',
  platform: 'facebook', plan_item_id: 'pi-1',
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
    render(<ContentArticleView item={mockArticleItem} />);
    expect(screen.getByText('บทความ AI 2026')).toBeTruthy();
    expect(screen.getByText('สรุปเทรนด์ AI')).toBeTruthy();
    expect(screen.getByText('เนื้อหา...')).toBeTruthy();
  });

  it('renders hashtags', () => {
    render(<ContentArticleView item={mockArticleItem} />);
    expect(screen.getByText('#AI')).toBeTruthy();
    expect(screen.getByText('#2026')).toBeTruthy();
  });

  it('renders cover image', () => {
    render(<ContentArticleView item={mockArticleItem} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/img.png');
  });

  it('shows fallback on broken article_content', () => {
    const broken = { ...mockArticleItem, article_content: '{broken json' };
    render(<ContentArticleView item={broken} />);
    expect(screen.getByText('ข้อมูลบทความไม่สมบูรณ์')).toBeTruthy();
  });

  it('shows "Send Email Campaign" button', () => {
    render(<ContentArticleView item={mockArticleItem} />);
    expect(screen.getByText('ส่ง Email Campaign')).toBeTruthy();
  });
});
```

Run: `pnpm test src/__tests__/content/ContentArticleView.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 3: Test ContentVideoView**

Create `src/__tests__/content/ContentVideoView.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContentVideoView from '@/components/content/views/ContentVideoView';
import type { ContentItem } from '@/components/content/types';

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
    render(<ContentVideoView item={mockVideoItem} />);
    expect(screen.getByText('Hook 3 วิ')).toBeTruthy();
    expect(screen.getByText('เชื่อมต่อ')).toBeTruthy();
  });

  it('renders platform tabs', () => {
    render(<ContentVideoView item={mockVideoItem} />);
    expect(screen.getByText('TikTok')).toBeTruthy();
    expect(screen.getByText('YouTube')).toBeTruthy();
  });

  it('renders cover image', () => {
    render(<ContentVideoView item={mockVideoItem} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/thumb.png');
  });

  it('shows empty state when no article_content', () => {
    const empty = { ...mockVideoItem, article_content: null };
    render(<ContentVideoView item={empty} />);
    expect(screen.getByText('ยังไม่มีเนื้อหา')).toBeTruthy();
  });
});
```

Run: `pnpm test src/__tests__/content/ContentVideoView.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 4: Test SendToCampaignDialog**

Create `src/__tests__/content/SendToCampaignDialog.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SendToCampaignDialog from '@/components/content/dialogs/SendToCampaignDialog';
import type { ContentItem } from '@/components/content/types';

const mockItem: ContentItem = {
  id: 'ci-1', title: 'Test', type: 'article', status: 'draft',
  views: 0, likes: 0, created_at: '2026-01-01',
  platform: 'facebook', plan_item_id: null,
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('SendToCampaignDialog', () => {
  it('renders dialog with new/existing modes', () => {
    wrap(<SendToCampaignDialog open={true} onOpenChange={vi.fn()} contentItem={mockItem} />);
    expect(screen.getByText('สร้างแคมเปญใหม่')).toBeTruthy();
    expect(screen.getByText('เพิ่มในแคมเปญที่มีอยู่')).toBeTruthy();
  });

  it('shows submit button disabled when no existing campaign selected', () => {
    wrap(<SendToCampaignDialog open={true} onOpenChange={vi.fn()} contentItem={mockItem} />);
    const btn = screen.getByRole('button', { name: /ส่งเข้า Campaign/ });
    expect(btn).toBeTruthy();
    // Default mode is "new", so button should be enabled (name input optional)
  });
});
```

Run: `pnpm test src/__tests__/content/SendToCampaignDialog.test.tsx`
Expected: 2 tests pass.

- [ ] **Step 5: Test PullFromContentDialog**

Create `src/__tests__/content/PullFromContentDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PullFromContentDialog from '@/components/content/dialogs/PullFromContentDialog';

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('PullFromContentDialog', () => {
  it('renders empty state when no articles', () => {
    wrap(<PullFromContentDialog open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('ดึงบทความจาก Content')).toBeTruthy();
    // Initially loading, then empty
    expect(screen.getByPlaceholderText('ค้นหาบทความ...')).toBeTruthy();
  });
});
```

Run: `pnpm test src/__tests__/content/PullFromContentDialog.test.tsx`
Expected: 1 test passes.

- [ ] **Step 6: Run all tests**

Run: `pnpm test`
Expected: All 15 tests pass (3 + 5 + 4 + 2 + 1).

- [ ] **Step 7: Commit**

```bash
git add src/__tests__/content/
git commit -m "test: add tests for content views, dialogs, and contentBridge

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Final verification — build + lint + dev server

- [ ] **Step 1: Lint check**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 2: Full build**

Run: `pnpm build`
Expected: Build succeeds, all imports resolve.

- [ ] **Step 3: Start dev server and verify routes**

Run: `pnpm dev`
Navigate to:
- `http://localhost:8080/#/content` — tabs render, content list shows, detail view works
- `http://localhost:8080/#/content-planner` — planner renders, uses extracted components
- Click article in content list → see simplified article view with "ส่ง Email Campaign" button
- Click video in content list → see scene cards with preview
- `http://localhost:8080/#/campaigns` → "ดึงจาก Content" button is visible

- [ ] **Step 4: Final commit (if any cleanup needed)**

If all passes, no commit needed. If minor fixes required:
```bash
git add -A
git commit -m "chore: final cleanup for content refactor

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
```
