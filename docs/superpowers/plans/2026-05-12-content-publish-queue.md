# Content Publish Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มระบบ queue-based publish scheduling สำหรับ ContentPage — content ที่ status=published สามารถตั้งเวลาส่งหรือส่งทันทีไปยัง social platform channels ผ่าน stub dispatch functions พร้อม cron job และ reminder UI

**Architecture:** `content_publish_queue` table เก็บ job per content+channel, cron job (`publish-scheduler.php`) poll ทุกนาทีและเรียก dispatch stubs, frontend poll `overdue_count` ทุก 30 วินาทีและแสดง reminder banner + queue chips ต่อ item

**Tech Stack:** PHP 8+/MariaDB backend (XAMPP), React 18 + TypeScript + TanStack Query frontend, shadcn-ui components, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `database/migrations/2026_05_12_130000_content_publish_queue.sql` | CREATE | SQL migrations (expand enum, add column, new table) |
| `database/schema.sql` | MODIFY | Apply migrations to source-of-truth |
| `api/lib/publish-dispatch.php` | CREATE | Dispatch stub functions per platform |
| `api/content-publish.php` | CREATE | Queue CRUD + send_now + overdue_count endpoint |
| `api/cron/publish-scheduler.php` | CREATE | Cron job — process pending queue entries |
| `src/components/content/types.ts` | MODIFY | Add `scheduled_at`, `publish_queue` to ContentItem |
| `src/hooks/useContent.ts` | MODIFY | Add publish queue hooks |
| `src/components/content/SchedulePublishDialog.tsx` | CREATE | Channel + datetime picker dialog |
| `src/components/content/tabs/ContentListTab.tsx` | MODIFY | Status filter, status badges, action buttons, queue chips |
| `src/pages/ContentPage.tsx` | MODIFY | Reminder banner |

---

### Task 1: DB Migration

**Files:**
- Create: `database/migrations/2026_05_12_130000_content_publish_queue.sql`
- Modify: `database/schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- database/migrations/2026_05_12_130000_content_publish_queue.sql

-- 1. Expand publish_channels.platform enum
ALTER TABLE `publish_channels`
  MODIFY `platform` ENUM('wordpress','wix','custom','facebook',
                         'lineoa','instagram','tiktok','linkedin','twitter') NOT NULL;

-- 2. Add scheduled_at (datetime) to content_items
ALTER TABLE `content_items`
  ADD COLUMN `scheduled_at` DATETIME DEFAULT NULL AFTER `scheduled_date`;

-- 3. Create content_publish_queue table
CREATE TABLE IF NOT EXISTS `content_publish_queue` (
  `id`           CHAR(36)     NOT NULL,
  `tenant_id`    CHAR(36)     NOT NULL,
  `content_id`   CHAR(36)     NOT NULL COMMENT 'FK → content_items.id',
  `channel_id`   CHAR(36)     NOT NULL COMMENT 'FK → publish_channels.id',
  `scheduled_at` DATETIME     NOT NULL,
  `status`       ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending',
  `sent_at`      DATETIME     DEFAULT NULL,
  `error_msg`    VARCHAR(500) DEFAULT NULL,
  `retry_count`  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`   DATETIME     NOT NULL DEFAULT current_timestamp(),
  `updated_at`   DATETIME     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status_scheduled` (`tenant_id`, `status`, `scheduled_at`),
  KEY `idx_content_id` (`content_id`),
  KEY `idx_channel_id` (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Apply to schema.sql**

In `database/schema.sql`:

a) Find `publish_channels` CREATE TABLE and change the `platform` enum line from:
```sql
  `platform` enum('wordpress','wix','custom','facebook','lineoa') NOT NULL,
```
to:
```sql
  `platform` enum('wordpress','wix','custom','facebook','lineoa','instagram','tiktok','linkedin','twitter') NOT NULL,
```

b) Find `content_items` CREATE TABLE. After the `scheduled_date` line add:
```sql
  `scheduled_at` DATETIME DEFAULT NULL,
```

c) Add the full `content_publish_queue` CREATE TABLE block (from Step 1) before the `-- --------------------------------------------------------` separator after `content_items`.

- [ ] **Step 3: Add auto-migration in content-items.php**

At the top of `api/content-items.php` after existing auto-migrations (lines 12-14), add:
```php
try { $db->exec("ALTER TABLE content_items ADD COLUMN scheduled_at DATETIME NULL DEFAULT NULL AFTER scheduled_date"); } catch (Exception $e) {}
```

- [ ] **Step 4: Run migration on dev DB**

Open phpMyAdmin or run:
```bash
mysql -u root flowstack < database/migrations/2026_05_12_130000_content_publish_queue.sql
```
Expected: no errors, `SHOW COLUMNS FROM content_publish_queue;` returns 11 columns

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_05_12_130000_content_publish_queue.sql database/schema.sql api/content-items.php
git commit -m "feat: add content_publish_queue migration and schema"
```

---

### Task 2: Dispatch Stubs

**Files:**
- Create: `api/lib/publish-dispatch.php`

- [ ] **Step 1: Create directory if needed**

```bash
mkdir -p api/lib
```

- [ ] **Step 2: Create api/lib/publish-dispatch.php**

```php
<?php
// Dispatch stubs — replace return body with real API calls per platform

function dispatch_content(string $platform, array $channel, array $content): array {
    return match($platform) {
        'facebook'  => dispatch_facebook($channel, $content),
        'instagram' => dispatch_instagram($channel, $content),
        'tiktok'    => dispatch_tiktok($channel, $content),
        'lineoa'    => dispatch_lineoa($channel, $content),
        'linkedin'  => dispatch_linkedin($channel, $content),
        'twitter'   => dispatch_twitter($channel, $content),
        'wordpress' => dispatch_wordpress($channel, $content),
        'wix'       => dispatch_wix($channel, $content),
        'custom'    => dispatch_custom($channel, $content),
        default     => ['success' => false, 'error' => "Unknown platform: $platform"],
    };
}

function dispatch_facebook(array $channel, array $content): array {
    // TODO: POST https://graph.facebook.com/v18.0/me/feed
    // Requires: channel.credentials_encrypted → page_access_token
    error_log("[publish] facebook stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_instagram(array $channel, array $content): array {
    // TODO: Meta Graph API — create media container then publish
    error_log("[publish] instagram stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_tiktok(array $channel, array $content): array {
    // TODO: TikTok Content Posting API v2
    error_log("[publish] tiktok stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_lineoa(array $channel, array $content): array {
    // TODO: LINE Messaging API — broadcast message
    error_log("[publish] lineoa stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_linkedin(array $channel, array $content): array {
    // TODO: LinkedIn Share API v2
    error_log("[publish] linkedin stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_twitter(array $channel, array $content): array {
    // TODO: Twitter API v2 — POST /2/tweets
    error_log("[publish] twitter stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_wordpress(array $channel, array $content): array {
    // TODO: WordPress REST API POST /wp-json/wp/v2/posts
    // Requires: channel.endpoint_url + credentials_encrypted → app_password
    error_log("[publish] wordpress stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_wix(array $channel, array $content): array {
    // TODO: Wix Blog API
    error_log("[publish] wix stub: content_id={$content['id']} channel={$channel['id']}");
    return ['success' => true, 'platform_post_id' => null];
}

function dispatch_custom(array $channel, array $content): array {
    if (empty($channel['endpoint_url'])) {
        return ['success' => false, 'error' => 'endpoint_url not configured'];
    }
    // TODO: POST to channel.endpoint_url with JSON body
    error_log("[publish] custom stub: content_id={$content['id']} url={$channel['endpoint_url']}");
    return ['success' => true, 'platform_post_id' => null];
}
```

- [ ] **Step 3: Verify file loads without errors**

```bash
php -l api/lib/publish-dispatch.php
```
Expected: `No syntax errors detected`

- [ ] **Step 4: Commit**

```bash
git add api/lib/publish-dispatch.php
git commit -m "feat: add publish dispatch stubs for all platforms"
```

---

### Task 3: Queue API

**Files:**
- Create: `api/content-publish.php`

- [ ] **Step 1: Create api/content-publish.php**

```php
<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/publish-dispatch.php';

$db       = getDB();
$method   = getMethod();
$auth     = requireAuth();
$userId   = $auth['user_id'];
$tenantId = $auth['tenant_id'];

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'overdue_count') {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM content_publish_queue
             WHERE tenant_id = ? AND status = 'pending' AND scheduled_at < NOW()"
        );
        $stmt->execute([$tenantId]);
        jsonResponse(['count' => (int)$stmt->fetchColumn()]);
    }

    $contentId = $_GET['content_id'] ?? '';
    if (!$contentId) jsonError('content_id required', 400);

    $stmt = $db->prepare(
        "SELECT q.*, pc.name AS channel_name, pc.platform
         FROM content_publish_queue q
         JOIN publish_channels pc ON pc.id = q.channel_id
         WHERE q.content_id = ? AND q.tenant_id = ?
         ORDER BY q.scheduled_at ASC"
    );
    $stmt->execute([$contentId, $tenantId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    // ── schedule ──────────────────────────────────────────────────────────────
    if ($action === 'schedule') {
        $contentId   = $body['content_id']   ?? '';
        $channelIds  = $body['channel_ids']  ?? [];
        $scheduledAt = $body['scheduled_at'] ?? '';

        if (!$contentId || empty($channelIds) || !$scheduledAt) {
            jsonError('content_id, channel_ids, scheduled_at required', 400);
        }
        if (strtotime($scheduledAt) <= time()) {
            jsonError('scheduled_at must be in the future', 422);
        }

        // Verify content is published and belongs to tenant
        $cs = $db->prepare("SELECT id FROM content_items WHERE id=? AND tenant_id=? AND status='published'");
        $cs->execute([$contentId, $tenantId]);
        if (!$cs->fetch()) jsonError('Content not found or not published', 422);

        // Verify all channels belong to tenant and are active
        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $chs = $db->prepare(
            "SELECT id FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1"
        );
        $chs->execute([...$channelIds, $tenantId]);
        $validIds = array_column($chs->fetchAll(PDO::FETCH_ASSOC), 'id');
        if (count($validIds) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        $created = [];
        foreach ($channelIds as $channelId) {
            $id = generateUUID();
            $db->prepare(
                "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at)
                 VALUES (?,?,?,?,?)"
            )->execute([$id, $tenantId, $contentId, $channelId, $scheduledAt]);
            $created[] = $id;
        }
        jsonResponse(['created' => $created]);
    }

    // ── send_now ──────────────────────────────────────────────────────────────
    if ($action === 'send_now') {
        $contentId  = $body['content_id']  ?? '';
        $channelIds = $body['channel_ids'] ?? [];

        if (!$contentId || empty($channelIds)) {
            jsonError('content_id, channel_ids required', 400);
        }

        // Verify content is published
        $cs = $db->prepare("SELECT * FROM content_items WHERE id=? AND tenant_id=? AND status='published'");
        $cs->execute([$contentId, $tenantId]);
        $content = $cs->fetch(PDO::FETCH_ASSOC);
        if (!$content) jsonError('Content not found or not published', 422);

        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $chs = $db->prepare(
            "SELECT * FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1"
        );
        $chs->execute([...$channelIds, $tenantId]);
        $channels = $chs->fetchAll(PDO::FETCH_ASSOC);
        if (count($channels) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        $results = [];
        foreach ($channels as $channel) {
            $id = generateUUID();
            $now = date('Y-m-d H:i:s');

            $db->prepare(
                "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at,status)
                 VALUES (?,?,?,?,?,?)"
            )->execute([$id, $tenantId, $contentId, $channel['id'], $now, 'processing']);

            $result = dispatch_content($channel['platform'], $channel, $content);

            if ($result['success']) {
                $db->prepare(
                    "UPDATE content_publish_queue SET status='sent', sent_at=NOW() WHERE id=?"
                )->execute([$id]);
                $results[] = ['channel_id' => $channel['id'], 'success' => true];
            } else {
                $db->prepare(
                    "UPDATE content_publish_queue SET status='failed', error_msg=? WHERE id=?"
                )->execute([$result['error'] ?? 'dispatch failed', $id]);
                $results[] = ['channel_id' => $channel['id'], 'success' => false, 'error' => $result['error'] ?? ''];
            }
        }
        jsonResponse(['results' => $results]);
    }

    // ── cancel ────────────────────────────────────────────────────────────────
    if ($action === 'cancel') {
        $queueId = $body['queue_id'] ?? '';
        if (!$queueId) jsonError('queue_id required', 400);
        $db->prepare(
            "UPDATE content_publish_queue SET status='failed', error_msg='cancelled by user'
             WHERE id=? AND tenant_id=? AND status='pending'"
        )->execute([$queueId, $tenantId]);
        jsonResponse(['ok' => true]);
    }

    jsonError('Unknown action', 400);
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) jsonError('id required', 400);
    $db->prepare(
        "DELETE FROM content_publish_queue WHERE id=? AND tenant_id=?"
    )->execute([$id, $tenantId]);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 2: Syntax check**

```bash
php -l api/content-publish.php
```
Expected: `No syntax errors detected`

- [ ] **Step 3: Test GET overdue_count (should return 0)**

```bash
# Get a valid JWT token first, then:
curl -s "http://localhost/flowstack/api/content-publish.php?action=overdue_count" \
  -H "Authorization: Bearer <token>"
```
Expected: `{"count":0}`

- [ ] **Step 4: Commit**

```bash
git add api/content-publish.php
git commit -m "feat: add content-publish.php queue API"
```

---

### Task 4: Cron Job

**Files:**
- Create: `api/cron/publish-scheduler.php`

- [ ] **Step 1: Create directory**

```bash
mkdir -p api/cron
```

- [ ] **Step 2: Create api/cron/publish-scheduler.php**

```php
<?php
// Run via: php api/cron/publish-scheduler.php
// XAMPP Windows Task Scheduler: php C:\xampp\htdocs\flowstack\api\cron\publish-scheduler.php
// Linux cron: * * * * * php /var/www/html/flowstack/api/cron/publish-scheduler.php

define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/publish-dispatch.php';

$db = getDB();

// Select up to 50 pending entries due now, across all tenants
$stmt = $db->prepare(
    "SELECT q.*, ci.title, ci.caption, ci.article_content, ci.generated_image_url,
            ci.platform AS content_platform,
            pc.platform, pc.endpoint_url, pc.credentials_encrypted, pc.name AS channel_name
     FROM content_publish_queue q
     JOIN content_items ci       ON ci.id = q.content_id
     JOIN publish_channels pc    ON pc.id = q.channel_id
     WHERE q.status = 'pending' AND q.scheduled_at <= NOW()
     ORDER BY q.scheduled_at ASC
     LIMIT 50"
);
$stmt->execute();
$entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($entries)) {
    echo date('[Y-m-d H:i:s]') . " No pending entries.\n";
    exit(0);
}

echo date('[Y-m-d H:i:s]') . " Processing " . count($entries) . " entries...\n";

foreach ($entries as $entry) {
    $queueId = $entry['id'];

    // Lock the row by setting processing
    $lock = $db->prepare(
        "UPDATE content_publish_queue SET status='processing' WHERE id=? AND status='pending'"
    );
    $lock->execute([$queueId]);
    if ($lock->rowCount() === 0) {
        echo "  [{$queueId}] Skipped (already processing)\n";
        continue;
    }

    $channel = [
        'id'                     => $entry['channel_id'],
        'platform'               => $entry['platform'],
        'endpoint_url'           => $entry['endpoint_url'],
        'credentials_encrypted'  => $entry['credentials_encrypted'],
        'name'                   => $entry['channel_name'],
    ];
    $content = [
        'id'                  => $entry['content_id'],
        'title'               => $entry['title'],
        'caption'             => $entry['caption'],
        'article_content'     => $entry['article_content'],
        'generated_image_url' => $entry['generated_image_url'],
    ];

    try {
        $result = dispatch_content($entry['platform'], $channel, $content);
    } catch (Exception $e) {
        $result = ['success' => false, 'error' => $e->getMessage()];
    }

    if ($result['success']) {
        $db->prepare(
            "UPDATE content_publish_queue SET status='sent', sent_at=NOW() WHERE id=?"
        )->execute([$queueId]);
        echo "  [{$queueId}] sent via {$entry['platform']}\n";
    } else {
        $retryCount = (int)$entry['retry_count'] + 1;
        if ($retryCount < 3) {
            // Retry in 5 minutes
            $db->prepare(
                "UPDATE content_publish_queue
                 SET status='pending', error_msg=?, retry_count=?, scheduled_at=DATE_ADD(NOW(), INTERVAL 5 MINUTE)
                 WHERE id=?"
            )->execute([$result['error'] ?? 'dispatch failed', $retryCount, $queueId]);
            echo "  [{$queueId}] failed (retry {$retryCount}/3): {$result['error']}\n";
        } else {
            $db->prepare(
                "UPDATE content_publish_queue SET status='failed', error_msg=?, retry_count=? WHERE id=?"
            )->execute([$result['error'] ?? 'dispatch failed', $retryCount, $queueId]);
            echo "  [{$queueId}] permanently failed after 3 retries\n";
        }
    }
}

echo date('[Y-m-d H:i:s]') . " Done.\n";
```

- [ ] **Step 3: Syntax check**

```bash
php -l api/cron/publish-scheduler.php
```
Expected: `No syntax errors detected`

- [ ] **Step 4: Test dry run (no pending entries)**

```bash
php api/cron/publish-scheduler.php
```
Expected output: `[2026-05-12 xx:xx:xx] No pending entries.`

- [ ] **Step 5: Commit**

```bash
git add api/cron/publish-scheduler.php
git commit -m "feat: add publish-scheduler cron job"
```

---

### Task 5: Types and Hooks

**Files:**
- Modify: `src/components/content/types.ts`
- Modify: `src/hooks/useContent.ts`

- [ ] **Step 1: Update ContentItem type in types.ts**

Add `scheduled_at` and `publish_queue` fields to the `ContentItem` interface:

```typescript
export interface PublishQueueEntry {
  id: string;
  content_id: string;
  channel_id: string;
  channel_name: string;
  platform: string;
  scheduled_at: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  sent_at: string | null;
  error_msg: string | null;
  retry_count: number;
}

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
  scheduled_date?: string | null;
  scheduled_at?: string | null;
  plan_title?: string | null;
  plan_id?: string | null;
  week_start?: string | null;
  publish_queue?: PublishQueueEntry[];
}
```

Replace the entire `ContentItem` interface block (lines 5-19) with the above.

- [ ] **Step 2: Add publish queue hooks to useContent.ts**

Append to the end of `src/hooks/useContent.ts`:

```typescript
// ── Publish Queue ──────────────────────────────────────────────────────────

export function usePublishQueue(contentId: string | null) {
  return useQuery({
    queryKey: ['content', 'publish-queue', contentId],
    queryFn: () => apiFetch(`/content-publish.php?content_id=${contentId}`),
    enabled: !!contentId,
  });
}

export function useOverdueCount() {
  return useQuery({
    queryKey: ['content', 'publish-queue', 'overdue'],
    queryFn: () => apiFetch('/content-publish.php?action=overdue_count'),
    refetchInterval: 30_000,
  });
}

export function useScheduleContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content_id: string; channel_ids: string[]; scheduled_at: string }) =>
      apiFetch('/content-publish.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'schedule', ...payload }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['content', 'publish-queue', vars.content_id] });
      qc.invalidateQueries({ queryKey: ['content', 'publish-queue', 'overdue'] });
    },
  });
}

export function useSendNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content_id: string; channel_ids: string[] }) =>
      apiFetch('/content-publish.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_now', ...payload }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['content', 'publish-queue', vars.content_id] });
      qc.invalidateQueries({ queryKey: ['content', 'publish-queue', 'overdue'] });
    },
  });
}

export function useCancelQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { queue_id: string; content_id: string }) =>
      apiFetch('/content-publish.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel', queue_id: payload.queue_id }),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['content', 'publish-queue', vars.content_id] });
      qc.invalidateQueries({ queryKey: ['content', 'publish-queue', 'overdue'] });
    },
  });
}

export function usePublishChannels() {
  return useQuery({
    queryKey: ['content', 'publish-channels'],
    queryFn: () => apiFetch('/brand-content.php?action=channels'),
  });
}

export function useUpdateContentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; status: 'draft' | 'published' | 'review' }) =>
      apiFetch(`/content-items.php?id=${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: payload.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
    },
  });
}
```

Make sure `useMutation` and `useQueryClient` are already imported at the top of `useContent.ts`. If not, add them to the import line:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/content/types.ts src/hooks/useContent.ts
git commit -m "feat: add publish queue types and hooks"
```

---

### Task 6: SchedulePublishDialog Component

**Files:**
- Create: `src/components/content/SchedulePublishDialog.tsx`

- [ ] **Step 1: Create SchedulePublishDialog.tsx**

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { usePublishChannels, useScheduleContent } from '@/hooks/useContent';
import { useToast } from '@/hooks/use-toast';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { PLATFORM_MAP } from '@/components/content/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentId: string;
  contentTitle: string;
}

export function SchedulePublishDialog({ open, onOpenChange, contentId, contentTitle }: Props) {
  const { toast } = useToast();
  const { data: channels = [] } = usePublishChannels();
  const schedule = useScheduleContent();

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const activeChannels = (channels as any[]).filter((c: any) => c.is_active);

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selectedChannels.length === 0) {
      toast({ title: 'กรุณาเลือก channel อย่างน้อย 1 อัน', variant: 'destructive' });
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      toast({ title: 'กรุณาระบุวันที่และเวลา', variant: 'destructive' });
      return;
    }
    const scheduledAt = `${scheduleDate}T${scheduleTime}:00`;
    if (new Date(scheduledAt) <= new Date()) {
      toast({ title: 'เวลาที่ตั้งต้องอยู่ในอนาคต', variant: 'destructive' });
      return;
    }
    try {
      await schedule.mutateAsync({ content_id: contentId, channel_ids: selectedChannels, scheduled_at: scheduledAt });
      toast({ title: 'ตั้งเวลาส่งแล้ว' });
      onOpenChange(false);
      setSelectedChannels([]);
      setScheduleDate('');
      setScheduleTime('');
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">ตั้งเวลาโพสต์</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{contentTitle}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel list */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">เลือก Channel</Label>
            {activeChannels.length === 0 && (
              <p className="text-xs text-muted-foreground">ยังไม่มี channel — ไปตั้งค่าใน Channel Management</p>
            )}
            {activeChannels.map((ch: any) => (
              <label
                key={ch.id}
                className="flex items-center gap-2.5 py-1.5 cursor-pointer group"
              >
                <Checkbox
                  checked={selectedChannels.includes(ch.id)}
                  onCheckedChange={() => toggleChannel(ch.id)}
                />
                <PlatformIcon platform={ch.platform} size={14} />
                <span className="text-sm">{ch.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {PLATFORM_MAP[ch.platform]?.label ?? ch.platform}
                </span>
              </label>
            ))}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sched-date" className="text-xs">วันที่</Label>
              <Input
                id="sched-date"
                type="date"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-time" className="text-xs">เวลา</Label>
              <Input
                id="sched-time"
                type="time"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button size="sm" onClick={handleSubmit} disabled={schedule.isPending}>
            {schedule.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            ตั้งเวลา
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/content/SchedulePublishDialog.tsx
git commit -m "feat: add SchedulePublishDialog component"
```

---

### Task 7: ContentListTab — Status Filter, Badges, Buttons, Queue Chips

**Files:**
- Modify: `src/components/content/tabs/ContentListTab.tsx`

- [ ] **Step 1: Add imports at top of ContentListTab.tsx**

Add to the existing import block:
```typescript
import { Calendar, Send, Loader2 as Loader2Icon, AlertCircle, CheckCircle2, Clock as ClockIcon, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SchedulePublishDialog } from '@/components/content/SchedulePublishDialog';
import {
  useUpdateContentStatus,
  useSendNow,
  usePublishQueue,
  useCancelQueue,
} from '@/hooks/useContent';
import type { PublishQueueEntry } from '@/components/content/types';
```

- [ ] **Step 2: Add state and hooks inside ContentListTab function**

After `const [generatingImage, setGeneratingImage] = useState(false);`, add:
```typescript
const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'review' | 'published'>('all');
const [scheduleItem, setScheduleItem] = useState<ContentItem | null>(null);
const updateStatus = useUpdateContentStatus();
const sendNow = useSendNow();
const cancelQueue = useCancelQueue();
```

- [ ] **Step 3: Add status to filtered memo**

Replace the `filtered` useMemo to include statusFilter:
```typescript
const filtered = useMemo(() =>
  items.filter(c => {
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    const matchPlatform = platformFilter === 'all' || (c.platform || '').toLowerCase() === platformFilter;
    const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchType && matchPlatform && matchSearch && matchStatus;
  }), [items, typeFilter, platformFilter, search, statusFilter]);
```

- [ ] **Step 4: Add status filter dropdown after the platform filter block**

After the closing `</div>` of the platform filter section (after line ~197), add:
```tsx
{/* Status filter */}
<div className="flex items-center gap-2">
  <span className="text-[11px] text-muted-foreground shrink-0">สถานะ:</span>
  <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
    <SelectTrigger className="h-7 text-xs w-36">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">ทั้งหมด</SelectItem>
      <SelectItem value="draft">ร่าง</SelectItem>
      <SelectItem value="review">รออนุมัติ</SelectItem>
      <SelectItem value="published">เผยแพร่แล้ว</SelectItem>
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 5: Add status badge and action buttons to each content row**

Inside `{filtered.map(item => {` block, after the existing badge chips (around line 280), add status badge:
```tsx
{/* Status badge */}
<span className={cn(
  'text-[11px] px-1.5 py-0 rounded-full font-medium',
  item.status === 'published' ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' :
  item.status === 'review'    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
)}>
  {item.status === 'published' ? 'เผยแพร่' : item.status === 'review' ? 'รออนุมัติ' : 'ร่าง'}
</span>
```

- [ ] **Step 6: Add Publish / Schedule / Send Now buttons to each row**

At the end of the row (before the closing `</div>` of the row), add — make sure to stop `onClick` propagation so it doesn't open the edit dialog:
```tsx
{/* Action buttons — only visible on hover */}
<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
  {item.status === 'draft' && (
    <Button
      size="sm" variant="outline"
      className="h-6 text-[11px] px-2"
      disabled={updateStatus.isPending}
      onClick={() => updateStatus.mutate({ id: item.id, status: 'published' })}
    >
      เผยแพร่
    </Button>
  )}
  {item.status === 'published' && (
    <>
      <Button
        size="sm" variant="outline"
        className="h-6 text-[11px] px-2 gap-1"
        onClick={() => setScheduleItem(item)}
      >
        <Calendar className="h-3 w-3" />ตั้งเวลา
      </Button>
      <Button
        size="sm"
        className="h-6 text-[11px] px-2 gap-1"
        disabled={sendNow.isPending}
        onClick={() => {
          if (!item.platform) return;
          // Send to item's own platform channel — user picks channel in a real flow
          // For now open schedule dialog which handles channel selection
          setScheduleItem(item);
        }}
      >
        <Send className="h-3 w-3" />ส่งเลย
      </Button>
    </>
  )}
</div>
```

**Note:** "ส่งเลย" also opens SchedulePublishDialog but the dialog should have a "ส่งทันที" mode. Update `SchedulePublishDialog` to accept `mode?: 'schedule' | 'send_now'` prop and call `useSendNow` when mode is `send_now`. See Step 7.

- [ ] **Step 7: Update SchedulePublishDialog for send_now mode**

In `src/components/content/SchedulePublishDialog.tsx`, add `mode` prop and `useSendNow` hook:

```tsx
import { useSendNow, usePublishChannels, useScheduleContent } from '@/hooks/useContent';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentId: string;
  contentTitle: string;
  mode?: 'schedule' | 'send_now';
}

export function SchedulePublishDialog({ open, onOpenChange, contentId, contentTitle, mode = 'schedule' }: Props) {
  // ...existing hooks...
  const sendNow = useSendNow();
  const isSendNow = mode === 'send_now';

  const handleSubmit = async () => {
    if (selectedChannels.length === 0) {
      toast({ title: 'กรุณาเลือก channel อย่างน้อย 1 อัน', variant: 'destructive' });
      return;
    }
    try {
      if (isSendNow) {
        await sendNow.mutateAsync({ content_id: contentId, channel_ids: selectedChannels });
        toast({ title: 'ส่งสำเร็จ!' });
      } else {
        if (!scheduleDate || !scheduleTime) {
          toast({ title: 'กรุณาระบุวันที่และเวลา', variant: 'destructive' });
          return;
        }
        const scheduledAt = `${scheduleDate}T${scheduleTime}:00`;
        if (new Date(scheduledAt) <= new Date()) {
          toast({ title: 'เวลาที่ตั้งต้องอยู่ในอนาคต', variant: 'destructive' });
          return;
        }
        await schedule.mutateAsync({ content_id: contentId, channel_ids: selectedChannels, scheduled_at: scheduledAt });
        toast({ title: 'ตั้งเวลาส่งแล้ว' });
      }
      onOpenChange(false);
      setSelectedChannels([]);
      setScheduleDate('');
      setScheduleTime('');
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };
```

In the DialogTitle, change title conditionally:
```tsx
<DialogTitle className="text-base">{isSendNow ? 'ส่งเดี๋ยวนี้' : 'ตั้งเวลาโพสต์'}</DialogTitle>
```

Hide date/time fields when `isSendNow`:
```tsx
{!isSendNow && (
  <div className="grid grid-cols-2 gap-3">
    {/* date/time inputs */}
  </div>
)}
```

Change submit button label:
```tsx
{isSendNow ? 'ส่งเลย' : 'ตั้งเวลา'}
```

- [ ] **Step 8: Update send_now button in ContentListTab to use mode="send_now"**

```tsx
<Button
  size="sm"
  className="h-6 text-[11px] px-2 gap-1"
  onClick={() => { setSendNowItem(item); }}
>
  <Send className="h-3 w-3" />ส่งเลย
</Button>
```

Add `sendNowItem` state:
```typescript
const [sendNowItem, setSendNowItem] = useState<ContentItem | null>(null);
```

Add second dialog instance at the bottom of the return:
```tsx
{scheduleItem && (
  <SchedulePublishDialog
    open={!!scheduleItem}
    onOpenChange={v => !v && setScheduleItem(null)}
    contentId={scheduleItem.id}
    contentTitle={scheduleItem.title}
    mode="schedule"
  />
)}
{sendNowItem && (
  <SchedulePublishDialog
    open={!!sendNowItem}
    onOpenChange={v => !v && setSendNowItem(null)}
    contentId={sendNowItem.id}
    contentTitle={sendNowItem.title}
    mode="send_now"
  />
)}
```

- [ ] **Step 9: Add QueueChips sub-component at bottom of ContentListTab.tsx**

Add before the `export default` line:
```tsx
function QueueChips({ contentId, onCancel }: { contentId: string; onCancel: (queueId: string) => void }) {
  const { data: queue = [] } = usePublishQueue(contentId);
  if (!queue.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1" onClick={e => e.stopPropagation()}>
      {(queue as PublishQueueEntry[]).map(q => {
        const isOverdue = q.status === 'pending' && new Date(q.scheduled_at) <= new Date();
        return (
          <span
            key={q.id}
            className={cn(
              'inline-flex items-center gap-1 text-[10px] px-1.5 py-0 rounded-full font-medium',
              q.status === 'sent'       ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' :
              q.status === 'failed'     ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' :
              q.status === 'processing' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
              isOverdue                 ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' :
                                          'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
            )}
          >
            {q.status === 'sent'       && <><CheckCircle2 className="h-2.5 w-2.5" />ส่งแล้ว ({q.channel_name})</>}
            {q.status === 'failed'     && <><AlertCircle className="h-2.5 w-2.5" />ส่งไม่สำเร็จ ({q.channel_name})</>}
            {q.status === 'processing' && <><Loader2Icon className="h-2.5 w-2.5 animate-spin" />กำลังส่ง...</>}
            {q.status === 'pending' && !isOverdue && (
              <>
                <ClockIcon className="h-2.5 w-2.5" />
                รอส่ง {new Date(q.scheduled_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} {q.scheduled_at.slice(11, 16)} ({q.channel_name})
                <button
                  type="button"
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  onClick={() => onCancel(q.id)}
                >×</button>
              </>
            )}
            {q.status === 'pending' && isOverdue && (
              <><AlertCircle className="h-2.5 w-2.5" />เลยเวลา ({q.channel_name})</>
            )}
          </span>
        );
      })}
    </div>
  );
}
```

Then inside `{filtered.map(item => {`, after the caption line, add:
```tsx
<QueueChips contentId={item.id} onCancel={queueId => cancelQueue.mutate({ queue_id: queueId, content_id: item.id })} />
```

- [ ] **Step 10: Type-check and lint**

```bash
pnpm tsc --noEmit && pnpm lint
```
Expected: 0 errors, warnings only

- [ ] **Step 11: Commit**

```bash
git add src/components/content/tabs/ContentListTab.tsx src/components/content/SchedulePublishDialog.tsx
git commit -m "feat: add status filter, badges, publish buttons, and queue chips to ContentListTab"
```

---

### Task 8: ContentPage Reminder Banner

**Files:**
- Modify: `src/pages/ContentPage.tsx`

- [ ] **Step 1: Add imports to ContentPage.tsx**

Add to existing imports:
```typescript
import { AlertTriangle } from 'lucide-react';
import { useOverdueCount } from '@/hooks/useContent';
```

- [ ] **Step 2: Add hook inside ContentPage function**

```typescript
const { data: overdueData } = useOverdueCount();
const overdueCount = overdueData?.count ?? 0;
```

- [ ] **Step 3: Add banner above `<Tabs>` inside the return**

```tsx
{overdueCount > 0 && (
  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm mb-4">
    <AlertTriangle className="h-4 w-4 shrink-0" />
    <span>มี <strong>{overdueCount}</strong> โพสต์เลยเวลาที่ตั้งไว้แต่ยังไม่ถูกส่ง</span>
  </div>
)}
```

- [ ] **Step 4: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Start dev server and verify**

```bash
pnpm dev
```
- เปิด http://localhost:8080 → ContentPage → ตรวจ: ไม่มี banner เมื่อ overdue=0
- ลอง publish content item หนึ่งชิ้น → ปุ่ม "ตั้งเวลา" และ "ส่งเลย" ควรปรากฏ
- กด "ตั้งเวลา" → dialog เปิด แสดง channels
- status filter dropdown ทำงาน

- [ ] **Step 6: Commit**

```bash
git add src/pages/ContentPage.tsx
git commit -m "feat: add overdue reminder banner to ContentPage"
```
