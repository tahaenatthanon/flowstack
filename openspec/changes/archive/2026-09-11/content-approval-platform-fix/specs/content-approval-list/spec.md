## MODIFIED Requirements

### Requirement: User can view content approval list
ระบบ SHALL แสดงรายการอนุมัติคอนเทนต์เป็น Tab "รายการอนุมัติ" ในหน้าผลงานคอนเทนต์ (`ContentPage`, route `/content`) เท่านั้น — ไม่มี route แยก `/content-approval` — โดยวางถัดจาก Tab "ผลงานทั้งหมด" ทันที และแสดง content items เฉพาะที่อยู่ใน workflow การอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected`) — ไม่รวม `draft` และ `published` มี Filter Status Dropdown สำหรับกรองตามสถานะ ประกอบด้วย: ทุกสถานะ (ไม่รวม draft/published), อนุมัติแล้ว (`approved`), รออนุมัติ (`pending_approval`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`)

#### Scenario: Approval list shown as a tab in content page
- **WHEN** ผู้ใช้ที่มีสิทธิ์เข้าถึง `/content`
- **THEN** เห็น Tab "รายการอนุมัติ" อยู่ใน Tab Menu ถัดจาก Tab "ผลงานทั้งหมด"

#### Scenario: เปิด Tab รายการอนุมัติผ่าน URL
- **WHEN** ผู้ใช้เข้าถึง `/content?tab=approval`
- **THEN** หน้า `/content` เปิด Tab "รายการอนุมัติ" โดยตรง (ไม่ใช่ Tab "ผลงานทั้งหมด")

#### Scenario: Route /content-approval ถูกยกเลิก
- **WHEN** ผู้ใช้เข้าถึง `/#/content-approval`
- **THEN** ไม่มี route นี้ (แสดง NotFound) — ฟังก์ชันรายการอนุมัติเข้าถึงได้ผ่าน Tab ใน `/content` เท่านั้น

#### Scenario: Approval list filters to approval-relevant items only
- **WHEN** ผู้ใช้เปิด Tab "รายการอนุมัติ"
- **THEN** ระบบแสดงตารางรายการคอนเทนต์ที่มี status เป็น `pending_approval`, `approved`, `revision`, หรือ `rejected` — draft และ published items ไม่แสดง พร้อมข้อมูล: ชื่อคอนเทนต์, ประเภท, แพลตฟอร์ม, วันที่สร้าง, สถานะ และมี Stat Cards สรุปจำนวนแต่ละสถานะด้านบน

#### Scenario: Sidebar no longer lists approval entry
- **WHEN** ผู้ใช้ดู Sidebar ฝั่ง "การตลาด"
- **THEN** ไม่มีรายการเมนู "รายการอนุมัติ" แยก (ย้ายไปเป็น Tab ในหน้าผลงานคอนเทนต์แล้ว)

#### Scenario: Default filter is "ทุกสถานะ"
- **WHEN** ผู้ใช้เปิด Tab "รายการอนุมัติ" ครั้งแรก
- **THEN** Filter Status Dropdown ถูกเลือกเป็น default "ทุกสถานะ" และตารางแสดงเฉพาะ approval-relevant items

#### Scenario: No items in selected status
- **WHEN** สถานะที่เลือกไม่มี content items
- **THEN** ระบบแสดงข้อความ "ไม่มีรายการ" พร้อมระบุสถานะที่เกี่ยวข้อง

#### Scenario: คอลัมน์แพลตฟอร์มแสดง badge แรกพร้อมตัวเลขที่เหลือเมื่อ item มีหลายแพลตฟอร์ม
- **WHEN** content item มีมากกว่า 1 แพลตฟอร์ม (parse จาก `platforms` หรือ `platform`)
- **THEN** คอลัมน์ "แพลตฟอร์ม" แสดง badge ของแพลตฟอร์มแรก (ตามลำดับที่ parse ได้) ตามด้วยป้าย `+N` โดย N คือจำนวนแพลตฟอร์มที่เหลือ โดยไม่ทำให้ความสูงแถวเปลี่ยนไป

#### Scenario: คอลัมน์แพลตฟอร์มแสดง badge เดียวเมื่อ item มีแพลตฟอร์มเดียว
- **WHEN** content item มีแพลตฟอร์มเดียว
- **THEN** คอลัมน์ "แพลตฟอร์ม" แสดง badge ของแพลตฟอร์มนั้นโดยไม่มีป้าย `+N`

#### Scenario: คอลัมน์แพลตฟอร์มแสดง "-" เมื่อ item ไม่มีแพลตฟอร์ม
- **WHEN** content item ไม่มีแพลตฟอร์มเลย (parse ได้ array ว่าง)
- **THEN** คอลัมน์ "แพลตฟอร์ม" แสดง "-" เหมือนพฤติกรรมเดิม

### Requirement: Approval list supports filtering and sorting
ระบบ SHALL รองรับการกรองรายการตามสถานะผ่าน Filter Status Dropdown, การกรองตามประเภทผ่าน Type Filter, การกรองตามแพลตฟอร์มผ่าน Platform Filter, การค้นหาผ่านช่องค้นหา, และการจัดเรียงตามวันที่ขออนุมัติ (`requested_at`) ผ่าน Dropdown

#### Scenario: Filter by status dropdown
- **WHEN** ผู้ใช้เลือกสถานะ "ขอแก้ไข" จาก Filter Status Dropdown
- **THEN** ระบบแสดงเฉพาะรายการที่มี status เป็น `revision`

#### Scenario: Filter by content type
- **WHEN** ผู้ใช้เลือก "บทความ" จาก Type Filter
- **THEN** ระบบแสดงเฉพาะรายการที่มี `content_type` เป็น `article`

#### Scenario: Type filter and status filter work together
- **WHEN** ผู้ใช้เลือกสถานะ "รออนุมัติ" จาก Filter Status และ Type Filter "วีดีโอ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และ `content_type` เป็น `video`

#### Scenario: Filter by platform matches items with multiple platforms
- **WHEN** ผู้ใช้เลือก filter แพลตฟอร์ม `platformFilter='facebook'` และมี content item ที่มีหลายแพลตฟอร์ม (เช่น `platforms=["facebook","linkedin"]`)
- **THEN** ระบบแสดง content item นั้นในผลกรอง เนื่องจากระบบ parse รายการแพลตฟอร์มของ item ก่อนเช็คว่ามีแพลตฟอร์มที่เลือกกรองอยู่หรือไม่ (ไม่เทียบค่าดิบทั้งก้อนแบบ exact-match)

#### Scenario: Filter by platform excludes items without that platform
- **WHEN** ผู้ใช้เลือก filter แพลตฟอร์ม `platformFilter='youtube'` และมี content item ที่ `platforms=["facebook","linkedin"]`
- **THEN** content item นั้นไม่ปรากฏในผลกรอง

#### Scenario: Platform filter dropdown lists individual platforms from multi-platform items
- **WHEN** มี content item ที่มีหลายแพลตฟอร์ม (เช่น `platforms=["facebook","linkedin"]`) อยู่ในรายการที่กรองด้วยสถานะ/ประเภทปัจจุบันแล้ว
- **THEN** Platform Filter Dropdown แสดงตัวเลือก "Facebook" และ "LinkedIn" แยกกัน ไม่แสดงค่าดิบรวม (เช่น "facebook,linkedin") เป็นตัวเลือกเดียว

#### Scenario: Search across filtered results
- **WHEN** ผู้ใช้พิมพ์คำค้นหาในช่องค้นหา และเลือกสถานะ "รออนุมัติ" จาก Filter Status
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และชื่อตรงกับคำค้นหา

#### Scenario: Sort by request approval date (newest first)
- **WHEN** ผู้ใช้เลือก "ล่าสุด-เก่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากใหม่สุดไปเก่าสุด

#### Scenario: Sort by request approval date (oldest first)
- **WHEN** ผู้ใช้เลือก "เก่าสุด-ล่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากเก่าสุดไปใหม่สุด

#### Scenario: All tools grouped in toolbar
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** ช่องค้นหาพร้อมไอคอน `Search` (แว่นขยาย), Filter Status Dropdown, Type Filter, Platform Filter, และ Sort Dropdown ถูกจัดวางใน toolbar บริเวณเดียวกันระหว่าง Stat Cards และตาราง
