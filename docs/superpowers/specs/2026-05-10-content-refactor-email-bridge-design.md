# Content Feature Refactor & Email Bridge — Design Spec

**Date:** 2026-05-10
**Status:** Approved

## 1. Problem Statement

- `ContentPage.tsx` is 2,800+ lines — single file holding 6 tabs, 4 dialogs, duplicate types, impossible to unit test
- Article content view shows irrelevant sections (headline frameworks, script tabs, visuals) — should display "ready to post"
- Video content lacks scene-based preview with visuals
- No bridge between generated content and email marketing campaigns
- Zero tests — AI generation failures surface as raw errors to users

## 2. Goals

1. Split ContentPage into independent, testable components
2. Simplify article view to "ready to post" layout
3. Enhance video view with scene cards + preview
4. Bidirectional Content ↔ Email Campaign connection
5. Test coverage preventing regressions

## 3. File Structure

```
src/
├── pages/
│   ├── ContentPage.tsx              (~200L) Tabs container
│   └── ContentPlannerPage.tsx       (~70L)  Thin wrapper

├── components/content/
│   ├── types.ts                     Single source of truth for all types
│   ├── tabs/
│   │   ├── ContentListTab.tsx
│   │   ├── ContentPlannerTab.tsx
│   │   ├── BrandContextTab.tsx
│   │   ├── SkillsTriggerTab.tsx
│   │   ├── AISettingsTab.tsx
│   │   └── ScheduleOverviewPanel.tsx
│   ├── dialogs/
│   │   ├── BatchGenerateDialog.tsx
│   │   ├── QuickCreateDialog.tsx
│   │   ├── ScheduleDialog.tsx
│   │   └── SendToCampaignDialog.tsx   (NEW)
│   ├── views/
│   │   ├── ContentArticleView.tsx     (NEW)
│   │   ├── ContentVideoView.tsx       (NEW)
│   │   ├── ContentDetailView.tsx
│   │   └── CopyButton.tsx
│   └── ContentTabs.tsx

├── hooks/useContent.ts              (unchanged, types imported from content/types.ts)
├── lib/contentBridge.ts             (NEW)

api/
├── content-items.php                (unchanged)
├── brand-content.php                (unchanged)
└── content-to-campaign.php          (NEW)
```

## 4. Article View (ContentArticleView)

- Shows: cover image, title, excerpt, full HTML body, hashtags
- Removes: headline framework tabs, script platform tabs, visuals list
- Action bar: Copy, Send to Email Campaign, Schedule Post
- Error boundary: catches JSON parse failures, shows "ลองใหม่"

## 5. Video View (ContentVideoView)

- Shows: cover/preview image at top
- Scene cards: each scene with image prompt, script text, timecode
- Scene image generation per card
- Removes: headline frameworks (secondary for video)
- Action bar: Copy script, Generate All Images, Schedule Post

## 6. Content ↔ Email Bridge

### 6.1 Flow A: Content → Campaign
Button in ContentArticleView → SendToCampaignDialog
- Option 1: Create new campaign (name, group, schedule)
- Option 2: Add to existing draft campaign
- POST /content-to-campaign.php?action=to-campaign

### 6.2 Flow B: Campaign → Content
Button in CampaignsPage → PullFromContentDialog
- Lists content items with article_content (filtered)
- Preview: title + excerpt + platform
- Select → fills email editor with article HTML

### 6.3 API: content-to-campaign.php
- POST ?action=to-campaign
  - Input: { content_item_id, campaign_name?, group_id?, scheduled_at? }
  - Output: { campaign_id }
- GET ?action=from-campaign?campaign_id=X
  - Output: { source_content_item }

### 6.4 DB Migration
```sql
ALTER TABLE email_campaigns
ADD COLUMN source_content_id CHAR(36) NULL AFTER template_id;
```

### 6.5 Bridge Logic: src/lib/contentBridge.ts
```typescript
function contentToEmailPayload(item: ContentItem, art: ArticleContent) {
  return {
    subject: art.title || item.title,
    body: art.html || '',
    excerpt: art.excerpt || '',
    footer_tags: art.hashtags?.join(' ') || '',
    source_content_id: item.id,
    source_platform: item.platform,
  };
}
```

## 7. Error Handling

| Layer | Mechanism |
|-------|-----------|
| UI | React ErrorBoundary wrapping each content view |
| Data | React Query retry: 1 (AI calls), 3 (CRUD) |
| UI Feedback | Toast on every error, descriptive Thai messages |
| API | All AI calls in try/catch, sanitizeAIOutput on raw text, token limit detection |
| Fallback | "เกิดข้อผิดพลาด" with "ลองใหม่" button, never blank screen |

## 8. Test Plan

| # | Test | Tool |
|---|------|------|
| 1 | ContentArticleView renders HTML body, hides framework tabs | Vitest + RTL |
| 2 | ContentArticleView copy button copies to clipboard | Vitest + RTL |
| 3 | ContentArticleView shows fallback on broken article_content | Vitest + RTL |
| 4 | ContentVideoView renders scene cards with preview | Vitest + RTL |
| 5 | SendToCampaignDialog selects existing campaign, submits | Vitest + RTL |
| 6 | SendToCampaignDialog creates new campaign, validates fields | Vitest + RTL |
| 7 | PullFromContentDialog filters only article content | Vitest + RTL |
| 8 | contentBridge.contentToEmailPayload transforms correctly | Vitest |
| 9 | useContentItems filters and searches correctly | Vitest + MSW |
| 10 | content-to-campaign.php creates campaign from content_item_id | Vitest + MSW |

## 9. Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Extract types to components/content/types.ts | types.ts, useContent.ts, ContentPage.tsx |
| 2 | Split tabs into separate files | 6 tab files |
| 3 | Create ContentArticleView + ContentVideoView | 2 view files + ContentDetailView |
| 4 | Split dialogs into separate files | 4 dialog files |
| 5 | Create SendToCampaignDialog + PullFromContentDialog | 2 new dialog files |
| 6 | Create contentBridge.ts + content-to-campaign.php | lib + api |
| 7 | Add button in CampaignsPage | CampaignsPage.tsx |
| 8 | DB migration | database/migrations/2026_05_10_000000_add_source_content_to_campaigns.sql |
| 9 | Tests | __tests__/ directory |
| 10 | Dev server smoke test | pnpm dev, navigate to /#/content and /#/content-planner |

## 10. Out of Scope

- Video rendering/encoding
- Real-time preview of video scenes (static images only)
- Email template designer integration
- Analytics dashboard changes
