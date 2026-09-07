warning: in the working copy of 'api/brand-content.php', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'api/content-research.php', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'api/lib/ai-research.php', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'openspec/specs/content-generation-research/spec.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'openspec/specs/content-research-settings/spec.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/__tests__/content/QuickCreateDialog.research.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/__tests__/content/ResearchProviderForm.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/components/brand/ResearchProviderForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/components/content/ContentCardDialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/components/content/dialogs/BatchGenerateDialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/components/content/dialogs/QuickCreateDialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/components/content/tabs/ContentListTab.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/components/content/views/ContentDetailView.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/hooks/useResearchRun.ts', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/api/brand-content.php b/api/brand-content.php[m
[1mindex c65a157..32c9ae0 100644[m
[1m--- a/api/brand-content.php[m
[1m+++ b/api/brand-content.php[m
[36m@@ -257,7 +257,7 @@[m [mif ($action === 'global-settings') {[m
         if (!$row) {[m
             jsonResponse(['tenant_id' => $tenantId, 'global_instruction' => '', 'image_gen_provider' => 'none',[m
                           'image_gen_model' => '', 'image_gen_base_url' => '', 'product_ref_image_url' => '', 'has_image_gen_key' => false,[m
[31m-                          'research_provider' => 'none', 'research_api_login' => '', 'has_research_key' => false,[m
[32m+[m[32m                          'research_provider' => 'ai', 'research_api_login' => '', 'has_research_key' => false,[m
                           'research_location_code' => 2764, 'research_language_code' => 'th', 'research_cache_hours' => 168,[m
                           'weekly_posts_target' => 0]);[m
         }[m
[36m@@ -265,17 +265,17 @@[m [mif ($action === 'global-settings') {[m
         $row['has_research_key'] = !empty($row['research_api_key_encrypted']);[m
         $row['weekly_posts_target'] = (int)($row['weekly_posts_target'] ?? 0);[m
         $row['research_location_code'] = (int)($row['research_location_code'] ?? 2764);[m
[31m-        $row['research_cache_hours'] = (int)($row['research_cache_hours'] ?? 168);[m
[32m+[m[32m        $row['research_cache_hours'] = research_normalize_cache_hours($row['research_cache_hours'] ?? null);[m
         unset($row['image_gen_api_key_encrypted']);[m
         unset($row['research_api_key_encrypted']);[m
         jsonResponse($row);[m
     }[m
     if ($method === 'POST') {[m
         $body = getRequestBody();[m
[31m-        // Whitelist research provider: none/dataforseo/ai — ค่าอื่น fallback เป็น 'none'[m
[31m-        $researchProvider = in_array($body['research_provider'] ?? null, ['none', 'dataforseo', 'ai'], true)[m
[32m+[m[32m        // Whitelist mandatory Research providers: dataforseo/ai — ค่าอื่น fallback เป็น 'ai'[m
[32m+[m[32m        $researchProvider = in_array($body['research_provider'] ?? null, ['dataforseo', 'ai'], true)[m
             ? (string)$body['research_provider'][m
[31m-            : 'none';[m
[32m+[m[32m            : 'ai';[m
         $encKey = null;[m
         if (!empty($body['image_gen_api_key'])) {[m
             $encKey = encryptValue($body['image_gen_api_key']);[m
[36m@@ -303,7 +303,7 @@[m [mif ($action === 'global-settings') {[m
             if (array_key_exists('research_api_login', $body))     { $sets[] = 'research_api_login=?';     $vals[] = trim((string)($body['research_api_login'] ?? '')); }[m
             if (array_key_exists('research_location_code', $body)){ $sets[] = 'research_location_code=?'; $vals[] = max(1, (int)($body['research_location_code'] ?? 2764)); }[m
             if (array_key_exists('research_language_code', $body)){ $sets[] = 'research_language_code=?'; $vals[] = trim((string)($body['research_language_code'] ?? 'th')); }[m
[31m-            if (array_key_exists('research_cache_hours', $body))  { $sets[] = 'research_cache_hours=?';  $vals[] = min(8760, max(0, (int)($body['research_cache_hours'] ?? 168))); }[m
[32m+[m[32m            if (array_key_exists('research_cache_hours', $body))  { $sets[] = 'research_cache_hours=?';  $vals[] = research_normalize_cache_hours($body['research_cache_hours'] ?? null); }[m
             if ($researchEncKey !== null) { $sets[] = 'research_api_key_encrypted=?'; $vals[] = $researchEncKey; }[m
             if (count($sets) > 1) {[m
                 $vals[] = $tenantId;[m
[36m@@ -311,7 +311,7 @@[m [mif ($action === 'global-settings') {[m
             }[m
         } else {[m
             $db->prepare('INSERT INTO content_global_settings (tenant_id,global_instruction,image_gen_provider,image_gen_api_key_encrypted,image_gen_model,image_gen_base_url,product_ref_image_url,product_refs,weekly_posts_target,research_provider,research_api_login,research_api_key_encrypted,research_location_code,research_language_code,research_cache_hours) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')[m
[31m-               ->execute([$tenantId, $body['global_instruction'] ?? '', $body['image_gen_provider'] ?? 'none', $encKey, $body['image_gen_model'] ?? '', $body['image_gen_base_url'] ?? '', $body['product_ref_image_url'] ?? '', $body['product_refs'] ?? '[]', max(0, (int)($body['weekly_posts_target'] ?? 0)), $researchProvider, trim((string)($body['research_api_login'] ?? '')), $researchEncKey, max(1, (int)($body['research_location_code'] ?? 2764)), trim((string)($body['research_language_code'] ?? 'th')), min(8760, max(0, (int)($body['research_cache_hours'] ?? 168))) ]);[m
[32m+[m[32m               ->execute([$tenantId, $body['global_instruction'] ?? '', $body['image_gen_provider'] ?? 'none', $encKey, $body['image_gen_model'] ?? '', $body['image_gen_base_url'] ?? '', $body['product_ref_image_url'] ?? '', $body['product_refs'] ?? '[]', max(0, (int)($body['weekly_posts_target'] ?? 0)), $researchProvider, trim((string)($body['research_api_login'] ?? '')), $researchEncKey, max(1, (int)($body['research_location_code'] ?? 2764)), trim((string)($body['research_language_code'] ?? 'th')), research_normalize_cache_hours($body['research_cache_hours'] ?? null) ]);[m
         }[m
         jsonResponse(['saved' => true]);[m
     }[m
[36m@@ -1993,7 +1993,7 @@[m [mif ($action === 'generate-article') {[m
     $researchJobId = trim((string)($body['research_job_id'] ?? ''));[m
     if (!$itemId) jsonError('item_id required', 400);[m
 [m
[31m-    $item = $db->prepare("SELECT ci.*, ci.title AS topic, cp.trigger_command, cp.skill_id, cp.brand_context_ids, cpi.day_label, cpi.day_order FROM content_items ci LEFT JOIN content_plans cp ON cp.id = ci.plan_id LEFT JOIN content_plan_items cpi ON cpi.id = ci.plan_item_id WHERE ci.id = ? AND ci.tenant_id = ?");[m
[32m+[m[32m    $item = $db->prepare("SELECT ci.*, ci.title AS topic, cp.title AS source_topic, cp.trigger_command, cp.skill_id, cp.brand_context_ids, cpi.day_label, cpi.day_order FROM content_items ci LEFT JOIN content_plans cp ON cp.id = ci.plan_id LEFT JOIN content_plan_items cpi ON cpi.id = ci.plan_item_id WHERE ci.id = ? AND ci.tenant_id = ?");[m
     $item->execute([$itemId, $tenantId]);[m
     $item = $item->fetch();[m
     if (!$item) jsonError('Item not found', 404);[m
[36m@@ -2022,6 +2022,39 @@[m [mif ($action === 'generate-article') {[m
     $researchJob = null;[m
     $researchBrief = null;[m
     $researchKeywords = [];[m
[32m+[m
[32m+[m[32m    // Research is mandatory at the generation boundary. UI normally supplies the[m
[32m+[m[32m    // job id after Fetch/Reuse → Analyze. For legacy/direct callers, allow reuse of[m
[32m+[m[32m    // the same Topic's still-valid cached Research job, but never generate without it.[m
[32m+[m[32m    if ($researchJobId === '') {[m
[32m+[m[32m        $sourceSeed = trim((string)($item['source_topic'] ?? '')) ?: trim((string)($item['topic'] ?? ''));[m
[32m+[m[32m        if ($sourceSeed !== '') {[m
[32m+[m[32m            $settingsStmt = $db->prepare('SELECT research_provider, research_location_code, research_language_code, research_cache_hours FROM content_global_settings WHERE tenant_id=?');[m
[32m+[m[32m            $settingsStmt->execute([$tenantId]);[m
[32m+[m[32m            $researchSettings = $settingsStmt->fetch(PDO::FETCH_ASSOC) ?: [];[m
[32m+[m[32m            // ใช้ cache semantics เดียวกับ content-research.php: 0 = ปิด cache[m
[32m+[m[32m            // เมื่อปิด cache ยอมรับเฉพาะ job ที่เพิ่ง Fetch ในรอบเดียวกัน (grace window)[m
[32m+[m[32m            $cacheHours = research_normalize_cache_hours($researchSettings['research_cache_hours'] ?? null);[m
[32m+[m[32m            $maxAgeSeconds = research_max_age_seconds($cacheHours);[m
[32m+[m[32m            $provider = trim((string)($researchSettings['research_provider'] ?? ''));[m
[32m+[m[32m            if ($provider !== '') {[m
[32m+[m[32m                $cachedResearchStmt = $db->prepare("SELECT id FROM content_research_jobs WHERE tenant_id=? AND provider=? AND location_code=? AND language_code=? AND seed_keyword=? AND status='done' AND analysis IS NOT NULL AND fetched_at >= DATE_SUB(NOW(), INTERVAL {$maxAgeSeconds} SECOND) ORDER BY fetched_at DESC LIMIT 1");[m
[32m+[m[32m                $cachedResearchStmt->execute([[m
[32m+[m[32m                    $tenantId,[m
[32m+[m[32m                    $provider,[m
[32m+[m[32m                    (int)($researchSettings['research_location_code'] ?? 2764),[m
[32m+[m[32m                    (string)($researchSettings['research_language_code'] ?? 'th'),[m
[32m+[m[32m                    $sourceSeed,[m
[32m+[m[32m                ]);[m
[32m+[m[32m                $cachedResearchJobId = $cachedResearchStmt->fetchColumn();[m
[32m+[m[32m                if ($cachedResearchJobId) $researchJobId = (string)$cachedResearchJobId;[m
[32m+[m[32m            }[m
[32m+[m[32m        }[m
[32m+[m[32m        if ($researchJobId === '') {[m
[32m+[m[32m            jsonError('ไม่พบ Research Data ที่ใช้งานได้สำหรับ Topic นี้ — กรุณาเริ่มการสร้าง Content ผ่าน Research flow', 422);[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m
     if ($researchJobId !== '') {[m
         $researchStmt = $db->prepare("SELECT * FROM content_research_jobs WHERE id=? AND tenant_id=? AND status='done'");[m
         $researchStmt->execute([$researchJobId, $tenantId]);[m
[36m@@ -2029,6 +2062,20 @@[m [mif ($action === 'generate-article') {[m
         if (!$researchJob || empty($researchJob['analysis'])) {[m
             jsonError('ไม่พบ Research job ที่วิเคราะห์เสร็จแล้วใน tenant นี้', 422);[m
         }[m
[32m+[m
[32m+[m[32m        // Enforce the same Topic + TTL rules even when a caller supplies a job id.[m
[32m+[m[32m        $expectedSeed = trim((string)($item['source_topic'] ?? '')) ?: trim((string)($item['topic'] ?? ''));[m
[32m+[m[32m        $researchSettingsStmt = $db->prepare('SELECT research_cache_hours FROM content_global_settings WHERE tenant_id=?');[m
[32m+[m[32m        $researchSettingsStmt->execute([$tenantId]);[m
[32m+[m[32m        $rawConfiguredCacheHours = $researchSettingsStmt->fetchColumn();[m
[32m+[m[32m        $configuredCacheHours = research_normalize_cache_hours($rawConfiguredCacheHours === false ? null : $rawConfiguredCacheHours);[m
[32m+[m[32m        if ($expectedSeed !== '' && strcasecmp(trim((string)$researchJob['seed_keyword']), $expectedSeed) !== 0) {[m
[32m+[m[32m            jsonError('Research ไม่ตรงกับ Topic ของ Content นี้', 422);[m
[32m+[m[32m        }[m
[32m+[m[32m        if (!research_job_is_usable($configuredCacheHours, $researchJob['fetched_at'] ?? null)) {[m
[32m+[m[32m            jsonError('Research Data หมดอายุแล้ว — กรุณา Fetch Research ใหม่ก่อนสร้าง Content', 422);[m
[32m+[m[32m        }[m
[32m+[m
         $researchKeywordsStmt = $db->prepare('SELECT keyword, search_volume, difficulty, intent, source, is_selected FROM content_research_keywords WHERE job_id=? AND tenant_id=? ORDER BY is_selected DESC, search_volume DESC, keyword ASC');[m
         $researchKeywordsStmt->execute([$researchJobId, $tenantId]);[m
         $researchKeywords = $researchKeywordsStmt->fetchAll(PDO::FETCH_ASSOC);[m
[1mdiff --git a/api/content-research.php b/api/content-research.php[m
[1mindex 2745281..5c46d3c 100644[m
[1m--- a/api/content-research.php[m
[1m+++ b/api/content-research.php[m
[36m@@ -19,13 +19,14 @@[m [mfunction research_settings(PDO $db, string $tenantId): array {[m
     $stmt->execute([$tenantId]);[m
     $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];[m
     return [[m
[31m-        'provider' => (string)($row['research_provider'] ?? 'none'),[m
[32m+[m[32m        'provider' => (string)($row['research_provider'] ?? 'ai'),[m
         'login' => (string)($row['research_api_login'] ?? ''),[m
         'password' => !empty($row['research_api_key_encrypted']) ? decryptApiKey((string)$row['research_api_key_encrypted']) : '',[m
         'has_key' => !empty($row['research_api_key_encrypted']),[m
         'location_code' => (int)($row['research_location_code'] ?? 2764),[m
         'language_code' => (string)($row['research_language_code'] ?? 'th'),[m
[31m-        'cache_hours' => (int)($row['research_cache_hours'] ?? 168),[m
[32m+[m[32m        // 0 = ปิด cache (ห้าม Reuse), > 0 = Reuse ได้ภายใน N ชั่วโมง[m
[32m+[m[32m        'cache_hours' => research_normalize_cache_hours($row['research_cache_hours'] ?? null),[m
     ];[m
 }[m
 [m
[36m@@ -187,8 +188,8 @@[m [mif ($action === 'fetch') {[m
         if (!$itemStmt->fetchColumn()) jsonError('ไม่พบ content item ใน tenant นี้', 404);[m
     }[m
     $forceRefresh = !empty($body['force_refresh']);[m
[31m-    if (!$forceRefresh && $settings['cache_hours'] > 0) {[m
[31m-        $hours = min(8760, max(1, $settings['cache_hours']));[m
[32m+[m[32m    if (!$forceRefresh && research_cache_enabled($settings['cache_hours'])) {[m
[32m+[m[32m        $hours = $settings['cache_hours'];[m
         $cacheSql = "SELECT * FROM content_research_jobs WHERE tenant_id=? AND provider=? AND location_code=? AND language_code=? AND seed_keyword=? AND status='done' AND fetched_at >= DATE_SUB(NOW(), INTERVAL {$hours} HOUR) ORDER BY fetched_at DESC LIMIT 1";[m
         $cacheStmt = $db->prepare($cacheSql);[m
         $cacheStmt->execute([$tenantId, $settings['provider'], $settings['location_code'], $settings['language_code'], $seed]);[m
[1mdiff --git a/api/lib/ai-research.php b/api/lib/ai-research.php[m
[1mindex 4123283..7f555e9 100644[m
[1m--- a/api/lib/ai-research.php[m
[1m+++ b/api/lib/ai-research.php[m
[36m@@ -1,5 +1,44 @@[m
 <?php[m
 [m
[32m+[m[32m/**[m
[32m+[m[32m * Research cache semantics — single source of truth ใช้ร่วมกันทั้ง[m
[32m+[m[32m * `content-research.php` (Fetch/Reuse) และ `brand-content.php` (Generate)[m
[32m+[m[32m *[m
[32m+[m[32m *   cache_hours > 0 : Reuse Research ที่ fetch มาไม่เกิน N ชั่วโมงได้[m
[32m+[m[32m *   cache_hours = 0 : ปิด cache — ห้าม Reuse Research เดิมเลย ต้อง Fetch ใหม่ทุกครั้ง[m
[32m+[m[32m *[m
[32m+[m[32m * เมื่อ cache ปิด Generate ยังต้องใช้ Research job ที่ Fetch มาในรอบการทำงานเดียวกัน[m
[32m+[m[32m * (fetch → analyze → generate) จึงยอมรับเฉพาะ job ที่อายุไม่เกิน[m
[32m+[m[32m * RESEARCH_ACTIVE_RUN_GRACE_SECONDS ซึ่งไม่ใช่การ Reuse cache[m
[32m+[m[32m */[m
[32m+[m[32mconst RESEARCH_CACHE_HOURS_MAX = 8760;[m
[32m+[m[32mconst RESEARCH_CACHE_HOURS_DEFAULT = 168;[m
[32m+[m[32mconst RESEARCH_ACTIVE_RUN_GRACE_SECONDS = 900;[m
[32m+[m
[32m+[m[32m/** บีบค่า cache hours ให้อยู่ในช่วง 0-8760 โดย 0 = ปิด cache */[m
[32m+[m[32mfunction research_normalize_cache_hours($raw, int $default = RESEARCH_CACHE_HOURS_DEFAULT): int {[m
[32m+[m[32m    if ($raw === null || $raw === '') return min(RESEARCH_CACHE_HOURS_MAX, max(0, $default));[m
[32m+[m[32m    return min(RESEARCH_CACHE_HOURS_MAX, max(0, (int)$raw));[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction research_cache_enabled(int $cacheHours): bool {[m
[32m+[m[32m    return $cacheHours > 0;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/** อายุสูงสุด (วินาที) ของ Research job ที่ยังใช้สร้าง Content ได้ */[m
[32m+[m[32mfunction research_max_age_seconds(int $cacheHours): int {[m
[32m+[m[32m    return research_cache_enabled($cacheHours)[m
[32m+[m[32m        ? $cacheHours * 3600[m
[32m+[m[32m        : RESEARCH_ACTIVE_RUN_GRACE_SECONDS;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/** Research job ยังใช้สร้าง Content ได้หรือไม่ ตาม cache semantics ด้านบน */[m
[32m+[m[32mfunction research_job_is_usable(int $cacheHours, ?string $fetchedAt): bool {[m
[32m+[m[32m    $ts = ($fetchedAt === null || $fetchedAt === '') ? false : strtotime($fetchedAt);[m
[32m+[m[32m    if ($ts === false) return false;[m
[32m+[m[32m    return $ts >= (time() - research_max_age_seconds($cacheHours));[m
[32m+[m[32m}[m
[32m+[m
 function ai_research_required_fields(): array {[m
     return [[m
         'primary_keyword', 'secondary_keywords', 'intent', 'paa',[m
[1mdiff --git a/openspec/specs/content-generation-research/spec.md b/openspec/specs/content-generation-research/spec.md[m
[1mindex 8d1920f..f59ef95 100644[m
[1m--- a/openspec/specs/content-generation-research/spec.md[m
[1m+++ b/openspec/specs/content-generation-research/spec.md[m
[36m@@ -1,50 +1,109 @@[m
[32m+[m[32m# content-generation-research Specification[m
[32m+[m
 ## Purpose[m
 [m
[31m-กำหนดการนำ Research brief ไปใช้สร้าง content โดยคงความเข้ากันได้กับ flow เดิม[m
[32m+[m[32mกำหนดให้ Research เป็น Mandatory Internal Flow ของการสร้าง Content โดยระบบต้อง Reuse Research Data ที่ยังสด หรือ Fetch ใหม่เมื่อไม่มี/หมดอายุ และ AI ต้องใช้ Research Data จริงเป็น Context ในการสร้าง Content[m
 [m
 ## Requirements[m
 [m
[31m-### Requirement: Content generation can use a completed research brief[m
[31m-`generate-article` SHALL รับ `research_job_id` แบบ optional และเมื่อมีค่า SHALL ใช้เฉพาะ brief ของ tenant เดียวกันที่ job มีสถานะ `done` เป็น input ของการสร้าง content[m
[32m+[m[32m### Requirement: Research is mandatory for content generation[m
[32m+[m[32m`generate-article` SHALL ไม่สร้าง Content หากไม่มี Research Job ที่ผ่านการตรวจสอบและมี Research Brief ที่ใช้งานได้[m
[32m+[m
[32m+[m[32m#### Scenario: Content is generated through the normal UI[m
[32m+[m[32m- **WHEN** ผู้ใช้กรอก Topic และกดสร้าง Content[m
[32m+[m[32m- **THEN** ระบบต้องทำ Research Fetch/Reuse → Analyze → Generate โดยอัตโนมัติ[m
[32m+[m[32m- **AND** ไม่มีตัวเลือกให้ผู้ใช้ปิด Research[m
[32m+[m
[32m+[m[32m#### Scenario: Direct generation bypass is attempted[m
[32m+[m[32m- **WHEN** request เรียก `generate-article` โดยไม่มี `research_job_id`[m
[32m+[m[32m- **THEN** ระบบสามารถ Reuse Research Job เดิมที่ตรง Topic และยังอยู่ใน TTL ได้[m
[32m+[m[32m- **AND** หากไม่มี Research Data ที่ใช้งานได้ ระบบต้องไม่ Generate Content และคืน error[m
[32m+[m
[32m+[m[32m### Requirement: Every generation entry point runs the Research flow[m
[32m+[m[32mทุกจุดใน UI ที่สั่งสร้างเนื้อหา (Content Planner, Card Dialog, Detail View, Content List, Quick Create, Batch Generate) SHALL เรียก `generate-article` ผ่าน Mandatory Research flow เดียวกัน (Fetch/Reuse → Analyze → Generate) และ SHALL ไม่เรียก `generate-article` โดยตรง[m
[32m+[m
[32m+[m[32m#### Scenario: Research is expired when the user presses generate[m
[32m+[m[32m- **WHEN** ผู้ใช้กดสร้างเนื้อหาจากจุดใดก็ได้ใน UI และ Research เดิมหมดอายุ[m
[32m+[m[32m- **THEN** ระบบ Fetch Research ใหม่ให้อัตโนมัติแล้วจึง Generate[m
[32m+[m[32m- **AND** ผู้ใช้ไม่พบ error ที่ต้องแก้ด้วยการไป Fetch Research เองก่อน[m
[32m+[m
[32m+[m[32m#### Scenario: A generation entry point has no topic[m
[32m+[m[32m- **WHEN** รายการที่จะสร้างไม่มี Topic/หัวข้อ[m
[32m+[m[32m- **THEN** ระบบไม่เรียก `generate-article` และแจ้งผู้ใช้ว่าต้องมีหัวข้อก่อนเริ่ม Research[m
[32m+[m
[32m+[m[32m### Requirement: Existing valid Research Data is reused[m
[32m+[m[32mResearch Fetch SHALL ตรวจสอบ Research Data ของ tenant เดียวกันที่ตรงกับ provider, location, language และ normalized seed/topic และยังอยู่ใน TTL ก่อน Fetch ใหม่[m
[32m+[m
[32m+[m[32m#### Scenario: Matching Research is fresh[m
[32m+[m[32m- **WHEN** มี Research Data ที่ตรง Topic และ `fetched_at` ยังอยู่ภายใน `research_cache_hours`[m
[32m+[m[32m- **THEN** ระบบใช้ Research Job เดิม[m
[32m+[m[32m- **AND** ไม่ Fetch provider ใหม่[m
[32m+[m
[32m+[m[32m### Requirement: Expired or missing Research is refreshed[m
[32m+[m[32mระบบ SHALL Fetch Research ใหม่เมื่อไม่มีข้อมูลที่ตรง Topic หรือข้อมูลเดิมหมดอายุ[m
 [m
[31m-#### Scenario: Content is generated with research[m
[31m-- **WHEN** ผู้ใช้ส่ง `research_job_id` ที่ถูกต้องและ job มี brief ที่ผ่านการ validate[m
[31m-- **THEN** prompt มี brief, selected keywords และ provider/location/language/fetched time ของ job[m
[32m+[m[32m#### Scenario: Research is expired[m
[32m+[m[32m- **WHEN** Research Data เดิมเกิน TTL[m
[32m+[m[32m- **THEN** ระบบ Fetch Research ใหม่[m
[32m+[m[32m- **AND** ใช้ Research Job ใหม่ที่ Fetch สำเร็จในการ Generate Content[m
 [m
[31m-#### Scenario: Invalid research is rejected[m
[31m-- **WHEN** research job ไม่ใช่ของ tenant, ไม่ใช่สถานะ `done` หรือไม่มี brief ที่ใช้ได้[m
[31m-- **THEN** ระบบไม่โหลดข้อมูลของ job เข้า prompt และคืน error ภาษาไทย[m
[32m+[m[32m#### Scenario: No Research exists[m
[32m+[m[32m- **WHEN** ไม่พบ Research Data ที่ตรง Topic[m
[32m+[m[32m- **THEN** ระบบ Fetch Research ใหม่ก่อน Generate Content[m
[32m+[m
[32m+[m[32m### Requirement: Research Topic is the source of truth[m
[32m+[m[32mResearch SHALL ใช้ Original User Topic/Seed เป็น source และ SHALL ไม่ใช้ topic ที่ AI rewrite จาก plan มาแทน[m
[32m+[m
[32m+[m[32m#### Scenario: User enters YouTube[m
[32m+[m[32m- **WHEN** ผู้ใช้กรอก Topic `YouTube`[m
[32m+[m[32m- **THEN** Research Fetch ใช้ seed `YouTube` หลัง trim/normalize[m
[32m+[m[32m- **AND** ห้ามใช้ AI-rewritten topic แทน seed เดิม[m
[32m+[m
[32m+[m[32m### Requirement: Research brief must be usable before generation[m
[32m+[m[32mResearch Job ที่ใช้ Generate SHALL มีสถานะ `done`, มี `analysis` ที่ผ่าน validation และมี source data ที่ตรวจสอบย้อนหลังได้[m
[32m+[m
[32m+[m[32m#### Scenario: Research fetch succeeds but analysis is missing[m
[32m+[m[32m- **WHEN** Job มี raw Research แต่ไม่มี valid analysis[m
[32m+[m[32m- **THEN** ระบบต้อง Analyze ก่อน Generate[m
[32m+[m
[32m+[m[32m### Requirement: AI generation must consume Research[m
[32m+[m[32mเมื่อสร้าง Content ระบบ SHALL ส่ง Research Brief, Research keywords และ source metadata ของ Job ที่ใช้จริงเข้า AI Generation Context ทุกครั้ง[m
[32m+[m
[32m+[m[32m#### Scenario: Content is generated from Research[m
[32m+[m[32m- **WHEN** Research Job พร้อมใช้งาน[m
[32m+[m[32m- **THEN** prompt ของ AI มี Research Brief และ selected/fallback Research keywords[m
[32m+[m[32m- **AND** AI ไม่สามารถ Generate จาก Topic เพียงอย่างเดียวได้[m
 [m
 ### Requirement: Research primary keyword controls SEO metadata[m
[31m-เมื่อสร้าง content จาก Research ระบบ SHALL ใช้ primary keyword ที่มาจาก Research เป็นหลักสำหรับ SEO title, slug, meta description, ย่อหน้าแรก และ headings โดยไม่ให้ LLM สร้าง `meta_keywords` ที่ไม่มีแหล่ง Research[m
[32m+[m[32mเมื่อสร้าง Content จาก Research ระบบ SHALL ใช้ primary keyword ที่มาจาก Research เป็นหลักสำหรับ SEO title, slug, meta description, ย่อหน้าแรก และ headings และ SHALL ไม่สร้าง `meta_keywords` ที่ไม่มีแหล่งจาก Research[m
 [m
[31m-#### Scenario: SEO fields use selected keyword[m
[31m-- **WHEN** Research brief มี primary keyword และ content generation สำเร็จ[m
[31m-- **THEN** SEO fields ที่กำหนดมี primary keyword ตามกติกา และ `meta_keywords` มาจาก keyword ที่เลือกใน Research[m
[32m+[m[32m#### Scenario: SEO fields use Research keyword[m
[32m+[m[32m- **WHEN** Research brief มี primary keyword และ Content Generation สำเร็จ[m
[32m+[m[32m- **THEN** SEO fields ที่กำหนดมี primary keyword ตามกติกา[m
[32m+[m[32m- **AND** `meta_keywords` มาจาก Research keywords เท่านั้น[m
 [m
[31m-### Requirement: Content generation remains compatible without research[m
[31m-เมื่อไม่ส่ง `research_job_id` ระบบ SHALL สร้าง content ด้วย flow เดิมได้ และ SHALL ปล่อย `meta_keywords` ว่างโดยไม่สร้าง metrics หรือ keyword ปลอม[m
[32m+[m[32m### Requirement: Research fetch failure has a safe fallback[m
[32m+[m[32mหาก Fetch ใหม่ล้มเหลว ระบบ SHALL ไม่ลบ Research Data เดิม และสามารถใช้ Research Data เดิมได้เมื่อยังอยู่ใน TTL และผ่าน validation[m
 [m
[31m-#### Scenario: Legacy generation has no research id[m
[31m-- **WHEN** request สร้าง article ไม่มี `research_job_id`[m
[31m-- **THEN** ระบบใช้ brand context/knowledge base เดิม สร้าง content ได้ และ `meta_keywords` เป็นค่าว่าง[m
[32m+[m[32m#### Scenario: Refresh fails with usable cached data[m
[32m+[m[32m- **WHEN** Fetch ใหม่ล้มเหลวและมี Research Data เดิมที่ยังใช้ได้[m
[32m+[m[32m- **THEN** ระบบสามารถใช้ข้อมูลเดิมเป็น fallback[m
 [m
[31m-### Requirement: Research linkage is persisted after content creation[m
[31m-เมื่อสร้าง content จาก Research สำเร็จ ระบบ SHALL บันทึก `content_item_id` กลับไปยัง Research job ของ tenant เดียวกัน[m
[32m+[m[32m#### Scenario: Refresh fails without usable research[m
[32m+[m[32m- **WHEN** Fetch ใหม่ล้มเหลวและไม่มี Research Data ที่ใช้ได้[m
[32m+[m[32m- **THEN** ระบบต้องหยุด Content Generation และแจ้ง error[m
 [m
[31m-#### Scenario: Created content is linked to research[m
[31m-- **WHEN** content item ถูกสร้างสำเร็จจาก Research job[m
[31m-- **THEN** job ถูกอัปเดตด้วย `content_item_id` ของ content นั้น และยังคงข้อมูล source เดิม[m
[32m+[m[32m### Requirement: Research linkage is persisted[m
[32m+[m[32mเมื่อสร้าง Content จาก Research สำเร็จ ระบบ SHALL บันทึก `content_item_id` กลับไปยัง Research Job ของ tenant เดียวกัน โดยไม่ลบ source data เดิม[m
 [m
[31m-### Requirement: Original User Topic SHALL remain the source seed[m
[31m-ระบบ SHALL รักษา topic ที่ผู้ใช้กรอกก่อน AI generation เป็น Original User Topic/Seed และ SHALL ไม่ใช้ AI-rewritten topic แทนค่า source นี้ใน Research[m
[32m+[m[32m#### Scenario: Created content is linked to research[m
[32m+[m[32m- **WHEN** Content Item ถูกสร้างจาก Research Job[m
[32m+[m[32m- **THEN** Job ถูกอัปเดตด้วย `content_item_id` ของ Content นั้น[m
[32m+[m[32m- **AND** raw source, fetched_at และ analysis ยังคงอยู่[m
 [m
[31m-#### Scenario: Research enabled[m
[31m-- **WHEN** ผู้ใช้กรอก topic `YouTube` และเปิด AI Research[m
[31m-- **THEN** fetch ใช้ seed keyword `YouTube` หลัง trim[m
[31m-- **AND** seed ไม่ถูกเปลี่ยนเป็น topic ใหม่ที่ AI สร้างขึ้นจาก plan[m
[32m+[m[32m### Requirement: Cached Research with existing analysis is not re-analyzed unnecessarily[m
[32m+[m[32mเมื่อ Reuse Research Job ที่มี valid analysis อยู่แล้ว ระบบ SHALL ใช้ analysis เดิมโดยไม่เรียก Analyze AI ซ้ำ[m
 [m
[31m-#### Scenario: Research disabled[m
[31m-- **WHEN** ผู้ใช้กรอก topic และปิด AI Research[m
[31m-- **THEN** generate-article ยังคงสร้างจาก content item ที่อ้างอิง topic ของผู้ใช้[m
[31m-- **AND** ระบบไม่เติม weekly/day topic เข้าไปแทน[m
[32m+[m[32m#### Scenario: Cached job already has a brief[m
[32m+[m[32m- **WHEN** Fetch endpoint คืน cached job ที่มี `analysis`[m
[32m+[m[32m- **THEN** generation flow ข้าม Analyze และใช้ brief เดิม[m
[1mdiff --git a/openspec/specs/content-research-settings/spec.md b/openspec/specs/content-research-settings/spec.md[m
[1mindex 743a009..fc39b9c 100644[m
[1m--- a/openspec/specs/content-research-settings/spec.md[m
[1m+++ b/openspec/specs/content-research-settings/spec.md[m
[36m@@ -23,16 +23,41 @@[m
 - **WHEN** frontend โหลด Research settings[m
 - **THEN** response มีสถานะว่าตั้งค่า key แล้วหรือยัง แต่ไม่มี secret field[m
 [m
[31m-### Requirement: Research settings have Thai defaults[m
[31m-ระบบ SHALL ใช้ค่าเริ่มต้น provider `none`, location `2764`, language `th` และ cache `168` ชั่วโมง[m
[32m+[m[32m### Requirement: Research has a default provider[m
[32m+[m[32mระบบ SHALL ใช้ค่าเริ่มต้น provider `ai`, location `2764`, language `th` และ cache `168` ชั่วโมง[m
 [m
 #### Scenario: New tenant has no Research configuration[m
 - **WHEN** อ่าน settings ของ tenant ที่ยังไม่ตั้งค่า[m
 - **THEN** ระบบคืนค่า default ดังกล่าวและระบุว่ายังไม่มี key[m
 [m
[32m+[m[32m### Requirement: Research cache duration is configurable[m
[32m+[m[32mระบบ SHALL ให้ผู้ดูแลกำหนดอายุ Research Cache เป็นชั่วโมงในหน้า Settings ของ Research โดยค่าต้องอยู่ในช่วง 0-8760 ชั่วโมง[m
[32m+[m
[32m+[m[32m#### Scenario: Admin changes Research Cache duration[m
[32m+[m[32m- **WHEN** ผู้ดูแลบันทึกค่า cache hours[m
[32m+[m[32m- **THEN** ระบบบันทึกค่าเฉพาะ Research settings และใช้ค่านั้นตัดสินว่า Research Data ใดสามารถ Reuse ได้[m
[32m+[m
[32m+[m[32m### Requirement: Cache duration 0 means cache is disabled[m
[32m+[m[32mระบบ SHALL ตีความ `research_cache_hours = 0` ว่า "ปิด Research Cache — ห้าม Reuse Research เดิม ต้อง Fetch ใหม่ทุกครั้ง" และ SHALL ใช้ความหมายเดียวกันทั้งขั้น Fetch และขั้น Generate[m
[32m+[m
[32m+[m[32m#### Scenario: Cache is disabled and content is created[m
[32m+[m[32m- **WHEN** `research_cache_hours = 0` และผู้ใช้สร้าง Content[m
[32m+[m[32m- **THEN** ขั้น Fetch สร้าง Research job ใหม่เสมอโดยไม่ Reuse job เดิม และขั้น Generate ไม่ค้นหา Research job เดิมมาใช้แทน[m
[32m+[m
[32m+[m[32m#### Scenario: Cache is disabled and Research comes from the current run[m
[32m+[m[32m- **WHEN** `research_cache_hours = 0` และขั้น Generate ได้รับ `research_job_id` ที่ Fetch มาในรอบเดียวกัน[m
[32m+[m[32m- **THEN** ระบบยอมรับ job นั้นภายใน grace window ของรอบการทำงาน (fetch → analyze → generate) ซึ่งไม่ถือเป็นการ Reuse cache[m
[32m+[m
 ### Requirement: Research settings are editable without affecting AI settings[m
 ระบบ SHALL ให้แก้ Research settings ผ่าน settings API และ SHALL ไม่เปลี่ยนค่า AI provider/model settings เดิม[m
 [m
 #### Scenario: Research settings are updated[m
[31m-- **WHEN** ผู้ดูแลแก้ location หรือ cache hours[m
[32m+[m[32m- **WHEN** ผู้ดูแลแก้ location, language หรือ cache hours[m
 - **THEN** ค่า Research เปลี่ยนเฉพาะ Research settings และค่า AI settings คงเดิม[m
[32m+[m
[32m+[m[32m### Requirement: Research is not a user-selectable generation option[m
[32m+[m[32mระบบ SHALL ไม่แสดงตัวเลือกเปิด/ปิด Research ใน Content Generation UI และ SHALL ถือ Research เป็น mandatory internal flow[m
[32m+[m
[32m+[m[32m#### Scenario: User creates content[m
[32m+[m[32m- **WHEN** ผู้ใช้กรอก Topic และกดสร้าง Content[m
[32m+[m[32m- **THEN** ระบบเริ่ม Research flow โดยอัตโนมัติ และผู้ใช้ไม่สามารถเลือก `ไม่ใช้ Research`[m
[1mdiff --git a/src/__tests__/content/QuickCreateDialog.directMode.test.tsx b/src/__tests__/content/QuickCreateDialog.directMode.test.tsx[m
[1mindex 68ec4b5..1a408d0 100644[m
[1m--- a/src/__tests__/content/QuickCreateDialog.directMode.test.tsx[m
[1m+++ b/src/__tests__/content/QuickCreateDialog.directMode.test.tsx[m
[36m@@ -91,12 +91,11 @@[m [mdescribe('QuickCreateDialog direct generation mode', () => {[m
     expect(plan).not.toHaveProperty('week_start');[m
   });[m
 [m
[31m-  it('เมื่อเปิด Research ใช้ Original User Topic เป็น seed ไม่ใช่ topic ที่ AI เขียนใหม่', async () => {[m
[32m+[m[32m  it('ใช้ Original User Topic เป็น seed ของ Research ไม่ใช่ topic ที่ AI เขียนใหม่', async () => {[m
     const bodies = mockApi();[m
     renderDialog();[m
 [m
     fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));[m
[31m-    fireEvent.click(await screen.findByRole('switch'));[m
     fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: '  YouTube  ' } });[m
     fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));[m
 [m
[36m@@ -112,16 +111,19 @@[m [mdescribe('QuickCreateDialog direct generation mode', () => {[m
     expect(findBody(bodies, 'action=generate-article')!.research_job_id).toBe('job-1');[m
   });[m
 [m
[31m-  it('เมื่อปิด Research ยังใช้ direct mode และไม่แตะ endpoint research', async () => {[m
[32m+[m[32m  it('direct mode ยังผ่าน Mandatory Research flow — Research ปิดไม่ได้', async () => {[m
     const bodies = mockApi();[m
     renderDialog();[m
 [m
     fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));[m
[32m+[m[32m    // ไม่มี toggle ให้ปิด Research[m
[32m+[m[32m    expect(screen.queryByRole('switch')).toBeNull();[m
     fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: 'YouTube' } });[m
     fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));[m
 [m
     await waitFor(() => expect(findBody(bodies, 'action=generate-article')).toBeTruthy());[m
[31m-    expect(bodies.filter(b => b.url.includes('content-research.php'))).toHaveLength(0);[m
[32m+[m[32m    expect(bodies.filter(b => b.url.includes('content-research.php')).length).toBeGreaterThan(0);[m
     expect(findBody(bodies, 'action=generate-plan')!.generation_mode).toBe('direct');[m
[32m+[m[32m    expect(findBody(bodies, 'action=generate-article')!.research_job_id).toBe('job-1');[m
   });[m
 });[m
[1mdiff --git a/src/__tests__/content/QuickCreateDialog.research.test.tsx b/src/__tests__/content/QuickCreateDialog.research.test.tsx[m
[1mindex 7777e83..bc3eb90 100644[m
[1m--- a/src/__tests__/content/QuickCreateDialog.research.test.tsx[m
[1m+++ b/src/__tests__/content/QuickCreateDialog.research.test.tsx[m
[36m@@ -4,6 +4,11 @@[m [mimport { QueryClient, QueryClientProvider } from '@tanstack/react-query';[m
 import QuickCreateDialog from '@/components/content/dialogs/QuickCreateDialog';[m
 import { apiFetch } from '@/lib/api';[m
 [m
[32m+[m[32m/**[m
[32m+[m[32m * Research เป็น Mandatory Internal Flow — ผู้ใช้ปิดไม่ได้[m
[32m+[m[32m * ทุกการสร้าง Content ต้องผ่าน Fetch/Reuse → Analyze → Generate[m
[32m+[m[32m */[m
[32m+[m
 const toast = vi.fn();[m
 [m
 vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));[m
[36m@@ -26,56 +31,65 @@[m [masync function gotoFormAndCreate() {[m
   fireEvent.click(screen.getByRole('button', { name: /สร้างบ