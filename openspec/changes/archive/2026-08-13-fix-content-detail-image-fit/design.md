## Context

หน้ารายละเอียดคอนเทนต์ถูกเปิดจากหน้ารายการอนุมัติ (`ContentDetailView` → `ContentArticleView`/`ContentVideoView` ตาม type) โดยแสดงรูปปก `generated_image_url` ไว้ด้านบน

**`ContentArticleView.tsx`** (รูปปกบทความ):
```jsx
<div className={cn('rounded-xl overflow-hidden border bg-muted/20 cursor-zoom-in group', isSocial && 'max-w-lg mx-auto')} onClick={...}>
  <img className="w-full max-h-80 object-cover" />
  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 ... opacity-0 group-hover:opacity-100">...</div>
</div>
```

**`ContentVideoView.tsx`** (cover/preview):
```jsx
<div className="rounded-xl overflow-hidden border bg-muted/20 relative">
  <img className="w-full max-h-80 object-cover" />
  <div className="absolute inset-0 flex items-center justify-center bg-black/20">...</div>
</div>
```

ปัญหา:
1. `object-cover` + `max-h-80` ครอปรูปให้เต็มกรอบ — ผู้ใช้มองเห็นรูปไม่เต็ม
2. `ContentArticleView` ใช้ `absolute inset-0` แต่ container ไม่มี `relative` — overlay อาจขยายเกินขอบเขตของรูป

## Goals / Non-Goals

**Goals:**
- เห็นรูปปกเต็มรูป (ไม่ถูกตัดโดย `object-cover`)
- กรอบ/overlay ขยายพอดีกับขอบเขตของรูป (ไม่ลอยเกิน)
- เมื่อ hover ไม่มีกรอบแสดงเกินขอบเขตของรูป

**Non-Goals:**
- ไม่เปลี่ยน `ImageViewer` (lightbox) — ทำงานถูกต้องแล้ว
- ไม่เปลี่ยน logic การแสดงวิดีโอ/เนื้อหาอื่น
- ไม่เปลี่ยน API/DB

## Decisions

### ข้อที่ 1: เปลี่ยน `object-cover` → `object-contain`

**เลือก**: ใช้ `object-contain` แทน `object-cover` บน `<img>` ของรูปปก

**ทางเลือกที่พิจารณา:**
- ใช้ `object-cover` + `aspect-ratio` — ยังคงครอปรูปบางส่วน
- ปล่อย `object-cover` ไว้ — ไม่ตรงข้อกำหนด "เห็นรูปเต็ม"

**เหตุผล**: `object-contain` แสดงทั้งรูปโดยไม่ครอป

### ข้อที่ 2: ให้ container ขยายตามขนาดรูป (ไม่บังคับความสูงคงที่)

**เลือก**: เปลี่ยน `max-h-80` เป็นค่าที่ไม่ตัดรูป (เช่น `max-h-[32rem]` ที่กว้างขึ้น) หรือใช้ `w-full h-auto` ร่วมกับ `object-contain` และ `max-h` ที่ยืดหยุ่น เพื่อให้ container hug รูป

**ทางเลือกที่พิจารณา:**
- คง `max-h-80` — รูปที่สูงกว่ายังถูกจำกัดความสูง (แตะขอบ) แต่ไม่ครอปถ้าใช้ `object-contain`
- ลบ `max-h` ทั้งหมด — รูปขนาดใหญ่เต็มจอ เกินความต้องการ

**เหตุผล**: ใช้ `object-contain` + `max-h` ที่กว้างพอให้เห็นรูปเต็ม โดย container `w-full` ยังคงเต็มความกว้าง

### ข้อที่ 3: เพิ่ม `relative` ให้ container (ContentArticleView)

**เลือก**: เพิ่ม `relative` ให้ container ของรูปปกใน `ContentArticleView` (ส่วน `ContentVideoView` มี `relative` อยู่แล้ว)

**เหตุผล**: ทำให้ `absolute inset-0` overlay ครอบคลุมเฉพาะ container ของรูป ไม่ลอยไปยัง ancestor

### ข้อที่ 4: overlay hug รูปด้วย `w-fit` (เฉพาะกรณีรูปเล็กกว่า container)

**เลือก**: เมื่อใช้ `object-contain` รูปอาจแคบกว่า container (letterbox) — ใช้ wrapper `inline-block` หรือ `w-fit` เพื่อให้ overlay ครอบคลุมเฉพาะรูป ไม่ใช่ container เต็มความกว้าง

**ทางเลือกที่พิจารณา:**
- ปล่อย overlay เต็ม container — overlay จะกว้างเกินรูป (ปัญหาที่ user รายงาน)

**เหตุผล**: จัด `w-fit`/`inline-block` เพื่อให้ container และ overlay ขยายพอดีกับรูป

## Risks / Trade-offs

- **ความเสี่ยง**: เปลี่ยนเป็น `object-contain` แล้วรูปมีพื้นว่าง (letterbox) ด้านบน/ล่าง — **การลดความเสี่ยง**: ใช้ `bg-muted/20` เดิมให้เห็นเป็นพื้นหลังอ่อน ไม่ดูขาด
- **ความเสี่ยง**: overlay `w-fit` กระทบ layout ของ `isSocial` (`max-w-lg mx-auto`) — **การลดความเสี่ยง**: คง `max-w-lg mx-auto` และ wrapper ด้านในใช้ `inline-block`

## Migration Plan

1. แก้ cover image ใน `ContentArticleView.tsx` และ `ContentVideoView.tsx`
2. รัน `pnpm build` + `pnpm lint`
3. ตรวจสอบภาพในหน้ารายละเอียด (จากหน้ารายการอนุมัติ)

**Rollback**: git revert (ไม่มีการเปลี่ยน schema/API)
