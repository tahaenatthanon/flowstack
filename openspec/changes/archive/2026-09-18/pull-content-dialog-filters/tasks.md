## 1. Backend: รองรับ status filter แบบ optional

- [x] 1.1 แก้ `api/content-items.php` GET handler: อ่าน `$_GET['status']` (comma-separated), แตกด้วย `explode(',', ...)`, กรองด้วย whitelist ค่าเดียวกับ `$validStatus` ที่มีอยู่แล้วในบล็อก PUT (ประกาศ local ซ้ำในบล็อก GET เพราะตัวแปรเดิมเป็น local ต่อ method block อยู่แล้ว — ไม่รีแฟกเตอร์ให้ใช้ร่วมกันเพื่อคุมขอบเขตการแก้ไข) ตัดค่าที่ไม่รู้จักทิ้งเงียบๆ ด้วย `array_intersect`
- [x] 1.2 ถ้า array ของ status หลัง whitelist ว่างเปล่า (ไม่ได้ส่ง param หรือส่งค่าที่ไม่ valid ทั้งหมด) ไม่เพิ่มเงื่อนไข `status` ใน SQL เลย (พฤติกรรมเดิมเป๊ะ)
- [x] 1.3 มี status ที่ valid อย่างน้อย 1 ค่า เพิ่มเงื่อนไข `AND ci.status IN (...)` ต่อจาก `search` condition เดิม
- [x] 1.4 ทดสอบผ่านสคริปต์ PHP เรียก query logic เดียวกับที่แก้ตรงๆ กับ DB จริง (endpoint ต้อง auth ผ่าน JWT ซึ่ง curl/browser fetch จากภายนอก session ทำไม่สะดวก — ทดสอบ logic ระดับ SQL แทน): ไม่ส่ง status → 50 แถวครบ 6 สถานะ (เหมือนเดิม), `status=approved,published` → 18 แถว เฉพาะ 2 สถานะนี้, `status=bogus` → fallback คืน 50 แถวครบเหมือนไม่ส่ง param, `status=draft` → 17 แถวเฉพาะ draft — ตรงตามที่ออกแบบไว้ทุกกรณี

## 2. Frontend: เพิ่มตัวกรองใน PullFromContentDialog

- [x] 2.1 เพิ่ม state `typeFilter`, `statusFilter`, `platformFilter` ใน `PullFromContentDialog.tsx` — `statusFilter` เริ่มต้นเป็น `['approved', 'published']` (ผ่านค่าคงที่ `DEFAULT_STATUS_FILTER`)
- [x] 2.2 แก้ query key เป็น `['content', 'items', { status: statusFilter }]` และส่ง `?status=${statusFilter.join(',')}` ใน `apiFetch` — แยกจาก `useContent.ts` (ยังใช้ `['content', 'items']` เฉยๆ ไม่มี status) ป้องกัน cache ปนกัน
- [x] 2.3 เพิ่ม UI pill-button สำหรับตัวกรองประเภท (ทั้งหมด/บทความ/วีดีโอ/รูปภาพ) เหนือช่องค้นหา — ใช้ pattern เดียวกับ `ContentPlannerPage.tsx` ผ่าน `TYPE_MAP`
- [x] 2.4 เพิ่ม UI pill-button สำหรับตัวกรองสถานะ ต่อจากตัวกรองประเภท — ใช้ label จาก `STATUS_MAP` เป็น multi-select (ต่างจาก type/platform ที่เลือกได้ทีละค่า เพราะ default ต้อง active พร้อมกัน 2 ปุ่ม: approved + published) พร้อม toggle handler และปุ่ม "ทั้งหมด" (array ว่าง)
- [x] 2.5 เพิ่ม UI pill-button สำหรับตัวกรองแพลตฟอร์ม ต่อจากตัวกรองสถานะ — ใช้ label/color จาก `PLATFORM_MAP` + `getPlatformColors`/`PlatformIcon` เหมือน `ContentPlannerPage.tsx`
- [x] 2.6 แก้ตัวแปร `filtered` ให้กรองตาม `typeFilter`/`platformFilter` เพิ่มจาก `search` เดิม — ใช้ `parsePlatforms()` แตกค่า platform ก่อนเช็คว่าตรงกับ `platformFilter` หรือไม่ — เพิ่ม reset ทุกตัวกรองกลับเป็นค่าเริ่มต้นใน `onOpenChange` ตอนปิด dialog ด้วย (สำหรับ task 3.5)

## 3. ทดสอบ

- [x] 3.1 เปิดหน้าต่าง "ดึงคอนเทนต์" ครั้งแรก — ยืนยันผ่านเบราว์เซอร์: pill "เผยแพร่แล้ว"+"อนุมัติแล้ว" active ตั้งแต่เปิด, network request เป็น `?status=approved,published`, รายการที่ render จริงมี 18 รายการ ตรงกับ 6 approved + 12 published เป๊ะ
- [x] 3.2 เปลี่ยนตัวกรองสถานะเป็น "ฉบับร่าง" (ปิด 2 pill default แล้วเปิด draft) — network request ไล่เปลี่ยนตามจริงทุกจังหวะ (`?status=approved` → `?status=` → `?status=draft`), รายการที่ render เหลือ 17 รายการ ตรงกับจำนวน draft จริงในระบบ
- [x] 3.3 ทดสอบตัวกรองประเภท/แพลตฟอร์ม: สลับสถานะกลับเป็น "ทั้งหมด" แล้วกรองแพลตฟอร์มเป็น "Line OA" — ทุกการ์ดที่แสดงมี badge "Line OA" ครบ รวมถึงรายการที่ฟิลด์ platform ดิบเป็น `"facebook,lineoa,lotusdomino"` (หลายค่าคั่นจุลภาค) ก็กรองเจอถูกต้องด้วย `parsePlatforms()`
- [x] 3.4 ทดสอบ regression: เปิด "ดึงคอนเทนต์" (เห็นแค่ approved+published) แล้วไปหน้า Content Planner — เห็น "แผนทั้งหมด 50" (ครบทุกสถานะ รวม badge "ร่าง" ที่ปรากฏจริง) ยืนยันไม่มี cache ปนกันระหว่าง query key `['content','items',{status}]` ของ dialog กับ `['content','items']` ของ `useContent.ts`
- [x] 3.5 ทดสอบ regression ผ่านเบราว์เซอร์จริง: เปลี่ยน platform filter เป็น "Line OA" → ปิด dialog ด้วยปุ่ม Close (X) → เปิดใหม่ — ยืนยันตัวกรองทั้งหมด (ประเภท/สถานะ/แพลตฟอร์ม) กลับเป็นค่าเริ่มต้นครบ (พบระหว่างทดสอบว่าปิดด้วยปุ่ม Escape ไม่ trigger `onOpenChange` ในสภาพแวดล้อมทดสอบนี้ — ไม่ใช่บั๊กของโค้ด แค่วิธีทดสอบที่ไม่ตรง ยืนยันซ้ำด้วยปุ่ม Close จริงแล้วทำงานถูกต้อง)

## 4. Verification

- [x] 4.1 รัน `pnpm lint` และ `pnpm build` — ทั้งคู่ผ่าน: lint 0 errors (มีแค่ 47 warnings เดิมที่ไม่เกี่ยวกับ change นี้), build สำเร็จ 19.90s ไม่มี error
