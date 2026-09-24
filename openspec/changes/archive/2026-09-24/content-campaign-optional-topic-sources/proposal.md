## Why

หน้าสร้างคอนเทนต์ (เดี่ยวและ Batch) บังคับให้ผู้ใช้พิมพ์ "หัวข้อ" เสมอ แม้จะเลือก Trigger, Skill หรือ Knowledge Base ไว้ครบแล้วก็ตาม — ทั้งที่ทั้ง 4 อย่างล้วนเป็นแหล่งข้อมูลที่ให้บริบท AI สร้างเนื้อหาได้เหมือนกัน การบังคับหัวข้อเป็นช่องเดียวที่ต้องกรอกขัดกับการมี Trigger/Skill/KB ให้เลือกอยู่แล้ว ทำให้ผู้ใช้ต้องพิมพ์ข้อความซ้ำซ้อนโดยไม่จำเป็น

หน้าสร้างแคมเปญอีเมลก็มีปัญหาคล้ายกัน: ฟิลด์ "เลือกสินค้า", "โทนการเขียน", "ใช้ข้อมูลแบรนด์ (brand.md)" ที่เป็นแหล่งบริบทให้ AI ถูกซ่อนไว้ในแผงย่อย "สร้างด้วย AI" ที่ต้องกดเปิดเองก่อนถึงจะเห็น ทำให้ผู้ใช้พลาดฟีเจอร์นี้ได้ง่าย ต่างจากหน้า "AI วางแผนแคมเปญ" ที่ทำถูกอยู่แล้ว (ฟิลด์ทั้งหมดอยู่ในฟอร์มหลัก พร้อมกติกา "อย่างน้อย 1 แหล่งข้อมูล" ทั้ง client และ server)

## What Changes

- **สร้างคอนเทนต์เดี่ยว** (`QuickCreateDialog.tsx`, ทั้งโหมดบทความและวีดีโอสคริปต์): ปุ่ม "สร้าง" เปิดใช้งานได้เมื่อมีอย่างน้อย 1 ใน 4: หัวข้อ, Trigger, Skill, หรือ Knowledge Base — ไม่บังคับหัวข้ออีกต่อไป
- **Batch สร้างคอนเทนต์** (`BatchGenerateDialog.tsx`, ทั้งโหมดบทความและวีดีโอสคริปต์): แต่ละแถวหัวข้อผ่านเงื่อนไขได้เมื่อมีอย่างน้อย 1 ใน 4 (หัวข้อ/Trigger/Skill/KB) แทนที่จะบังคับหัวข้อเป็นช่องเดียว — ยังคงต้องมี ≥3 แถวที่ผ่านเงื่อนไข และยังต้องเลือกแพลตฟอร์มต่อแถวเหมือนเดิม
- **Backend** (`api/brand-content.php action=generate-plan`, `api/lib/content-plan-prompt.php`): แก้ guard ให้ตรงกับกติกาใหม่ — `content_plan_has_any_topic_source()` นับ Skill/Knowledge Base เป็นแหล่งข้อมูลด้วย (เดิมนับแค่ trigger/topic) และลบ guard ที่สอง (`content_plan_direct_requires_topic()`) ที่บังคับหัวข้อซ้ำสำหรับ Direct mode โดยไม่สนแหล่งข้อมูลอื่น
- **สร้างแคมเปญใหม่** (`CampaignsPage.tsx`): ย้ายฟิลด์ "เลือกสินค้า", "โทนการเขียน", "ใช้ข้อมูลแบรนด์ (brand.md)" ออกจากแผงย่อยที่ต้องกดเปิด ("สร้างด้วย AI") ไปไว้ในส่วน "ข้อมูลแคมเปญ" (ส่วนที่ 1 ของฟอร์ม แสดงตลอดเวลา) และย้ายปุ่มที่สั่งให้ AI สร้างเนื้อหาจริง (เดิมอยู่ในแผงย่อย) ไปไว้ใน footer ของ dialog ร่วมกับปุ่ม ยกเลิก/บันทึกร่าง/ตั้งเวลาส่ง/ส่งทันที — ปุ่ม toggle เปิด/ปิดแผงเดิมไม่จำเป็นอีกต่อไปเพราะฟิลด์แสดงตลอดเวลาแล้ว ตรรกะ "อย่างน้อย 1 แหล่งข้อมูล" (สินค้า/หัวข้ออีเมล/brand.md) ของปุ่มสร้างด้วย AI คงเดิมทุกอย่าง แค่ย้ายตำแหน่ง
- **AI วางแผนแคมเปญ** (`AICampaignPlanDialog.tsx`): ไม่มีการเปลี่ยนแปลง — ตรง spec อยู่แล้ว

## Capabilities

### New Capabilities
- `content-generation-input-sources`: กติกา "อย่างน้อย 1 ใน 4 แหล่งข้อมูล (หัวข้อ/Trigger/Skill/Knowledge Base)" สำหรับการสร้างคอนเทนต์แบบ Direct mode ทั้งเดี่ยวและ Batch ครอบคลุมทั้ง client-side (ปุ่มเปิดใช้งาน) และ server-side (`generate-plan` guard)

### Modified Capabilities
- `campaign-ai-content-generation`: เปลี่ยนตำแหน่ง UI ของฟิลด์เลือกสินค้า/โทน/brand context และปุ่มสั่งสร้างเนื้อหาด้วย AI (จากแผงย่อยที่ต้องกดเปิด → ฟิลด์อยู่ในฟอร์มหลัก + ปุ่มอยู่ที่ footer) — ตรรกะการสร้างเนื้อหา/กติกาแหล่งข้อมูลขั้นต่ำไม่เปลี่ยน

## Impact

- **Backend**: `api/lib/content-plan-prompt.php` (`content_plan_has_any_topic_source()` เพิ่มพารามิเตอร์ skill/KB, ลบ `content_plan_direct_requires_topic()` หรือปรับให้ไม่บังคับซ้ำ), `api/brand-content.php` (`generate-plan` guard), `api/tests/content-plan-generate-request-validation-test.php` (ปรับเทสต์ตามฟังก์ชันที่เปลี่ยน)
- **Frontend**: `src/components/content/dialogs/QuickCreateDialog.tsx`, `src/components/content/dialogs/BatchGenerateDialog.tsx`, `src/pages/CampaignsPage.tsx`
- **ไม่มี migration**: ไม่มีการเปลี่ยนโครงสร้างตาราง
- **ไม่อยู่ในขอบเขต**: `AICampaignPlanDialog.tsx` (ตรง spec อยู่แล้ว), การเปลี่ยนกติกาการบังคับ ชื่อแคมเปญ/หัวข้ออีเมล ตอนบันทึกแคมเปญ (ยังคงบังคับทั้งคู่เหมือนเดิม — คนละกติกากับแหล่งข้อมูลของ AI generation), เทสต์ 8 เคสที่ fail อยู่ก่อนหน้า (BatchGenerateDialog tone default, QuickCreateDialog selector ambiguity, PullFromContentDialog badge label) — เป็นปัญหาคนละเรื่อง แยกไปทำต่างหาก
