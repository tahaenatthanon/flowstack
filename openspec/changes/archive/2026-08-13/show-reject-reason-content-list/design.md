## Context

Tab "ผลงานทั้งหมด" (`ContentListTab`) แสดงรายการ content items และเมื่อคลิกแถวจะเปิด `ContentCardDialog` ผ่าน `asPlanItem(item)` ซึ่งแปลง `ContentItem` → `PlanItem` และส่ง `contentStatus={editItemLatest?.status}` ไปด้วย

เหตุผลที่ขอแก้ไข/ปฏิเสธ (`reject_reason`) ถูกบันทึกลง `content_items.reject_reason` แล้ว และ `GET /content-items.php` ส่งค่ากลับแล้ว (แก้ใน change `show-reject-reason`) แต่:
- `PlanItem` type ไม่มี field `reject_reason`
- `asPlanItem` ไม่ map ค่าดังกล่าว
- `ContentCardDialog` ไม่มีจุดแสดงเหตุผล

ส่วนหน้ารายละเอียด (`ContentDetailView`) แสดงเหตุผลแล้ว (จาก change `show-reject-reason`) — change นี้จึงครอบคลุมเฉพาะ Tab "ผลงานทั้งหมด"

**⚠️ Prerequisite (DB)**: ฐานข้อมูลจริงที่แอปใช้คือ `flowstack_dev` (ดู `.env` → `DB_NAME=flowstack_dev`) แต่ migration เอกสารใน `CLAUDE.md` ใช้ `mysql -u root flowstack ...` — หาก migration `2026_08_11_114953_add_reject_reason.sql` ถูกรันไปที่ `flowstack` (ชื่อเก่า) แทนที่จะเป็น `flowstack_dev` คอลัมน์ `reject_reason` จะไม่มีอยู่จริง → เหตุผลจะไม่ถูกบันทึกและไม่แสดง ทั้งๆ ที่โค้ด frontend/backend ถูกต้องแล้ว

## Goals / Non-Goals

**Goals:**
- ให้เหตุผลที่ขอแก้ไข/ปฏิเสธแสดงใน `ContentCardDialog` (Tab "ผลงานทั้งหมด") เช่นเดียวกับ `ContentDetailView`

**Non-Goals:**
- ไม่เปลี่ยน schema (`reject_reason` มีอยู่แล้วใน source)
- ไม่เปลี่ยน logic การบันทึกเหตุผล
- ไม่แตะ `ContentDetailView` (แสดงแล้ว)

## Decisions

### Decision 1: ส่งเหตุผลผ่าน `PlanItem.reject_reason` (ไม่เพิ่ม prop ใหม่ให้ `ContentCardDialog`)

`ContentCardDialog` รับ `existingItem: PlanItem` อยู่แล้ว — เพิ่ม field `reject_reason` ใน `PlanItem` แล้ว `asPlanItem` map ค่าให้ ซึ่ง `ContentCardDialog` อ่านได้ทันทีโดยไม่ต้องเพิ่ม prop ใหม่

**Rationale**: กระทบน้อยที่สุด และ `contentStatus` ที่มีอยู่แล้วใช้ร่วมกับ `reject_reason` ในการตัดสินใจแสดงได้พอดี

**Alternatives considered**:
- เพิ่ม prop `rejectReason?: string` แยกให้ `ContentCardDialog` → ต้องแก้ signature ของ component + ทุกจุดเรียกใช้ (หลายที่) ซ้ำซ้อนกับข้อมูลที่มีใน `existingItem` แล้ว

### Decision 2: แสดงแบนเนอร์ amber ต้นๆ ของ scrollable body (เหนือ ArticleEditor)

วางแบนเนอร์ใน `<div className="flex-1 overflow-y-auto">` ก่อน section "เนื้อหาบทความ" — ใช้รูปแบบเดียวกับแบนเนอร์ใน `ContentDetailView`

**Rationale**: เห็นได้ทันทีเมื่อเปิดกล่อง และ consistency กับ `ContentDetailView`

### Decision 3: แสดงเหตุผลในแถวรายการโดยตรง (ไม่ต้องคลิกเปิดกล่อง)

ใน `ContentListTab` แสดงเหตุผลใต้ชื่อรายการเป็นข้อความ amber (`text-amber-700 dark:text-amber-300`) พร้อม label "เหตุผลขอแก้ไข:" / "เหตุผลปฏิเสธ:" เมื่อสถานะเป็น `revision`/`rejected` และมี `reject_reason` — ใช้ `line-clamp-2` ตัดความยาว และ `title` attribute ให้ hover ดูเต็ม

**Rationale**: ผู้สร้างเนื้อหาเห็นเหตุผลได้ทันทีในรายการ ไม่ต้องคลิกเปิดกล่องทีละรายการ

## Risks / Trade-offs

- [เหตุผลยาวมากอาจเกะกะ editor] → ใช้ `whitespace-pre-wrap` + `break-words`
- [ต้องแก้ 3 ไฟล์] → เป็นการแก้เล็กน้อย ตรงไปตรงมา ไม่มี side effect
