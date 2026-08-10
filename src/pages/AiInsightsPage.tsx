import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, BarChart3, Clock, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import PageShell from '@/components/PageShell';
import { apiFetch } from '@/lib/api';

const ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle, TrendingUp, TrendingDown, Lightbulb, BarChart3, Clock, FileText, Sparkles,
};

const COLOR_MAP: Record<string, { card: string; icon: string; bg: string }> = {
  red:    { card: 'border-red-200',    icon: 'text-red-500',    bg: 'bg-red-50' },
  orange: { card: 'border-orange-200', icon: 'text-orange-500', bg: 'bg-orange-50' },
  amber:  { card: 'border-amber-200',  icon: 'text-amber-600',  bg: 'bg-amber-50' },
  green:  { card: 'border-green-200',  icon: 'text-green-600',  bg: 'bg-green-50' },
  blue:   { card: 'border-blue-200',   icon: 'text-blue-600',   bg: 'bg-blue-50' },
};

export default function AiInsightsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => apiFetch('/ai-insights.php'),
  });

  const insights: any[] = data?.insights ?? [];
  const summary: any    = data?.summary  ?? {};

  return (
    <PageShell
      breadcrumbs={[{ label: 'AI วิเคราะห์', isCurrent: true }]}
      title="AI วิเคราะห์"
      description="ข้อมูลเชิงลึกจากการวิเคราะห์ข้อมูลธุรกิจของคุณ"
    >

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">โปรเจกต์ทั้งหมด</p><p className="text-3xl font-bold text-primary">{summary.total_projects ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">งานเกินกำหนด</p><p className="text-3xl font-bold text-red-500">{summary.overdue_tasks ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Ticket เปิดอยู่</p><p className="text-3xl font-bold text-amber-500">{summary.open_tickets ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">Pipeline มูลค่า</p><p className="text-3xl font-bold text-green-500">{((summary.pipeline_value ?? 0) / 1000).toFixed(0)}K</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : insights.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>ไม่พบข้อมูลเชิงลึกในขณะนี้ ระบบทำงานได้ดีปกติ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins: any, i: number) => {
            const Icon  = ICON_MAP[ins.icon] ?? Sparkles;
            const color = COLOR_MAP[ins.color] ?? COLOR_MAP.blue;
            return (
              <Card key={i} className={`border ${color.card}`}>
                <CardContent className={`pt-5 ${color.bg} rounded-lg`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color.icon}`} />
                    <div>
                      <p className="font-semibold text-sm mb-1">{ins.title}</p>
                      <p className="text-sm text-muted-foreground">{ins.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-violet-500" />AI สรุปภาพรวม</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>เสร็จสิ้น <strong className="text-foreground">{summary.completed_this_month ?? 0} งาน</strong> ในเดือนนี้
            {(summary.overdue_tasks ?? 0) > 0 && <> · มี <strong className="text-red-600">{summary.overdue_tasks} งานเกินกำหนด</strong></>}
            {(summary.delayed_projects ?? 0) > 0 && <> · โปรเจกต์ล่าช้า <strong className="text-orange-600">{summary.delayed_projects} รายการ</strong></>}
          </p>
          {(summary.expiring_contracts ?? 0) > 0 && (
            <p>สัญญาใกล้หมดอายุ <strong className="text-amber-600">{summary.expiring_contracts} ฉบับ</strong> ควรติดต่อลูกค้าเพื่อต่ออายุ</p>
          )}
          {(summary.leads_no_proposal ?? 0) > 0 && (
            <p>มี <strong className="text-blue-600">{summary.leads_no_proposal} leads</strong> ที่ยังไม่ได้รับ proposal — ควรติดตามเพื่อเพิ่มโอกาสปิดดีล</p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
