## Context

ใน `ContentCardDialog.tsx` และ `ContentDetailView.tsx` มีส่วน "ภาพประกอบ" ที่แสดงรูปที่สร้างโดย AI (`generated_image_url`) แต่รูปภาพแสดงเป็น `<img>` โดยตรง ไม่มี lightbox ให้คลิกดูแบบเต็มจอ

ระบบมีฟีเจอร์สร้างวิดีโอด้วย AI อยู่แล้วใน `ContentVideoView.tsx` (ผ่าน `/brand-content.php?action=generate-video`) แต่ยังไม่มีส่วน UI "วิดีโอ" ใน dialog แก้ไขคอนเทนต์ (`ContentCardDialog` / `ContentDetailView`)

## Goals / Non-Goals

**Goals:**
- เมื่อคลิกรูปภาพที่สร้างโดย AI → แสดง lightbox แบบเต็มหน้าจอ (zoom เต็มจอ, ปุ่มปิด, คลิกพื้นหลังปิด)
- เพิ่มหัวข้อ "วิดีโอ" ใต้ "ภาพประกอบ" ใน `ContentCardDialog` และ `ContentDetailView` — แสดงเฉพาะข้อมูลวิดีโอ, ไม่แสดงส่วนบทความ
- เพิ่มปุ่ม "สร้างวิดีโอด้วย AI" — ใช้ไอคอน `Clapperboard` จาก lucide-react สอดคล้องกับ Design System
- เปลี่ยนข้อความ description เมื่อยังไม่มีวิดีโอเป็น "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ"
- ใช้ shadcn-ui primitives (`Dialog` หรือ custom lightbox component) ตามมาตรฐาน project
- หน้ารายละเอียด Content แสดงไอคอนประเภทวิดีโอ (`Play`) ที่มุมซ้ายบนของ header — ใช้ icon เดียวกับ `ContentListTab` (`🎬 วิดีโอ`)

**Non-Goals:**
- ไม่ implement video generation logic ใหม่ — ใช้ endpoint `/brand-content.php?action=generate-video` ที่มีอยู่แล้ว
- ไม่เปลี่ยน API endpoints
- ไม่เปลี่ยน database schema
- ไม่ redesign ระบบ video workflow
- ไม่กระทบการแสดงผลหรือการทำงานของส่วนบทความ (Article) ที่มีอยู่เดิม

## Decisions

### 1. Lightbox: ใช้ `Dialog` component แทน third-party library

**เลือก**: ใช้ `Dialog` จาก shadcn-ui (มีอยู่แล้วใน project) เป็น lightbox — แสดงรูปภาพเต็มจอใน dialog แบบไม่มี padding, คลิกที่รูปหรือพื้นหลังเพื่อปิด

**เหตุผล**: 
- ไม่ต้องเพิ่ม dependency ใหม่
- `Dialog` รองรับ animation, overlay, และ keyboard dismiss (Escape) อยู่แล้ว
- Minimal code — แค่ `<DialogContent>` ที่มีรูปภาพเต็ม width

**Alternative considered**: ใช้ `react-medium-image-zoom` หรือ `yet-another-react-lightbox` — เพิ่ม bundle size โดยไม่จำเป็น

### 2. Video Section: แยก component แสดงเฉพาะข้อมูลวิดีโอ

**เลือก**: Video section แสดงเฉพาะข้อมูลและองค์ประกอบที่เกี่ยวข้องกับวิดีโอเท่านั้น — ไม่แสดงส่วนบทความ (Article) ในบริบทวิดีโอ ใช้ไอคอน `Clapperboard` สำหรับหัวข้อ "วิดีโอ" และปุ่ม "สร้างวิดีโอด้วย AI"

**เหตุผล**:
- แยก concern — video section ไม่ควรแสดงข้อมูลบทความที่ไม่เกี่ยวข้อง
- `Clapperboard` เป็นไอคอนมาตรฐานสำหรับ video/content production — สอดคล้องกับ Design System เดิมที่ใช้ใน `ContentVideoView`
- ข้อความ description "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ" ให้ข้อมูลที่เป็นประโยชน์กับผู้ใช้

### 3. Lightbox: สร้าง `ImageViewer` component ใช้ร่วมกัน

**เลือก**: สร้าง `src/components/content/ImageViewer.tsx` — component ที่รับ `src`, `alt`, `open`, `onOpenChange` props — ใช้ `Dialog` แสดงรูปเต็มจอ

**เหตุผล**: Reuse ได้ทุกที่ที่มีรูปภาพ (ContentCardDialog, ContentListTab, ContentDetailView, ContentArticleView)

## Risks / Trade-offs

- **[Risk] Lightbox อาจมีปัญหากับรูปภาพขนาดเล็ก** → Mitigation: ใช้ `object-contain` และ max sizing
- **[Risk] ปุ่มสร้างวิดีโอ UI-only อาจทำให้ผู้ใช้กดแล้วไม่เกิดอะไรขึ้น** → Mitigation: เชื่อมกับ endpoint `/brand-content.php?action=generate-video` ที่มีอยู่แล้ว, แสดง loading state

## Migration Plan

1. Deploy พร้อมกันทั้งหมด (ImageViewer + Video section)
2. ไม่ต้องมี database migration
3. Rollback: revert commit — ไม่มี data change
