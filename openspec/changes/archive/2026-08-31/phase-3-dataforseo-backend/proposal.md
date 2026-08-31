## Why

Phase 2 เตรียมตารางและการตั้งค่า DataForSEO แล้ว แต่ระบบยังไม่สามารถเรียกข้อมูลค้นหาจริงได้ หากไม่มี provider adapter และ API ที่ควบคุม cache, tenant ownership และข้อผิดพลาด จะไม่สามารถนำ SERP และ keyword metrics ไปใช้ใน Content Pipeline ได้อย่างน่าเชื่อถือ

## What Changes

- เพิ่ม adapter สำหรับ DataForSEO ที่เรียก SERP, Keyword Suggestions, Search Volume และ credential test
- normalize ผลจาก provider เป็นรูปแบบกลาง พร้อมเก็บ raw response และ cost
- เพิ่ม `api/content-research.php` สำหรับ settings status, test, fetch, job history และ keyword selection
- เพิ่ม cache ตาม tenant/provider/location/language/seed keyword เพื่อลดค่าใช้จ่ายซ้ำ
- เพิ่มสถานะ job และ error handling ภาษาไทย โดยไม่เปิดเผย credential
- เพิ่ม automated tests สำหรับ normalization, null metrics, cache และ tenant isolation

## Capabilities

### New Capabilities

- `content-research-provider`: การเรียกและ normalize ข้อมูลจาก DataForSEO ผ่าน adapter ที่เปลี่ยน provider ภายหลังได้
- `content-research-api`: API สำหรับจัดการ Research job, cache, keyword และสถานะการทำงานแบบ tenant-safe

### Modified Capabilities

ไม่มี

## Impact

- เพิ่ม `api/lib/keyword-research.php`
- เพิ่ม `api/content-research.php`
- อาจเพิ่ม test fixtures/tests สำหรับ backend contract
- ใช้ตารางและ settings จาก Phase 2
- ใช้ DataForSEO ผ่าน HTTPS/cURL และ credential ที่เข้ารหัสในฐานข้อมูล
- ยังไม่รวม AI analysis, การป้อนผลเข้า `generate-article` หรือหน้า `/content-pipeline`
