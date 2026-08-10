# Helpdesk AI — Auto-Task, Timesheet & AI Enhancements ✅ DONE (2026-05-18)

> **Goal:** ครบชุด AI workflow ใน Helpdesk: (1) `ai-suggest` ทำงานครบถ้วนสำหรับ ticket triage (2) `autoCreateTaskForTicket` ถูก trigger เสมอเมื่อเหมาะสม (3) เพิ่ม auto-timesheet เมื่อ ticket ปิด (4) เพิ่ม AI summary สำหรับ ticket resolution

---

## Root Cause Analysis — สถานะปัจจุบัน

| Feature | สถานะ | หมายเหตุ |
|---------|--------|---------|
| `ai-suggest` — triage suggestion | ✅ มี | GET `?action=ai-suggest` — suggest category/priority |
| `autoCreateTaskForTicket()` | ✅ มี | เรียกเมื่อ status → `in-progress` |
| Task auto-close เมื่อ ticket resolved | ✅ มี | UPDATE task status + actual_hours |
| **Auto-timesheet entry เมื่อ ticket ปิด** | ❌ ไม่มี | hours ถูก capture ใน task แต่ไม่สร้าง timesheet row |
| **AI summary/closing note** | ❌ ไม่มี | ไม่มี auto-generate summary เมื่อ resolve |
| **Frontend แสดง AI suggestions** | ❓ ต้องตรวจ | มี UI แสดง category/priority จาก ai-suggest? |
| **Trigger `ai-suggest` อัตโนมัติเมื่อสร้าง ticket** | ❌ ไม่มี | ต้อง call manual |

---

## File Map

**Modified:**
- `api/support-tickets.php` — เพิ่ม auto-timesheet, AI closing note, auto-trigger ai-suggest
- `src/components/TicketDetailSheet.tsx` หรือ ticket detail UI — แสดง AI suggestions อัตโนมัติ
- `src/pages/SupportPage.tsx` — เพิ่ม AI triage badge

---

## Task 1: Auto-Timesheet เมื่อ Ticket Resolved/Closed

**Problem:** เมื่อ ticket → resolved/closed, code ปัจจุบัน update task.actual_hours แต่ไม่สร้าง `timesheet_entries` row ดังนั้น engineer ไม่เห็น hours ใน Timesheet module

- [ ] **Step 1: เพิ่ม timesheet creation ใน status transition handler**

หา section `// Transition to resolved/closed` (line ~454 ใน support-tickets.php) และเพิ่มหลัง UPDATE tasks:

```php
// Transition to resolved/closed → mark linked task completed + create timesheet entry
if (in_array($newStatus, ['resolved','closed'], true) && !empty($prevTicket['task_id'])) {
    try {
        // Compute hours worked
        $hoursWorked = 0.5;
        if (!empty($prevTicket['first_response_at'])) {
            $mins = max(0, (strtotime('now') - strtotime($prevTicket['first_response_at'])) / 60);
            $hoursWorked = max(0.5, round($mins / 60, 1));
        }

        // Update task
        $db->prepare("
            UPDATE tasks
            SET status = 'completed',
                completed_date = CURDATE(),
                actual_hours = COALESCE(actual_hours, ?),
                updated_at = NOW()
            WHERE id = ? AND deleted_at IS NULL AND status != 'completed'
        ")->execute([$hoursWorked, $prevTicket['task_id']]);

        // ── NEW: Create timesheet entry ──────────────────────────────
        $tsId   = generateUUID();
        $taskInfo = $db->prepare('SELECT user_id, project_id FROM tasks WHERE id = ?');
        $taskInfo->execute([$prevTicket['task_id']]);
        $taskRow = $taskInfo->fetch();

        if ($taskRow && $taskRow['user_id']) {
            $db->prepare("
                INSERT IGNORE INTO timesheet_entries
                  (id, tenant_id, user_id, task_id, project_id, work_date, hours, description, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, 'ticket_auto', NOW(), NOW())
            ")->execute([
                $tsId,
                $tenantId,
                $taskRow['user_id'],
                $prevTicket['task_id'],
                $taskRow['project_id'],
                $hoursWorked,
                'ปิด Ticket #' . ($prevTicket['ticket_number'] ?? $id),
            ]);

            // Update ticket with linked timesheet
            $db->prepare("UPDATE support_tickets SET timesheet_id = ? WHERE id = ?")->execute([$tsId, $id]);
        }
    } catch (\Throwable $e) {
        error_log('[support task-close] ' . $e->getMessage());
    }
}
```

> **หมายเหตุ:** ต้องตรวจ `timesheet_entries` table schema ก่อนว่าใช้ column ชื่ออะไร — อาจเป็น `logged_hours`, `hours`, `actual_hours`

- [ ] **Step 2: เพิ่ม `timesheet_id` column ใน `support_tickets` (ถ้ายังไม่มี)**

```sql
-- database/migrations/2026_05_15_000003_support_ticket_timesheet_link.sql
ALTER TABLE `support_tickets`
  ADD COLUMN IF NOT EXISTS `timesheet_id` CHAR(36) DEFAULT NULL
  COMMENT 'Linked timesheet entry created on ticket close';
```

---

## Task 2: Auto-Trigger `ai-suggest` เมื่อสร้าง Ticket ใหม่

**Problem:** ตอนนี้ `ai-suggest` ต้องเรียก manual — ถ้า trigger อัตโนมัติตอนสร้าง ticket ใหม่ จะช่วย triage ได้เร็วขึ้น

- [ ] **Step 1: เพิ่ม async AI suggest ใน POST handler**

หา section POST (สร้าง ticket ใหม่) และเพิ่มหลัง INSERT:

```php
// ── Non-blocking AI triage (best-effort) ─────────────────────────────────────
try {
    $ai = supportResolveAi($db);
    if ($ai) {
        $ticketText = "{$body['title']}\n{$body['description']}";
        $suggPayload = json_encode([
            'model'    => $ai['model'],
            'messages' => [[
                'role'    => 'user',
                'content' => "วิเคราะห์ support ticket นี้:\n---\n$ticketText\n---\n"
                           . "ตอบ JSON เท่านั้น: "
                           . '{"category_suggested":"Hardware|Software|Network|Account|Other",'
                           . '"priority_suggested":"critical|high|medium|low",'
                           . '"summary":"สรุปปัญหา 1 บรรทัด"}',
            ]],
            'stream' => false,
        ]);
        $suggCh = curl_init($ai['base_url'] . '/chat/completions');
        curl_setopt_array($suggCh, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $suggPayload,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $ai['api_key'],
            ],
        ]);
        $suggRaw = curl_exec($suggCh);
        curl_close($suggCh);
        $suggResp = json_decode($suggRaw, true);
        $content  = $suggResp['choices'][0]['message']['content'] ?? '';
        if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
            $sugg = json_decode($m[0], true);
            if (!empty($sugg['priority_suggested'])) {
                $db->prepare("
                    UPDATE support_tickets
                    SET ai_suggested_priority = ?, ai_suggested_category = ?, ai_summary = ?
                    WHERE id = ?
                ")->execute([
                    $sugg['priority_suggested'],
                    $sugg['category_suggested'] ?? null,
                    $sugg['summary'] ?? null,
                    $newTicketId,
                ]);
            }
        }
    }
} catch (\Throwable $e) {
    error_log('[ticket ai-auto-suggest] ' . $e->getMessage());
}
```

- [ ] **Step 2: เพิ่ม columns ใน `support_tickets` (ถ้ายังไม่มี)**

```sql
-- database/migrations/2026_05_15_000003_support_ticket_timesheet_link.sql (ต่อ)
ALTER TABLE `support_tickets`
  ADD COLUMN IF NOT EXISTS `ai_suggested_priority` VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `ai_suggested_category` VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `ai_summary`             TEXT        DEFAULT NULL;
```

---

## Task 3: AI Closing Note เมื่อ Ticket Resolved

- [ ] **Step 1: เพิ่ม auto-generate closing summary**

หา section `// Transition to resolved` และเพิ่ม:

```php
// ── AI closing summary ────────────────────────────────────────────────────────
if (in_array($newStatus, ['resolved','closed'], true)) {
    try {
        $ai = supportResolveAi($db);
        if ($ai && empty($prevTicket['resolution_note'])) {
            // Load comments for context
            $comments = $db->prepare("
                SELECT c.body, u.display_name
                FROM support_comments c LEFT JOIN users u ON u.id = c.user_id
                WHERE c.ticket_id = ? ORDER BY c.created_at DESC LIMIT 5
            ");
            $comments->execute([$id]);
            $commentText = implode("\n", array_map(
                fn($c) => "[{$c['display_name']}]: {$c['body']}",
                $comments->fetchAll()
            ));

            $closePayload = json_encode([
                'model'    => $ai['model'],
                'messages' => [[
                    'role'    => 'user',
                    'content' => "สรุปการแก้ไข ticket นี้เป็น 1-2 ประโยคภาษาไทย:"
                               . "\nชื่อ: {$prevTicket['title']}"
                               . "\nปัญหา: {$prevTicket['description']}"
                               . "\nความคิดเห็นล่าสุด:\n$commentText",
                ]],
                'stream' => false,
            ]);
            $closeCh = curl_init($ai['base_url'] . '/chat/completions');
            curl_setopt_array($closeCh, [
                CURLOPT_POST => true, CURLOPT_POSTFIELDS => $closePayload,
                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $ai['api_key'],
                ],
            ]);
            $closeRaw  = curl_exec($closeCh); curl_close($closeCh);
            $closeResp = json_decode($closeRaw, true);
            $note = trim($closeResp['choices'][0]['message']['content'] ?? '');
            if ($note) {
                $db->prepare("UPDATE support_tickets SET resolution_note = ? WHERE id = ?")->execute([$note, $id]);
            }
        }
    } catch (\Throwable $e) {
        error_log('[ticket ai-close] ' . $e->getMessage());
    }
}
```

- [ ] **Step 2: เพิ่ม `resolution_note` column ถ้ายังไม่มี**

```sql
ALTER TABLE `support_tickets`
  ADD COLUMN IF NOT EXISTS `resolution_note` TEXT DEFAULT NULL;
```

---

## Task 4: Frontend แสดง AI Suggestions

- [ ] **Step 1: ตรวจสอบ ticket detail UI**

หาไฟล์ที่แสดง ticket detail (น่าจะ `TicketDetailSheet.tsx` หรือ `SupportPage.tsx`) และตรวจว่ามี `ai_suggested_priority`, `ai_summary` แสดงไหม

- [ ] **Step 2: เพิ่ม AI badge ถ้ายังไม่มี**

```tsx
{ticket.ai_suggested_priority && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <span>✨ AI แนะนำ:</span>
    <Badge variant="outline" className="text-xs">
      {ticket.ai_suggested_priority}
    </Badge>
    {ticket.ai_summary && <span className="ml-1">{ticket.ai_summary}</span>}
  </div>
)}
```

---

## Final Verification

- [ ] สร้าง ticket ใหม่ → รอ ~5 วิ → ตรวจว่า `ai_suggested_priority` ถูก populate
- [ ] เปลี่ยน status → `in-progress` → ตรวจว่า task ถูกสร้างใน Base Calendar
- [ ] เปลี่ยน status → `resolved` → ตรวจว่า:
  - task ถูกปิด (status=completed)
  - timesheet entry ถูกสร้าง
  - `resolution_note` ถูก populate
- [ ] `php -l api/support-tickets.php`
- [ ] `pnpm build`
