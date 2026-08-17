## MODIFIED Requirements

### Requirement: Approval list supports filtering and sorting
ระบบ SHALL รองรับการกรองรายการตามสถานะผ่าน Tab Navigation, การกรองตามประเภทผ่าน Type Filter, การกรองตามแพลตฟอร์มผ่าน Platform Filter, การค้นหาผ่านช่องค้นหา, และการจัดเรียงตามวันที่ขออนุมัติ (`requested_at`) ผ่าน Dropdown

#### Scenario: Filter by status tab
- **WHEN** ผู้ใช้เลือก Tab "ขอแก้ไข"
- **THEN** ระบบแสดงเฉพาะรายการที่มี status เป็น `revision`

#### Scenario: Filter by content type
- **WHEN** ผู้ใช้เลือก "บทความ" จาก Type Filter
- **THEN** ระบบแสดงเฉพาะรายการที่มี `content_type` เป็น `article`

#### Scenario: Type filter and tab work together
- **WHEN** ผู้ใช้เลือก Tab "รออนุมัติ" และ Type Filter "วีดีโอ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และ `content_type` เป็น `video`

#### Scenario: Filter by platform
- **WHEN** ผู้ใช้เลือก filter แพลตฟอร์ม
- **THEN** ระบบแสดงเฉพาะรายการที่ตรงกับแพลตฟอร์มที่เลือก

#### Scenario: Search across filtered results
- **WHEN** ผู้ใช้พิมพ์คำค้นหาในช่องค้นหา และเลือก Tab "รออนุมัติ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และชื่อตรงกับคำค้นหา

#### Scenario: Sort by request approval date (newest first)
- **WHEN** ผู้ใช้เลือก "ขออนุมัติล่าสุด → เก่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากใหม่สุดไปเก่าสุด

#### Scenario: Sort by request approval date (oldest first)
- **WHEN** ผู้ใช้เลือก "ขออนุมัติเก่าสุด → ล่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากเก่าสุดไปใหม่สุด

#### Scenario: All tools grouped in toolbar
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Tab Navigation (แถวบน), ช่องค้นหาพร้อมไอคอน `Search` (แว่นขยาย), Type Filter, Platform Filter, และ Sort Dropdown (แถวล่าง) ถูกจัดวางใน toolbar บริเวณเดียวกันระหว่าง Stat Cards และตาราง