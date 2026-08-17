## Why

ผู้ใช้ไม่สามารถดูรูปภาพที่สร้างด้วย AI แบบเต็มหน้าจอได้ — ต้องคลิกขวา "Open image in new tab" ซึ่งไม่สะดวก นอกจากนี้ในหน้าแก้ไขคอนเทนต์มีเฉพาะส่วน "ภาพประกอบ" แต่ไม่มีส่วน "วิดีโอ" ทำให้ผู้ใช้ไม่เห็นว่ามีฟีเจอร์สร้างวิดีโอด้วย AI

## What Changes

- **Image Preview**: เมื่อคลิกที่รูปภาพที่สร้างโดย AI (ใน `ContentCardDialog`, `ContentListTab`, `ContentDetailView`, `ContentArticleView`) ให้แสดงรูปภาพแบบเต็มหน้าจอ (lightbox/zoom)
- **Video Section UI**: เพิ่มหัวข้อ "วิดีโอ" ใต้หัวข้อ "ภาพประกอบ" ใน `ContentCardDialog` และ `ContentDetailView` พร้อมปุ่ม "สร้างวิดีโอด้วย AI" — แสดงเฉพาะข้อมูลที่เกี่ยวข้องกับวิดีโอเท่านั้น ไม่แสดงส่วนบทความ (Article) ในบริบทวิดีโอ
- **Video Section Icons**: หัวข้อ "วิดีโอ" ใช้ไอคอน `Clapperboard`, ปุ่ม "สร้างวิดีโอด้วย AI" ใช้ไอคอน `Clapperboard` — สอดคล้องกับ Design System
- **Video Section Description**: ข้อความอธิบายเมื่อยังไม่มีวิดีโอเปลี่ยนเป็น "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ"
- **Video Icon on Detail Page**: หน้ารายละเอียด Content (`ContentDetailView`) แสดงไอคอนประเภทวิดีโอ (`Play`) ที่มุมซ้ายบนของ header — ใช้ไอคอนเดียวกับหน้า "ผลงานทั้งหมด" (`ContentListTab`)
- **การทำงานของระบบต้องเหมือนเดิมทุกอย่าง** — หน้าเดิมและ API เดิมไม่มีการเปลี่ยนแปลง logic, ส่วนบทความ (Article) ไม่ถูกกระทบ

## Capabilities

### New Capabilities
- `content-image-lightbox`: รองรับการคลิกดูรูปภาพแบบเต็มหน้าจอ (lightbox) ในหน้า content
- `content-video-ui-section`: เพิ่มส่วนหัวข้อ "วิดีโอ" และปุ่มสร้างวิดีโอด้วย AI ในหน้าแก้ไขคอนเทนต์

### Modified Capabilities
<!-- ไม่มี existing specs ที่ต้องแก้ requirement -->

## Impact

- **Frontend (`src/components/content/ContentCardDialog.tsx`)**: เพิ่ม image click → lightbox, เพิ่ม "วิดีโอ" section พร้อมปุ่ม AI
- **Frontend (`src/components/content/views/ContentArticleView.tsx`)**: เพิ่ม image click → lightbox
- **Frontend (`src/components/content/views/ContentDetailView.tsx`)**: เพิ่ม image click → lightbox, เพิ่ม "วิดีโอ" section, แสดงไอคอนประเภทวิดีโอที่ header
- **Frontend (`src/components/content/tabs/ContentListTab.tsx`)**: เพิ่ม image thumbnail click → lightbox
- **Frontend (ใหม่ `src/components/content/ImageViewer.tsx`)**: Lightbox component สำหรับแสดงรูปเต็มจอ
