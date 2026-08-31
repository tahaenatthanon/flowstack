## Why

AI Research ยังไม่มีพื้นที่เก็บ job, keyword และค่าเชื่อมต่อ DataForSEO ในฐานข้อมูล ทำให้ไม่สามารถเก็บผล Research แบบตรวจสอบย้อนหลังหรือ reuse cache ได้ และยังไม่มีช่องทางให้ผู้ดูแลตั้งค่า provider โดยไม่เปิดเผย secret

## What Changes

- เพิ่มตาราง `content_research_jobs` สำหรับเก็บสถานะ, raw response, analysis, cost และความสัมพันธ์กับ content
- เพิ่มตาราง `content_research_keywords` สำหรับ keyword metrics ที่ค้นคืนและการเลือก keyword
- เพิ่มคอลัมน์ตั้งค่า Research แบบแยก tenant ใน `content_global_settings`
- รันและตรวจสอบ migration กับ MariaDB ทันทีตามกฎโครงการ
- ขยาย settings API ให้บันทึก credential แบบเข้ารหัสและคืนเฉพาะสถานะว่ามี key
- เพิ่มฟอร์มตั้งค่า Research ในหน้าตั้งค่าเดิม พร้อมค่าเริ่มต้นสำหรับประเทศไทย
- เพิ่มการทดสอบ credential สำหรับใช้ใน phase backend ถัดไป แต่ยังไม่เชื่อม provider จริงใน change นี้

## Capabilities

### New Capabilities

- `content-research-storage`: โครงสร้างจัดเก็บ Research jobs และ keyword metrics แบบ tenant-safe
- `content-research-settings`: การตั้งค่า provider, credential และพารามิเตอร์ Research โดยไม่เปิดเผย secret

### Modified Capabilities

ไม่มี

## Impact

- Database migrations ใน `database/migrations/`
- `content_global_settings` และข้อมูลต่อ tenant
- `api/brand-content.php` หรือ settings API ที่รับผิดชอบ `action=global-settings`
- `src/components/content/types.ts` สำหรับ type ของ settings
- `src/components/brand/ResearchProviderForm.tsx` และ `src/pages/BrandSettingPage.tsx`
- ต้องใช้ XAMPP MariaDB และ encryption helper เดิมของระบบ
- ไม่มีการเปลี่ยน SEO gate, publish flow หรือ route `/content-pipeline` ใน change นี้
