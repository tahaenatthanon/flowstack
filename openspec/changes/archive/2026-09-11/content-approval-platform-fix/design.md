## Context

`ContentApprovalTab.tsx` (Tab "รายการอนุมัติ" ในหน้า `/content`) มีบั๊กคลาสเดียวกับที่เพิ่งแก้ใน `ContentPlannerCalendar.tsx`/`ContentItemList.tsx` (`openspec/changes/archive/2026-09-11/content-planner-platform-filter-fix/`) — ปฏิบัติกับ `content_items.platform` (สตริง comma-joined เมื่อเลือกหลายแพลตฟอร์ม) เหมือนเป็นค่าเดี่ยวเสมอ ในไฟล์นี้บั๊กปรากฏ 3 จุดที่เชื่อมกัน: ตัวกรอง (บรรทัด ~92), ที่มาของตัวเลือก dropdown (`usedPlatforms`, บรรทัด ~157), และการแสดงผลคอลัมน์ตาราง (บรรทัด ~289, ~303-306) `parsePlatforms()` (export จาก `src/components/content/PlatformBadgeList.tsx`) มีอยู่แล้วและเป็นทางแก้มาตรฐานของบั๊กคลาสนี้ในโปรเจกต์

## Goals / Non-Goals

**Goals:**
- แก้ทั้ง 3 จุดใน `ContentApprovalTab.tsx` ให้ parse แพลตฟอร์มก่อนกรอง/สร้างตัวเลือก/แสดงผลเสมอ โดยใช้ `parsePlatforms()` ที่มีอยู่แล้ว
- คอลัมน์ตารางแสดง badge แพลตฟอร์มแรก + `+N` เมื่อมีมากกว่า 1 แพลตฟอร์ม โดยไม่เปลี่ยนความสูงแถวหรือ layout ตาราง

**Non-Goals:**
- ไม่ย้าย `parsePlatforms()` ไป `src/lib/` (แยกเป็น `task_1b7b03a8`)
- ไม่แตะ `getItemPlatforms()` ส่วนตัวใน `ContentListTab.tsx` (แยกเป็น `task_1b7b03a8`)
- ไม่เพิ่ม tooltip โชว์รายชื่อแพลตฟอร์มที่เหลือใต้ `+N` — เก็บ scope เท่าที่ proposal ระบุ ถ้าต้องการ UX เพิ่มเติมค่อยทำเป็นการเปลี่ยนแปลงถัดไป
- ไม่เปลี่ยนพฤติกรรมของ Type Filter, Status Filter, หรือ workflow อนุมัติ/ปฏิเสธ/ขอแก้ไข

## Decisions

- **ใช้ `parsePlatforms(item.platforms ?? item.platform)` เป็นจุดร่วมเดียวสำหรับทั้ง 3 จุด** — สอดคล้องกับรูปแบบที่ใช้ใน `ContentPlannerCalendar.tsx`/`ContentItemList.tsx` แล้ว ทำให้พฤติกรรม parse เหมือนกันทั้งระบบ (ยกเว้น `ContentListTab.tsx` ที่มี `getItemPlatforms()` ของตัวเองซึ่งเป็นงาน refactor แยก)
- **Dropdown ตัวเลือก (`usedPlatforms`) ใช้ `flatMap` แล้ว dedupe ผ่าน `Set`** แทน `map` ตรงๆ — เพื่อให้ item หลายแพลตฟอร์มสร้างตัวเลือกแยกทีละแพลตฟอร์มแทนที่จะสร้างตัวเลือกเป็นสตริงรวม
- **คอลัมน์ตารางแสดง "badge แรก + `+N`"** (ไม่ใช่ wrap badge ครบทุกอัน) — ตามที่ผู้ใช้ยืนยันระหว่าง explore เพื่อคงความสูงแถวเดิมในตารางที่ layout แน่นอยู่แล้ว (ต่างจาก `ContentListTab.tsx` ที่เป็น card layout มีพื้นที่ wrap ได้) ลำดับแพลตฟอร์มที่แสดงเป็น badge แรกอิงตามลำดับที่ `parsePlatforms()` คืนมา (ลำดับตามข้อมูลเดิม ไม่ sort ใหม่)
- **ไม่ใส่ tooltip ที่ `+N`** — เป็นการตัดสินใจจำกัด scope ให้ตรงกับ 3 บั๊กที่ระบุใน proposal เท่านั้น ไม่เพิ่มฟีเจอร์ใหม่ระหว่างแก้บั๊ก

## Risks / Trade-offs

- [Risk] "badge แรก + `+N`" ซ่อนชื่อแพลตฟอร์มที่เหลือจากมุมมองแรกเห็น → Mitigation: ผู้ใช้ที่ต้องการดูครบสามารถคลิกแถวเพื่อเปิด Content Detail Dialog ซึ่งมีอยู่แล้ว (`ContentDetailView` แสดงแพลตฟอร์มครบผ่าน `PlatformBadgeList` — capability `content-platform-badge-display`)
- [Risk] การเปลี่ยน `usedPlatforms` เป็น `flatMap` อาจทำให้ dropdown ยาวขึ้นถ้ามี item หลายแพลตฟอร์มจำนวนมาก → Mitigation: เป็นพฤติกรรมที่ถูกต้องตามข้อมูลจริง (ตัวเลือกที่ยาวขึ้นสะท้อนแพลตฟอร์มที่มีอยู่จริงในระบบ) ไม่ใช่ regression

## Migration Plan

ไม่มี migration ฐานข้อมูลหรือ API — เป็นการแก้ logic ฝั่ง frontend ในไฟล์เดียว ปรับใช้ได้ทันทีหลัง build/deploy ตามปกติ ไม่ต้อง rollback plan พิเศษ (revert commit เดียวพอ หากพบปัญหา)

## Open Questions

(ไม่มี — การตัดสินใจด้านดีไซน์ที่เคยเปิดไว้ระหว่าง explore ได้ข้อสรุปแล้ว)
