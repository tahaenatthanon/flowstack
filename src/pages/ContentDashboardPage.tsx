import { useState } from 'react';
import { FileText, BarChart3, Share2, Globe, LayoutDashboard, Mail } from 'lucide-react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useContentItems, usePostingAnalytics, useRecalculateAnalytics, useResultMetrics, useContentOverview, useContentAnalytics } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';
import { AnalyticsContentTab } from '@/components/content/AnalyticsContentTab';
import { AnalyticsSocialTab } from '@/components/content/AnalyticsSocialTab';
import { AnalyticsWebsiteTab } from '@/components/content/AnalyticsWebsiteTab';
import { CampaignAnalyticsTab } from '@/components/content/CampaignAnalyticsTab';
import { GlobalKpiRow } from '@/components/content/overview/GlobalKpiRow';
import { ProductionSection } from '@/components/content/overview/ProductionSection';
import { PublishingSection } from '@/components/content/overview/PublishingSection';
import { ResultsSection } from '@/components/content/overview/ResultsSection';
import ReportDateFilter from '@/components/reports/ReportDateFilter';
import { useSearchParams } from 'react-router-dom';

/** sub-tab ของแท็บวิเคราะห์ — ค่าที่ผูกกับ URL param `view` */
const ANALYTICS_VIEWS = ['social', 'website', 'content'] as const;
type AnalyticsView = typeof ANALYTICS_VIEWS[number];

const ANALYTICS_SUBTABS: Array<{ value: AnalyticsView; label: string; icon: React.ElementType }> = [
  { value: 'social',  label: 'โซเชียล', icon: Share2 },
  { value: 'website', label: 'เว็บไซต์', icon: Globe },
  { value: 'content', label: 'เนื้อหา',  icon: FileText },
];

/** ช่วงวันที่ default = 12 เดือนย้อนหลังถึงวันนี้ — ตรงกับ default ฝั่ง backend */
function defaultDateRange(): { from: string; to: string } {
  const today = new Date();
  return {
    from: format(startOfMonth(subMonths(today, 11)), 'yyyy-MM-dd'),
    to: format(today, 'yyyy-MM-dd'),
  };
}

export default function ContentDashboardPage() {
  // items ส่งต่อให้แท็บวิเคราะห์ (AnalyticsContentTab)
  const { data: items = [], isLoading } = useContentItems();

  // Active tab driven by the `tab` URL query param (default: overview).
  // The analytics sub-tab lives in `view` so a refresh restores both levels.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'analytics' ? 'analytics' : 'overview';
  const rawView = searchParams.get('view');
  const view: AnalyticsView = ANALYTICS_VIEWS.includes(rawView as AnalyticsView)
    ? (rawView as AnalyticsView)
    : 'content';

  // Carry `view` along when entering the analytics tab so the sub-tab never
  // gets dropped, and drop both params when returning to the overview tab.
  const handleTabChange = (value: string) => {
    setSearchParams(value === 'analytics' ? { tab: 'analytics', view } : {});
  };
  const handleViewChange = (value: string) => {
    setSearchParams({ tab: 'analytics', view: value });
  };

  // ส่วนของหน้า (ชั้นบนสุด): `section=campaign` = แคมเปญ, ไม่มี/ค่าอื่น = คอนเทนต์
  // ใช้ชื่อ `section` เพราะ `view` เป็น sub-tab ของแท็บวิเคราะห์อยู่แล้ว
  // handler สองตัวข้างบนเขียนทับ params ทั้งชุดได้โดยไม่ต้องแก้ เพราะทำงานเฉพาะในส่วนคอนเทนต์
  // ซึ่งไม่มี `section` อยู่แล้ว — กลับมาส่วนคอนเทนต์ = ล้าง params (แท็บภาพรวม)
  const section: 'content' | 'campaign' = searchParams.get('section') === 'campaign' ? 'campaign' : 'content';
  const handleSectionChange = (value: string) => {
    setSearchParams(value === 'campaign' ? { section: 'campaign' } : {});
  };

  // Date range for the analytics tab. Kept in component state (not the URL) —
  // only `tab` and `view` are URL-bound.
  const [range, setRange] = useState(defaultDateRange);
  const { from, to } = range;

  // Analytics data (fetched only while the analytics tab is active)
  const { data: postingAnalytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = usePostingAnalytics(tab === 'analytics');
  const { data: resultMetrics, isLoading: metricsLoading } = useResultMetrics(from, to, tab === 'analytics');
  const recalcAnalytics = useRecalculateAnalytics();
  const handleRecalculate = () => {
    recalcAnalytics.mutate(undefined, { onSuccess: () => { refetchAnalytics(); } });
  };

  // BI aggregations — one request per tab, fetched lazily. แท็บภาพรวมใช้ข้อมูลทั้งหมด
  // ไม่มีช่วงเวลาและไม่มีการเปรียบเทียบ (spec content-overview-bi)
  const { data: bi, isLoading: biLoading } = useContentOverview(tab === 'overview');
  const { data: biAnalytics, isLoading: biAnalyticsLoading } = useContentAnalytics(from, to, tab === 'analytics');

  return (
    <PageShell
      breadcrumbs={[
        { label: 'การตลาด', href: '/campaigns' },
        { label: 'แดชบอร์ด', isCurrent: true },
      ]}
      title={section === 'campaign' ? 'แดชบอร์ดแคมเปญ' : 'แดชบอร์ดคอนเทนต์'}
      description={section === 'campaign'
        ? 'ผลการส่ง การเปิด และการคลิกของแคมเปญอีเมล'
        : 'ภาพรวมประสิทธิภาพการผลิต การเผยแพร่ และผลลัพธ์'}
      actions={
        // สลับ "ทั้งหน้า" อยู่ในหัวหน้า ต่างจากแท็บภาพรวม/วิเคราะห์ที่สลับ "เนื้อหาในหน้า"
        // แสดงชื่อเต็มทุกขนาดจอ (แท็บในหน้าซ่อน label บนมือถือ แต่ปุ่มนี้มีแค่ 2 ตัวเลือก)
        <ToggleGroup
          type="single"
          variant="outline"
          value={section}
          // Radix คืน '' เมื่อกดตัวที่เลือกอยู่ซ้ำ — ไม่ถือเป็นการสลับ
          onValueChange={(v) => { if (v) handleSectionChange(v); }}
          aria-label="เลือกส่วนของแดชบอร์ด"
        >
          <ToggleGroupItem value="content" className="gap-1.5 px-3">
            <FileText className="h-4 w-4" />
            คอนเทนต์
          </ToggleGroupItem>
          <ToggleGroupItem value="campaign" className="gap-1.5 px-3">
            <Mail className="h-4 w-4" />
            แคมเปญ
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      {/* ส่วนแคมเปญไม่รอข้อมูลคอนเทนต์ — รอเฉพาะ query ของตัวเองใน CampaignAnalyticsTab */}
      {section === 'campaign' ? (
        <CampaignAnalyticsTab />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-2">
            <TabsTrigger value="overview" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">ภาพรวม</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">วิเคราะห์</span>
            </TabsTrigger>
          </TabsList>

          {/* ── ภาพรวม ─────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            {/* ── BI Summary: ข้อมูลทั้งหมด ไม่มีการเปรียบเทียบ ── */}
            <GlobalKpiRow kpi={bi?.kpi} isLoading={biLoading} />
            <ProductionSection data={bi} isLoading={biLoading} />
            <PublishingSection data={bi} isLoading={biLoading} />
            <ResultsSection data={bi} isLoading={biLoading} />
          </TabsContent>

          {/* ── วิเคราะห์ ───────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-6">
            {/* ตัวกรองช่วงวันที่ — ใช้ร่วมกับทุก sub-tab ที่มีเมตริกผูกช่วงเวลา */}
            <ReportDateFilter
              startDate={from}
              endDate={to}
              onDateRangeChange={(start, end) => setRange({ from: start, to: end })}
              onReset={() => setRange(defaultDateRange())}
              summary={'ช่วงวันที่นี้ใช้กับ widget ที่ผูกช่วงเวลา — widget ที่เป็น snapshot จะกำกับไว้ว่า "ไม่ผูกช่วงวันที่ที่เลือก"'}
            />

            {/* ── sub-tab ระดับที่ 2 ────────────────────────────── */}
            <Tabs value={view} onValueChange={handleViewChange} className="space-y-6">
              <TabsList className="flex overflow-x-auto sm:grid sm:grid-cols-3 border-b rounded-none bg-transparent h-auto p-0 gap-0 w-full justify-start">
                {ANALYTICS_SUBTABS.map(subtab => {
                  const Icon = subtab.icon;
                  return (
                    <TabsTrigger
                      key={subtab.value}
                      value={subtab.value}
                      className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {subtab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="social" className="mt-0">
                <AnalyticsSocialTab
                  social={biAnalytics?.social}
                  socialLoading={biAnalyticsLoading}
                  from={from}
                  to={to}
                />
              </TabsContent>

              <TabsContent value="website" className="mt-0">
                <AnalyticsWebsiteTab />
              </TabsContent>

              <TabsContent value="content" className="mt-0">
                <AnalyticsContentTab
                  items={items}
                  biAnalytics={biAnalytics}
                  biAnalyticsLoading={biAnalyticsLoading}
                  resultMetrics={resultMetrics}
                  metricsLoading={metricsLoading}
                  postingAnalytics={postingAnalytics}
                  analyticsLoading={analyticsLoading}
                  onRecalculate={handleRecalculate}
                  isRecalculating={recalcAnalytics.isPending}
                  from={from}
                  to={to}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  );
}
