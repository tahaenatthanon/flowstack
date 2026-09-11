## 1. Code Fix

- [x] 1.1 เพิ่ม import `parsePlatforms` จาก `@/lib/contentPlatforms` และ `getPlatformColors` จาก `@/lib/platformConfig` ใน `ContentPlannerAI.tsx`
- [x] 1.2 แก้จุดสีใน sidebar "แผนล่าสุด" ให้คำนวณสีจาก `getPlatformColors(parsePlatforms(item.platforms ?? item.platform)[0]).text` เมื่อ item มีแพลตฟอร์มอย่างน้อย 1 อัน ใช้ inline `style={{ backgroundColor }}` แทน Tailwind class chain เดิม — ถ้าไม่มีแพลตฟอร์มเลยใช้สีเทา default เดิม (`#9ca3af` เทียบเท่า `bg-gray-400`)
- [x] 1.3 ลบ ternary chain สีแพลตฟอร์มเดิม (`item.platform === 'facebook' ? 'bg-indigo-500' : ...`) ออกทั้งหมด

## 2. Verification

- [x] 2.1 `pnpm exec tsc --noEmit` และ `pnpm lint` ผ่านไม่มี error
- [x] 2.2 `pnpm test` ผ่านทั้งหมด ไม่มี regression — รอบแรกมี 1 test ล้มเหลว (timing/waitFor timeout ในไฟล์ settings ที่ไม่เกี่ยวกับ ContentPlannerAI เลย) รันซ้ำผ่านหมด 249/249 ยืนยันว่าเป็น flaky test ไม่ใช่ regression จากการเปลี่ยนแปลงนี้
- [x] 2.3 `pnpm build` ผ่านไม่มี error
- [x] 2.4 ทดสอบด้วยมือใน browser: เปิด Content Planner (ปฏิทินคอนเทนต์) เปิด sidebar AI ยืนยันว่าจุดสีข้าง item ในแผนแสดงสีตามแพลตฟอร์มแรกถูกต้อง ทั้ง item แพลตฟอร์มเดียวและหลายแพลตฟอร์ม ไม่มี item ไหนตกไปสีเทาทั้งที่มีแพลตฟอร์ม — ทดสอบกับข้อมูลจริงใน DB: ตรวจ backgroundColor ของจุดทั้ง 21 item ที่แสดง พบสีหลากหลายถูกต้องตามแพลตฟอร์มแรกของแต่ละ item (indigo=facebook, slate=tiktok, pink=instagram, blue=wordpress, purple=wix) ไม่มี item ไหนตกไปสีเทา (#9ca3af) ทั้งที่มีแพลตฟอร์ม ไม่มี console error
