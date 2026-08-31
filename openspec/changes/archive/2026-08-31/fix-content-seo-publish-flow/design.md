## Context

ระบบประเมิน SEO อยู่ใน `api/lib/seo-checklist.php` และถูกเรียกซ้ำทั้ง endpoint สำหรับหน้าจอและเส้นทางเผยแพร่ ปัจจุบันกฎ `no_h1` ขัดกับ generator ที่เติม h1 ให้ชื่อบทความ, กฎเดียวกันถูกใช้กับบทความและวิดีโอ, และข้อมูลที่ยังว่างถูกตีเป็น `fail` ทั้งหมด

เส้นทาง `send_now` สร้างผลลัพธ์แยกตาม channel และมี idempotency lock อยู่แล้ว แต่ payload ที่ส่งยังไม่เลือก script ของ platform นั้น อีกทั้ง cron ต้องส่งชนิดคอนเทนต์ให้การตรวจ SEO ใช้กฎเดียวกับ send-now การแก้ครั้งนี้ต้องรักษา approval gate, queue และการแยก tenant เดิมไว้

## Goals / Non-Goals

**Goals:**

- ทำให้ SEO checklist สะท้อนชนิดคอนเทนต์และสถานะข้อมูลจริง
- ทำให้ SEO gate และ cron ใช้ผลประเมินชุดเดียวกันโดยมีชนิดคอนเทนต์ครบ
- ส่งเนื้อหาเฉพาะ platform ที่กำลังประมวลผล และคงผลลัพธ์ราย channel
- ทำให้การแก้ metadata ด้วยมือและการสร้างวิดีโอไม่ถูกตัดออกจาก flow
- ปิดช่องโหว่การอ่านข้อมูลคอนเทนต์ข้าม tenant

**Non-Goals:**

- ไม่สร้างหน้า `/content-pipeline` หรือ wizard ใหม่
- ไม่ทำ DataForSEO, research tables, GSC, Rank Tracking หรือ AI-assisted editing
- ไม่ rewrite HTML ของคอนเทนต์ที่มีอยู่แล้ว
- ไม่เปลี่ยนโครงสร้าง `content_items.platform` ใน change นี้

## Decisions

1. **ใช้ `content_items.type` เป็นแหล่งชนิดคอนเทนต์**

   `type` เป็นข้อมูลที่บันทึกไว้จริงและไม่ผูกกับช่องทางเผยแพร่ จึงรองรับวิดีโอที่เผยแพร่บน Facebook/Instagram ได้ถูกต้อง การเดาจาก platform จะถูกยกเลิกใน generate, SEO gate และ cron

2. **ยอมรับ h1 แรก และไม่ยอมรับ h1 ซ้ำ**

   generator สร้าง h1 สำหรับชื่อบทความอยู่แล้ว จึงให้ `no_h1` ผ่านเมื่อมี h1 ไม่เกินหนึ่งตัว และ fail เมื่อมีตั้งแต่สองตัวขึ้นไป ไม่แก้ข้อมูลเก่าด้วย migration หรือ bulk rewrite

3. **ruleset วิดีโอใช้กฎ metadata ที่เกี่ยวข้องและข้ามกฎโครงสร้างบทความ**

   วิดีโอจะข้าม `has_h2`, `word_count`, `internal_link` และกฎหัวข้อบทความที่ต้องใช้ HTML แต่ยังตรวจ SEO title, meta description, slug/structured data ตามข้อมูลที่มี และ hashtags ตามสัญญาของวิดีโอ การเลือก ruleset ทำใน `seo_evaluate()` เพื่อให้ endpoint และ publish ใช้ผลเดียวกัน

4. **แยกสถานะ pending ออกจาก fail**

   ค่าว่างจะแสดงเป็นสถานะยังไม่ได้กำหนดและไม่ถูกกล่าวหาว่าผิดรูปแบบ ส่วนค่าที่มีแต่ผิดเกณฑ์ยังเป็น fail การคำนวณคะแนนจะไม่หักคะแนนจาก pending เช่นเดียวกับ skip และ gate ที่ตั้ง `min_score=0` จะบล็อกเฉพาะ rule ระดับ fail ตามนโยบายที่อนุมัติไว้

5. **เลือก payload ก่อน dispatch โดยรักษา override เป็นลำดับสูงสุด**

   ถ้ามี channel override ให้ใช้ override ก่อน หากไม่มีและเป็น channel social ให้เลือก `article_content.scripts[platform]` เมื่อมีค่า จากนั้น fallback ไป caption เดิม ส่วน Website/CMS ยังคงใช้ HTML บทความ การเปลี่ยนนี้อยู่ก่อน `dispatch_content()` และไม่เพิ่มการเรียก API ภายนอก

6. **ไม่ใช้ `platform` เป็นสถานะรวมหลังเผยแพร่หลายช่องทาง**

   queue row และผลลัพธ์ราย channel เป็นแหล่งความจริงของการเผยแพร่แต่ละช่องทาง การแก้ครั้งนี้จะไม่เปลี่ยน schema แต่จะไม่ให้ผล channel สุดท้ายถูกนำไปตีความว่าเป็นผลของทุก channel

7. **ไม่เติม meta keywords จาก LLM เมื่อไม่มี Research**

   generate จะเขียนค่าว่างเมื่อไม่มีผล Research และการแก้ไขด้วยมือจะบันทึกลงคอลัมน์จริงผ่าน allowlist เดิมที่ขยายแล้ว

## Risks / Trade-offs

- [คอนเทนต์ที่ metadata ว่างอาจผ่าน gate ได้เมื่อไม่มีกฎ fail] → แสดงสถานะ pending อย่างชัดเจนและคงการตรวจ fail สำหรับค่าที่กรอกผิด; นโยบาย gate ที่เข้มกว่านี้ให้ทำเป็น change แยก
- [script key ของ platform อาจไม่ตรงกับชื่อ channel ภายใน] → ทำ normalization แบบ explicit เฉพาะ mapping ที่ระบบรองรับ และ fallback ไป payload เดิมเมื่อไม่มี script
- [การเปลี่ยน ruleset อาจทำให้คะแนนวิดีโอสูงขึ้น] → แสดง rule ที่ skip พร้อมเหตุผล และทดสอบแยก article/video
- [การแก้ shared publish flow กระทบ cron และ send-now] → ทดสอบทั้งสองเส้นทาง, ตรวจ queue ราย channel และใช้ PHP lint/build/test ก่อนเสร็จ
- [คอลัมน์ `platform` เดิมยังเป็นค่าเดียว] → ไม่อ้างคอลัมน์นี้เป็นผลสำเร็จรวม ให้ใช้ queue/result ราย channel จนกว่าจะมีข้อกำหนด data model ใหม่

## Migration Plan

ไม่มี schema migration การ deploy เป็นการปล่อย backend ที่แก้แล้ว จากนั้นตรวจ SEO endpoint, send-now และ cron ในสภาพแวดล้อมทดสอบก่อนเปิด `seo_gate_enabled=1` ให้ tenant

Rollback ใช้ revision เดิมของไฟล์ backend หากพบปัญหา โดยปิด `seo_gate_enabled` ก่อน rollback เพื่อไม่ให้คอนเทนต์ใหม่หยุดเผยแพร่ระหว่างตรวจสอบ

## Open Questions

ไม่มีสำหรับขอบเขต change นี้
