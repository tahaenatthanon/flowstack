# approval-sort-order Specification

## Purpose

กำหนดพฤติกรรมของ Sort Dropdown สำหรับจัดเรียงรายการในหน้า "รายการอนุมัติ" (`/content-approval`) ตามวันที่สร้าง (`created_at`) รวมถึงค่าเริ่มต้นของการเรียงลำดับ และการทำงานร่วมกับ Tab Navigation และช่องค้นหา

## Requirements

### Requirement: Approval list supports sort by date
ระบบ SHALL แสดง Dropdown สำหรับจัดเรียงรายการตามวันที่สร้าง โดยมีตัวเลือก "ใหม่ → เก่า" (default) และ "เก่า → ใหม่"

#### Scenario: Default sort order
- **WHEN** ผู้ใช้เข้าถึง `/content-approval` ครั้งแรก
- **THEN** Dropdown แสดง "ใหม่ → เก่า" และรายการเรียงตาม `created_at` จากล่าสุดไปเก่าสุด

#### Scenario: Change sort order
- **WHEN** ผู้ใช้เลือก "เก่า → ใหม่" จาก Dropdown
- **THEN** รายการในตารางเรียงตาม `created_at` จากเก่าสุดไปล่าสุด

#### Scenario: Sort respects active tab and search
- **WHEN** ผู้ใช้เลือก Tab "ขอแก้ไข" และค้นหาคีย์เวิร์ด แล้วเปลี่ยนการเรียงลำดับ
- **THEN** ผลลัพธ์ที่กรองแล้วเรียงตาม sort order ที่เลือก
