# legacy-publish-endpoints-retired Specification

## Purpose

กำหนด requirement ว่า legacy publish action ทั้ง 3 (`send_now-legacy`, `publish-legacy`, `cron-publish-legacy`) ที่เคยมีอยู่ใน `api/content-publish.php` และ `api/brand-content.php` SHALL ตอบ HTTP 410 เท่านั้นโดยไม่มีโค้ด logic อื่นตามหลัง response — ป้องกันไม่ให้มีใครเผลอเพิ่มโค้ดกลับเข้าไปหลัง guard ในอนาคต และยืนยันว่าการเผยแพร่จริงทั้งหมดต้องผ่าน central publish flow (`publish_via_central_flow`) เท่านั้น

## Requirements

### Requirement: legacy publish action ต้องตอบ 410 โดยไม่มี logic อื่นตามหลัง
`api/content-publish.php` action `send_now-legacy` และ `api/brand-content.php` action `publish-legacy`, `cron-publish-legacy` SHALL ตอบ HTTP 410 ทันทีที่ถูกเรียก และ SHALL ไม่มีโค้ด logic อื่นใด (query, dispatch, side effect) อยู่หลัง response นั้นในไฟล์ — เพื่อป้องกันไม่ให้เข้าใจผิดว่าโค้ดที่เหลืออยู่ยังทำงานอยู่จริง

#### Scenario: เรียก send_now-legacy
- **WHEN** client เรียก `api/content-publish.php?action=send_now-legacy`
- **THEN** ระบบตอบ HTTP 410 พร้อมข้อความแจ้งให้ใช้ central publish flow แทน
- **AND** ไม่มีการสร้าง queue row หรือ dispatch ไปยังปลายทางใดๆ

#### Scenario: เรียก publish-legacy
- **WHEN** client เรียก `api/brand-content.php?action=publish-legacy`
- **THEN** ระบบตอบ HTTP 410 พร้อมข้อความแจ้งให้ใช้ central publish flow แทน
- **AND** ไม่มีการอ่าน/เขียนตาราง `content_schedules` หรือ dispatch ไปยังปลายทางใดๆ

#### Scenario: เรียก cron-publish-legacy
- **WHEN** client หรือ cron เรียก `api/brand-content.php?action=cron-publish-legacy`
- **THEN** ระบบตอบ HTTP 410 พร้อมข้อความแจ้งให้ใช้ central publish flow แทน
- **AND** ไม่มีการ query หา schedule ที่ถึงกำหนดหรือ dispatch ใดๆ

### Requirement: การเผยแพร่จริงต้องผ่าน central publish flow เท่านั้น
เส้นทางเผยแพร่ที่ทำงานได้จริงทั้งหมด SHALL ไปผ่าน `publish_via_central_flow` เท่านั้น ไม่ผ่าน legacy action ที่ถูก retire แล้ว

#### Scenario: ไม่มี caller ภายในระบบเรียก legacy action
- **WHEN** ตรวจสอบ frontend (`src/`) และ endpoint อื่นทั้งหมดใน `api/`
- **THEN** ไม่พบการเรียกชื่อ action `send_now-legacy`, `publish-legacy`, หรือ `cron-publish-legacy` จากที่ใดเลย
