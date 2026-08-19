## ADDED Requirements

### Requirement: แท็บวิเคราะห์มี sub-tab 3 ส่วน
แท็บ "วิเคราะห์" (`TabsContent value="analytics"`) ของแดชบอร์ดคอนเทนต์ SHALL มี nested tab ระดับที่สอง 3 แท็บ เรียงลำดับ: "โซเชียล" (`social`), "เว็บไซต์" (`website`), "เนื้อหา" (`content`)

#### Scenario: แสดง sub-tab ทั้งสามในแท็บวิเคราะห์
- **WHEN** ผู้ใช้เปิดแท็บ "วิเคราะห์" (`?tab=analytics`)
- **THEN** เห็น tab bar ระดับที่สองประกอบด้วย 3 trigger เรียงลำดับ โซเชียล → เว็บไซต์ → เนื้อหา

#### Scenario: แท็บภาพรวมไม่มี sub-tab
- **WHEN** ผู้ใช้เปิดแท็บ "ภาพรวม" (`?tab=overview` หรือไม่มี `tab`)
- **THEN** ไม่แสดง tab bar ระดับที่สอง (sub-tab อยู่ภายใน TabsContent ของ "วิเคราะห์" เท่านั้น)

### Requirement: sub-tab ผูกกับ URL query parameter view
สถานะ sub-tab SHALL ผูกกับ URL query parameter ตัวที่สอง `view` โดยค่าที่รู้จักคือ `social`, `website`, `content` และค่า default SHALL เป็น `content`

#### Scenario: ค่า view ที่รู้จักแสดง sub-tab ที่ตรงกัน
- **WHEN** ผู้ใช้เปิด `/content-dashboard?tab=analytics&view=social`
- **THEN** sub-tab "โซเชียล" active และแสดงเนื้อหาของแท็บโซเชียล

#### Scenario: ค่า view ที่ไม่รู้จัก fallback เป็น content
- **WHEN** ผู้ใช้เปิด `/content-dashboard?tab=analytics&view=bogus`
- **THEN** sub-tab "เนื้อหา" active (fallback เป็น content)

#### Scenario: ไม่มีค่า view fallback เป็น content
- **WHEN** ผู้ใช้เปิด `/content-dashboard?tab=analytics` โดยไม่มี `view`
- **THEN** sub-tab "เนื้อหา" active (default เป็น content)

#### Scenario: refresh คง sub-tab เดิม
- **WHEN** ผู้ใช้อยู่บน sub-tab ใดก็ตามและ refresh หน้า
- **THEN** ทั้ง `tab` และ `view` คงค่าเดิม (ทั้งสองชั้นของแท็บคงเดิม)

#### Scenario: สลับ sub-tab ไม่หลุด tab=analytics
- **WHEN** ผู้ใช้คลิกสลับ sub-tab ในแท็บวิเคราะห์
- **THEN** query parameter `tab` ยังคงเป็น `analytics` (ไม่หลุดกลับไปแท็บภาพรวม)

### Requirement: sub-tab ใช้ visual style ตาม pattern Helpdesk
tab bar ระดับที่สอง SHALL ใช้รูปแบบ underline ตาม pattern tab bar ของหน้า Helpdesk (`SupportPage`): `TabsList` ใช้ `flex overflow-x-auto sm:grid sm:grid-cols-3 border-b rounded-none bg-transparent h-auto p-0 gap-0 w-full justify-start` และ `TabsTrigger` ใช้ `shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium`

#### Scenario: TabsList เป็น underline 3 คอลัมน์
- **WHEN** แท็บวิเคราะห์ render tab bar ระดับที่สอง
- **THEN** `TabsList` ใช้คลาส `flex overflow-x-auto sm:grid sm:grid-cols-3 border-b rounded-none bg-transparent h-auto p-0 gap-0 w-full justify-start`

#### Scenario: TabsTrigger เป็น underline style
- **WHEN** trigger sub-tab ถูก render
- **THEN** แต่ละ trigger ใช้คลาส `shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium`

#### Scenario: mobile scroll แนวนอน
- **WHEN** แท็บวิเคราะห์แสดงบนจอต่ำกว่า `sm`
- **THEN** tab bar ระดับที่สอง scroll แนวนอนได้ (`overflow-x-auto`) ไม่ล้นจอ

### Requirement: ไอคอนประจำ sub-tab
sub-tab แต่ละอัน SHALL แสดงไอคอน `lucide-react`: "โซเชียล" ใช้ `Share2`, "เว็บไซต์" ใช้ `Globe`, "เนื้อหา" ใช้ `FileText`

#### Scenario: โซเชียลใช้ Share2
- **WHEN** trigger "โซเชียล" ถูก render
- **THEN** แสดงไอคอน `Share2`

#### Scenario: เว็บไซต์ใช้ Globe
- **WHEN** trigger "เว็บไซต์" ถูก render
- **THEN** แสดงไอคอน `Globe`

#### Scenario: เนื้อหาใช้ FileText
- **WHEN** trigger "เนื้อหา" ถูก render
- **THEN** แสดงไอคอน `FileText`
