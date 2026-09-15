## Why

`GlobalSearch.tsx` (Cmd+K quick search) ยังมีรายการนำทาง 2 รายการที่ค้างมาจากก่อนรอบเปลี่ยนชื่อหน้า "แคมเปญอีเมล" — ป้าย "การตลาด" ไม่ตรงกับชื่อจริงในเมนูข้าง (`AppSidebar.tsx`) และมีรายการ "แคมเปญ" ซ้อนทับหน้าเดียวกันโดยไม่จำเป็น นอกจากนี้หน้า "วิเคราะห์แคมเปญ" (`/campaign-analytics`) ซึ่งใช้งานจริงและมีอยู่ใน sidebar กลับไม่มีอยู่ใน quick search เลย ทำให้ค้นหาแล้วได้ผลลัพธ์ไม่ตรงหรือหาไม่เจอ

## What Changes

- แก้รายการ GlobalSearch ที่ชี้ไปหน้าแคมเปญอีเมล: เปลี่ยนป้ายจาก "การตลาด" เป็น "แคมเปญอีเมล" (ตรงกับ `AppSidebar.tsx`) และเปลี่ยนปลายทางจาก `/marketing` เป็น `/campaigns` (ใช้ redirect ที่มีอยู่แล้วใน `App.tsx`)
- ลบรายการ "แคมเปญ" → `/campaigns` ที่ซ้ำซ้อนกับรายการข้างต้นออก
- เพิ่มรายการใหม่ "วิเคราะห์แคมเปญ" → `/campaign-analytics` เข้า GlobalSearch
- ไม่แตะ route `/campaigns` ใน `App.tsx` (ยังคงเป็น redirect ไป `/marketing` เหมือนเดิม เพื่อ backward compatibility)
- ไม่แตะ `CampaignsPage.tsx` (dead code — เก็บไว้พิจารณาแยกเป็นอีก change)

## Capabilities

### New Capabilities
- `global-search-marketing-entries`: ผลลัพธ์ GlobalSearch สำหรับกลุ่มหน้าแคมเปญอีเมล/วิเคราะห์แคมเปญ ต้องมีป้ายและปลายทางที่ตรงกับเมนูข้างเสมอ ไม่มีรายการซ้ำซ้อน

### Modified Capabilities
(ไม่มี — ยังไม่เคยมี spec ของ GlobalSearch มาก่อน)

## Impact

- `src/components/GlobalSearch.tsx` — แก้ไข `NAV_ITEMS` array เท่านั้น (2 รายการเดิม + เพิ่ม 1 รายการใหม่)
- ไม่กระทบ backend, routing, หรือ component อื่น
