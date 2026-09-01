## Why

Phase 1-4 วางฐาน AI Research, DataForSEO, analysis และ generation integration แล้ว แต่ยังต้องมีรอบตรวจ end-to-end เพื่อยืนยันว่า credential จริง, cache, tenant isolation, SEO metadata และ publish flow ทำงานร่วมกันได้ใน flow คอนเทนต์เดิมโดยไม่สร้าง `/content-pipeline`

ต้องทำตอนนี้เพราะผู้ใช้ตั้งค่า DataForSEO Login/Password แล้ว และปุ่มทดสอบการเชื่อมต่อใน UI ยังถูกปิดไว้ แม้ backend `action=test` มีพร้อมใช้งานแล้ว

## What Changes

- เพิ่มรอบ verification แบบ end-to-end สำหรับ AI Research ตั้งแต่ settings test, fetch, analyze, generate, SEO/AEO, approval, schedule และ publish
- เปิดให้ปุ่ม "ทดสอบการเชื่อมต่อ" ใน `ResearchProviderForm` เรียก backend `api/content-research.php?action=test`
- แสดงผลทดสอบ DataForSEO ด้วย toast ภาษาไทย โดยไม่เปิดเผย credential
- ตรวจ regression ของ flow เดิมเมื่อไม่ใช้ Research โดยเฉพาะ `meta_keywords` ต้องว่างตามข้อกำหนด
- ตรวจคุณภาพด้วย lint, build, test และ PHP syntax สำหรับไฟล์ที่เกี่ยวข้อง
- ไม่เพิ่ม route `/content-pipeline`, ไม่เพิ่ม `content_pipeline`, และไม่สร้าง wizard ใหม่

## Capabilities

### New Capabilities
- `ai-research-end-to-end-verification`: สัญญาการตรวจระบบ AI Research ครบ flow ด้วย credential จริง/จำลอง, cache, tenant safety, generation, SEO และ publish โดยใช้ flow คอนเทนต์เดิม

### Modified Capabilities
- `content-research-provider`: เพิ่มข้อกำหนดว่า UI settings ต้องสามารถทดสอบ credential ผ่าน endpoint ที่มีอยู่และแสดงผลโดยไม่เผย credential

## Impact

- Frontend: `src/components/brand/ResearchProviderForm.tsx`, hook/API client ที่เกี่ยวข้องกับ content research ถ้าจำเป็น
- Backend: ใช้ `api/content-research.php?action=test/fetch/analyze`, `api/brand-content.php?action=generate-article`, SEO checklist และ publish endpoints ที่มีอยู่
- Tests: เพิ่มหรือปรับ test สำหรับ Research settings test button และ end-to-end contract เท่าที่ทำได้โดยไม่ยิง provider จริงใน automated tests
- Operations: ต้องมี DataForSEO credential ที่ผู้ใช้ตั้งค่าไว้สำหรับ manual verification
