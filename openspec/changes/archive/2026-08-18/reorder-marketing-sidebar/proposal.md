## Why

เมนูหมวด "การตลาด" ใน Sidebar ปัจจุบันเรียงลำดับไม่สอดคล้องกับ workflow การทำงานจริงของทีมคอนเทนต์ ซึ่งควรไล่จากแดชบอร์ด → งานผลิตคอนเทนต์ → งานวางแผน/แคมเปญ → งานวิเคราะห์ → เครื่องมือสร้างสื่อ เพื่อให้ผู้ใช้เข้าถึงเมนูที่ใช้บ่อยได้เป็นธรรมชาติมากขึ้น

## What Changes

- จัดเรียงลำดับรายการเมนูในกลุ่ม "การตลาด" ของ Sidebar ใหม่ให้เป็น:
  1. แดชบอร์ดคอนเทนต์ (`/content-dashboard`)
  2. คอนเทนต์โซเชียล (`/content`)
  3. ปฏิทินคอนเทนต์ (`/content-planner`)
  4. แคมเปญอีเมล (`/marketing`)
  5. วิเคราะห์แคมเปญ (`/campaign-analytics`)
  6. สตูดิโอสื่อ (`/media-studio`)
- คงฟังก์ชันการทำงาน, เส้นทาง (Route/`href`), ไอคอน และ `menuKey` ของแต่ละเมนูไว้เหมือนเดิม
- เปลี่ยนแปลงเฉพาะลำดับการเรียงรายการใน array `NAV_GROUPS` ภายในกลุ่ม `marketing` เท่านั้น ไม่แก้โครงสร้างกลุ่มอื่น

## Capabilities

### New Capabilities

(ไม่มี)

### Modified Capabilities

- `sidebar-nested-menu`: แก้ไข requirement "Marketing menu flattened" ให้ลำดับรายการเมนูการตลาดใหม่ (เลื่อน "คอนเทนต์โซเชียล" และ "ปฏิทินคอนเทนต์" ขึ้นก่อน "แคมเปญอีเมล")

## Impact

- `src/components/AppSidebar.tsx` — แก้ลำดับ items ใน `NAV_GROUPS` กลุ่ม `key: 'marketing'`
- ไม่กระทบ Route, menuKey, permissions, หรือ backend ใด ๆ
