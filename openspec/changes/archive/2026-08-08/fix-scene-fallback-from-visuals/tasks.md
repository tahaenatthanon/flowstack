## 1. Backend: Fallback ใน generate-scene-images

- [x] 1.1 แทรก fallback logic แปลง `visuals` → `scenes` ใน `api/brand-content.php` ก่อน `if (empty($scenes)) jsonError(...)` ที่ประมาณบรรทัด 1305
- [x] 1.2 ปรับข้อความ error จาก "ไม่มี scenes ใน article_content" เป็น "ไม่มี scenes หรือ visuals ใน article_content"

## 2. Backend: Fallback ใน generate-video

- [x] 2.1 แทรก fallback logic เดียวกันใน `api/brand-content.php` ก่อน `if (empty($scenes)) jsonError(...)` ที่ประมาณบรรทัด 2672
- [x] 2.2 ปรับข้อความ error จาก "ไม่มี scenes ใน article_content" เป็น "ไม่มี scenes หรือ visuals ใน article_content"

## 3. Frontend: ปุ่ม "สร้างภาพทุกฉาก" ใน ContentCardDialog

- [x] 3.1 เพิ่ม `generatingScenes` state ใน `ContentCardDialog.tsx`
- [x] 3.2 เพิ่ม `handleGenerateScenes` handler ที่เรียก `generate-scene-images` endpoint
- [x] 3.3 เพิ่มปุ่ม "สร้างภาพทุกฉาก" ใน Video Section (ก่อนปุ่ม "สร้างวิดีโอด้วย AI")
- [x] 3.4 ใส่ loading state (spinner + "กำลังสร้างภาพทุกฉาก...") ขณะ generating

## 4. Frontend: ควบคุมการแสดง Video Section ตามประเภท Content

- [x] 4.1 ซ่อน Video Section ทั้งบล็อกเมื่อ content ไม่ใช่ประเภทวิดีโอสคริปต์ (`!isVideo`)
- [x] 4.2 เปลี่ยนเงื่อนไขปุ่ม "สร้างวิดีโอด้วย AI" จาก "อย่างน้อย 1 ฉาก" เป็น "ครบทุกฉากมี image_url"
- [x] 4.3 เปลี่ยน description เป็น "ต้องกดสร้างภาพทุกฉากก่อน"
- [x] 4.4 ปรับข้อความ description ให้เปลี่ยนเมื่อทุกฉากมีภาพแล้ว (เช่น ซ่อน description, แสดงสถานะพร้อมสร้างวิดีโอ)
- [x] 4.5 แก้ไข `isVideo` detection: เพิ่ม fallback `existingItem?.content_type` เพราะ `generate-article` ไม่ได้ใส่ `platform_type` ใน `article_content` JSON แต่วางใน `content_items.type`

## 5. Verification

- [x] 5.1 ทดสอบ: สร้างเนื้อหา AI สำหรับ platform วิดีโอ → กด "สร้างภาพทุกฉาก" → ต้องไม่ error และได้ภาพ
- [x] 5.2 ทดสอบ: หลังจากสร้างภาพทุกฉากสำเร็จ → กด "สร้างวิดีโอ" → ต้องทำงานได้
- [x] 5.3 ทดสอบ: content ที่มี `scenes` อยู่แล้ว → fallback ต้องไม่ทำงาน (ใช้ scenes เดิม)
- [x] 5.4 ทดสอบ: content ที่ไม่มีทั้ง `scenes` และ `visuals` → ต้องแสดง error ที่เหมาะสม
- [x] 5.5 ทดสอบ: content ประเภทบทความหรือโซเชียล → Video Section ต้องไม่แสดง
- [x] 5.6 ทดสอบ: content ประเภทวิดีโอที่มีภาพไม่ครบทุกฉาก → ปุ่ม "สร้างวิดีโอ" ต้อง disabled
