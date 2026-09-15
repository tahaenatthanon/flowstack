## Context

สองบั๊กนี้เจอระหว่างสำรวจโค้ดหน้าแคมเปญอีเมลในรอบก่อนหน้า ไม่เกี่ยวข้องกันทางเทคนิค แต่รวมไว้ใน change เดียวตามที่ผู้ร้องขอเลือก — ทั้งคู่มีความเสี่ยงต่ำและ scope แคบ

**เรื่องที่ 1 — Type ผิด:** `CustomerStats.customers[]` ใน `useMarketing.ts` ประกาศ field ที่ไม่มีอยู่จริงในสิ่งที่ `api/customer-email-stats.php` ส่งกลับมา (`getAllCustomersEmailStats()`, บรรทัด 205-221) ยืนยันด้วย `npx tsc --noEmit` แล้วว่ามี TS2339 error 22 จุดในไฟล์ `MarketingPage.tsx` ที่ใช้ type นี้ (แต่ไม่กระทบ build จริงเพราะ Vite ใช้ esbuild transpile-only ไม่ typecheck)

**เรื่องที่ 2 — `{{subject}}` ใช้ไม่ได้:** `processMergeTags()` ใน `email-utils.php` ถูกเรียกแค่ 3 จุด ทั้งหมดอยู่ใน `sendCampaign()` ของ `email-campaigns.php` (บรรทัด 664, 669, 676) ไม่มีที่อื่นเรียกใช้เลย — blast radius ของการเปลี่ยน signature ฟังก์ชันนี้จึงเล็กมาก

## Goals / Non-Goals

**Goals:**
- `CustomerStats` interface ตรงกับ response จริงของ `customer-email-stats.php` ทุก field รวมถึง field ที่ frontend ยังไม่ได้ใช้ตอนนี้ (เพื่อความสมบูรณ์และรองรับการใช้งานในอนาคต)
- `{{subject}}` ใช้งานได้จริงเหมือน merge tag อื่น ทั้งใน `body_html` และ `body_text`
- ไม่มีการเปลี่ยนแปลงพฤติกรรม runtime ที่ผู้ใช้สังเกตเห็นได้ ยกเว้นหัวข้อ `<title>` ของอีเมลที่ส่งจริง (ซึ่งควรจะถูกต้องอยู่แล้วแต่แรก)

**Non-Goals:**
- ไม่แก้ type อื่นในไฟล์ `useMarketing.ts` ที่ไม่เกี่ยวกับ `CustomerStats`
- ไม่เพิ่ม merge tag ใหม่อื่นนอกจาก `{{subject}}` (เช่น ไม่เพิ่ม `{{campaign_name}}` แม้จะเป็นแนวคิดที่คล้ายกัน — อยู่นอก scope ของบั๊กที่รายงาน)
- ไม่แก้ปัญหาการแสดงผล merge tag ที่ไม่รู้จัก (เช่น พิมพ์ `{{typo}}` ผิด) ให้เตือนผู้ใช้ — เป็นเรื่องคนละ scope

## Decisions

**Decision 1 — เขียน `CustomerStats` ใหม่ทั้งหมด ให้ครบทุก field ที่ API ส่งจริง ไม่ใช่แค่ field ที่ใช้อยู่**
```ts
// เดิม (ผิดทั้งหมด)
export interface CustomerStats {
  customers: Array<{
    id: string; first_name: string; last_name: string; email: string; company_name: string;
    total_delivered: number; total_opens: number; total_clicks: number;
    last_open_at: string | null; last_click_at: string | null;
  }>;
  total: number;
}

// ใหม่ (ตรงกับ customer-email-stats.php:206-221)
export interface CustomerStats {
  customers: Array<{
    id: string; first_name: string; last_name: string; email: string; company_name: string;
    total_emails: number; delivered: number; opened: number; clicked: number; bounced: number;
    open_rate: number; click_rate: number;
    last_sent: string | null; last_opened: string | null; last_clicked: string | null;
  }>;
  total: number;
}
```
`last_sent`/`last_opened`/`last_clicked` เป็น `string | null` เพราะมาจาก `MAX(et.sent_at)`/`MAX(et.opened_at)`/`MAX(et.clicked_at)` บน `LEFT JOIN email_tracking` — ลูกค้าที่ไม่เคยถูกส่งอีเมลเลยจะได้ `NULL` จาก SQL ทางเลือกที่พิจารณา: เขียน type แค่ field ที่ `MarketingPage.tsx` ใช้อยู่ตอนนี้ (`delivered`, `opened`, `clicked`, `open_rate`, `click_rate`, `last_sent`) — ตัดออก เพราะ type ควรสะท้อนความจริงของ contract ทั้งหมด ไม่ใช่แค่ subset ที่บังเอิญถูกใช้ตอนนี้ (field ที่ตกหล่นจาก type จะกลายเป็นปัญหาเดิมซ้ำถ้ามีโค้ดใหม่มาใช้ field เหล่านั้นในอนาคต)

**Decision 2 — เพิ่ม `{{subject}}` เป็น parameter ใหม่ของ `processMergeTags()` ไม่ใช่ patch แยก**
ทางเลือกที่พิจารณา: ทำ `str_replace('{{subject}}', $subject, $htmlBody)` แยกต่างหากใน `sendCampaign()` โดยไม่แตะ `processMergeTags()` — ตัดออก เพราะจะทำให้ `{{subject}}` เป็น "case พิเศษ" ที่ซ่อนอยู่นอกระบบ merge tag หลัก ไม่ปรากฏถ้ามีคน grep หา tag ที่รองรับทั้งหมดในฟังก์ชันเดียว เลือกเพิ่มเป็น parameter ใหม่แทน:
```php
// เดิม
function processMergeTags($content, $customer, $company = null, $companySettings = null) {
    ...
    $replacements = [
        '{{first_name}}' => $customer['first_name'] ?? '',
        ...
    ];

// ใหม่
function processMergeTags($content, $customer, $company = null, $companySettings = null, $subject = '') {
    ...
    $replacements = [
        '{{first_name}}' => $customer['first_name'] ?? '',
        ...
        '{{subject}}' => $subject,
    ];
```
`$subject = ''` เป็นค่า default ทำให้ backward-compatible — ไม่กระทบผู้เรียกเดิมที่ไม่ได้ส่ง parameter นี้มา (ถ้ามีในอนาคต) แค่ `{{subject}}` จะไม่ถูกแทนที่ (เหลือเป็น literal text เหมือนเดิม) ถ้าไม่ส่งมา ไม่ throw error

**Decision 3 — อัปเดตเฉพาะ call site ที่ประมวลผล body (ไม่ใช่ตัว subject เอง)**
ที่ `sendCampaign()`:
```php
// เดิม
$subject    = processMergeTags($campaign['subject'],   $recipient, $company, $companySettings);
$rawHtml    = $campaign['body_html'] ?? '';
...
$htmlBody   = processMergeTags($rawHtml, $recipient, $company, $companySettings);
...
$textBody   = processMergeTags($campaign['body_text'] ?? '', $recipient, $company, $companySettings);

// ใหม่
$subject    = processMergeTags($campaign['subject'],   $recipient, $company, $companySettings);  // ไม่เปลี่ยน — subject อ้างอิงตัวเองไม่ได้
$rawHtml    = $campaign['body_html'] ?? '';
...
$htmlBody   = processMergeTags($rawHtml, $recipient, $company, $companySettings, $subject);
...
$textBody   = processMergeTags($campaign['body_text'] ?? '', $recipient, $company, $companySettings, $subject);
```
บรรทัดแรก (คำนวณ `$subject` เอง) ไม่ส่ง parameter ที่ 5 เพราะเป็น chicken-and-egg (จะเอา subject ที่ยังไม่มีมาแทนที่ตัวเอง) — เป็น edge case ที่ไม่มีความหมายในทางปฏิบัติ (ไม่มีเหตุผลที่หัวข้ออีเมลจะมี `{{subject}}` อ้างถึงตัวเอง) จึงปล่อยให้เหลือเป็น literal text ถ้าเกิดขึ้นจริง ไม่ต้องจัดการพิเศษ

## Risks / Trade-offs

- **[Risk] Regression ต่อ test ที่มีอยู่** → ตรวจแล้วไม่มี test ใน `src/__tests__/` อ้างอิง `CustomerStats`, `useMarketing`, `processMergeTags`, หรือ `email-utils.php` จึงไม่คาดว่าจะพัง
- **[Risk] แคมเปญที่เคยส่งไปแล้วก่อนแก้ ยังมี `{{subject}}` ค้างอยู่ในบันทึกที่ส่งไปแล้ว** → **Mitigation:** ไม่สามารถแก้อีเมลที่ส่งไปแล้วได้อยู่แล้ว (ธรรมชาติของอีเมล) การแก้นี้มีผลกับแคมเปญที่ส่ง**หลังจาก**แก้เท่านั้น ไม่ต้อง migrate ข้อมูลเก่า
- **[Risk] เปลี่ยน type `CustomerStats` อาจทำให้ TypeScript เจอ error ใหม่ในโค้ดที่ใช้ type นี้อยู่** → **Mitigation:** ตรวจแล้วว่า `MarketingPage.tsx` (ผู้ใช้ type นี้ที่เดียว) อ้างอิง field ตามชื่อจริงอยู่แล้ว (`delivered`, `opened`, ฯลฯ) การแก้ type ให้ตรงกับที่ใช้จริงจะทำให้ TS2339 error ที่เคยมีอยู่ (แต่ไม่มีใครเห็นเพราะ Vite ไม่ typecheck) หายไป ไม่ใช่เพิ่มขึ้น

## Migration Plan

1. แก้ `useMarketing.ts` (frontend type, ไม่กระทบ backend)
2. แก้ `email-utils.php` (เพิ่ม parameter) แล้วแก้ `email-campaigns.php` (2 call site) พร้อมกัน — สองไฟล์นี้ต้อง deploy พร้อมกันเสมอ (signature เปลี่ยน)
3. แก้คอมเมนต์ documentation ใน `emailTemplates.ts`
4. ไม่ต้องใช้ feature flag ไม่มี DB migration
5. Rollback: revert commit ที่เกี่ยวข้อง ไม่มีข้อมูลถูกทำลาย

## Open Questions

- ไม่มีคำถามค้างอยู่ — ทั้งสองเรื่องมีทางแก้ทางเดียวที่สมเหตุสมผล (ตกลง Option A ของ `{{subject}}` กับผู้ร้องขอแล้วระหว่าง explore)
