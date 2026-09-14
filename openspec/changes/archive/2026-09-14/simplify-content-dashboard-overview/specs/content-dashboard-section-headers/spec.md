## MODIFIED Requirements

### Requirement: ไอคอนหัวข้อทุก section
The content dashboard SHALL render an icon next to the title of every section Card: "ความคืบหน้าการผลิต", "เผยแพร่ล้มเหลว", "คอนเทนต์ค้างท่อ", "คิวเผยแพร่", "เนื้อหาล่าสุด", and "กำหนดการโพสต์ถัดไป" on the overview tab, and "สถานะช่องทาง" on the analytics tab.

#### Scenario: ไอคอนครบทุก section
- **WHEN** the dashboard renders all section Cards
- **THEN** each section title is preceded by a `lucide-react` icon (e.g. `BarChart3`, `XCircle`, `Hourglass`, `Send`, `FileText`, `CalendarClock`, `Radio`)

#### Scenario: ไอคอนไม่เบียดชื่อ
- **WHEN** a section title with icon renders
- **THEN** the icon uses a small fixed size (`h-4 w-4`) and the title remains legible

### Requirement: ปุ่ม action มุมขวาบนของ Card
The dashboard SHALL render action buttons in the top-right corner of specific Card headers, aligned opposite the title.

#### Scenario: ปุ่ม ดูทั้งหมด บน เนื้อหาล่าสุด
- **WHEN** the "เนื้อหาล่าสุด" Card renders
- **THEN** a "ดูทั้งหมด" button appears at the top-right and navigates to the content list

#### Scenario: ปุ่ม จัดการ บน สถานะช่องทาง
- **WHEN** the "สถานะช่องทาง" Card renders (on the "โซเชียล" sub-tab of the analytics tab)
- **THEN** a "จัดการ" button appears at the top-right and navigates to channel management

#### Scenario: ปุ่มไม่รบกวน layout
- **WHEN** an action button renders in a Card header
- **THEN** it uses a compact (`ghost`/`sm`) style and does not overlap the title
