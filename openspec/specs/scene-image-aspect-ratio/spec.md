# scene-image-aspect-ratio Specification

## Purpose

กำหนดการสร้างภาพประจำฉากตามอัตราส่วนวิดีโอของ content item แยกตาม provider ของ model ภาพ (OpenRouter Image API พร้อม `aspect_ratio` / Kilo ระบุใน prompt / อื่นๆ ใช้ `size`) โดยไม่ครอปภาพ — ที่มา: change `video-creation-options`

## Requirements

### Requirement: ภาพประจำฉากสร้างตามสัดส่วนของ content item
`generate-scene-images` และ `generate-scene-image` SHALL สร้างภาพตาม `content_items.video_aspect_ratio` (NULL → `9:16`) — SHALL ไม่ครอปหรือเติมขอบภาพที่ได้ในฝั่ง server — ถ้า model ภาพคืนภาพที่สัดส่วนไม่ตรง ระบบ SHALL บันทึกภาพนั้นตามปกติ (Veo/Seedance ปรับสัดส่วนเองได้)

#### Scenario: คอนเทนต์ 9:16
- **WHEN** ผู้ใช้กด "สร้างภาพทุกฉาก" ของคอนเทนต์ที่ `video_aspect_ratio = '9:16'`
- **THEN** คำขอไปยัง model ภาพของทุกฉาก SHALL ระบุสัดส่วน 9:16 (ตามวิธีของ provider)

#### Scenario: retry ภาพฉากเดียว
- **WHEN** ผู้ใช้กดสร้างภาพใหม่เฉพาะฉากที่ 3 ของคอนเทนต์ `16:9`
- **THEN** คำขอ SHALL ระบุสัดส่วน 16:9 เหมือนกับตอนสร้างทุกฉาก

### Requirement: provider OpenRouter ใช้ Image API พร้อม aspect_ratio
เมื่อ model ภาพอยู่ภายใต้ provider ที่ `api_base_url` เป็นของ OpenRouter ระบบ SHALL เรียก `POST {baseUrl}/images` (Image API) ด้วย `{model, prompt, aspect_ratio, n: 1}` และอ่านภาพจาก `data[0].b64_json` — SHALL ไม่ส่ง `size: 1024x1024` แบบเดิม — ถ้า model ไม่รองรับสัดส่วนที่ขอ (OpenRouter ตอบ 400) ระบบ SHALL บันทึก `image_gen_status = 'failed'` พร้อม `image_gen_error` ที่มีข้อความจาก provider

#### Scenario: Nano Banana 9:16
- **WHEN** model ภาพคือ `google/gemini-2.5-flash-image` บน OpenRouter และคอนเทนต์เป็น `9:16`
- **THEN** payload SHALL มี `aspect_ratio: "9:16"` และภาพที่บันทึก SHALL เป็นแนวตั้ง

#### Scenario: model ไม่รองรับสัดส่วน
- **WHEN** model ภาพคือ `openai/gpt-5-image-mini` (รองรับแค่ 1:1/2:3/3:2) และ OpenRouter ตอบ 400
- **THEN** ฉากนั้น SHALL มี `image_gen_status = 'failed'` และ `image_gen_error` ที่อ่านแล้วรู้ว่าสัดส่วนไม่รองรับ

### Requirement: provider Kilo บอกสัดส่วนใน prompt
เมื่อ model ภาพอยู่ภายใต้ provider Kilo (เรียก `chat/completions` ซึ่งไม่มีพารามิเตอร์ขนาดภาพ) ระบบ SHALL เติมข้อความกำหนดสัดส่วนลงใน prompt เช่น `vertical 9:16 portrait composition` หรือ `horizontal 16:9 landscape composition`

#### Scenario: Kilo 16:9
- **WHEN** model ภาพอยู่บน Kilo และคอนเทนต์เป็น `16:9`
- **THEN** ข้อความที่ส่งให้ model SHALL มีคำกำหนดสัดส่วนแนวนอน 16:9
