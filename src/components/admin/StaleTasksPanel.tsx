import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

const STATUS_LABEL: Record<string, string> = {
  pending:     'รอดำเนินการ',
  in_progress: 'กำลังทำ',
  on_hold:     'พัก',
  review:      'รอตรวจ',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
};

export function StaleTasksPanel() {
  const [days, setDays] = useState('30');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['stale-tasks', days],
    queryFn: () => apiFetch(`/impactos.php?view=stale_tasks&days=${days}`),
    staleTime: 5 * 60 * 1000,
  });

  const tasks: any[] = data?.tasks ?? [];
  const count: number = data?.count ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Stale Tasks — งานค้างนาน
              </CardTitle>
              <CardDescription className="mt-1">
                งานที่ยังไม่เสร็จและไม่มีการอัปเดตนานกว่าที่กำหนด
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 วัน</SelectItem>
                  <SelectItem value="14">14 วัน</SelectItem>
                  <SelectItem value="30">30 วัน</SelectItem>
                  <SelectItem value="60">60 วัน</SelectItem>
                  <SelectItem value="90">90 วัน</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <RefreshCw className="h-4 w-4 animate-spin" />กำลังโหลด…
            </div>
          ) : count === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600 py-6">
              <CheckCircle2 className="h-5 w-5" />
              ไม่มีงานค้างเกิน {days} วัน — ทุกงานได้รับการอัปเดตล่าสุดแล้ว
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                พบ <strong>{count}</strong> งานที่ไม่มีการอัปเดตเกิน {days} วัน
                {count === 100 && ' (แสดงสูงสุด 100 รายการ)'}
              </p>
              <div className="divide-y max-h-[520px] overflow-y-auto">
                {tasks.map((t) => (
                  <div key={t.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{t.title}</span>
                        <Badge
                          variant="outline"
                          className={cn('text-xs shrink-0', PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.low)}
                        >
                          {t.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        {t.project_name && (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            {t.project_name}
                          </span>
                        )}
                        {t.assignee_name && <span>• {t.assignee_name}</span>}
                        <span>• {STATUS_LABEL[t.status] ?? t.status}</span>
                      </div>
                      {t.end_date && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          กำหนดส่ง: {format(parseISO(t.end_date), 'd MMM yyyy', { locale: th })}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          t.days_stale >= 60 ? 'border-red-300 text-red-600 bg-red-50'
                            : t.days_stale >= 30 ? 'border-amber-300 text-amber-600 bg-amber-50'
                            : 'border-gray-200 text-gray-500'
                        )}
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {t.days_stale} วัน
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        อัปเดตล่าสุด
                        <br />
                        {t.updated_at
                          ? format(parseISO(t.updated_at), 'd MMM yy', { locale: th })
                          : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
