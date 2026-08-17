## 1. Enable lazy analytics fetch

- [x] 1.1 In `src/hooks/useContent.ts`, add an optional `enabled = true` parameter to `usePostingAnalytics()` and pass it to the `useQuery` options (mirroring `useContentSkills`/`usePublishChannels`)

## 2. Setup tab state and analytics data

- [x] 2.1 In `src/pages/ContentDashboardPage.tsx`, import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`
- [x] 2.2 Import `useSearchParams` from `react-router-dom` (replacing or alongside the existing `useNavigate`)
- [x] 2.3 Import `usePostingAnalytics` and `useRecalculateAnalytics` from `@/hooks/useContent`
- [x] 2.4 Import `BestTimeAnalyticsPanel` from `@/components/content/BestTimeAnalyticsPanel`
- [x] 2.5 Derive the active tab from the `tab` URL query param (`tab === 'analytics' ? 'analytics' : 'overview'`) and update it via `setSearchParams` on tab change
- [x] 2.6 Split the current `statCards` array into `productionStatCards` (เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง) and `engagementStatCards` (ยอดวิวรวม, ยอดไลก์รวม)
- [x] 2.7 Add a `topContent` variable sorting items by engagement score (`Number(views) + Number(likes) * 2`) descending, sliced to 5
- [x] 2.8 Add `usePostingAnalytics(tab === 'analytics')`, `useRecalculateAnalytics()` mutation, and a `handleRecalculate` callback (calling the mutation then refetching)

## 3. Restructure page into two tabs

- [x] 3.1 Wrap the dashboard body (everything inside the current `<div className="space-y-6">`) in `<Tabs value={tab} onValueChange={...}>` and add a `TabsList` with `TabsTrigger` "ภาพรวม" (`value="overview"`) and "วิเคราะห์" (`value="analytics"`)
- [x] 3.2 Move `productionStatCards`, the overdue alert, and the existing master 2-column grid into `<TabsContent value="overview">`
- [x] 3.3 In the overview right column, remove the "แพลตฟอร์ม" (Platform Distribution) Card — it relocates to the analytics tab
- [x] 3.4 Add `<TabsContent value="analytics">` rendering: `engagementStatCards` grid, the "แพลตฟอร์ม" Card (moved from overview), a "เนื้อหายอดนิยม" Card (from `topContent`), and `<BestTimeAnalyticsPanel analytics={postingAnalytics} isLoading={...} onRecalculate={handleRecalculate} isRecalculating={...} />`
- [x] 3.5 Verify the "เนื้อหายอดนิยม" Card shows title + views + likes per item with an empty-state when there is no content

## 4. Verify

- [x] 4.1 Run `pnpm lint` and fix any errors/warnings
- [x] 4.2 Run `pnpm build` and confirm a successful production build
- [ ] 4.3 Manually verify: default tab is "ภาพรวม", switching to "วิเคราะห์" updates the URL to `?tab=analytics`, refreshing keeps the tab, and the `analytics-posting-times` request only fires on the analytics tab
