## 1. Component — MultiSelectCombobox

- [x] 1.1 สร้าง `src/components/MultiSelectCombobox.tsx` — props: `options: { value, label, meta? }[]`, `value: string[]`, `onChange: (values: string[]) => void`, `placeholder?`, `searchPlaceholder?`, `emptyText?`, `showSelectAll?` (default `true`), `className?`
- [x] 1.2 Trigger: `Button` + `Popover`/`PopoverTrigger` ตาม pattern ของ `ProjectFilterSelect.tsx` — แสดงข้อความ `placeholder` เสมอ ไม่โชว์จำนวนที่เลือก (chip ทำหน้าที่นั้นแทน)
- [x] 1.3 Popover content: `Command` + `CommandInput` + `CommandList` + `CommandGroup` + `CommandItem` ต่อ option — `onSelect` toggle เข้า/ออกจาก `value` array **ไม่เรียก `setOpen(false)`** (เจตนา ต่างจาก Combobox เดิมทุกตัว) — กรอง options เองใน JS (`shouldFilter={false}`) เพื่อให้ "เลือกทั้งหมด" อ้างอิงชุดที่กำลังแสดงจริงชุดเดียวกัน
- [x] 1.4 แสดง checkmark (`Check` icon) เมื่อ `value.includes(opt.value)`, แสดง `opt.meta` เป็นข้อความจางด้านขวาถ้ามี
- [x] 1.5 เพิ่มแถว "เลือกทั้งหมด" ที่หัว `CommandGroup` เมื่อ `showSelectAll` — toggle เลือก/ยกเลิกทุก option ที่กำลังแสดงอยู่ (หลังกรองค้นหา)
- [x] 1.6 Chip row: แสดงใต้/เหนือ trigger (นอก popover) — `Badge` ต่อรายการที่เลือก + ปุ่ม `X` (lucide) ที่เรียก `onChange` เอา id นั้นออกทันที ไม่ต้องเปิด popover — ไม่แสดง chip row เลยเมื่อ `value` ว่าง
- [x] 1.7 `CommandEmpty` แสดง `emptyText` เมื่อค้นหาไม่พบ

## 2. ใช้แทน checkbox list ในหน้าแคมเปญ

- [x] 2.1 แก้ `src/pages/MarketingPage.tsx`: แทนที่ checkbox list ของกลุ่มผู้รับ (จาก `email-campaign-multi-group-send`) ด้วย `<MultiSelectCombobox options={groups.map(g => ({ value: g.id, label: g.name, meta: `${g.member_count} คน` }))} value={selectedCampaignGroups} onChange={setSelectedCampaignGroups} placeholder="เลือกกลุ่มผู้รับ" searchPlaceholder="ค้นหากลุ่ม..." emptyText="ไม่พบกลุ่มผู้รับ" />`
- [x] 2.2 ลบ/เก็บกวาด markup checkbox list เดิม + `toggleCampaignGroup` helper ถ้าไม่ได้ใช้ที่อื่นแล้ว (เช็คก่อนลบว่าไม่มีจุดอื่นเรียกใช้) — ยืนยันแล้วว่าไม่มีจุดอื่นเรียกใช้ ลบออกแล้ว
- [x] 2.3 ยืนยันว่าเส้นทาง "จะส่งถึง N คน" (`useCampaignRecipientCount(selectedCampaignGroups)`) ยังทำงานเหมือนเดิม เพราะรับ `string[]` แบบเดียวกัน ไม่ต้องแก้ hook — ไม่ได้แตะ hook นี้เลย

## 3. Verification

- [x] 3.1 รัน `pnpm lint` และ `pnpm build` (0 error ทั้งคู่)
- [x] 3.2 ทดสอบ manual ในเบราว์เซอร์จริง (ข้อมูลจริง 4 กลุ่ม): พิมพ์ค้นหา "win" กรองเหลือ "Winai" ถูกต้อง, เลือก "Smart Factory" แล้ว "Test Group" ติดกัน 2 ครั้งโดย popover ไม่ปิดระหว่างนั้น (ยืนยันด้วย screenshot เห็น checkmark ค้างอยู่), กดปุ่ม × บนชิป "Smart Factory" ลบออกสำเร็จ (เหลือ "Test Group" ตัวเดียว, ตัวเลขผู้รับอัปเดตจาก 23→2 ถูกต้อง), ทดสอบ "เลือกทั้งหมด" ยืนยันว่า scope เฉพาะรายการที่กรองด้วยคำค้นหาอยู่ ณ ขณะนั้นจริง (ไม่ใช่ทั้ง 4 กลุ่มเสมอ) ตรงตาม design
- [x] 3.3 ยืนยันว่าตัวเลข "จะส่งถึง N คน" ยังอัปเดตถูกต้องเมื่อเลือก/ลบกลุ่มผ่าน component ใหม่ — เห็นค่าปรับตามจริงทุกครั้งที่ทดสอบข้างต้น (23 คน → 2 คน หลังลบ Smart Factory)
- [x] 3.4 ทดสอบ responsive/overflow บนมือถือ (375px, เลือกครบ 4 กลุ่ม): `docScrollWidth === docClientWidth` (375=375) ไม่มี horizontal overflow เลย, chip row/dropdown แสดงเต็มความกว้างถูกต้อง
