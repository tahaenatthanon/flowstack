## 1. SEO/AEO Status Support

- [x] 1.1 เพิ่ม `pending` ใน `SeoRuleLevel` และ type ของผลตรวจ SEO
- [x] 1.2 เพิ่ม icon, สี และรูปแบบการแสดงผลสำหรับสถานะ `pending` ใน `ArticleEditor`
- [x] 1.3 เพิ่ม fallback metadata สำหรับ level ที่ไม่รู้จัก เพื่อไม่ให้ `SEO_LEVEL_META[rule.level]` ทำให้หน้า crash
- [x] 1.4 ตรวจข้อความและสไตล์ให้ pending แยกจาก warn/fail และเป็นภาษาไทย

## 2. Verification

- [x] 2.1 เพิ่มหรือปรับ test ให้เปิดแผง `SEO / AEO Metadata` ได้เมื่อผลตรวจมี `pending`
- [x] 2.2 ทดสอบกรณีผลตรวจมี level ที่ไม่รู้จักและยืนยันว่า Page ยัง render ได้
- [x] 2.3 รัน `pnpm lint`, `pnpm build` และ `pnpm test`
