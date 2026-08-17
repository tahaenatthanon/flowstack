## Why

ในหน้ารายละเอียดคอนเทนต์ (ทั้ง `ContentArticleView` และ `ContentVideoView` เปิดจากหน้ารายการอนุมัติ) รูปปก (cover image) ใช้ `object-cover` + `max-h-80` ซึ่งครอปรูปให้เต็มกรอบ ทำให้มองเห็นรูปไม่เต็ม และใน `ContentArticleView` overlay ตอน hover ใช้ `absolute inset-0` โดยที่ container ไม่มี `relative` ทำให้ overlay อาจลอยเกินขอบเขตของรูป

## What Changes

- เปลี่ยนการแสดงรูปปกจาก `object-cover` เป็น `object-contain` เพื่อให้เห็นรูปเต็มโดยไม่ถูกตัด
- ปรับ container ให้มี `relative` (ใน `ContentArticleView`) เพื่อให้ overlay `absolute inset-0` ครอบคลุมเฉพาะขอบเขตของรูป
- ปรับให้กรอบ/overlay ขยายตามขนาดรูป (fit-content) แทนการบังคับความสูงคงที่ที่ตัดรูป

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `content-image-preview`: ปรับการแสดงรูปปกในหน้ารายละเอียดคอนเทนต์ให้เห็นรูปเต็มและกรอบพอดีกับรูป

## Impact

- **Frontend**:
  - `src/components/content/views/ContentArticleView.tsx` — แก้ cover image (object-contain + relative + ปรับขนาด)
  - `src/components/content/views/ContentVideoView.tsx` — แก้ cover/preview image (object-contain + ปรับขนาด)
- **Backend**: ไม่มีการแก้ไข
- **Database**: ไม่มีการแก้ไข
