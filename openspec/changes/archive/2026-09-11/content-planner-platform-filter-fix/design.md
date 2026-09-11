## Context

`content_items.platform` เก็บแพลตฟอร์มที่เลือกไว้เป็นสตริง comma-joined เดียว (เช่น `"facebook,linkedin,twitter"`) เมื่อ content item เลือกไว้หลายแพลตฟอร์ม — นี่คือ root cause เดียวกับที่แก้ไปแล้วหลายจุดวันนี้ผ่าน `platform-color-catalog` และ `content-type-badge-display` (ฝั่งการแสดงผล) แต่ตรรกะ**การกรอง** (`platformFilter`) ยังไม่เคยถูกแตะเลย

ทั้ง `ContentPlannerCalendar.tsx` และ `ContentItemList.tsx` รับ prop `platformFilter` เดียวกันจาก `ContentPlannerPage.tsx` (มาจากแถบปุ่มกรองแพลตฟอร์มเหนือปฏิทิน/รายการ) และต่างเขียนตรรกะกรองของตัวเองแยกกัน:

```
ContentPlannerCalendar.tsx:61
  if (platformFilter !== 'all' && item.platform !== platformFilter) continue;

ContentItemList.tsx:53-55
  if (platformFilter !== 'all') {
    result = result.filter(item => item.platform === platformFilter);
  }
```

ทั้งสองจุดเทียบ `item.platform` (สตริงดิบ) กับ `platformFilter` (ค่าแพลตฟอร์มเดี่ยวจากปุ่มกด) แบบ `===`/`!==` ตรงๆ — content item ที่มีมากกว่า 1 แพลตฟอร์มจะไม่ match กับตัวกรองใดๆ เลย แม้จะมีแพลตฟอร์มนั้นรวมอยู่ด้วยจริง

ระบบมี `parsePlatforms()` (export จาก `PlatformBadgeList.tsx`) ที่ parse `platforms`/`platform` ให้เป็น array ที่ normalize แล้ว (lowercase, trim, dedupe, รองรับทั้ง JSON array string และ comma-joined string) — ใช้แก้ตรงนี้ได้ตรงๆ โดยไม่ต้องเขียน parsing ใหม่

## Goals / Non-Goals

**Goals:**
- ตัวกรองแพลตฟอร์มใน `ContentPlannerCalendar` และ `ContentItemList` ต้อง match content item ที่มีแพลตฟอร์มนั้นรวมอยู่ในรายการที่เลือกไว้ ไม่ว่าจะมีแพลตฟอร์มอื่นร่วมด้วยกี่อันก็ตาม
- ใช้ `parsePlatforms()` ที่มีอยู่แล้วเป็นแหล่งเดียว ไม่เขียน parsing logic ซ้ำ

**Non-Goals:**
- ไม่แตะการแสดงผล badge/ไอคอนที่เพิ่งแก้ไปแล้ว (คนละ concern จากการกรอง)
- ไม่แก้ `ContentApprovalTab.tsx`/`ContentListTab.tsx` (หน้า `/content`) — มีบั๊กคลาสเดียวกันแต่ถูก flag เป็นงานแยกต่างหากแล้ว
- ไม่เปลี่ยน UI ของแถบปุ่มกรองแพลตฟอร์มเอง (ยังเลือกได้ทีละ 1 แพลตฟอร์มเหมือนเดิม เปลี่ยนแค่วิธี match)

## Decisions

### 1. ใช้ `parsePlatforms(item.platforms ?? item.platform).includes(platformFilter)` แทน exact-match
ทั้งสองไฟล์เปลี่ยนมาเรียก `parsePlatforms()` แล้วเช็ค `.includes(platformFilter)` แทนการเทียบสตริงตรงๆ — `platformFilter` เองเป็นค่าแพลตฟอร์มเดี่ยว (lowercase) มาจากปุ่มกด ไม่ต้อง parse ฝั่งนั้น

**ทางเลือกที่พิจารณา**: เขียน helper ใหม่ชื่อ `itemHasPlatform(item, platform)` ห่อ `parsePlatforms(...).includes(...)` อีกชั้น — ปฏิเสธเพราะ logic สั้นพอที่จะเรียกตรงๆ ในทั้ง 2 จุดโดยไม่ต้องเพิ่ม abstraction ใหม่ที่ไม่มีที่ใช้ที่สาม

### 2. ไม่รวมการแก้ `ContentApprovalTab.tsx` เข้ามาด้วย แม้เป็นบั๊กคลาสเดียวกัน
`ContentApprovalTab.tsx` มีบั๊กเดียวกันเป๊ะ (`item.platform === platformFilter`) แต่ผู้ใช้ตัดสินใจแยกเป็น task ต่างหากแล้วไว้ก่อนเปิด change นี้ — คง scope ของ change นี้ไว้แค่ 2 ไฟล์ใน Content Planner (`ContentPlannerCalendar`, `ContentItemList`) ตามที่ตกลงกัน ไม่ลากงานอื่นเข้ามาปนแม้จะเป็นบั๊กเดียวกัน

## Risks / Trade-offs

- **[Risk]** ต่ำมาก — เป็นการแก้เงื่อนไข filter ให้ครอบคลุมกว่าเดิม (superset) ไม่มีทางทำให้ item ที่เคย match อยู่แล้วหายไป มีแต่จะทำให้ item ที่เคยหายไปผิดๆ กลับมาโผล่ถูกต้อง

## Migration Plan

ไม่มี schema migration — แก้เฉพาะ frontend filter logic ไม่มี breaking change ต่อ API หรือฐานข้อมูล

Rollback: revert commit เดียวได้ทั้งหมด ไม่มี state ค้างต้อง cleanup

## Open Questions

- ไม่มี
