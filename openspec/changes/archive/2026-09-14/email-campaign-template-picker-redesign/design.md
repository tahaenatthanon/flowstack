## Context

ไดอะล็อกสร้าง/แก้ไขแคมเปญอีเมลใน `MarketingPage.tsx` (`DialogContent` กว้างสูงสุด `sm:max-w-[95vw]`) มีโครงสร้างเป็น section ที่มี badge เลขกำกับ: ② ผู้ส่ง, ③ ผู้รับ (จัดเรียงเป็น grid 2 คอลัมน์ `sm:grid-cols-2`), ④ เนื้อหาอีเมล ปัจจุบัน "Template เริ่มต้น" ซ้อนอยู่ใน section ③ ผู้รับ ใช้ `ScrollableKanban` (flex + `overflow-x-auto`) แสดงปุ่ม emoji 20 อัน ปัญหาคือ grid item ไม่หดต่ำกว่าความกว้างเนื้อหา (`min-width: auto` ของ CSS Grid) ทำให้ container ล้นออกนอกไดอะล็อกแทนที่จะเคลิป/เลื่อนได้จริง — ยืนยันด้วย `getBoundingClientRect()` พบว่า `scrollWidth === clientWidth` ของ container ไม่เคย engage overflow clipping เลย

ไฟล์ที่มี `emailTemplates` (`src/data/emailTemplates.ts`) มีทั้งหมด 20 รายการ (`template-1` ถึง `template-20`)

## Goals / Non-Goals

**Goals:**
- ย้าย section "Template เริ่มต้น" ออกมาเป็น section เดี่ยวเต็มความกว้างไดอะล็อก (แก้ปัญหาตกขอบที่ต้นเหตุ ไม่ใช่แค่ปะ `min-w-0`)
- แสดง template ทั้ง 20 รายการพร้อมกันแบบ grid ห่อบรรทัด ไม่ต้อง scroll
- รองรับ toggle การเลือก: คลิกซ้ำ template ที่เลือกอยู่ = ยกเลิกการเลือก และล้าง `campaignBody` แต่ต้องผ่าน confirm dialog ก่อนเสมอ

**Non-Goals:**
- ไม่แก้ backend หรือ schema ฐานข้อมูล
- ไม่เปลี่ยนเนื้อหา/จำนวน template ใน `emailTemplates.ts`
- ไม่เปลี่ยนพฤติกรรมตอน "เลือก template ใหม่ทับของเดิม" (ยังคง `setCampaignBody(template.html)` ทันทีโดยไม่ confirm เหมือนเดิม — confirm เฉพาะตอนยกเลิกการเลือก)

## Decisions

**1. ย้าย Template เริ่มต้น เป็น section เต็มความกว้าง (ไม่ใช่แค่เพิ่ม `min-w-0` ในคอลัมน์เดิม)**
เพิ่ม `min-w-0` อย่างเดียวจะทำให้ scroll ใช้งานได้จริง แต่ยังคงบีบเหลือครึ่งความกว้างไดอะล็อกเสมอไม่ว่าจอกว้างแค่ไหน ผู้ใช้ยังต้องเลื่อนดูทีละไม่กี่อันอยู่ดี การย้ายออกมาเต็มความกว้าง (section ใหม่ต่อจากแถว ผู้ส่ง/ผู้รับ) ใช้ประโยชน์จาก `sm:max-w-[95vw]` ของไดอะล็อกได้เต็มที่ และทำให้ตัดปัญหา scroll ทิ้งได้จริง (ตัดสินใจร่วมกับผู้ใช้ในขั้นตอน explore)

**2. เปลี่ยนจาก `ScrollableKanban` เป็น `flex flex-wrap gap-2` ธรรมดา**
`ScrollableKanban` ออกแบบมาสำหรับรายการที่ตั้งใจให้เลื่อนแนวนอน (มีปุ่มลูกศร, fade gradient) ซึ่งไม่เหมาะกับเป้าหมายใหม่ที่ต้องการ "เห็นครบไม่ต้องเลื่อน" การห่อบรรทัดด้วย flex-wrap ธรรมดาเรียบง่ายกว่าและตรงเป้าหมายกว่า ไม่จำเป็นต้องใช้ CSS Grid เพราะปุ่มมีขนาดคงที่ (`w-12 h-12`) — flex-wrap ห่อบรรทัดได้เหมือนกันโดยไม่ต้องกำหนดจำนวนคอลัมน์ตายตัว จึงปรับตามความกว้างจอได้เอง (responsive) ดีกว่า grid คอลัมน์คงที่
ตรวจสอบแล้วว่า usage อื่นของ `ScrollableKanban` (`KanbanBoard.tsx`, `Index.tsx`, `SalesPage.tsx`) ไม่ได้อยู่ในบริบทเดียวกัน จึงไม่กระทบ — เอาออกเฉพาะจุดนี้จุดเดียว ไม่แตะ component `ScrollableKanban` เอง

**3. เลข badge ของ section ที่ตามหลัง Template เริ่มต้น ต้องขยับเลขใหม่**
เดิม: ② ผู้ส่ง / ③ ผู้รับ / ④ เนื้อหาอีเมล
ใหม่: ② ผู้ส่ง / ③ ผู้รับ / ④ Template เริ่มต้น (section ใหม่) / ⑤ เนื้อหาอีเมล
เป็นการเปลี่ยนตัวเลขคงที่ในโค้ด (hardcoded string ใน `<span>` badge) ไม่ใช่ generate อัตโนมัติ — ต้องแก้ตรงๆ ที่ section เนื้อหาอีเมลด้วย

**4. Toggle deselect: ใช้ `useConfirm()` ที่มีอยู่แล้วในไฟล์ ไม่สร้าง dialog ใหม่**
`MarketingPage.tsx` มี `const { confirm } = useConfirm()` ใช้งานอยู่แล้วหลายจุด (บรรทัด 455, 472, 538) รูปแบบ `await confirm({ title, description, variant })` — ใช้ pattern เดียวกัน `variant: 'default'` (ไม่ใช่ `'destructive'` เพราะการล้าง draft เนื้อหาไม่ใช่การลบข้อมูลถาวรระดับเดียวกับลบ record ในฐานข้อมูล)

Logic ปุ่ม template:
```
onClick:
  if คลิก template ที่เลือกอยู่แล้ว (selectedTemplate === template.id):
    ok = await confirm({ title: 'ยกเลิกการเลือก Template?', description: 'เนื้อหาอีเมลที่ใช้จาก Template นี้จะถูกล้างกลับเป็นค่าว่าง', variant: 'default' })
    if ok:
      setSelectedTemplate('')
      setCampaignBody('')
  else:
    setSelectedTemplate(template.id)
    setCampaignBody(template.html)   // พฤติกรรมเดิม ไม่ confirm ตอนเลือกใหม่/สลับ template
```

## Risks / Trade-offs

- **[Risk]** ผู้ใช้ที่แก้ไขเนื้อหาต่อจาก template ไปเยอะแล้ว อาจคลิก template เดิมโดยไม่ตั้งใจ (เช่นเผลอกดซ้ำ) แล้วเสียงานที่แก้ไป → **Mitigation**: มี confirm dialog กันไว้แล้วตามที่ผู้ใช้กำหนด (ตัดสินใจไว้ในขั้นตอน explore ก่อนหน้า)
- **[Risk]** Section เต็มความกว้างใหม่ทำให้ไดอะล็อกสูงขึ้น (เพิ่ม section หนึ่งชั้น) → **Mitigation**: ไดอะล็อกมี `overflow-y-auto` และ `sm:max-h-[95vh]` อยู่แล้ว รองรับเนื้อหาที่ยาวขึ้นได้โดยไม่ต้องแก้เพิ่ม
- **[Trade-off]** เลิกใช้ปุ่มลูกศรเลื่อน/fade gradient ของ `ScrollableKanban` (ผู้ใช้ที่คุ้นเคยจะไม่เห็นอีก) แลกกับการเห็น template ครบทุกตัวทันทีโดยไม่ต้องโต้ตอบเพิ่ม ซึ่งตรงเป้าหมายที่ตั้งไว้มากกว่า

## Migration Plan

ไม่มี migration ฐานข้อมูล เป็นการแก้ไข JSX/state logic ในไฟล์เดียว (`MarketingPage.tsx`) deploy พร้อม build ปกติ ไม่มี feature flag หรือ rollback พิเศษ (revert commit ได้ทันทีหากมีปัญหา)
