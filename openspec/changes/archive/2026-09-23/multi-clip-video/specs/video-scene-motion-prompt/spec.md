## ADDED Requirements

### Requirement: ฉากใหม่ได้ `scene.id` และทุกจุดที่เขียนฉากคง id ไว้
`_visualsToScenes()` SHALL ใส่ `id` ที่ไม่ซ้ำให้ทุกฉากที่สร้าง (ฉากที่แปลงมาจาก `visuals` ที่มี `id` อยู่แล้ว SHALL ใช้ `id` เดิม) — ทุก action ที่เขียน `article_content.scenes[]` (`generate-scene-images`, `generate-scene-image`, `update-scene`, `generate-scene-video-prompt` และการบันทึกจาก dialog) SHALL คง `id` ของฉากที่มีอยู่แล้วไว้ — การเขียนสคริปต์ใหม่ที่ได้ `visuals` ชุดใหม่ SHALL ได้ฉากที่มี `id` ใหม่

#### Scenario: สร้างภาพทุกฉากครั้งแรก
- **WHEN** คอนเทนต์ยังไม่มี `scenes` และผู้ใช้กด "สร้างภาพทุกฉาก"
- **THEN** ทุกฉากใน `scenes` ที่บันทึก SHALL มี `id` ไม่ซ้ำกัน

#### Scenario: สร้างภาพฉากเดียวใหม่
- **WHEN** ผู้ใช้สร้างภาพของฉาก 3 ใหม่
- **THEN** `scenes[2].id` SHALL ไม่เปลี่ยน (แต่ `image_url` เปลี่ยน)

#### Scenario: แก้บทพากย์ผ่าน update-scene
- **WHEN** เรียก `update-scene` แก้ `narration` ของฉาก 1
- **THEN** `id` ของทุกฉาก SHALL ไม่เปลี่ยน
