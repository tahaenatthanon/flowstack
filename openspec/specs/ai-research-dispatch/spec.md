# ai-research-dispatch Specification

## Purpose

กำหนด contract ของชั้น dispatch ใน `content-research.php` ที่ route provider `ai` ไป `research_fetch_ai()` / `research_test_ai()` และ provider `dataforseo` ไป adapter เดิม โดยคง cache, status, tenant-safety และไม่เปิดเผย credential

## Requirements

### Requirement: Research fetch dispatches by provider
`action=fetch` SHALL เลือก adapter ตาม `provider` — เมื่อ `provider='ai'` เรียก `research_fetch_ai()` และเมื่อ `provider='dataforseo'` เรียก `research_fetch_dataforseo()` — และ SHALL ไม่ guard ว่าเป็น dataforseo เท่านั้น

#### Scenario: AI provider is selected
- **WHEN** settings `provider` เป็น `ai` และผู้ใช้เรียก `fetch`
- **THEN** ระบบเรียก `research_fetch_ai()` และคืน job `done` พร้อม serp/keywords (metric ปริมาณเป็น `null`)

#### Scenario: DataForSEO provider is selected
- **WHEN** settings `provider` เป็น `dataforseo` และผู้ใช้เรียก `fetch`
- **THEN** ระบบเรียก `research_fetch_dataforseo()` เหมือนเดิมโดยไม่ถอยหลัง

### Requirement: Research test dispatches by provider
`action=test` SHALL เลือก adapter ตาม `provider` — เมื่อ `provider='ai'` เรียก `research_test_ai()` และเมื่อ `provider='dataforseo'` เรียก `research_test_dataforseo()` — โดยไม่เปิดเผย credential ใน response

#### Scenario: AI provider test succeeds
- **WHEN** provider `ai` พร้อมใช้ (credential + model ยืนยันแล้ว) และผู้ใช้เรียก `test`
- **THEN** ระบบคืน `ok: true` โดยไม่มี credential หลุดใน response

#### Scenario: DataForSEO provider test is unchanged
- **WHEN** provider เป็น `dataforseo`
- **THEN** ระบบทดสอบด้วย login/password ตามเดิมและไม่เปิดเผย credential

### Requirement: AI fetch failures produce failed jobs
เมื่อ `research_fetch_ai()` ล้มเหลว ระบบ SHALL เปลี่ยน job เป็น `failed` พร้อม `error_msg` ภาษาไทย และ SHALL ไม่รายงาน job เป็น `done` — เช่นเดียวกับ provider dataforseo

#### Scenario: AI fetch fails
- **WHEN** Research AI timeout หรือคืน error
- **THEN** job เป็น `failed` พร้อม `error_msg` และ API คืน HTTP error ที่เหมาะสม

### Requirement: Cache works for both providers
cache ของ `fetch` SHALL reuse job `done` ที่ตรงกับ tenant, provider, location_code, language_code และ seed keyword ภายใน cache window สำหรับทั้ง provider `ai` และ `dataforseo` และ SHALL คง `force_refresh` เป็นทางเดียวที่ bypass cache

#### Scenario: AI fetch hits cache
- **WHEN** fetch seed เดิมด้วย provider `ai` ภายใน cache window โดยไม่ส่ง force refresh
- **THEN** ระบบคืน job เดิมพร้อม `cached: true` และไม่เรียก AI ซ้ำ

#### Scenario: Force refresh bypasses cache
- **WHEN** ผู้ใช้ส่ง `force_refresh: true`
- **THEN** ระบบสร้าง fetch ใหม่โดยไม่ใช้ cached job

### Requirement: AI fetch does not leak credentials
response ของ `fetch` และ `test` สำหรับ provider `ai` SHALL ไม่คืน API key, encrypted key หรือ credential ใด ๆ ของ Research AI

#### Scenario: Fetch response is credential-free
- **WHEN** fetch สำเร็จด้วย provider `ai`
- **THEN** response มีเฉพาะ job, serp, keywords, cost และ metadata โดยไม่มี credential

### Requirement: Keyword ordering stays valid with null metrics
เมื่อ metric ปริมาณ (`search_volume` ฯลฯ) เป็น `null` ทั้งหมดจาก AI fetch ระบบ SHALL ยังคืนรายการ keyword ได้โดยไม่ crash และเรียงลำดับตาม sort key ที่เหลือ (keyword ASC) อย่างสมเหตุสมผล

#### Scenario: All metrics are null
- **WHEN** keywords จาก AI fetch มี `search_volume`/`difficulty` เป็น `null` ทั้งหมด
- **THEN** `research_keyword_rows()` คืนรายการครบโดยไม่ error และเรียงตาม `keyword` อย่างคงที่
