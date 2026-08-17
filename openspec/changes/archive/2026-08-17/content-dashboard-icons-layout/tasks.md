## 1. Section header icons

- [x] 1.1 In `src/pages/ContentDashboardPage.tsx`, add lucide-react icon imports (`BarChart3`, `FileText`, `Clock`, `CalendarClock`, `Share2`, `Radio`, plus any used for buttons)
- [x] 1.2 Add an icon before each section `CardTitle`: ภาพรวมสถานะคอนเทนต์ (`BarChart3`), เนื้อหาล่าสุด (`FileText`), รออนุมัติ (`Clock`), กำหนดการโพสต์ถัดไป (`CalendarClock`), แพลตฟอร์ม (`Share2`), สถานะช่องทาง (`Radio`)
- [x] 1.3 Layout each CardHeader with `flex items-center justify-between` so the title+icon sit left and action buttons sit right

## 2. Action buttons

- [x] 2.1 Add a "ดูทั้งหมด" `Button variant="ghost" size="sm"` to the "เนื้อหาล่าสุด" Card header (top-right)
- [x] 2.2 Add a "ดูทั้งหมด" button to the "รออนุมัติ" Card header (top-right), preserving the existing full-width "ดูรายการอนุมัติทั้งหมด" button inside the body
- [x] 2.3 Add a "จัดการ" button to the "สถานะช่องทาง" Card header (top-right)

## 3. Recent content thumbnails

- [x] 3.1 Add a leading thumbnail column to the "เนื้อหาล่าสุด" table
- [x] 3.2 Render `item.generated_image_url` as an image (`w-8 h-8 rounded border bg-muted object-cover`, `loading="lazy"`), else fallback to the type icon from `TYPE_MAP[item.type]`

## 4. Balance left/right columns

- [x] 4.1 Make both left and right columns stretch to equal height (`flex flex-col` on the grid children) with `space-y-6` preserved
- [x] 4.2 Use `flex-1` on the appropriate Card(s) so the total height of each column matches

## 5. Verify

- [x] 5.1 Run `pnpm lint` and fix any errors/warnings
- [x] 5.2 Run `pnpm build` and confirm a successful production build
- [x] 5.3 Manually verify icons, buttons, thumbnails, and balanced columns on wide (`xl`) and narrow responsive screens
