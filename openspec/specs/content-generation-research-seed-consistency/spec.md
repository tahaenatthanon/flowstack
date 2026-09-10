# content-generation-research-seed-consistency Specification

## Purpose

บังคับให้ทุก Generation Entry Point ที่ resolve Research seed topic (source_topic เป็นหลัก fallback ไป topic ปัจจุบันเมื่อว่าง) เรียก `researchSeedTopic()` จาก `useResearchRun.ts` แทนการเขียน fallback logic ของตัวเองซ้ำ — ยกระดับกฎที่มีอยู่แล้วในระดับ docblock ของโค้ดให้เป็น spec requirement ที่ตรวจสอบได้ ป้องกันไม่ให้ entry point ใหม่ในอนาคต drift ออกจากกติกาเดียวกัน

## Requirements

### Requirement: Generation entry points resolve Research seed via a single shared function
ทุก Generation Entry Point ที่ต้อง resolve Research seed topic (`source_topic` เป็นหลัก fallback ไป topic ปัจจุบันเมื่อว่าง) SHALL เรียก `researchSeedTopic()` จาก `useResearchRun.ts` และ SHALL ไม่เขียน fallback logic ของตัวเองซ้ำ

#### Scenario: ContentPlannerPage เรียก AI เขียนบทความจากการ์ด
- **WHEN** ผู้ใช้กด "AI เขียนให้" บนการ์ด content ใน Content Planner
- **THEN** seed topic ที่ส่งเข้า Research มาจากการเรียก `researchSeedTopic(item.source_topic, data.topic)` ไม่ใช่ fallback logic ที่เขียนแยกไว้ใน `ContentPlannerPage.tsx`

#### Scenario: ContentPlannerPage สร้างแผนด้วย AI แล้ว Research ต่อแต่ละ item
- **WHEN** "AI สร้างแผน" สร้าง content plan สำเร็จและเริ่มวน Research ต่อแต่ละ item
- **THEN** seed topic ของแต่ละ item มาจากการเรียก `researchSeedTopic(item.source_topic, item.topic)` ไม่ใช่ fallback logic ที่เขียนแยกไว้

#### Scenario: ผลลัพธ์ seed topic เหมือนเดิมทุกกรณี
- **WHEN** เปรียบเทียบ seed topic ที่ resolve ได้ก่อนและหลังเปลี่ยนมาเรียก `researchSeedTopic()`
- **THEN** ค่าที่ได้เหมือนกันทุกกรณี ไม่มีพฤติกรรมที่สังเกตได้เปลี่ยนไป
