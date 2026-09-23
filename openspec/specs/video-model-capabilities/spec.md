# video-model-capabilities Specification

## Purpose

กำหนดว่า model วิดีโอประกาศ capability อย่างไรใน `ai_models.features.video` (ตระกูล API ของ kie.ai, ความยาว, ความละเอียด, หน่วยราคา, ชื่อฟิลด์ภาพ) การกรอง model ในหน้าตั้งค่า AI และการ sync models ที่ไม่ทับข้อมูลนี้ — ที่มา: change `kie-video-adapter`

## Requirements

### Requirement: Model วิดีโอประกาศ capability ใน `features.video`
ทุกแถวใน `ai_models` ที่ใช้สร้างวิดีโอได้ SHALL มี `features.video` ที่เป็น JSON object ประกอบด้วย:
- `api`: `"veo"` หรือ `"market"` — ตระกูล API ของ kie.ai ที่ใช้ยิง
- `durations`: array ของความยาวที่รองรับ (เช่น `[4,6,8]`) หรือ object `{min, max}` (เช่น `{"min":4,"max":12}`)
- `resolutions`: array ที่ SHALL มีทั้ง `"720p"` และ `"1080p"`
- `price_unit`: `"per_clip"` หรือ `"per_second"`
- `price_usd`: object ราคาต่อหน่วยแยกตามความละเอียด
- `image_field` (เฉพาะ `api = "market"`): ชื่อฟิลด์ที่ใช้ส่งภาพเริ่มต้น — `"input_urls"` (ส่งเป็น array) หรือ `"first_frame_url"` (ส่งเป็น string)

ระบบ SHALL ไม่ใช้ model ที่ไม่มี `features.video` ในการสร้างวิดีโอ

#### Scenario: Seedance 1.5 Pro ประกาศชื่อฟิลด์ภาพ
- **WHEN** อ่าน `features.video` ของ `bytedance/seedance-1.5-pro`
- **THEN** `api` SHALL เป็น `"market"` และ `image_field` SHALL เป็น `"input_urls"`

#### Scenario: Seedance 2.0 และ 2.5 ประกาศชื่อฟิลด์ภาพ
- **WHEN** อ่าน `features.video` ของ `bytedance/seedance-2` หรือ `bytedance/seedance-2-5`
- **THEN** `api` SHALL เป็น `"market"` และ `image_field` SHALL เป็น `"first_frame_url"`

#### Scenario: Model Veo ไม่ต้องมี image_field
- **WHEN** อ่าน `features.video` ของ `veo3`, `veo3_fast` หรือ `veo3_lite`
- **THEN** `api` SHALL เป็น `"veo"` และ `price_unit` SHALL เป็น `"per_clip"`

### Requirement: AI Settings แสดงเฉพาะ model วิดีโอที่ใช้ได้
dropdown เลือก model สำหรับ "Video Generation" ในหน้า AI Settings SHALL แสดงเฉพาะ model ที่มี `features.video` และ `status = 'active'` — SHALL ไม่แสดง model ที่ไม่มี `features.video` หรือ `status = 'inactive'` (เช่น `bytedance/seedance-2-fast`)

#### Scenario: model ที่ถูกปิดไม่แสดง
- **WHEN** แอดมินเปิด dropdown model วิดีโอ
- **THEN** SHALL ไม่เห็น `bytedance/seedance-2-fast` (status `inactive`)
- **AND** SHALL เห็น Veo 3.1 Lite/Fast/Quality และ Seedance 1.5 Pro/2.0/2.5

#### Scenario: model ที่ตั้งไว้เดิมไม่อยู่ในรายการ
- **WHEN** `company_settings.ai_content_video_model_id` ชี้ไปที่ model ที่ไม่มี `features.video`
- **THEN** หน้า AI Settings SHALL แสดงคำเตือนภาษาไทยว่า model ที่ตั้งไว้ใช้สร้างวิดีโอไม่ได้ และให้เลือกใหม่

### Requirement: Sync models ไม่เขียนทับ `features.video`
action sync models ใน `api/ai-providers.php` SHALL รวม (merge) ข้อมูลที่ได้จาก provider เข้ากับ `features` เดิมของแถวที่มีอยู่แล้ว — SHALL ไม่แทนที่ `features` ทั้งก้อน และ SHALL คงค่า `features.video` เดิมไว้เสมอ — สำหรับแถวที่มี `features.video` sync SHALL ไม่เปลี่ยน `status` (ปัจจุบัน sync ตั้ง `status = "active"` ทุกแถว ซึ่งจะเปิด model ที่ถูกปิดเพราะไม่รองรับ 1080p กลับมา)

#### Scenario: sync provider ที่มี model วิดีโออยู่แล้ว
- **WHEN** แอดมินกด sync models ของ provider ที่มีแถว `veo3_lite` พร้อม `features.video` อยู่แล้ว และ provider คืนข้อมูล `architecture` ของ model นี้มา
- **THEN** `features.architecture` SHALL ถูกอัปเดต
- **AND** `features.video` SHALL ยังคงเหมือนเดิมทุกค่า

#### Scenario: sync ไม่เปิด model วิดีโอที่ถูกปิดไว้
- **WHEN** แถว model วิดีโอมี `status = 'inactive'` และแอดมินกด sync models ของ provider นั้น
- **THEN** `status` ของแถวนั้น SHALL ยังเป็น `inactive`

### Requirement: คำอธิบายการตั้งค่า model วิดีโอตรงกับการใช้งานจริง
รายการ `ai_content_video_model_id` ใน `AIFeatureSettings.tsx` และ `AISettingsPanel.tsx` SHALL มีคำอธิบายว่าเป็นโมเดลสำหรับ "สร้างวิดีโอ" — SHALL ไม่ใช้คำอธิบายเดิม "โมเดลสำหรับสร้างสคริปต์และคำบรรยายวิดีโอ" เพราะค่านี้ใช้เฉพาะ `generate-video` / `video-status` (สคริปต์ใช้ model ข้อความ)

#### Scenario: แอดมินอ่านคำอธิบาย
- **WHEN** แอดมินเปิดหน้าตั้งค่า AI
- **THEN** รายการ "คอนเทนท์วิดีโอ" SHALL อธิบายว่าเป็นโมเดลสำหรับสร้างวิดีโอ (เช่น Veo / Seedance)
