# Media Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างหน้า `/media-studio` สำหรับ generate ภาพผ่าน kie.ai API พร้อม async job polling, 2 mode (free prompt + from video script), และ job history

**Architecture:** เพิ่ม `provider-kieai` ใน `ai_providers` table ผ่าน migration, สร้าง `media_jobs` table สำหรับ async job tracking, `api/media-jobs.php` จัดการ create/poll/list, frontend `MediaStudioPage.tsx` poll ทุก 3 วินาทีจน completed

**Tech Stack:** PHP + MariaDB backend, React 18 + TypeScript + TanStack Query, shadcn-ui, Tailwind CSS, kie.ai REST API (`https://api.kie.ai/api/v1`)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `database/migrations/2026_06_18_120000_create_media_jobs_table.sql` | Schema: media_jobs + provider seed |
| Create | `api/media-jobs.php` | create / poll / list jobs via kie.ai |
| Create | `src/pages/MediaStudioPage.tsx` | หน้าหลัก 2 tabs |
| Create | `src/components/media/FreePromptForm.tsx` | Mode A: free text-to-image |
| Create | `src/components/media/FromScriptForm.tsx` | Mode B: import scenes from video script |
| Create | `src/components/media/JobResultGallery.tsx` | แสดงภาพผล + download |
| Create | `src/components/media/JobHistoryTab.tsx` | ประวัติ jobs |
| Modify | `src/App.tsx` | เพิ่ม route + lazy import |
| Modify | `src/components/AppSidebar.tsx` | เพิ่ม item "Media Studio" ใน marketing group |
| Modify | `api/auth.php` | เพิ่ม `media_studio` ใน ALL_MENU_KEYS |

---

## Task 1: Database migration — media_jobs table + kie.ai provider seed

**Files:**
- Create: `database/migrations/2026_06_18_120000_create_media_jobs_table.sql`

- [ ] **Step 1: สร้าง migration file**

```sql
-- database/migrations/2026_06_18_120000_create_media_jobs_table.sql

CREATE TABLE IF NOT EXISTS media_jobs (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  tenant_id         CHAR(36)      NOT NULL,
  created_by        CHAR(36)      NOT NULL,
  job_type          VARCHAR(20)   NOT NULL DEFAULT 'image',
  provider          VARCHAR(50)   NOT NULL DEFAULT 'kieai',
  model             VARCHAR(100)  NOT NULL,
  kie_task_id       VARCHAR(255)  NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending',
  prompt            TEXT          NULL,
  input_params      JSON          NULL,
  result_urls       JSON          NULL,
  error_message     TEXT          NULL,
  source_content_id CHAR(36)      NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status  (tenant_id, status),
  INDEX idx_tenant_created (tenant_id, created_at)
);

INSERT IGNORE INTO ai_providers (id, name, display_name, description, api_base_url, icon, is_active, created_at, updated_at)
VALUES (
  'provider-kieai',
  'kieai',
  'Kie.ai',
  'Affordable AI image, video, audio and music generation via Kie.ai API',
  'https://api.kie.ai/api/v1',
  '🎨',
  1,
  NOW(),
  NOW()
);
```

- [ ] **Step 2: รัน migration**

```bash
mysql -u root flowstack < database/migrations/2026_06_18_120000_create_media_jobs_table.sql
```

- [ ] **Step 3: ตรวจสอบ**

```bash
mysql -u root flowstack -e "SHOW COLUMNS FROM media_jobs; SELECT id, display_name, api_base_url FROM ai_providers WHERE id='provider-kieai';"
```

Expected: columns ครบ 14 คอลัมน์, row provider-kieai แสดงขึ้น

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_06_18_120000_create_media_jobs_table.sql
git commit -m "feat(media): add media_jobs table and kieai provider seed"
```

---

## Task 2: Backend API — `api/media-jobs.php`

**Files:**
- Create: `api/media-jobs.php`

- [ ] **Step 1: สร้างไฟล์ `api/media-jobs.php`**

```php
<?php
// POST /api/media-jobs.php?action=create  - สร้าง image job ผ่าน kie.ai
// GET  /api/media-jobs.php?action=poll&id= - poll status + update DB
// GET  /api/media-jobs.php?action=list    - list jobs ของ tenant

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId  = $tokenData['tenant_id'];
$userId    = $tokenData['user_id'];
$db        = getDB();
$method    = getMethod();
$action    = $_GET['action'] ?? '';

// ── Helper: get kie.ai API key ────────────────────────────────────────────────
function getKieaiApiKey($db) {
    $stmt = $db->prepare('SELECT api_key_encrypted FROM ai_providers WHERE id = ?');
    $stmt->execute(['provider-kieai']);
    $row = $stmt->fetch();
    if (!$row || empty($row['api_key_encrypted'])) {
        jsonError('ยังไม่ได้ตั้งค่า Kie.ai API Key — ไปที่ Admin › AI Providers', 400);
    }
    $key = decryptApiKey($row['api_key_encrypted']);
    if (!$key) jsonError('ไม่สามารถถอดรหัส Kie.ai API Key ได้', 500);
    return $key;
}

// ── Helper: call kie.ai REST ──────────────────────────────────────────────────
function kieaiRequest($method, $path, $apiKey, $body = null) {
    $url = 'https://api.kie.ai/api/v1' . $path;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_CUSTOMREQUEST  => $method,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) jsonError('kie.ai connection error: ' . $curlErr, 502);
    $data = json_decode($response, true);
    if ($httpCode >= 400) {
        $msg = $data['message'] ?? $data['error'] ?? 'kie.ai error ' . $httpCode;
        jsonError('kie.ai: ' . $msg, $httpCode >= 500 ? 502 : 400);
    }
    return $data;
}

// ── POST ?action=create ───────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'create') {
    $body  = json_decode(file_get_contents('php://input'), true) ?? [];
    $model = trim($body['model'] ?? '');
    $prompt = trim($body['prompt'] ?? '');
    $inputParams     = $body['input_params'] ?? [];
    $sourceContentId = $body['source_content_id'] ?? null;

    if (!$model)  jsonError('กรุณาระบุ model', 400);
    if (!$prompt) jsonError('กรุณาระบุ prompt', 400);

    $apiKey = getKieaiApiKey($db);

    // Build kie.ai request based on model type
    $kieInput = array_merge(['prompt' => $prompt], $inputParams);
    $kieBody  = ['model' => $model, 'input' => $kieInput];

    $kieResponse = kieaiRequest('POST', '/jobs/createTask', $apiKey, $kieBody);
    $kieTaskId   = $kieResponse['data']['taskId'] ?? $kieResponse['taskId'] ?? null;
    if (!$kieTaskId) jsonError('kie.ai ไม่ส่ง taskId กลับมา', 502);

    $jobId = generateUUID();
    $db->prepare('
        INSERT INTO media_jobs (id, tenant_id, created_by, job_type, provider, model, kie_task_id, status, prompt, input_params, source_content_id)
        VALUES (?, ?, ?, \'image\', \'kieai\', ?, ?, \'pending\', ?, ?, ?)
    ')->execute([
        $jobId, $tenantId, $userId,
        $model, $kieTaskId,
        $prompt,
        json_encode($inputParams),
        $sourceContentId,
    ]);

    jsonResponse(['job_id' => $jobId, 'kie_task_id' => $kieTaskId, 'status' => 'pending']);
}

// ── GET ?action=poll&id= ──────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'poll') {
    $jobId = $_GET['id'] ?? null;
    if (!$jobId) jsonError('กรุณาระบุ id', 400);

    $stmt = $db->prepare('SELECT * FROM media_jobs WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$jobId, $tenantId]);
    $job = $stmt->fetch();
    if (!$job) jsonError('ไม่พบ job', 404);

    // If already terminal, return cached result
    if (in_array($job['status'], ['completed', 'failed'])) {
        $job['result_urls']  = json_decode($job['result_urls'] ?? '[]', true);
        $job['input_params'] = json_decode($job['input_params'] ?? '{}', true);
        jsonResponse($job);
    }

    // Poll kie.ai
    $apiKey = getKieaiApiKey($db);
    $kieResponse = kieaiRequest('GET', '/jobs/' . $job['kie_task_id'], $apiKey);

    $kieStatus = $kieResponse['data']['status'] ?? $kieResponse['status'] ?? 'processing';

    // Map kie.ai status → our status
    $statusMap = [
        'SUCCESS'    => 'completed',
        'COMPLETED'  => 'completed',
        'FAILED'     => 'failed',
        'ERROR'      => 'failed',
        'PENDING'    => 'pending',
        'PROCESSING' => 'processing',
        'RUNNING'    => 'processing',
    ];
    $newStatus = $statusMap[strtoupper($kieStatus)] ?? 'processing';

    $resultUrls   = null;
    $errorMessage = null;

    if ($newStatus === 'completed') {
        // kie.ai returns images in various paths — try common ones
        $data = $kieResponse['data'] ?? $kieResponse;
        $images = $data['images'] ?? $data['output']['images'] ?? $data['result'] ?? [];
        if (is_string($images)) $images = [$images];
        $resultUrls = json_encode(array_values(array_filter((array) $images)));
    } elseif ($newStatus === 'failed') {
        $errorMessage = $kieResponse['data']['error'] ?? $kieResponse['message'] ?? 'kie.ai task failed';
    }

    $db->prepare('
        UPDATE media_jobs SET status = ?, result_urls = ?, error_message = ?, updated_at = NOW()
        WHERE id = ?
    ')->execute([$newStatus, $resultUrls, $errorMessage, $jobId]);

    jsonResponse([
        'job_id'        => $jobId,
        'status'        => $newStatus,
        'result_urls'   => json_decode($resultUrls ?? '[]', true),
        'error_message' => $errorMessage,
    ]);
}

// ── GET ?action=list ──────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'list') {
    $stmt = $db->prepare('
        SELECT id, job_type, model, status, prompt, result_urls, error_message, created_at
        FROM media_jobs
        WHERE tenant_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ');
    $stmt->execute([$tenantId]);
    $jobs = $stmt->fetchAll();
    foreach ($jobs as &$j) {
        $j['result_urls'] = json_decode($j['result_urls'] ?? '[]', true);
    }
    jsonResponse(['jobs' => $jobs]);
}

jsonError('Invalid action', 400);
```

- [ ] **Step 2: ทดสอบ PHP syntax**

```bash
php -l api/media-jobs.php
```

Expected: `No syntax errors detected in api/media-jobs.php`

- [ ] **Step 3: Commit**

```bash
git add api/media-jobs.php
git commit -m "feat(media): add media-jobs.php API for kie.ai image generation"
```

---

## Task 3: JobResultGallery component

**Files:**
- Create: `src/components/media/JobResultGallery.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
import { Loader2, Download, ImageOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  resultUrls: string[];
  errorMessage?: string | null;
}

export default function JobResultGallery({ status, resultUrls, errorMessage }: Props) {
  if (status === 'idle') return null;

  if (status === 'pending' || status === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">AI กำลังสร้างภาพ...</p>
        <p className="text-xs">อาจใช้เวลา 10–60 วินาที</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm font-medium">สร้างภาพไม่สำเร็จ</p>
        {errorMessage && <p className="text-xs text-muted-foreground">{errorMessage}</p>}
      </div>
    );
  }

  if (status === 'completed' && resultUrls.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <ImageOff className="h-8 w-8" />
        <p className="text-sm">ไม่มีภาพในผลลัพธ์</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {resultUrls.map((url, i) => (
        <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
          <img src={url} alt={`ภาพที่ ${i + 1}`} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button size="sm" variant="secondary" asChild>
              <a href={url} download={`image-${i + 1}.png`} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5 mr-1.5" />ดาวน์โหลด
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/media/JobResultGallery.tsx
git commit -m "feat(media): add JobResultGallery component"
```

---

## Task 4: FreePromptForm component

**Files:**
- Create: `src/components/media/FreePromptForm.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import JobResultGallery from './JobResultGallery';

const MODELS = [
  { id: 'qwen2/text-to-image', label: 'Qwen2 Image — ราคาถูก เร็ว' },
  { id: 'flux-kontext/generate', label: 'Flux Kontext — คุณภาพสูง' },
  { id: 'gpt/gpt-image-2', label: 'GPT Image 2 — รายละเอียดสูง' },
];

const SIZES = [
  { id: '1:1',  label: '1:1 (สี่เหลี่ยมจัตุรัส)', width: 1024, height: 1024 },
  { id: '16:9', label: '16:9 (แนวนอน)',            width: 1344, height: 768  },
  { id: '9:16', label: '9:16 (แนวตั้ง)',            width: 768,  height: 1344 },
];

type JobStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export default function FreePromptForm() {
  const { toast } = useToast();
  const [prompt, setPrompt]     = useState('');
  const [model, setModel]       = useState(MODELS[0].id);
  const [size, setSize]         = useState(SIZES[0].id);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  const pollJob = async (jobId: string) => {
    const startTime = Date.now();
    const maxMs = 5 * 60 * 1000; // 5 min timeout

    const interval = setInterval(async () => {
      if (Date.now() - startTime > maxMs) {
        clearInterval(interval);
        setJobStatus('failed');
        setErrorMsg('หมดเวลา 5 นาที ลองใหม่อีกครั้ง');
        return;
      }
      try {
        const res: any = await apiFetch(`/media-jobs.php?action=poll&id=${jobId}`);
        setJobStatus(res.status as JobStatus);
        if (res.status === 'completed') {
          clearInterval(interval);
          setResultUrls(res.result_urls ?? []);
        } else if (res.status === 'failed') {
          clearInterval(interval);
          setErrorMsg(res.error_message ?? 'สร้างภาพไม่สำเร็จ');
        }
      } catch {
        // transient error — keep polling
      }
    }, 3000);
  };

  const handleCreate = async () => {
    if (!prompt.trim()) return;
    const sizeConfig = SIZES.find(s => s.id === size)!;
    setJobStatus('pending');
    setResultUrls([]);
    setErrorMsg(null);

    try {
      const res: any = await apiFetch('/media-jobs.php?action=create', {
        method: 'POST',
        body: JSON.stringify({
          model,
          prompt: prompt.trim(),
          input_params: { width: sizeConfig.width, height: sizeConfig.height },
          source_content_id: null,
        }),
      });
      pollJob(res.job_id);
    } catch (e: any) {
      setJobStatus('failed');
      setErrorMsg(e.message);
      toast({ title: 'สร้างไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  const isRunning = jobStatus === 'pending' || jobStatus === 'processing';

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="space-y-1.5">
        <Label>Prompt <span className="text-destructive">*</span></Label>
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="อธิบายภาพที่ต้องการ เช่น: A modern Thai office building at golden hour, photorealistic, 4K"
          className="min-h-[100px] text-sm"
          disabled={isRunning}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>โมเดล</Label>
          <Select value={model} onValueChange={setModel} disabled={isRunning}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ขนาดภาพ</Label>
          <Select value={size} onValueChange={setSize} disabled={isRunning}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SIZES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={!prompt.trim() || isRunning} className="gap-2">
        {isRunning
          ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังสร้าง...</>
          : <><Sparkles className="h-4 w-4" />สร้างภาพ</>}
      </Button>

      <JobResultGallery status={jobStatus} resultUrls={resultUrls} errorMessage={errorMsg} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/media/FreePromptForm.tsx
git commit -m "feat(media): add FreePromptForm component"
```

---

## Task 5: FromScriptForm component

**Files:**
- Create: `src/components/media/FromScriptForm.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
import { useState } from 'react';
import { Sparkles, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import JobResultGallery from './JobResultGallery';

const MODELS = [
  { id: 'qwen2/text-to-image', label: 'Qwen2 Image' },
  { id: 'flux-kontext/generate', label: 'Flux Kontext' },
  { id: 'gpt/gpt-image-2', label: 'GPT Image 2' },
];

// Extract scene descriptions from video script text
function parseScenes(articleContent: string): string[] {
  if (!articleContent) return [];
  // Split by common scene markers: numbered lines, [SCENE], ---
  const lines = articleContent
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 20); // skip short lines
  // Group into ~4–8 scenes by taking every N-th meaningful line
  // Simple heuristic: return lines that look like scene descriptions
  const scenes: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/^[\d\.\-\*\[\]#]+\s*/, '').trim();
    if (clean.length > 20 && scenes.length < 8) {
      scenes.push(clean);
    }
  }
  return scenes.slice(0, 8);
}

type JobStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
interface SceneJob { scene: string; status: JobStatus; resultUrls: string[]; errorMsg: string | null; jobId: string | null }

export default function FromScriptForm() {
  const { toast } = useToast();
  const [selectedContentId, setSelectedContentId] = useState('__none__');
  const [model, setModel] = useState(MODELS[0].id);
  const [selectedScenes, setSelectedScenes] = useState<number[]>([]);
  const [sceneJobs, setSceneJobs] = useState<SceneJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: videoItems = [] } = useQuery<any[]>({
    queryKey: ['content-items-video'],
    queryFn: () => apiFetch('/brand-content.php?action=list-items&type=video'),
  });

  const selectedItem = videoItems.find((i: any) => i.id === selectedContentId);
  const scenes = selectedItem ? parseScenes(selectedItem.article_content ?? '') : [];

  const toggleScene = (idx: number) => {
    setSelectedScenes(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const pollJob = (jobId: string, sceneIdx: number) => {
    const startTime = Date.now();
    const maxMs = 5 * 60 * 1000;

    const interval = setInterval(async () => {
      if (Date.now() - startTime > maxMs) {
        clearInterval(interval);
        setSceneJobs(prev => prev.map((j, i) => i === sceneIdx ? { ...j, status: 'failed', errorMsg: 'หมดเวลา' } : j));
        return;
      }
      try {
        const res: any = await apiFetch(`/media-jobs.php?action=poll&id=${jobId}`);
        setSceneJobs(prev => prev.map((j, i) => i === sceneIdx
          ? { ...j, status: res.status, resultUrls: res.result_urls ?? [], errorMsg: res.error_message ?? null }
          : j
        ));
        if (res.status === 'completed' || res.status === 'failed') clearInterval(interval);
      } catch {
        // transient error — keep polling
      }
    }, 3000);
  };

  const handleCreate = async () => {
    if (!selectedContentId || selectedContentId === '__none__' || selectedScenes.length === 0) return;
    setIsSubmitting(true);

    const initialJobs: SceneJob[] = scenes.map((scene, i) => ({
      scene,
      status: selectedScenes.includes(i) ? 'pending' : 'idle',
      resultUrls: [],
      errorMsg: null,
      jobId: null,
    }));
    setSceneJobs(initialJobs);

    for (const sceneIdx of selectedScenes) {
      try {
        const res: any = await apiFetch('/media-jobs.php?action=create', {
          method: 'POST',
          body: JSON.stringify({
            model,
            prompt: scenes[sceneIdx],
            input_params: { width: 1024, height: 1024 },
            source_content_id: selectedContentId,
          }),
        });
        setSceneJobs(prev => prev.map((j, i) => i === sceneIdx ? { ...j, jobId: res.job_id } : j));
        pollJob(res.job_id, sceneIdx);
      } catch (e: any) {
        setSceneJobs(prev => prev.map((j, i) => i === sceneIdx ? { ...j, status: 'failed', errorMsg: e.message } : j));
        toast({ title: `Scene ${sceneIdx + 1} ไม่สำเร็จ`, description: e.message, variant: 'destructive' });
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="space-y-1.5">
        <Label>เลือก Video Script</Label>
        <Select value={selectedContentId} onValueChange={v => { setSelectedContentId(v); setSelectedScenes([]); setSceneJobs([]); }}>
          <SelectTrigger><SelectValue placeholder="เลือก content..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— เลือก content —</SelectItem>
            {videoItems.map((item: any) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title || 'ไม่มีชื่อ'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scenes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>เลือก Scene ({selectedScenes.length}/{scenes.length})</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setSelectedScenes(selectedScenes.length === scenes.length ? [] : scenes.map((_, i) => i))}
            >
              {selectedScenes.length === scenes.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>
          <div className="space-y-2">
            {scenes.map((scene, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleScene(i)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border text-xs transition-all',
                  selectedScenes.includes(i)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40'
                )}
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                  <span className="line-clamp-2">{scene}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {scenes.length > 0 && (
        <div className="space-y-1.5">
          <Label>โมเดล</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {scenes.length > 0 && (
        <Button
          onClick={handleCreate}
          disabled={selectedScenes.length === 0 || isSubmitting}
          className="gap-2"
        >
          {isSubmitting
            ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังส่ง...</>
            : <><Sparkles className="h-4 w-4" />สร้างภาพ {selectedScenes.length} Scene</>}
        </Button>
      )}

      {sceneJobs.filter(j => j.status !== 'idle').map((job, i) => (
        <div key={i} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground line-clamp-1">Scene: {job.scene}</p>
          <JobResultGallery status={job.status} resultUrls={job.resultUrls} errorMessage={job.errorMsg} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/media/FromScriptForm.tsx
git commit -m "feat(media): add FromScriptForm component"
```

---

## Task 6: JobHistoryTab component

**Files:**
- Create: `src/components/media/JobHistoryTab.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Loader2, ImageOff, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; class: string }> = {
  pending:    { label: 'รอคิว',     icon: Clock,         class: 'text-muted-foreground' },
  processing: { label: 'กำลังสร้าง', icon: Loader2,       class: 'text-blue-500 animate-spin' },
  completed:  { label: 'สำเร็จ',    icon: CheckCircle2,  class: 'text-green-500' },
  failed:     { label: 'ล้มเหลว',   icon: XCircle,       class: 'text-destructive' },
};

export default function JobHistoryTab() {
  const { data, isLoading } = useQuery<{ jobs: any[] }>({
    queryKey: ['media-jobs-history'],
    queryFn: () => apiFetch('/media-jobs.php?action=list'),
    refetchInterval: 5000,
  });

  const jobs = data?.jobs ?? [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <ImageOff className="h-10 w-10 opacity-30" />
        <p className="text-sm">ยังไม่มีประวัติการสร้างภาพ</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job: any) => {
        const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.processing;
        const Icon = cfg.icon;
        const firstImage = job.result_urls?.[0];
        return (
          <div key={job.id} className="flex gap-3 p-3 border rounded-lg bg-card hover:bg-muted/20 transition-colors">
            <div className="w-16 h-16 rounded-md overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
              {firstImage
                ? <img src={firstImage} alt="ผลลัพธ์" className="w-full h-full object-cover" />
                : <Icon className={`h-5 w-5 ${cfg.class}`} />}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-medium line-clamp-2">{job.prompt}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{job.model}</Badge>
                <span className={`flex items-center gap-1 text-[10px] ${cfg.class}`}>
                  <Icon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                  {cfg.label}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(job.created_at).toLocaleString('th-TH')}
              </p>
              {job.result_urls?.length > 0 && (
                <p className="text-[10px] text-primary">{job.result_urls.length} ภาพ</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/media/JobHistoryTab.tsx
git commit -m "feat(media): add JobHistoryTab component"
```

---

## Task 7: MediaStudioPage

**Files:**
- Create: `src/pages/MediaStudioPage.tsx`

- [ ] **Step 1: สร้างไฟล์**

```tsx
import { useState } from 'react';
import { Wand2, History, PenLine, FileText } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import FreePromptForm from '@/components/media/FreePromptForm';
import FromScriptForm from '@/components/media/FromScriptForm';
import JobHistoryTab from '@/components/media/JobHistoryTab';

type Mode = 'prompt' | 'script';

export default function MediaStudioPage() {
  const [mode, setMode] = useState<Mode>('prompt');

  return (
    <PageShell
      breadcrumbs={[{ label: 'การตลาด' }, { label: 'Media Studio', isCurrent: true }]}
      title="Media Studio"
      description="สร้างภาพด้วย AI ผ่าน Kie.ai"
    >
      <Tabs defaultValue="create" className="space-y-6">
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Wand2 className="h-3.5 w-3.5" />สร้างภาพ
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-3.5 w-3.5" />ประวัติ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('prompt')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                mode === 'prompt'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              )}
            >
              <PenLine className="h-4 w-4" />พิมพ์ Prompt
            </button>
            <button
              type="button"
              onClick={() => setMode('script')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                mode === 'script'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              )}
            >
              <FileText className="h-4 w-4" />จาก Video Script
            </button>
          </div>

          {mode === 'prompt' && <FreePromptForm />}
          {mode === 'script' && <FromScriptForm />}
        </TabsContent>

        <TabsContent value="history">
          <JobHistoryTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/MediaStudioPage.tsx
git commit -m "feat(media): add MediaStudioPage"
```

---

## Task 8: Route, Sidebar, และ menuKey

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `api/auth.php`

- [ ] **Step 1: เพิ่ม lazy import และ route ใน `src/App.tsx`**

หา block lazy imports แล้วเพิ่ม:
```tsx
const MediaStudioPage = lazy(() => import('./pages/MediaStudioPage'));
```

หา route `/content` แล้วเพิ่มใกล้ ๆ:
```tsx
<Route path="/media-studio" element={<PermissionRoute menuKey="media_studio"><MediaStudioPage /></PermissionRoute>} />
```

- [ ] **Step 2: เพิ่ม sidebar item ใน `src/components/AppSidebar.tsx`**

หา block `key: 'marketing'` (บรรทัดประมาณ 81) แล้วเพิ่ม item ต่อท้าย `items` array:
```tsx
{ title: 'Media Studio', href: '/media-studio', icon: Wand2, menuKey: 'media_studio' },
```

เพิ่ม `Wand2` ใน import จาก `lucide-react` ถ้ายังไม่มี

- [ ] **Step 3: เพิ่ม `media_studio` ใน `api/auth.php` บรรทัด 149**

แก้ `ALL_MENU_KEYS` เพิ่ม `'media_studio'` ต่อท้าย array:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','task_hours','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar','task_intelligence','workflow','brand_setting','media_studio'];
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx api/auth.php
git commit -m "feat(media): add /media-studio route, sidebar item, and menuKey"
```

---

## Task 9: Build และทดสอบ

- [ ] **Step 1: รัน lint**

```bash
pnpm lint
```

Expected: ไม่มี error

- [ ] **Step 2: รัน build**

```bash
pnpm build
```

Expected: build สำเร็จ ไม่มี TypeScript error

- [ ] **Step 3: ทดสอบ manual**

1. ไปที่ Admin › AI Providers → ต้องเห็น "Kie.ai" ในรายการ
2. ใส่ API key ของ kie.ai → กด Test → ต้องผ่าน
3. ไปที่ `http://localhost:8080/#/media-studio` → ต้องโหลดหน้าได้
4. **Mode A:** พิมพ์ prompt → เลือก Qwen2 → กด "สร้างภาพ" → spinner ขึ้น → ภาพแสดงใน gallery
5. **Mode B:** เลือก video content → เลือก scenes → กด สร้าง → แต่ละ scene มี gallery ของตัวเอง
6. Tab "ประวัติ" → ต้องแสดง jobs ที่สร้างไปแล้ว + thumbnail
7. Sidebar → ต้องเห็น "Media Studio" ใน group การตลาด
