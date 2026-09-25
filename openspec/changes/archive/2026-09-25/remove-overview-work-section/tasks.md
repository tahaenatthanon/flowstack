## 1. API

- [x] 1.1 `api/content-analytics.php` `?action=overview`: ถอดการคำนวณและคีย์ `queue` / `aging` ออกจาก response (ตรวจว่า `publishing_health` / `unpublished_aging` ไม่พึ่งตัวแปรที่ถอด) และแก้คอมเมนต์หัวไฟล์ที่อ้างถึงส่วนงาน (D2)
- [x] 1.2 ย้าย query รายการ `failed` เป็น `publishing_health.failures` (สูงสุด 10, เรียง `scheduled_at DESC`, ฟิลด์ `id, title, platform, channel_name, error_msg, retry_count, scheduled_at`) (D4)
- [ ] 1.3 ทดสอบ API บน local: response ไม่มี `queue`/`aging`, `publishing_health.failures` ตรงกับ SQL ตรวจมือ และตัวเลขส่วน BI ไม่เปลี่ยน (Publishing Health, unpublished_aging, status_summary)

## 2. Frontend

- [x] 2.1 `src/pages/ContentDashboardPage.tsx`: ลบ section "งานที่ต้องจัดการ" ทั้งหมด (แถบเตือนเลยกำหนด, คิวเผยแพร่, กำหนดการโพสต์ถัดไป, เผยแพร่ล้มเหลว, คอนเทนต์ที่ยังไม่เผยแพร่, เนื้อหาล่าสุด, ภาพรวมสถานะคอนเทนต์) (D1)
- [x] 2.2 ถอด state/hook/ตัวแปร/import ที่ไม่มีผู้ใช้แล้ว (`useOverdueCount`, `useAllSchedules`, `useSendNow`, `handleRetry`, `queueStatuses`, `agingBuckets`, `statusCounts`, `recentItems`, `upcomingSchedules` ฯลฯ) — คง `useContentItems` ที่แท็บวิเคราะห์ใช้ (D3)
- [x] 2.3 `src/components/content/types.ts`: ถอด `queue` / `aging` จาก `ContentOverview`, เพิ่ม `publishing_health.failures: QueueFailure[]` (ถอด `content_id`/`channel_id`) และลบ `StaleContentItem` ถ้าไม่มีผู้ใช้เหลือ (grep ก่อนลบ)
- [x] 2.4 `PublishingSection.tsx`: รายการ "การเผยแพร่ที่ล้มเหลว" ใต้ Success Rate — ชื่อคอนเทนต์, ป้ายแพลตฟอร์ม (+ชื่อช่องทางเมื่อไม่ซ้ำ), สาเหตุ (`error_msg` เต็ม / "ไม่ทราบสาเหตุ"), สถานะ ("ยังไม่ลองส่งใหม่" / "ลองส่งแล้ว N ครั้ง" + วันเวลากำหนดส่ง), "แสดง N จาก M รายการ" เมื่อเกิน, ไม่แสดงเมื่อไม่มีรายการ, ไม่มีปุ่ม และแก้คอมเมนต์หัวไฟล์ที่อ้างส่วน "งานที่ต้องจัดการ" (D4)

## 3. ตรวจสอบ

- [x] 3.1 test: แก้ `ContentOverviewBi.test.tsx` (ลำดับหัวข้อเหลือ 4 ส่วน, ไม่มี "งานที่ต้องจัดการ"/แถบเตือน/ปุ่มลองส่งใหม่, ลบ test ลองส่งใหม่; รายการล้มเหลวแสดงชื่อ/แพลตฟอร์ม/สาเหตุ/สถานะ, "แสดง N จาก M", ไม่มีรายการเมื่อ failed = 0) และ test อื่นที่ mock `queue`/`aging` หรือคาดกล่องงาน
- [ ] 3.2 เปิด dev server ตรวจแท็บภาพรวม: เหลือ 4 ส่วน, ไม่มี error ใน console, แท็บวิเคราะห์ยังทำงาน (ใช้ `useContentItems`), จอใหญ่และมือถือ
- [x] 3.3 รัน `pnpm lint`, `pnpm build`, `pnpm test` — lint 0 error, build ผ่าน, test ผ่าน 338 fail 8 ตัวเดิม (BatchGenerateDialog/PullFromContentDialog/QuickCreateDialog); ลบ `ContentDashboardPagePlatforms.test.tsx` (ทดสอบเฉพาะการ์ดเนื้อหาล่าสุด/ค้างท่อที่ถูกลบ)
