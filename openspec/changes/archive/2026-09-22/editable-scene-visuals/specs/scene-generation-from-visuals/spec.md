## MODIFIED Requirements

### Requirement: Generate scene images button in ContentCardDialog
The `ContentCardDialog` component SHALL include a "สร้างภาพทุกฉาก" button that triggers `generate-scene-images` for the current content item. SceneCards (when `scenes` already exist) SHALL render above this button, not below it.

#### Scenario: Button visible and enabled
- **WHEN** a content item exists with `article_content` containing either `scenes` or `visuals`
- **THEN** the "สร้างภาพทุกฉาก" button SHALL be visible and enabled in the Video section

#### Scenario: Button shows loading state
- **WHEN** the user clicks "สร้างภาพทุกฉาก"
- **THEN** the button SHALL show a loading spinner with text "กำลังสร้างภาพทุกฉาก..."
- **AND** the button SHALL be disabled during generation

#### Scenario: Successful scene generation
- **WHEN** `generate-scene-images` completes successfully
- **THEN** a success toast SHALL appear with "สร้างภาพทุกฉากสำเร็จ!"
- **AND** content items and plans queries SHALL be invalidated to refresh the UI

#### Scenario: Layout order matches ContentVideoView
- **WHEN** `article_content.scenes` is non-empty and SceneCards is rendered in `ContentCardDialog`
- **THEN** the SceneCards grid SHALL appear immediately above the "สร้างภาพทุกฉาก" button in the DOM order

## ADDED Requirements

### Requirement: "ลำดับฉาก" แก้ไขข้อความได้ทั้งก่อนและหลังมี scenes
`ContentCardDialog` SHALL แสดงบล็อก "ลำดับฉาก" เป็นช่องข้อความแก้ไขได้แยกกล่องทีละฉาก (แต่ละฉากมีกล่อง `<Textarea>` เป็นของตัวเอง มีเลขลำดับกำกับ 1, 2, 3, ... อยู่ด้านหน้า) เสมอ ไม่ว่าจะยังไม่มี `scenes[]` (แก้ `visuals[].visual`) หรือมี `scenes[]` แล้ว (แก้ `scenes[].visual_prompt`) — SHALL ไม่รวมทุกฉากไว้ใน textarea เดียว และ SHALL ไม่ซ้ำอยู่ในแต่ละ SceneCards การ์ดอีก (บล็อกนี้อยู่แยกต่างหากเหนือ SceneCards จุดเดียว)

#### Scenario: แก้ไขข้อความในลำดับฉากก่อนมี scenes
- **WHEN** ผู้ใช้พิมพ์แก้ไขข้อความในกล่องที่ 2 ของ "ลำดับฉาก" (ยังไม่มี `scenes[]`)
- **THEN** ระบบ SHALL รับข้อความใหม่ในกล่องนั้นโดยยังไม่ส่ง API จนกว่าจะกดปุ่ม "บันทึก" หลักของ dialog — เมื่อบันทึกสำเร็จ SHALL อัปเดตเฉพาะ `visuals[1].visual` (index ตามกล่อง)

#### Scenario: entry แบบ object ที่มี motion ไม่ถูกแก้ไข
- **WHEN** รายการ visuals เป็นรูปแบบ `{visual, motion}` และผู้ใช้แก้ข้อความในกล่องที่สอดคล้องกัน
- **THEN** ระบบ SHALL แก้ไขเฉพาะค่า `visual` เท่านั้น — SHALL ไม่แตะต้องค่า `motion` เดิม

#### Scenario: แก้ไขข้อความในลำดับฉากหลังมี scenes
- **WHEN** ผู้ใช้พิมพ์แก้ไขข้อความในกล่องที่สอดคล้องกับ scene index 2 (มี `scenes[]` อยู่แล้ว)
- **THEN** ระบบ SHALL รับข้อความใหม่ในกล่องนั้นโดยยังไม่ส่ง API จนกว่าจะกดปุ่ม "บันทึก" หลักของ dialog — เมื่อบันทึกสำเร็จ SHALL อัปเดตเฉพาะ `scenes[2].visual_prompt`

#### Scenario: Scene card ไม่มีช่องลำดับฉากซ้ำ
- **WHEN** SceneCards render scene การ์ดหนึ่งใบ (มี `scenes[]` อยู่แล้ว)
- **THEN** การ์ดนั้น SHALL แสดงเฉพาะรูปภาพ, สถานะ, ปุ่ม "AI เขียน Video Prompt", และช่อง Video Prompt — SHALL ไม่มีช่องแก้ไข `visual_prompt` ซ้ำอยู่ในการ์ด
