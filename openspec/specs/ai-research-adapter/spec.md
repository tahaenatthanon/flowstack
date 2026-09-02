# ai-research-adapter Specification

## Purpose

กำหนด contract ของ adapter AI fetch สำหรับ Content Research (`research_fetch_ai()` / `research_test_ai()`) ที่คืน shape กลางเดียวกันกับ adapter DataForSEO เดิม เพื่อให้ชั้น dispatch (`content-research.php`, Phase 3) ใช้ provider `ai` ได้โดยไม่รู้โครงสร้างเฉพาะของ gateway

## Requirements

### Requirement: AI fetch uses the verified research model
`research_fetch_ai()` SHALL ใช้ model string, base_url และ credential resolve path ที่ผ่านการยืนยันแล้วจาก capability `ai-research-web-search` (provider `provider-openrouter`, model `perplexity/sonar`, base_url `https://openrouter.ai/api/v1`) และ SHALL ส่ง payload ขั้นต่ำ `{model, messages, stream:false, max_tokens}` โดยไม่มี param บังคับ search

#### Scenario: A verified model string is used
- **WHEN** adapter ยิง Research AI
- **THEN** payload ใช้ model `perplexity/sonar` และ base_url ของ OpenRouter ตามค่าคงที่ที่ยืนยันแล้ว

#### Scenario: No extra search parameter is sent
- **WHEN** adapter สร้าง payload
- **THEN** payload มีเฉพาะ `model`, `messages`, `stream:false`, `max_tokens` โดยไม่ส่ง param บังคับ search เพิ่มเติม

### Requirement: AI fetch returns the common research shape
`research_fetch_ai()` SHALL คืน `serp` (`organic[]`, `people_also_ask[]`, `related_searches[]`), `keywords[]`, `raw` และ `cost_usd` ใน shape เดียวกับ `research_fetch_dataforseo()` เพื่อให้ endpoint ใช้ได้โดยไม่ต้องแยก logic ตาม provider

#### Scenario: Fetch succeeds
- **WHEN** Research AI คืน structured JSON ที่ parse ได้
- **THEN** adapter คืน `serp`, `keywords`, `raw` และ `cost_usd` ในรูปแบบกลางที่ endpoint ใช้ได้

#### Scenario: Fetch response is malformed
- **WHEN** Research AI ไม่คืน JSON ที่ parse ได้
- **THEN** adapter คืนผลล้มเหลวโดยไม่คืนข้อมูลบางส่วนเป็นผลสำเร็จ

### Requirement: AI keyword metrics remain null
adapter SHALL เก็บ `search_volume`, `competition`, `cpc`, `difficulty` เป็น `null` **เสมอ** สำหรับ keyword จาก AI fetch และ SHALL ไม่เติมค่า `0` หรือตัวเลขที่ AI แต่งขึ้นแทน metric

#### Scenario: Keyword has no quantitative metrics
- **WHEN** keyword มาจาก Research AI
- **THEN** normalized keyword มี `search_volume`, `competition`, `cpc`, `difficulty` เป็น `null`

#### Scenario: AI fabricates a metric
- **WHEN** AI ตอบกลับมาพร้อมค่าตัวเลข metric ที่ไม่ใช่จาก provider จริง
- **THEN** adapter ละทิ้งค่านั้นและคง field เป็น `null`

### Requirement: AI keyword source and intent are preserved
adapter SHALL กำหนด `source` ของ keyword จาก AI fetch เป็น `ai_search` และ SHALL คง `intent` ที่ AI คืนมา (informational/commercial/transactional/navigational) หรือเป็น `null` เมื่อ AI ไม่ให้ และ SHALL รวม seed keyword ไว้ในผลลัพธ์ด้วย `source: 'seed'`

#### Scenario: Seed keyword is included
- **WHEN** adapter normalize ผลจาก AI fetch
- **THEN** รายการ keywords มี seed keyword พร้อม `source: 'seed'` เสมอ

#### Scenario: Intent is preserved when provided
- **WHEN** AI คืน intent ให้ keyword
- **THEN** keyword เก็บ intent นั้น และ keyword ที่ไม่มี intent จะเป็น `null`

### Requirement: AI fetch preserves raw response
adapter SHALL เก็บ raw response ทั้งหมดจาก Research AI ลงใน `raw` (ใน shape ที่ endpoint เขียนลง `raw_serp` ได้โดยตรง) เพื่อให้ตรวจสอบย้อนหลังได้เท่ากับ DataForSEO

#### Scenario: Raw response is retained
- **WHEN** AI fetch สำเร็จ
- **THEN** ผลลัพธ์มี `raw` ที่เก็บ response ดิบของ gateway โดยไม่ถูกตัด citation หรือ metadata ออก

### Requirement: AI fetch test verifies readiness
`research_test_ai()` SHALL ยิง probe สั้นด้วย credential + model ที่ยืนยันแล้ว และ SHALL คืนผลสำเร็จ/ล้มเหลวโดยไม่เปิดเผย credential และไม่จำเป็นต้องคืน balance แบบ DataForSEO

#### Scenario: Test succeeds
- **WHEN** credential และ model พร้อมใช้และยิง probe สำเร็จ
- **THEN** adapter คืนผลสำเร็จโดยไม่มี credential หลุดในผลลัพธ์

#### Scenario: Test fails
- **WHEN** credential ไม่พร้อมหรือ gateway ปฏิเสธ
- **THEN** adapter คืนผลล้มเหลวพร้อมข้อความที่ endpoint แปลงเป็นภาษาไทยได้

### Requirement: AI fetch failures are explicit
adapter SHALL ตรวจ HTTP status, response shape และ timeout ของ Research AI แล้วคืน error ที่ endpoint จัดการได้ และ SHALL ไม่ส่ง credential หรือข้อความดิบที่ไม่ปลอดภัยกลับออกไป

#### Scenario: Gateway request times out
- **WHEN** Research AI ไม่ตอบกลับภายใน timeout
- **THEN** adapter คืนผลล้มเหลวโดยไม่คืนข้อมูลบางส่วนเป็นผลสำเร็จ

#### Scenario: Gateway rejects the request
- **WHEN** gateway คืน HTTP >= 400 หรือ `error` ใน response
- **THEN** adapter คืน error พร้อมข้อความภาษาไทยที่สื่อถึงสาเหตุโดยไม่เปิดเผย key
