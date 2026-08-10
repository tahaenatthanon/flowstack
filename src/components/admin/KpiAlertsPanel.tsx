import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnomalyAlert {
  user_id: string;
  name: string;
  position: string;
  last_week: number;
  this_week: number;
  drop: number;
  last_period: string;
  this_period: string;
}

export function KpiAlertsPanel() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['kpi-anomaly'],
    queryFn: () => apiFetch('/impactos.php?view=anomaly&threshold=20'),
    staleTime: 5 * 60 * 1000,
  });

  const alerts: AnomalyAlert[] = data?.alerts ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                KPI Alerts — ตรวจจับคะแนนตก
              </CardTitle>
              <CardDescription className="mt-1">
                ผู้ใช้ที่คะแนน KPI รวมลดลง ≥ 20 คะแนน เทียบสัปดาห์ที่แล้วกับสัปดาห์นี้
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <RefreshCw className="h-4 w-4 animate-spin" />กำลังคำนวณ…
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600 py-4">
              <CheckCircle2 className="h-5 w-5" />
              ไม่มีสัญญาณเตือน — คะแนน KPI ทุกคนอยู่ในเกณฑ์ปกติ
            </div>
          ) : (
            <div className="divide-y">
              {alerts.map((a) => (
                <div key={a.user_id} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.position || 'ไม่ระบุตำแหน่ง'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      สัปดาห์ที่แล้ว ({a.last_period}): <strong>{a.last_week}</strong>
                      {' → '}
                      สัปดาห์นี้ ({a.this_period}): <strong>{a.this_week}</strong>
                    </p>
                  </div>
                  <Badge
                    variant="destructive"
                    className={cn(
                      'shrink-0 gap-1',
                      a.drop >= 40 ? 'bg-red-600' : 'bg-amber-500'
                    )}
                  >
                    <TrendingDown className="h-3 w-3" />
                    -{a.drop} pts
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">เกี่ยวกับ KPI Alerts</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• ระบบเปรียบเทียบคะแนน KPI รายสัปดาห์ (จันทร์–อาทิตย์)</p>
          <p>• แสดงเฉพาะผู้ที่มีกิจกรรมสัปดาห์ที่แล้วและคะแนนลดลง ≥ 20 คะแนน</p>
          <p>• คะแนนที่ลดลง ≥ 40 คะแนนแสดงด้วยสีแดง — ควรติดตามทันที</p>
          <p>• การแจ้งเตือนนี้ไม่ใช่การตัดสินผลงาน — ใช้เป็นสัญญาณเพื่อพูดคุยและช่วยเหลือ</p>
        </CardContent>
      </Card>
    </div>
  );
}
