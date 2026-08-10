## 1. ImageViewer — Lightbox component

- [x] 1.1 สร้าง `src/components/content/ImageViewer.tsx` — ใช้ `Dialog` จาก shadcn-ui เป็น lightbox, แสดงรูปเต็มจอด้วย `object-contain`, รองรับปิดด้วยปุ่ม X, คลิกพื้นหลัง, และ Escape key
- [x] 1.2 Props: `src: string`, `alt?: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`

## 2. ContentCardDialog — เพิ่ม image lightbox + video section

- [x] 2.1 เพิ่ม `ImageViewer` component ในส่วน "ภาพประกอบ" (`displayImageUrl`) — คลิกรูปเปิด lightbox
- [x] 2.2 เพิ่มหัวข้อ "วิดีโอ" ใต้หัวข้อ "ภาพประกอบ" ในคอลัมน์ขวา (เฉพาะเมื่อ `existingItem` มีค่า) — ใช้ไอคอน `Clapperboard`
- [x] 2.3 แสดงสถานะวิดีโอ: ยังไม่มี → description "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ" + ปุ่ม "สร้างวิดีโอด้วย AI" (ไอคอน `Clapperboard`), กำลังสร้าง → `Loader2`, พร้อมเล่น → `<video>` player
- [x] 2.4 ปุ่ม "สร้างวิดีโอด้วย AI" เรียก `/brand-content.php?action=generate-video` ด้วย `{ item_id: existingItem.id }` (ใช้ pattern เดียวกับ `handleGenerateImage`)
- [x] 2.6 Video section แสดงเฉพาะข้อมูลวิดีโอ — ไม่แสดงส่วนบทความ (Article) ในบริบทวิดีโอ
- [x] 2.5 เพิ่ม `onGenerateVideo` prop (optional) ให้ `ContentCardDialog` — dispatch event ให้ parent

## 3. ContentDetailView — เพิ่ม image lightbox + video section + video icon

- [x] 3.1 เพิ่ม `ImageViewer` ในส่วนรูปภาพ — คลิกรูปเปิด lightbox
- [x] 3.2 เพิ่มหัวข้อ "วิดีโอ" ใต้ "ภาพประกอบ" พร้อมปุ่มสร้างวิดีโอด้วย AI (logic เดียวกับ ContentCardDialog)
- [x] 3.3 แสดงไอคอนประเภทวิดีโอ (`Play`) ที่มุมซ้ายบนของ header — ใช้ icon เดียวกับ `ContentListTab` (`🎬 วิดีโอ`)

## 4. ContentListTab — เพิ่ม image lightbox

- [x] 4.1 เพิ่ม `ImageViewer` เมื่อคลิก thumbnail รูปภาพ (`generated_image_url`) ในตารางรายการเนื้อหา

## 5. ContentArticleView — เพิ่ม image lightbox

- [x] 5.1 เปลี่ยนลิงก์รูปภาพจาก `<a target=\"_blank\">` เป็นคลิกเปิด `ImageViewer` lightbox

## 6. Verification

- [x] 6.1 ตรวจสอบ lightbox: คลิกรูป → เปิดเต็มจอ, คลิกปิด/พื้นหลัง/Escape → ปิด
- [x] 6.2 ตรวจสอบ video section: แสดงใต้ "ภาพประกอบ" ใน `ContentCardDialog` และ `ContentDetailView`
- [x] 6.3 ตรวจสอบปุ่ม "สร้างวิดีโอด้วย AI" แสดง UI ถูกต้อง (loading state, success state)
- [x] 6.4 ตรวจสอบการทำงานของระบบเดิมไม่เปลี่ยนแปลง (image generation, content edit/save)
- [x] 6.5 รัน `pnpm lint` และ `pnpm build` เพื่อยืนยันไม่มี error
