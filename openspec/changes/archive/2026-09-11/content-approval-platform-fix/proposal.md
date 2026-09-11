## Why

`ContentApprovalTab.tsx` (Tab "รายการอนุมัติ" ในหน้า `/content`) เทียบและแสดงผล `content_items.platform` เหมือนเป็นค่าเดี่ยวเสมอ ทั้งที่ฟิลด์นี้เป็นสตริง comma-joined เมื่อ content item เลือกไว้หลายแพลตฟอร์ม (เช่น `"facebook,linkedin"`) — ทำให้ item ที่มีหลายแพลตฟอร์มหายไปจากตัวกรอง, dropdown ตัวเลือกแพลตฟอร์มโชว์ค่าดิบผิดๆ, และคอลัมน์ตารางไม่แสดงแพลตฟอร์มเลย (ตกไปที่ `-`) บั๊กคลาสเดียวกันนี้เพิ่งถูกแก้ไปแล้วใน `ContentPlannerCalendar.tsx`/`ContentItemList.tsx` (ดู `openspec/changes/archive/2026-09-11/content-planner-platform-filter-fix/`) โดยใช้ `parsePlatforms()` ที่มีอยู่แล้ว — เปลี่ยนแปลงนี้นำแนวทางเดียวกันมาปิดจุดเดิมในหน้าอนุมัติ

## What Changes

- แก้ตัวกรองแพลตฟอร์มใน `ContentApprovalTab.tsx` ให้ parse `item.platforms ?? item.platform` ด้วย `parsePlatforms()` ก่อนเช็ค `.includes(platformFilter)` แทนการเทียบ `===` กับค่าดิบทั้งก้อน
- แก้ที่มาของตัวเลือกใน Platform Filter Dropdown (`usedPlatforms`) ให้ flatten รายการแพลตฟอร์มที่ parse แล้วของทุก item ก่อนเข้า `Set` แทนการ map `item.platform` ดิบๆ (ซึ่งไม่แยกค่า comma-joined)
- แก้การแสดงผลคอลัมน์ "แพลตฟอร์ม" ในตารางให้ใช้ `parsePlatforms()` แล้วแสดง badge แพลตฟอร์มแรก + ป้าย `+N` แบบย่อเมื่อ item มีมากกว่า 1 แพลตฟอร์ม (คงพื้นที่แถวเดิม ไม่ทำให้แถวสูงขึ้น) แทนการ lookup `PLATFORM_MAP` ด้วยค่าดิบทั้งก้อนซึ่งตกไปที่ `-` เสมอสำหรับ item หลายแพลตฟอร์ม
- ไม่แตะ `getItemPlatforms()` ส่วนตัวใน `ContentListTab.tsx` และไม่ย้าย `parsePlatforms()` ไป `src/lib/` — ทั้งสองเป็นงาน refactor แยกต่างหาก (`task_1b7b03a8`)

## Capabilities

### New Capabilities
(ไม่มี)

### Modified Capabilities
- `content-approval-list`: requirement "Approval list supports filtering and sorting" — scenario "Filter by platform" ต้องระบุพฤติกรรมการ match กับ item ที่มีหลายแพลตฟอร์ม (ไม่ใช่ exact-match กับค่าดิบ) และ requirement เดิมที่กล่าวถึงคอลัมน์ "แพลตฟอร์ม" ต้องเพิ่ม scenario การแสดงผล badge แรก + `+N` เมื่อ item มีหลายแพลตฟอร์ม

## Impact

- `src/components/content/tabs/ContentApprovalTab.tsx` — filter predicate, `usedPlatforms` derivation, ตาราง cell แพลตฟอร์ม
- ใช้ `parsePlatforms()` ที่ export จาก `src/components/content/PlatformBadgeList.tsx` (ของเดิม ไม่สร้างใหม่)
- ไม่มีการเปลี่ยน schema/API — เป็นการแก้ logic ฝั่ง frontend ล้วนๆ
