## Context

Content item หนึ่งใบบนปฏิทิน (`content_items` แถวเดียว) กำหนด `platforms: string[]` ได้หลายแพลตฟอร์มพร้อมกัน (เช่น Facebook + Instagram) แต่มี `scheduled_date` เพียงค่าเดียวใช้ร่วมกันทุกแพลตฟอร์ม สถานะ "เผยแพร่แล้วหรือยัง" ต่อแพลตฟอร์มถูกเก็บแยกอยู่ใน `content_publish_queue.status` (คิว auto-dispatch) และ `content_schedules.status` (คิวจาก `plan-item-date` legacy path) ไม่ได้อยู่ใน `content_items` โดยตรง

`content_items.status`/`published_at` เป็น aggregate ที่เซ็ตเป็น `'published'` ก็ต่อเมื่อ**ทุก**แพลตฟอร์มที่เลือกไว้เผยแพร่ครบแล้วเท่านั้น (`sync_content_publish_status()` ใน `api/lib/publish-dispatch.php`) — ถ้าใช้ field นี้ตรงๆ จะพลาดเคส "เผยแพร่ไปแล้วบางแพลตฟอร์ม แต่ยังไม่ครบ" ซึ่งเป็นเคสที่ผู้ใช้ต้องการให้ล็อกด้วย

ระบบมีฟังก์ชัน `get_published_content_platforms(PDO $db, string $tenantId, string $contentId): array` อยู่แล้ว ที่คำนวณ "แพลตฟอร์มไหนของ content นี้เผยแพร่สำเร็จแล้วบ้าง" จากทั้งสองแหล่ง (`content_publish_queue` ด้วย `content_id`, `content_schedules` ด้วย `plan_item_id`) — `SchedulePublishDialog.tsx` ใช้ผลลัพธ์แบบเดียวกันนี้ผ่าน endpoint `content-publish.php?action=platform_status` อยู่แล้วเพื่อล็อก checkbox เลือก channel รายแพลตฟอร์ม

การแก้ `scheduled_date` ทำได้ 2 เส้นทางที่แยกกันคนละ endpoint และไม่มี guard ใดๆ ทั้งคู่ในปัจจุบัน:
1. ลากบนปฏิทิน → `ContentPlannerCalendar` → `handleDateDrop` → `action=plan-item-date` (PUT)
2. พิมพ์วันที่ในฟอร์มแก้ไขการ์ด → `ContentCardDialog` → `handleSaveCard` → `action=plans` (PUT, ส่ง `item_id`+`scheduled_date`)

ปฏิทินโหลด content item ทีเดียวทั้งเดือน/ไตรมาส/ปีผ่าน query เดียว (`plans` list ที่ join `content_items`) — ถ้าคำนวณสถานะล็อกด้วยการยิง `platform_status` แยกทีละใบจะกลายเป็น N+1 เมื่อมีหลายสิบรายการในมุมมองเดียว

## Goals / Non-Goals

**Goals:**
- ป้องกันการเปลี่ยน `scheduled_date` ของ content item ที่มีแพลตฟอร์มใดแพลตฟอร์มหนึ่งเผยแพร่สำเร็จแล้ว (ทั้ง 2 เส้นทางที่แก้ได้จริงในปัจจุบัน)
- ให้ backend เป็นแหล่งความจริงเดียว (single source of truth) ของกฎนี้ — frontend ปิดการโต้ตอบเพื่อ UX เท่านั้น ไม่ใช่การป้องกันเดียว
- ไม่เพิ่ม round-trip ต่อการ์ดเมื่อโหลดปฏิทิน (คำนวณสถานะล็อกใน query เดิมที่ hydrate รายการอยู่แล้ว)
- คงพฤติกรรมเดิมทุกกรณีสำหรับ content item ที่ยังไม่เผยแพร่แพลตฟอร์มใดเลย (รวมกรณีมีคิว `pending`/`processing` ตั้งไว้ล่วงหน้า)

**Non-Goals:**
- ไม่แยกการ์ดปฏิทินเป็นรายแพลตฟอร์ม (1 การ์ดยังคงแทน 1 content item เหมือนเดิม ไม่ใช่ 1 การ์ดต่อ 1 แพลตฟอร์ม)
- ไม่เพิ่ม per-platform `scheduled_date` (ยังคงมีวันที่เดียวต่อ content item เหมือนเดิม)
- ไม่แก้ไข schema ฐานข้อมูล — ไม่มีตาราง/คอลัมน์ใหม่
- ไม่แตะ logic การเผยแพร่จริง (`content-publish.php`, cron dispatch, `sync_content_publish_status`)
- ไม่แก้ไขกฎการถอยสถานะ `content_items.status` ที่ `content-published-status-guard` คุ้มครองอยู่แล้ว (คนละ endpoint คนละเงื่อนไข)

## Decisions

### 1. เงื่อนไขล็อก: "มีอย่างน้อย 1 แพลตฟอร์มเผยแพร่แล้ว" (any-published) ไม่ใช่ "ครบทุกแพลตฟอร์ม" (all-published)
ใช้ผลลัพธ์จาก `get_published_content_platforms()` ตรงๆ: ล็อกเมื่อ `count($published) > 0` ไม่ใช่รอให้ `content_items.status === 'published'`

**ทางเลือกที่พิจารณา**: ใช้ `content_items.published_at IS NOT NULL` (ล็อกเฉพาะเมื่อครบทุกแพลตฟอร์ม) — ง่ายกว่าเพราะเป็น column ตรงๆ ไม่ต้อง query ร่วม แต่ปฏิเสธไปเพราะปล่อยให้ item ที่ Facebook เผยแพร่ไปแล้วแต่ Instagram ยังไม่ไป ยังลาก/แก้วันที่ได้ ซึ่งขัดกับกฎที่ตกลงกันไว้ชัดเจนว่าต้องล็อกทันทีที่มีแพลตฟอร์มใดแพลตฟอร์มหนึ่งเผยแพร่แล้ว

### 2. คำนวณสถานะล็อกแบบ batch ใน query เดิมที่ hydrate `plan-items` แทนการยิง `platform_status` แยกทีละใบ
เพิ่ม correlated subquery (`EXISTS`) ต่อแถวใน SELECT ที่มีอยู่แล้ว 2 จุดใน `api/brand-content.php` (list เมื่อโหลด plan และ list ที่คืนหลัง generate-plan) แทนที่จะเรียก endpoint `content-publish.php?action=platform_status` ทีละ content_id:

```sql
EXISTS(
  SELECT 1 FROM content_publish_queue q
  WHERE q.content_id = ci.id AND q.status = 'sent'
) OR EXISTS(
  SELECT 1 FROM content_schedules cs
  WHERE cs.plan_item_id = ci.plan_item_id AND cs.status = 'sent'
) AS has_published_platform
```

ผลลัพธ์เป็น boolean เดียว (ไม่ใช่รายชื่อแพลตฟอร์ม) เพราะฝั่งปฏิทินต้องการแค่ "ล็อกทั้งใบไหม" — ไม่ต้อง breakdown รายแพลตฟอร์มเหมือน `SchedulePublishDialog` ที่ต้องล็อก checkbox แยกราย channel

**ทางเลือกที่พิจารณา**: เรียก `content-publish.php?action=platform_status` ต่อ item เมื่อ render — ปฏิเสธเพราะมุมมอง Quarter/Year โหลดหลายสิบ-ร้อยรายการพร้อมกัน จะกลายเป็น N+1 request ที่ไม่จำเป็น ในเมื่อ query hydrate เดิมมีอยู่แล้วและ index (`idx_content_id`, `idx_tenant_status_scheduled` บน `content_publish_queue`, และ index บน `content_schedules.plan_item_id`) รองรับ correlated subquery นี้ได้ถูก

### 3. Backend guard ซ้ำ 2 จุดด้วยเงื่อนไขเดียวกัน แทนการรวมเป็น endpoint เดียว
`action=plan-item-date` และ `action=plans` (PUT) ยังคงแยก endpoint เดิมตามโครงสร้างปัจจุบัน แต่ทั้งคู่เรียก `get_published_content_platforms()` ก่อน apply การเปลี่ยน `scheduled_date` แล้วปฏิเสธด้วย `jsonError('...', 409)` ถ้าไม่ว่าง

**ทางเลือกที่พิจารณา**: ทำ helper function กลาง เช่น `assert_scheduled_date_editable($db, $tenantId, $contentId)` ใน `api/lib/publish-dispatch.php` แล้วให้ทั้ง 2 จุดเรียกใช้ — เลือกแนวทางนี้เพื่อลด duplication และให้แก้จุดเดียวถ้าเงื่อนไขเปลี่ยนในอนาคต (ไม่ใช่ trade-off จริง เป็นแนวทางที่เลือกใช้)

### 4. HTTP 409 Conflict + ข้อความภาษาไทยระบุเหตุผล
ใช้ 409 (ไม่ใช่ 422 ที่ `content-published-status-guard` ใช้กับการถอยสถานะ) เพราะนี่คือ "คำขอขัดแย้งกับสถานะปัจจุบันของ resource" (state conflict) ไม่ใช่ validation error ของ input — แยกความหมายให้ frontend แยกแยะได้ถ้าจำเป็นในอนาคต

### 5. Frontend ใช้ field เดียว (`has_published_platform: boolean`) จาก list response ควบคุมทั้ง 3 จุด UI
`PlanItem.has_published_platform` เป็นแหล่งเดียวที่ `ContentPlannerCalendar`, `ContentCardDialog`, และ `ContentItemList` ใช้ตัดสินใจปิดการโต้ตอบ — ไม่คำนวณซ้ำในแต่ละคอมโพเนนต์ และไม่เรียก `platform_status` เพิ่มจากฝั่งปฏิทิน (dialog เดิมที่ใช้ `platform_status` อยู่แล้วคือ `SchedulePublishDialog` ซึ่งเป็นคนละบริบท ไม่ต้องเปลี่ยน)

## Risks / Trade-offs

- **[Risk]** `has_published_platform` เป็น snapshot ตอน query ปฏิทิน — ถ้า publish สำเร็จระหว่างที่ผู้ใช้เปิดปฏิทินค้างไว้ (real-time) หน้าจอจะยังแสดงว่าลากได้จนกว่าจะ refetch → **Mitigation**: backend guard เป็นแหล่งความจริงที่แท้จริงอยู่แล้ว ต่อให้ frontend ลากสำเร็จ (optimistic) request จะถูกปฏิเสธด้วย 409 และแสดง toast อธิบายเหตุผล ผู้ใช้ไม่มีทาง corrupt ข้อมูลได้จริง
- **[Risk]** เพิ่ม subquery ต่อแถวใน list query ที่ปัจจุบันดึงทีเดียวทั้ง plan — ถ้า plan มีหลายพันแถวอาจกระทบ performance → **Mitigation**: ทั้งสองตารางมี index รองรับอยู่แล้ว (`idx_content_id` บน `content_publish_queue`, index บน `content_schedules.plan_item_id` จาก foreign key) และ scope การ query นี้อยู่ระดับ 1 แผน (ไม่ใช่ทั้งระบบ) ขนาดข้อมูลจริงเล็กพอที่จะไม่เห็นผลกระทบวัดได้
- **[Trade-off]** ไม่ exposed รายชื่อแพลตฟอร์มที่ทำให้ล็อกในผลลัพธ์ปฏิทิน (มีแค่ boolean) — UI ไม่สามารถบอกผู้ใช้ตรงๆ ว่า "ล็อกเพราะ Facebook" ได้จาก field นี้อย่างเดียว หากต้องการ tooltip ละเอียดระดับนั้นในอนาคตต้องเรียก `platform_status` เพิ่มตอนเปิด dialog (ยอมรับ trade-off นี้เพราะ scope ปัจจุบันขอแค่ "ล็อกทั้งใบ" ไม่ได้ขอ breakdown)

## Migration Plan

ไม่มี schema migration (ไม่มีตาราง/คอลัมน์ใหม่) เป็นการเปลี่ยนเฉพาะ query/endpoint/UI logic — deploy พร้อมกับโค้ดฝั่ง frontend ในรอบเดียว (backend guard และ frontend disable ต้องขึ้นพร้อมกันไม่ให้ frontend ใหม่ไปเรียก backend เก่าที่ไม่มี field `has_published_platform` แล้ว UI พังเงียบ — ตรวจสอบว่า field ไม่มีค่า = ปฏิบัติเหมือน `false`/unlocked เพื่อ backward-compat ระหว่าง deploy)

Rollback: revert commit เดียวได้ทั้งหมด ไม่มี state ที่ค้างต้อง cleanup

## Open Questions

- ไม่มี — ข้อสงสัยหลักทั้งหมด (granularity any-vs-all, ขอบเขต drag-only vs ทุกช่องทาง, ผลกระทบต่อการ์ดอื่นในวันเดียวกัน) ถูกตัดสินใจร่วมกับผู้ใช้แล้วในขั้น explore ก่อนเปิด change นี้
