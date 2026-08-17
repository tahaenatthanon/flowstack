## 1. Remove Top Content widget

- [x] 1.1 In `src/pages/ContentDashboardPage.tsx`, remove the `topContent` variable (sort by `views`, slice 5)
- [x] 1.2 Remove the `TabsContent value="top"` block (its `<Table>` and empty-state) from the Tabs Card
- [x] 1.3 Remove now-unused imports: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, and `TrendingUp` (verify via grep they are unused in the file)

## 2. Make "เนื้อหาล่าสุด" the primary table

- [x] 2.1 Replace the `<Tabs>` Card with a single `<Card>` titled "เนื้อหาล่าสุด" using `CardHeader`/`CardContent className="p-0"`
- [x] 2.2 Move the `recentItems` `<Table>` (title, type, platform, status columns) directly into the new Card's `CardContent`
- [x] 2.3 Verify column sizing: title column truncates and expands, type hidden below `sm`, platform hidden below `md`, status shown

## 3. Balance left/right sections

- [x] 3.1 Ensure both the left column (`xl:col-span-2`) and right column use `space-y-6` consistently
- [x] 3.2 Ensure all Cards use `CardHeader className="pb-2"` and `CardTitle className="text-sm font-medium"` for equal header height
- [x] 3.3 Review that the first cards of left/right columns align at the top and the overall layout is balanced

## 4. Verify

- [x] 4.1 Run `pnpm lint` and fix any errors/warnings
- [x] 4.2 Run `pnpm build` and confirm a successful production build
- [x] 4.3 Manually verify the dashboard (wide `xl` and narrow responsive) shows only "เนื้อหาล่าสุด", no "เนื้อหายอดนิยม", and balanced columns
