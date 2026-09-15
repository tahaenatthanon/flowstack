## Context

`GlobalSearch.tsx:34-35` เก็บรายการนำทางแบบ hardcoded array (`NAV_ITEMS`) แยกจาก `AppSidebar.tsx` โดยสิ้นเชิง ไม่มีการ derive มาจากแหล่งเดียวกัน เมื่อรอบก่อนหน้าเปลี่ยนชื่อหน้า `/marketing` จาก "การตลาด" เป็น "แคมเปญอีเมล" ใน `AppSidebar.tsx` แล้ว `GlobalSearch.tsx` ไม่ได้ถูกแก้ตาม ทำให้ป้ายไม่ตรงกัน และมีรายการ `/campaigns` ซ้ำซ้อนกับ `/marketing` เพราะ `/campaigns` เป็นแค่ redirect (`App.tsx:160`) ไปหน้าเดียวกัน

## Goals / Non-Goals

**Goals:**
- ป้ายและปลายทางใน GlobalSearch สำหรับหน้าแคมเปญอีเมลต้องตรงกับ `AppSidebar.tsx`
- ไม่มีรายการซ้ำซ้อนที่ชี้ไปหน้าเดียวกัน
- เพิ่มรายการ "วิเคราะห์แคมเปญ" ที่ขาดหายไป

**Non-Goals:**
- ไม่ทำ GlobalSearch ให้ derive จาก `AppSidebar.tsx` อัตโนมัติ (refactor ใหญ่กว่าที่ขอบเขตนี้ต้องการ — เก็บเป็น array แยกเหมือนเดิม แค่แก้ค่าให้ตรงกัน)
- ไม่แตะ route `/campaigns` ใน `App.tsx` (คงไว้เป็น redirect เพื่อ backward compatibility ตามที่ตกลงกันไว้)
- ไม่ลบ `CampaignsPage.tsx` (dead code — พิจารณาแยกเป็น change อื่น)
- ไม่พิจารณาการสลับ canonical route ระหว่าง `/marketing` กับ `/campaigns` (คำถามเปิดที่ยังไม่ตัดสินใจ — อยู่นอกขอบเขตนี้)

## Decisions

**เปลี่ยนปลายทางของรายการ "แคมเปญอีเมล" เป็น `/campaigns` แทนที่จะเป็น `/marketing` โดยตรง**

ทางเลือกที่พิจารณา: แก้แค่ label เป็น "แคมเปญอีเมล" แต่คง href เป็น `/marketing` เดิม — ตัดออก เพราะผู้ร้องขอเลือกให้ใช้ `/campaigns` ชัดเจน (อาศัย redirect ที่มีอยู่แล้วใน `App.tsx:160` ซึ่งพาไปหน้าเดียวกัน ไม่มีความเสี่ยงเพิ่มเพราะ redirect ทำงานอยู่แล้วและผ่านการตรวจสอบแล้วว่าไม่มี route อื่นชนกัน)

**เปลี่ยนแปลง `NAV_ITEMS` array ในไฟล์เดียว ไม่แตะ logic การค้นหา/filter อื่นในไฟล์**

```ts
// เดิม (บรรทัด 34-35)
{ title: 'การตลาด',           href: '/marketing',   icon: Megaphone },
{ title: 'แคมเปญ',            href: '/campaigns',   icon: Megaphone },

// ใหม่
{ title: 'แคมเปญอีเมล',       href: '/campaigns',           icon: Megaphone },
{ title: 'วิเคราะห์แคมเปญ',   href: '/campaign-analytics',  icon: BarChart3 },
```
ไอคอน `BarChart3` มี import อยู่แล้วในไฟล์ (บรรทัด 11) และเป็นไอคอนเดียวกับที่ `AppSidebar.tsx` ใช้กับ "วิเคราะห์แคมเปญ" — ไม่ต้องเพิ่ม import ใหม่

## Risks / Trade-offs

- **[Risk] Route `/campaigns` เป็น redirect ไม่ใช่หน้าจริง อาจทำให้ผู้ใช้เห็น URL เปลี่ยนเป็น `/marketing` หลังคลิก** → **Mitigation:** เป็นพฤติกรรมเดิมที่มีอยู่แล้ว (ใครก็ตามที่เข้า `/campaigns` ตรงๆ ก็เจอ redirect นี้อยู่แล้ว) ไม่ใช่พฤติกรรมใหม่ที่เกิดจาก change นี้ และไม่กระทบการใช้งาน (ผู้ใช้ยังไปถึงหน้าที่ต้องการ)
- **[Risk] ในอนาคตถ้ามีการสลับ canonical route (ตามคำถามเปิดที่ยังไม่ตัดสินใจ) จะต้องกลับมาแก้ไฟล์นี้อีกครั้ง** → **Mitigation:** ยอมรับความเสี่ยงนี้ เพราะเป็นการเปลี่ยนแปลงเล็ก (1 บรรทัด) ถ้าเกิดขึ้นจริงในอนาคต ดีกว่าบล็อกงานเล็กตอนนี้ไว้รอการตัดสินใจเรื่องใหญ่ที่ยังไม่ชัดเจน

## Migration Plan

1. แก้ `src/components/GlobalSearch.tsx` (ไฟล์เดียว)
2. ไม่มี DB migration, ไม่มี feature flag
3. Rollback: revert commit ที่เกี่ยวข้อง ไม่มีข้อมูลถูกทำลาย

## Open Questions

- การสลับ canonical route ระหว่าง `/marketing` และ `/campaigns` (ย้าย implementation จาก `MarketingPage.tsx` ไป `CampaignsPage.tsx`) ยังไม่ตัดสินใจ — พักไว้เป็น change แยกในอนาคตถ้าต้องการ
