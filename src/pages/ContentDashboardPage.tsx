import { FileText, Clock, CheckCircle2, Edit3, AlertTriangle, Eye, ThumbsUp, ArrowRight, BarChart3, CalendarClock, Share2, Radio, TrendingUp, LayoutDashboard, Timer, Gauge, Filter, Hourglass, Sparkles, Send, RefreshCw, XCircle, Loader2, SearchCheck, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useContentItems, useOverdueCount, useAllSchedules, usePublishChannels, useChannelConnectionStatus, usePostingAnalytics, useRecalculateAnalytics, useResultMetrics, useContentOverview, useContentAnalytics, useSendNow } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';
import { STATUS_MAP, PLATFORM_MAP, TYPE_MAP } from '@/components/content/types';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { BestTimeAnalyticsPanel } from '@/components/content/BestTimeAnalyticsPanel';
import { ContentThroughputChart } from '@/components/content/ContentThroughputChart';
import { getPlatformColors } from '@/lib/platformConfig';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ContentDashboardPage() {
  const { data: items = [], isLoading } = useContentItems();
  const { data: overdue } = useOverdueCount();
  const { data: schedules = [] } = useAllSchedules();
  const { data: channels = [] } = usePublishChannels();
  const { data: channelStatus = [] } = useChannelConnectionStatus();
  const overdueCount = overdue?.count ?? 0;
  const navigate = useNavigate();
  const { toast } = useToast();

  // Active tab driven by the `tab` URL query param (default: overview)
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'analytics' ? 'analytics' : 'overview';
  const handleTabChange = (value: string) => {
    setSearchParams(value === 'analytics' ? { tab: 'analytics' } : {});
  };

  // Analytics data (fetched only while the analytics tab is active)
  const { data: postingAnalytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = usePostingAnalytics(tab === 'analytics');
  const { data: resultMetrics, isLoading: metricsLoading } = useResultMetrics(tab === 'analytics');
  const recalcAnalytics = useRecalculateAnalytics();
  const handleRecalculate = () => {
    recalcAnalytics.mutate(undefined, { onSuccess: () => { refetchAnalytics(); } });
  };

  // BI aggregations — one request per tab, fetched lazily
  const { data: bi, isLoading: biLoading, refetch: refetchBi } = useContentOverview(tab === 'overview');
  const { data: biAnalytics, isLoading: biAnalyticsLoading } = useContentAnalytics(tab === 'analytics');

  // Retry a failed publish through the existing send_now action. The original
  // failed row stays in the queue — send_now dispatches a new attempt.
  const sendNow = useSendNow();
  const handleRetry = (contentId: string, channelId: string) => {
    sendNow.mutate(
      { content_id: contentId, channel_ids: [channelId] },
      {
        onSuccess: () => {
          toast({ title: 'ส่งคำสั่งเผยแพร่ใหม่แล้ว', description: 'ระบบกำลังลองส่งอีกครั้ง — รายการที่ล้มเหลวเดิมยังคงอยู่ในประวัติ' });
          refetchBi();
        },
        onError: (err: unknown) => {
          toast({ title: 'ลองส่งใหม่ไม่สำเร็จ', description: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', variant: 'destructive' });
        },
      },
    );
  };

  const totalItems = items.length;
  const publishedCount = items.filter(i => i.status === 'published').length;
  const draftCount = items.filter(i => i.status === 'draft').length;
  const pendingApprovalCount = items.filter(i => i.status === 'pending_approval').length;

  // Totals for engagement
  const totalViews = items.reduce((s, i) => s + (Number(i.views) || 0), 0);
  const totalLikes = items.reduce((s, i) => s + (Number(i.likes) || 0), 0);

  // Status distribution for Work Progress
  const statusCounts = {
    published: publishedCount,
    pending_approval: pendingApprovalCount,
    approved: items.filter(i => i.status === 'approved').length,
    revision: items.filter(i => i.status === 'revision').length,
    draft: draftCount,
  };
  const workProgressStatuses = ['published', 'approved', 'pending_approval', 'revision', 'draft'] as const;

  // Platform distribution
  const platformCounts = items.reduce<Record<string, number>>((acc, item) => {
    const p = (item.platform ?? 'unknown').trim().toLowerCase();
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  // Recent items (last 5)
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Top content by engagement score (views + likes * 2), highest first
  const engagementScore = (i: typeof items[number]) => (Number(i.views) || 0) + (Number(i.likes) || 0) * 2;
  const topContent = [...items]
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, 5);

  // Pending approval queue (oldest request first, null last)
  const pendingItems = items
    .filter(i => i.status === 'pending_approval')
    .sort((a, b) => {
      const ta = a.requested_at ? new Date(a.requested_at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.requested_at ? new Date(b.requested_at).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

  // Upcoming schedules (future only, soonest first)
  const now = Date.now();
  const upcomingSchedules = schedules
    .filter(s => s.scheduled_at && new Date(s.scheduled_at).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Production stat cards (overview tab)
  const productionStatCards = [
    { label: 'เนื้อหาทั้งหมด', value: totalItems, icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-500/10', border: 'border-blue-600', countColor: 'text-blue-700' },
    { label: 'เผยแพร่แล้ว', value: publishedCount, icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-500/10', border: 'border-green-600', countColor: 'text-green-700' },
    { label: 'รออนุมัติ', value: pendingApprovalCount, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-500/10', border: 'border-amber-600', countColor: 'text-amber-700' },
    { label: 'ฉบับร่าง', value: draftCount, icon: Edit3, color: 'text-gray-600', bgColor: 'bg-gray-500/10', border: 'border-gray-600', countColor: 'text-gray-700' },
  ];

  // Result metric cards (analytics tab) — คำนวณจาก approved_at/published_at จริงใน DB
  const avgProductionHours = resultMetrics?.avg_production_hours ?? null;
  const approvedCount = resultMetrics?.approved_count ?? 0;
  const postsLast7Days = resultMetrics?.posts_last_7_days ?? 0;
  const weeklyTarget = resultMetrics?.weekly_posts_target ?? 0;

  const frequencyHint = weeklyTarget === 0
    ? 'ยังไม่ได้ตั้งเป้าหมาย'
    : postsLast7Days > weeklyTarget
      ? `เกินเป้าหมาย (เป้า ${weeklyTarget} โพสต์)`
      : postsLast7Days === weeklyTarget
        ? `ตรงเป้าหมาย (เป้า ${weeklyTarget} โพสต์)`
        : `ต่ำกว่าเป้าหมาย (เป้า ${weeklyTarget} โพสต์)`;

  const resultStatCards = [
    {
      label: 'เวลาผลิตเฉลี่ย',
      value: metricsLoading ? 'กำลังโหลด...' : avgProductionHours === null ? 'ยังไม่มีข้อมูล' : `${avgProductionHours.toFixed(1)} ชม.`,
      hint: metricsLoading ? null : avgProductionHours === null ? 'ยังไม่มีเนื้อหาที่อนุมัติแล้ว' : `จาก ${approvedCount.toLocaleString()} ชิ้นที่อนุมัติแล้ว`,
      icon: Timer, color: 'text-violet-600', bgColor: 'bg-violet-500/10', border: 'border-violet-600', countColor: 'text-violet-700',
    },
    {
      label: 'ความถี่การโพสต์/สัปดาห์',
      value: metricsLoading ? 'กำลังโหลด...' : `${postsLast7Days.toLocaleString()} โพสต์`,
      hint: metricsLoading ? null : frequencyHint,
      icon: Gauge, color: 'text-indigo-600', bgColor: 'bg-indigo-500/10', border: 'border-indigo-600', countColor: 'text-indigo-700',
    },
  ];

  // Engagement stat cards (analytics tab) — แสดงตลอดแม้ค่าเป็น 0 เพื่อสื่อว่า
  // "ยังไม่มี engagement" อย่างตรงไปตรงมา (0 คือค่าจริงที่รอ ingestion)
  const engagementStatCards = [
    { label: 'ยอดวิวรวม', value: totalViews.toLocaleString(), hint: null, icon: Eye, color: 'text-cyan-600', bgColor: 'bg-cyan-500/10', border: 'border-cyan-600', countColor: 'text-cyan-700' },
    { label: 'ยอดไลก์รวม', value: totalLikes.toLocaleString(), hint: null, icon: ThumbsUp, color: 'text-pink-600', bgColor: 'bg-pink-500/10', border: 'border-pink-600', countColor: 'text-pink-700' },
  ];

  const analyticsStatCards = [...resultStatCards, ...engagementStatCards];

  // ── BI derived values ────────────────────────────────────────────
  const queue = bi?.queue;
  const funnel = bi?.funnel;
  const aging = bi?.aging;
  const assets = bi?.assets;

  const queueStatuses = [
    { key: 'pending' as const,    label: 'รอส่ง',     icon: Clock,        color: 'text-amber-600' },
    { key: 'processing' as const, label: 'กำลังส่ง',  icon: Loader2,      color: 'text-blue-600' },
    { key: 'sent' as const,       label: 'ส่งแล้ว',   icon: CheckCircle2, color: 'text-green-600' },
    { key: 'failed' as const,     label: 'ล้มเหลว',   icon: XCircle,      color: 'text-red-600' },
  ];

  // Funnel stages, widest first. Drop-off is measured against the previous stage.
  const funnelStages = funnel ? [
    { key: 'created',   label: 'สร้าง',     count: funnel.created,   color: 'bg-blue-500' },
    { key: 'requested', label: 'ขออนุมัติ', count: funnel.requested, color: 'bg-amber-500' },
    { key: 'approved',  label: 'อนุมัติ',   count: funnel.approved,  color: 'bg-violet-500' },
    { key: 'published', label: 'เผยแพร่',   count: funnel.published, color: 'bg-green-500' },
  ] : [];

  const agingBuckets = aging ? [
    { key: 'd0_7',     label: '0-7 วัน',    count: aging.d0_7,     color: 'text-green-600',  bg: 'bg-green-500' },
    { key: 'd8_30',    label: '8-30 วัน',   count: aging.d8_30,    color: 'text-amber-600',  bg: 'bg-amber-500' },
    { key: 'd31_90',   label: '31-90 วัน',  count: aging.d31_90,   color: 'text-orange-600', bg: 'bg-orange-500' },
    { key: 'd90_plus', label: 'เกิน 90 วัน', count: aging.d90_plus, color: 'text-red-600',    bg: 'bg-red-500' },
  ] : [];

  const assetKinds = assets ? [
    { key: 'image', label: 'รูปภาพ', data: assets.image },
    { key: 'video', label: 'วิดีโอ', data: assets.video },
  ] : [];
  const assetStatuses = [
    { key: 'done' as const,       label: 'สำเร็จ',      color: 'text-green-600' },
    { key: 'generating' as const, label: 'กำลังสร้าง',  color: 'text-blue-600' },
    { key: 'failed' as const,     label: 'ล้มเหลว',     color: 'text-red-600' },
    { key: 'none' as const,       label: 'ยังไม่สร้าง', color: 'text-muted-foreground' },
  ];
  const hasAssetActivity = assetKinds.some(k => k.data.done + k.data.generating + k.data.failed > 0);

  const formatHours = (h: number | null) => h === null ? '—' : h < 1 ? `${Math.round(h * 60)} นาที` : `${h.toFixed(1)} ชม.`;
  const platformLabel = (p: string) => p === '__unknown__' ? 'ไม่ระบุแพลตฟอร์ม' : (PLATFORM_MAP[p]?.label ?? p);

  return (
    <PageShell
      breadcrumbs={[
        { label: 'การตลาด', href: '/marketing' },
        { label: 'คอนเทนต์โซเชียล' },
        { label: 'แดชบอร์ด', isCurrent: true },
      ]}
      title="แดชบอร์ดคอนเทนต์"
      description="ภาพรวมเนื้อหาและสถานะการผลิต"
    >
      {isLoading ? (
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
            {/* Production Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {productionStatCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className={`stat-card p-3 sm:p-5 ${card.border} ${card.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{card.label}</span>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <p className={`text-xl sm:text-2xl font-bold font-heading tabular-nums ${card.countColor}`}>{card.value.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>

            {/* Overdue Alert */}
            {overdueCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <span>มีโพสต์ที่เลยกำหนดส่ง <strong>{overdueCount}</strong> รายการ — กรุณาตรวจสอบในปฏิทินคอนเทนต์</span>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate('/content-planner')}>
                  ดูปฏิทิน
                </Button>
              </div>
            )}

            {/* Master 2-column */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* LEFT: สถานะการผลิต + ตาราง */}
              <div className="flex flex-col space-y-6 xl:col-span-2">
                {/* Work Progress */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">ภาพรวมสถานะคอนเทนต์</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {workProgressStatuses.map(statusKey => {
                      const count = statusCounts[statusKey];
                      const percent = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
                      const info = STATUS_MAP[statusKey];
                      return (
                        <div key={statusKey}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              {(() => { const StatusIcon = info.icon; return <StatusIcon className={`h-3.5 w-3.5 ${info.iconColor}`} />; })()}
                              {info.label}
                            </span>
                            <span className={`text-sm font-medium ${info.iconColor}`}>{count} ชิ้น ({percent}%)</span>
                          </div>
                          <Progress value={percent} className={`h-1.5 ${info.progressColor}`} />
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">เนื้อหาทั้งหมด</span>
                      <span className="text-lg font-bold">{totalItems.toLocaleString()} ชิ้น</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Funnel การผลิต */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">Funnel การผลิต</span>
                    </CardTitle>
                    <span className="shrink-0 text-xs text-muted-foreground">นับจากที่เคยผ่านแต่ละขั้น</span>
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !funnel || funnel.created === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ในระบบ</p>
                    ) : (
                      <div className="space-y-1">
                        {funnelStages.map((stage, idx) => {
                          const prev = idx > 0 ? funnelStages[idx - 1] : null;
                          const widthPct = funnel.created > 0 ? (stage.count / funnel.created) * 100 : 0;
                          const dropPct = prev && prev.count > 0
                            ? Math.round((1 - stage.count / prev.count) * 100)
                            : null;
                          return (
                            <div key={stage.key}>
                              {dropPct !== null && (
                                <p className="py-1 pl-1 text-xs text-muted-foreground">
                                  ↓ ตกหล่น <span className={dropPct >= 50 ? 'font-medium text-red-600' : 'font-medium text-amber-600'}>{dropPct}%</span>
                                  {' '}({(prev!.count - stage.count).toLocaleString()} ชิ้น)
                                </p>
                              )}
                              <div className="flex items-center gap-3">
                                <span className="w-20 shrink-0 text-sm text-muted-foreground">{stage.label}</span>
                                <div className="h-6 flex-1 rounded bg-muted">
                                  <div
                                    className={`flex h-6 items-center justify-end rounded px-2 ${stage.color}`}
                                    style={{ width: `${Math.max(widthPct, stage.count > 0 ? 8 : 0)}%` }}
                                  >
                                    {stage.count > 0 && (
                                      <span className="text-xs font-medium tabular-nums text-white">{stage.count.toLocaleString()}</span>
                                    )}
                                  </div>
                                </div>
                                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                  {Math.round(widthPct)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* คอนเทนต์ค้างท่อ */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Hourglass className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">คอนเทนต์ค้างท่อ</span>
                    </CardTitle>
                    {aging && aging.oldest_days !== null && (
                      <span className="shrink-0 text-xs text-muted-foreground">เก่าสุด {aging.oldest_days.toLocaleString()} วัน</span>
                    )}
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !aging || aging.total === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีคอนเทนต์ค้างท่อ — เผยแพร่ครบทุกชิ้น</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {agingBuckets.map(b => (
                            <div key={b.key} className="rounded-lg border p-3">
                              <p className="text-xs text-muted-foreground">{b.label}</p>
                              <p className={`text-xl font-bold font-heading tabular-nums ${b.color}`}>{b.count.toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex h-2 overflow-hidden rounded bg-muted">
                          {agingBuckets.map(b => (
                            b.count > 0 ? (
                              <div
                                key={b.key}
                                className={b.bg}
                                style={{ width: `${(b.count / aging.total) * 100}%` }}
                                title={`${b.label}: ${b.count} ชิ้น`}
                              />
                            ) : null
                          ))}
                        </div>
                        <div className="space-y-2 border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground">ค้างนานที่สุด</p>
                          {aging.items.map(item => {
                            const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                            const platform = item.platform ? PLATFORM_MAP[item.platform] : null;
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <p className="truncate text-sm">{item.title}</p>
                                  <Badge variant="outline" className={`shrink-0 ${status.color}`}>{status.label}</Badge>
                                  {platform && <Badge variant="outline" className={`shrink-0 ${platform.color}`}>{platform.label}</Badge>}
                                </div>
                                <span className={`shrink-0 text-xs font-medium tabular-nums ${item.age_days > 90 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  {item.age_days.toLocaleString()} วัน
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* สถานะสร้างสื่อ AI */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">สถานะสร้างสื่อ AI</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !assets || !hasAssetActivity ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีการสร้างสื่อด้วย AI</p>
                    ) : (
                      <div className="space-y-4">
                        {assetKinds.map(kind => {
                          const total = kind.data.none + kind.data.generating + kind.data.done + kind.data.failed;
                          const donePct = total > 0 ? Math.round((kind.data.done / total) * 100) : 0;
                          return (
                            <div key={kind.key}>
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{kind.label}</span>
                                <span className="text-sm font-medium">สำเร็จ {donePct}% ({kind.data.done.toLocaleString()}/{total.toLocaleString()})</span>
                              </div>
                              <Progress value={donePct} className="h-1.5" />
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                                {assetStatuses.map(s => (
                                  <span key={s.key} className={`text-xs ${s.color}`}>
                                    {s.label} <span className="font-medium tabular-nums">{kind.data[s.key].toLocaleString()}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* เนื้อหาล่าสุด */}
                <Card className="flex flex-1 flex-col">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">เนื้อหาล่าสุด</span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('/content')}>
                      ดูทั้งหมด
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {recentItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">ไม่มีเนื้อหา</p>
                    ) : (
                      <div className="space-y-3">
                        {recentItems.map(item => {
                          const type = TYPE_MAP[item.type] ?? TYPE_MAP.article;
                          const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                          const platform = item.platform ? PLATFORM_MAP[item.platform] : null;
                          const TypeIcon = type.icon;
                          return (
                            <div key={item.id} className="flex gap-3">
                              {/* Thumbnail (left, stretched to data height) */}
                              {item.generated_image_url ? (
                                <img
                                  src={item.generated_image_url}
                                  alt={item.title}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-14 self-stretch min-h-[56px] rounded border bg-muted object-cover shrink-0"
                                />
                              ) : (
                                <span className={`flex items-center justify-center w-14 self-stretch min-h-[56px] rounded border bg-muted shrink-0 ${type.color}`}>
                                  <TypeIcon className="h-5 w-5" />
                                </span>
                              )}
                              {/* Data (right) */}
                              <div className="flex-1 min-w-0 space-y-1">
                                {/* Line 1: title */}
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                {/* Line 2: type | platform */}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={type.color}>{type.label}</Badge>
                                  {platform ? (
                                    <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </div>
                                {/* Line 3: status | created date */}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={status.color}>{status.label}</Badge>
                                  <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT: สถานะ + งานที่ต้องทำ */}
              <div className="flex flex-col space-y-6">
                {/* สุขภาพคิวเผยแพร่ */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">สุขภาพคิวเผยแพร่</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !queue || queue.total === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการในคิวเผยแพร่</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          {queueStatuses.map(s => {
                            const StatusIcon = s.icon;
                            return (
                              <div key={s.key} className="flex items-center gap-2 rounded-lg border p-2">
                                <StatusIcon className={`h-4 w-4 shrink-0 ${s.color}`} />
                                <div className="min-w-0">
                                  <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                                  <p className={`text-base font-bold tabular-nums ${s.color}`}>{queue[s.key].toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {queue.overdue_pending > 0 && (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span>มี <strong>{queue.overdue_pending.toLocaleString()}</strong> รายการรอส่งที่เลยเวลาที่ตั้งไว้แล้ว</span>
                          </div>
                        )}

                        {queue.failures.length > 0 && (
                          <div className="space-y-3 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground">รายการที่ล้มเหลว</p>
                            {queue.failures.map(f => (
                              <div key={f.id} className="space-y-1.5 rounded-lg border border-red-200 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-950/20">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</p>
                                  <Badge variant="outline" className="shrink-0 text-xs">ลอง {f.retry_count.toLocaleString()} ครั้ง</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {f.platform && PLATFORM_MAP[f.platform] ? (
                                    <Badge variant="outline" className={PLATFORM_MAP[f.platform].color}>{PLATFORM_MAP[f.platform].label}</Badge>
                                  ) : null}
                                  {f.channel_name && <span className="truncate">{f.channel_name}</span>}
                                  <span>{formatDateTime(f.scheduled_at)}</span>
                                </div>
                                {f.error_msg && (
                                  <p className="break-words text-xs text-red-700 dark:text-red-300">{f.error_msg}</p>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-full gap-1.5 text-xs"
                                  disabled={sendNow.isPending}
                                  onClick={() => handleRetry(f.content_id, f.channel_id)}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  ลองส่งใหม่
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending Queue */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">รออนุมัติ</span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('/content?tab=approval')}>
                      ดูทั้งหมด
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {pendingItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">ไม่มีรายการรออนุมัติ</p>
                    ) : (
                      <div className="space-y-3">
                        {pendingItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium truncate min-w-0">{item.title}</p>
                            <span className="text-xs text-muted-foreground shrink-0">{formatDate(item.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Upcoming Schedule */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">กำหนดการโพสต์ถัดไป</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {upcomingSchedules.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">ไม่มีโพสต์ที่กำลังจะถึง</p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingSchedules.map(s => {
                          const platform = s.platform ? PLATFORM_MAP[s.platform] : null;
                          return (
                            <div key={s.id} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{s.topic || s.plan_title || 'ไม่มีชื่อ'}</p>
                                <p className="text-xs text-muted-foreground">{formatDateTime(s.scheduled_at)}</p>
                              </div>
                              {platform ? (
                                <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
                              ) : s.channel_name ? (
                                <span className="text-xs text-muted-foreground shrink-0">{s.channel_name}</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Channels */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">สถานะแพลตฟอร์ม</span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('/content?tab=settings')}>
                      จัดการ
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {channels.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">ไม่มีช่องทางที่เชื่อมต่อ</p>
                    ) : (
                      <div className="space-y-2">
                        {channels.map(ch => {
                          const status = channelStatus.find(s => s.id === ch.id);
                          const connected = status?.ok === true;
                          const pc = getPlatformColors(ch.platform);
                          return (
                            <div key={ch.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                                  style={{ backgroundColor: pc.bg, color: pc.text }}
                                  title={PLATFORM_MAP[ch.platform]?.label ?? ch.platform}
                                >
                                  <PlatformIcon platform={ch.platform} size={18} />
                                </span>
                                <span className="text-sm truncate">{ch.name}</span>
                              </div>
                              <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-600' : 'text-red-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                                {connected ? 'เชื่อมต่อแล้ว' : 'ไม่เชื่อมต่อ'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── วิเคราะห์ ───────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Result Metrics + Engagement Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {analyticsStatCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className={`stat-card p-3 sm:p-5 ${card.border} ${card.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{card.label}</span>
                      <Icon className={`w-4 h-4 shrink-0 ${card.color}`} />
                    </div>
                    <p className={`text-xl sm:text-2xl font-bold font-heading tabular-nums ${card.countColor}`}>{card.value}</p>
                    {card.hint && <p className="text-xs text-muted-foreground mt-1">{card.hint}</p>}
                  </div>
                );
              })}
            </div>

            {/* Platform Distribution + Top Content */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Platform Distribution */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">แพลตฟอร์ม</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(platformCounts).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(platformCounts)
                        .sort(([pa, a], [pb, b]) => {
                          const diff = b - a;
                          if (diff !== 0) return diff;
                          const nameA = PLATFORM_MAP[pa]?.label ?? pa;
                          const nameB = PLATFORM_MAP[pb]?.label ?? pb;
                          return nameA.localeCompare(nameB);
                        })
                        .map(([platform, count]) => {
                          const info = PLATFORM_MAP[platform];
                          const name = info?.label ?? platform;
                          const pc = getPlatformColors(platform);
                          return (
                            <div key={platform} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                                  style={{ backgroundColor: pc.bg, color: pc.text }}
                                  title={name}
                                >
                                  <PlatformIcon platform={platform} size={18} />
                                </span>
                                <span className="text-sm truncate">{name}</span>
                              </div>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Content */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">เนื้อหายอดนิยม</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topContent.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">ไม่มีเนื้อหา</p>
                  ) : (
                    <div className="space-y-3">
                      {topContent.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold shrink-0 tabular-nums">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {(Number(item.views) || 0).toLocaleString()}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {(Number(item.likes) || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Best Time To Post */}
            <Card className="overflow-hidden">
              <BestTimeAnalyticsPanel
                analytics={postingAnalytics}
                isLoading={analyticsLoading}
                onRecalculate={handleRecalculate}
                isRecalculating={recalcAnalytics.isPending}
              />
            </Card>

            {/* แนวโน้ม Throughput รายเดือน */}
            <ContentThroughputChart data={biAnalytics?.throughput ?? []} isLoading={biAnalyticsLoading} />

            {/* Lead time + ความสมบูรณ์ SEO */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Lead time แยกตามขั้น */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Timer className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Lead time แยกตามขั้น</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {biAnalyticsLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                  ) : !biAnalytics || biAnalytics.lead_time.every(s => s.sample_size === 0) ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ที่เดินผ่านขั้นตอนครบพอจะวัดเวลาได้</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="pb-2 text-left font-medium">ขั้นตอน</th>
                            <th className="pb-2 text-right font-medium">เฉลี่ย</th>
                            <th className="pb-2 text-right font-medium">p50</th>
                            <th className="pb-2 text-right font-medium">p90</th>
                            <th className="pb-2 text-right font-medium">จำนวน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {biAnalytics.lead_time.map(stage => (
                            <tr key={stage.key} className="border-b last:border-0">
                              <td className="py-2 pr-2">{stage.label}</td>
                              {stage.sample_size === 0 ? (
                                <td colSpan={3} className="py-2 text-right text-xs text-muted-foreground">ยังไม่มีข้อมูล</td>
                              ) : (
                                <>
                                  <td className="py-2 text-right font-medium tabular-nums">{formatHours(stage.avg_hours)}</td>
                                  <td className="py-2 text-right tabular-nums text-muted-foreground">{formatHours(stage.p50_hours)}</td>
                                  <td className="py-2 text-right tabular-nums text-muted-foreground">{formatHours(stage.p90_hours)}</td>
                                </>
                              )}
                              <td className="py-2 text-right tabular-nums text-muted-foreground">{stage.sample_size.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-3 text-xs text-muted-foreground">
                        p50/p90 อาจแกว่งมากเมื่อจำนวนตัวอย่างน้อย — ดูคอลัมน์ "จำนวน" ประกอบเสมอ
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ความสมบูรณ์ SEO */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <SearchCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">ความสมบูรณ์ SEO</span>
                  </CardTitle>
                  {biAnalytics && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {biAnalytics.seo.gate_enabled
                        ? `เกณฑ์บังคับ ≥ ${biAnalytics.seo.gate_min_score} คะแนน`
                        : 'ยังไม่เปิดเกณฑ์บังคับ'}
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  {biAnalyticsLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                  ) : !biAnalytics || biAnalytics.seo.total_articles === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ประเภทบทความ</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        จากบทความทั้งหมด {biAnalytics.seo.total_articles.toLocaleString()} ชิ้น
                      </p>
                      {biAnalytics.seo.fields.map(f => (
                        <div key={f.key}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{f.label}</span>
                            <span className={`text-sm font-medium tabular-nums ${f.pct === 0 ? 'text-red-600' : f.pct < 50 ? 'text-amber-600' : 'text-green-600'}`}>
                              {f.filled.toLocaleString()}/{f.total.toLocaleString()} ({f.pct}%)
                            </span>
                          </div>
                          <Progress value={f.pct} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Plan conversion + อัตราสำเร็จการเผยแพร่ */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Plan → Content conversion */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Plan → Content conversion</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {biAnalyticsLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                  ) : !biAnalytics || biAnalytics.plan_conversion.by_type.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีแผนคอนเทนต์</p>
                  ) : (
                    <div className="space-y-4">
                      {biAnalytics.plan_conversion.by_type.map(row => (
                        <div key={row.plan_type}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm">{row.label}</span>
                              <Badge variant="outline" className="shrink-0 text-xs">{row.plans.toLocaleString()} แผน</Badge>
                            </span>
                            <span className="shrink-0 text-sm font-medium tabular-nums">
                              {row.converted.toLocaleString()}/{row.plan_items.toLocaleString()} ({row.convert_pct}%)
                            </span>
                          </div>
                          <Progress value={row.convert_pct} className="h-1.5" />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.plan_items === 0
                              ? 'แผนนี้ยังไม่มีรายการย่อย'
                              : `แปลงเป็นคอนเทนต์แล้ว ${row.converted.toLocaleString()} ชิ้น · เผยแพร่แล้ว ${row.published.toLocaleString()} ชิ้น`}
                          </p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t pt-3">
                        <span className="text-sm text-muted-foreground">คอนเทนต์ที่สร้างนอกแผน</span>
                        <span className="text-sm font-medium tabular-nums">{biAnalytics.plan_conversion.adhoc_items.toLocaleString()} ชิ้น</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {biAnalyticsLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                  ) : !biAnalytics || biAnalytics.publish_success.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการเผยแพร่</p>
                  ) : (
                    <div className="space-y-4">
                      {biAnalytics.publish_success.map(row => (
                        <div key={row.platform}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={{
                                  backgroundColor: getPlatformColors(row.platform).bg,
                                  color: getPlatformColors(row.platform).text,
                                }}
                                title={platformLabel(row.platform)}
                              >
                                <PlatformIcon platform={row.platform} size={16} />
                              </span>
                              <span className="truncate text-sm">{platformLabel(row.platform)}</span>
                            </div>
                            {row.success_pct === null ? (
                              <span className="shrink-0 text-xs text-muted-foreground">ยังไม่มีรายการที่จบ</span>
                            ) : (
                              <span className={`shrink-0 text-sm font-medium tabular-nums ${row.success_pct >= 80 ? 'text-green-600' : row.success_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                สำเร็จ {row.success_pct}%
                              </span>
                            )}
                          </div>
                          {row.success_pct !== null && <Progress value={row.success_pct} className="h-1.5" />}
                          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            <span className="text-green-600">ส่งแล้ว <span className="font-medium tabular-nums">{row.sent.toLocaleString()}</span></span>
                            <span className="text-red-600">ล้มเหลว <span className="font-medium tabular-nums">{row.failed.toLocaleString()}</span></span>
                            <span>รอส่ง <span className="font-medium tabular-nums">{row.pending.toLocaleString()}</span></span>
                            {row.processing > 0 && <span>กำลังส่ง <span className="font-medium tabular-nums">{row.processing.toLocaleString()}</span></span>}
                          </div>
                          {row.top_error && (
                            <p className="mt-1 break-words text-xs text-red-700 dark:text-red-300">
                              ข้อผิดพลาดที่พบบ่อย: {row.top_error}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  );
}
