## Context

Popup "ส่งเดี๋ยวนี้" และ "ตั้งเวลาโพสต์" ทั้งสองโหมดอยู่ใน component เดียว `src/components/content/SchedulePublishDialog.tsx` โดยเปิดจาก `ContentListTab` และ `ContentArticleView`

สถานะปัจจุบันของ `DialogContent`:

```tsx
<DialogContent className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
```

- ความกว้างคงที่ `sm:max-w-lg` (512px) — แคบเกินไป ทำให้เนื้อหา (รายการ channel + textarea + ช่องวันที่/เวลา) ดูอึดอัดและจัดวางไม่เหมาะสม
- `max-h-[90vh] overflow-y-auto` อยู่บนตัว `DialogContent` ทำให้เมื่อ content สูง ทั้ง dialog เลื่อนทั้งหมด รวมหัวข้อและปุ่ม footer ที่จะเลื่อนหลุดจอ

base `DialogContent` (shadcn) มี default เป็น `grid`, `sm:max-w-[calc(100vw-2rem)]`, และ `sm:h-auto` อยู่แล้ว

## Goals / Non-Goals

**Goals:**
- เพิ่มความกว้างเป็น `sm:max-w-xl` (576px) ให้เนื้อหามีพื้นที่หายใจ ไม่แน่นเกินไป
- ปรับระยะห่างภายใน (section spacing + channel row padding) ให้ดูเป็นระเบียบและใช้งานง่าย
- ย้ายการเลื่อนจากทั้ง dialog มาอยู่ที่ส่วนเนื้อหากลางเท่านั้น เพื่อให้หัวข้อและ footer คงที่
- dialog ย่อตามเนื้อหาเมื่อ channel น้อย (ไม่บังคับ scroll)

**Non-Goals:**
- ไม่เปลี่ยน logic การส่ง/ตั้งเวลา, validation, hooks (`useSendNow`, `useScheduleContent`)
- ไม่แตะ dialog "ตั้งเวลาโพสต์" แบบ single-channel ใน `ContentDetailView.tsx` (นอกขอบเขตที่ขอ)
- ไม่เปลี่ยนโครงสร้าง channel list หรือฟิลด์เนื้อหา

## Decisions

**1. ความกว้าง: `sm:max-w-lg` → `sm:max-w-xl`**
- 576px ให้พื้นที่เพียงพอสำหรับแถว channel (checkbox + icon + ชื่อ + platform label) และ textarea (article/caption) โดยไม่แคบหรือกว้างจนเกินไป
- ยังพอดีกับจอ desktop ทั่วไปและไม่กระทบ centering ของ base dialog
- ทางเลือกที่พิจารณา: `sm:max-w-2xl` (672px) → ปัดตก เพราะกว้างเกินสำหรับ dialog ที่มีเนื้อหาไม่มาก; คง `sm:max-w-lg` → ปัดตก เพราะแคบเกินไปตามปัญหาที่รายงาน

**2. ระยะห่างและการจัดวางภายใน**
- ปรับระยะห่างแนวตั้งระหว่าง section ให้สม่ำเสมอ (`space-y-4` บน content wrapper) และเพิ่ม padding แถว channel เป็น `px-4 py-2.5` เพื่อให้รายการอ่านง่ายและแตะ/คลิกสะดวกขึ้นตามความกว้างใหม่
- ทางเลือกที่พิจารณา: คง spacing เดิม → ปัดตก เพราะเป็นสาเหตุที่เนื้อหาดูอึดอัด

**3. ย้าย scroll ไปที่ส่วนเนื้อหากลาง**
- โครงสร้างใหม่: `DialogHeader` (คงที่) → `<div className="max-h-[60vh] overflow-y-auto ...">` (เลื่อนได้) → `DialogFooter` (คงที่)
- ใช้ `max-h-[60vh]` เป็นเพดานของส่วนกลาง — หัวข้อ+footer รวมแล้วยังอยู่ในจอ 90vh ทั่วไป
- ทางเลือกที่พิจารณา: ใช้ `max-h-[calc(100dvh-...)]` → ซับซ้อนและไวต่อการเปลี่ยนแปลง header/footer; ใช้ `60vh` ง่ายและคงที่กว่า

**4. ลบ `max-h-[90vh] overflow-y-auto` ออกจาก `DialogContent`**
- ป้องกันการเลื่อนซ้ำซ้อน (nested scroll) ที่ทำให้ footer หลุดจอ

## Risks / Trade-offs

- [ฟิลด์เนื้อหา (textarea) สูงเกินเมื่อมีทั้ง article + caption + ช่องวันที่] → ถูกจำกัดด้วย `max-h-[60vh]` ของส่วนกลางและเลื่อนภายในส่วนกลาง ไม่ดัน footer หลุด
- [`max-h-[60vh]` อาจต่างกันตามขนาดจอ] → บนจอเล็กมาก base dialog ยัง `h-[100dvh]` + scroll อยู่แล้ว จึงไม่เกิด overflow เกินจอ
- [การเปลี่ยน className อาจกระทบ animation/centering] → คง base classes จาก shadcn ไว้ เปลี่ยนเฉพาะที่ระบุ
- [ความกว้าง `sm:max-w-xl` บนจอเล็ก] → 576px ยังเล็กกว่า `max-w-[calc(100vw-2rem)]` ของ base และ dialog เป็น `w-full` บนมือถือ จึงไม่ overflow

## Migration Plan

- เปลี่ยนเฉพาะไฟล์ `SchedulePublishDialog.tsx` (frontend เท่านั้น) — ไม่มี DB/API migration
- Rollback: revert className ใน `DialogContent` กลับเป็นค่าเดิม
