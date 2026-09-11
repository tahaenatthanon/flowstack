## Why

Content Planner (`ContentPlannerCalendar` และ `ContentItemList`) มีตัวกรองแพลตฟอร์ม (`platformFilter`) ที่เทียบ `item.platform === platformFilter` แบบ exact-match ตรงๆ แต่ `item.platform` เป็นสตริง comma-joined เมื่อ content item เลือกไว้หลายแพลตฟอร์ม (เช่น `"facebook,linkedin"`) — การเทียบแบบนี้ไม่มีทาง match กับตัวกรองแพลตฟอร์มเดี่ยวได้เลย แม้ item นั้นจะมีแพลตฟอร์มที่เลือกกรองอยู่จริง ทำให้กดกรอง "Facebook" แล้ว item ที่เลือกทั้ง Facebook+อื่นๆ หายไปจากผลกรองอย่างเงียบๆ ทั้งที่ควรเจอ

บั๊กนี้เป็นคลาสเดียวกับที่เพิ่งแก้ไปในหลายจุดของระบบวันนี้ (`ContentCardDialog`, `ContentPlannerCalendar`/`ContentItemList` ฝั่งแสดงผล) — ต่างกันแค่ครั้งนี้อยู่ที่ตรรกะการ**กรอง** ไม่ใช่การ**แสดงผล** และพบว่าอยู่ใน 2 ไฟล์ที่ใช้ `platformFilter` ร่วมกัน (ทั้งปฏิทินและมุมมองรายการ) ไม่ใช่แค่จุดเดียวที่เคย flag ไว้ตอนแรก

## What Changes

- `ContentPlannerCalendar.tsx` (บรรทัด ~61): เปลี่ยนจาก `item.platform !== platformFilter` เป็นการ parse `item.platforms ?? item.platform` แล้วเช็คว่า `platformFilter` อยู่ในรายการที่ parse ได้หรือไม่ (`.includes()`)
- `ContentItemList.tsx` (บรรทัด ~53-55): เปลี่ยนตรรกะเดียวกัน
- ใช้ `parsePlatforms()` ที่ export อยู่แล้วจาก `PlatformBadgeList.tsx` เป็นตัว parse — ไม่เขียน parsing logic ใหม่ซ้ำอีก
- เพิ่ม test ครอบคลุมเคส content item หลายแพลตฟอร์มกับ `platformFilter` ทั้ง 2 ไฟล์

## Capabilities

### New Capabilities
- `content-planner-platform-filter`: กฎการกรองแพลตฟอร์มของ Content Planner ที่ต้องแมตช์ content item ตามรายการแพลตฟอร์มที่ parse แล้ว ไม่ใช่ค่าดิบทั้งก้อน

### Modified Capabilities
(ไม่มี — ไม่มี capability เดิมใน `openspec/specs/` ที่ครอบคลุมพฤติกรรมการกรองแพลตฟอร์มนี้มาก่อน)

## Impact

- **Frontend เท่านั้น**: `src/components/content/ContentPlannerCalendar.tsx`, `src/components/content/ContentItemList.tsx`
- **ไม่กระทบ**: backend, schema ฐานข้อมูล, การแสดงผล badge/ไอคอนที่เพิ่งแก้ไปแล้ว (`content-platform-badge-display`, `content-type-badge-display`) — งานนี้แก้เฉพาะตรรกะการกรอง ไม่แตะการแสดงผล
- **ไม่กระทบ**: `ContentApprovalTab.tsx`/`ContentListTab.tsx` — มีบั๊กคลาสเดียวกันแต่อยู่คนละหน้า (`/content`) ถูก flag เป็นงานแยกต่างหากแล้ว (`task_14878863`, `task_1b7b03a8`) ไม่รวมใน change นี้
