## 1. Pending queue: remove bottom button & revert item layout

- [x] 1.1 In `src/pages/ContentDashboardPage.tsx`, remove the full-width "ดูรายการอนุมัติทั้งหมด" `Button` at the bottom of the "รออนุมัติ" `CardContent`
- [x] 1.2 Revert each pending item back to the original simple layout: title (`truncate`) + creation date (`formatDate(item.created_at)`)

## 2. Recent content: switch to multi-line list layout

- [x] 2.1 Replace the "เนื้อหาล่าสุด" `Table` with a list where each item is a flex row (thumbnail left, data right)
- [x] 2.2 Line 1: render title (`truncate`) on its own line
- [x] 2.3 Line 2: render type badge (`TYPE_MAP[item.type]`) and platform badge (`PLATFORM_MAP`, or "-" when absent) on the same line
- [x] 2.4 Line 3: render status badge (`STATUS_MAP`) and creation date (`formatDate(item.created_at)`) on the same line

## 3. Thumbnail sizing and fallback

- [x] 3.1 Render `item.generated_image_url` as an image with `self-stretch`/`h-full` + `object-cover` so it matches the height of the side data area
- [x] 3.2 When no `generated_image_url`, render a muted placeholder with the type icon from `TYPE_MAP[item.type]`, same size/alignment

## 4. Verify

- [x] 4.1 Run `pnpm lint` and fix any errors/warnings
- [x] 4.2 Run `pnpm build` and confirm a successful production build
- [x] 4.3 Manually verify "รออนุมัติ" (no bottom button, original item layout) and "เนื้อหาล่าสุด" (thumbnail + title / type|platform / status|date, aligned across rows)
