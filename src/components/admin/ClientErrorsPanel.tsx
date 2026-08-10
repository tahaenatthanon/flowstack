import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, RefreshCw, CheckCircle2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export function ClientErrorsPanel() {
  const [hours, setHours] = useState('24');
  const [expanded, setExpanded] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['client-errors-log', hours],
    queryFn: () => apiFetch(`/client-errors-list.php?hours=${hours}`),
    staleTime: 2 * 60 * 1000,
  });

  const purge = useMutation({
    mutationFn: () => apiFetch('/client-errors-list.php', { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'ล้างข้อมูล crash log แล้ว' });
      qc.invalidateQueries({ queryKey: ['client-errors-log'] });
    },
    onError: (e: any) => toast({ title: 'ล้มเหลว', description: e.message, variant: 'destructive' }),
  });

  const errors: any[] = data?.errors ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Frontend Crash Log
              </CardTitle>
              <CardDescription className="mt-1">
                ข้อผิดพลาด JavaScript ที่ถูกจับโดย ErrorBoundary ในแอปพลิเคชัน
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 ชั่วโมง</SelectItem>
                  <SelectItem value="6">6 ชั่วโมง</SelectItem>
                  <SelectItem value="24">24 ชั่วโมง</SelectItem>
                  <SelectItem value="72">3 วัน</SelectItem>
                  <SelectItem value="168">7 วัน</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => purge.mutate()}
                disabled={purge.isPending || total === 0}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                ล้างทั้งหมด
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <RefreshCw className="h-4 w-4 animate-spin" />กำลังโหลด…
            </div>
          ) : total === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600 py-6">
              <CheckCircle2 className="h-5 w-5" />
              ไม่มี crash log ใน {hours} ชั่วโมงที่ผ่านมา
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                พบ <strong>{total}</strong> รายการใน {hours} ชั่วโมงที่ผ่านมา
                {total === 200 && ' (แสดงสูงสุด 200 รายการ)'}
              </p>
              <div className="divide-y max-h-[560px] overflow-y-auto">
                {errors.map((e, i) => (
                  <div key={e.id ?? i} className="py-3">
                    <button
                      type="button"
                      className="w-full text-left flex items-start gap-3"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs shrink-0 border-red-200 text-red-600 bg-red-50">
                            {e.section ?? 'unknown'}
                          </Badge>
                          <span className="text-sm font-medium truncate">{e.message}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {e.created_at && (
                            <span>{format(parseISO(e.created_at), 'd MMM yyyy HH:mm', { locale: th })}</span>
                          )}
                          {e.ip_address && <span>{e.ip_address}</span>}
                          {e.user_id && <span>user: {e.user_id.slice(0, 8)}…</span>}
                        </div>
                      </div>
                      {expanded === i
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                    </button>

                    {expanded === i && (e.stack || e.component_stack) && (
                      <div className="mt-2 space-y-2">
                        {e.stack && (
                          <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                            {e.stack}
                          </pre>
                        )}
                        {e.component_stack && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Component stack
                            </summary>
                            <pre className="mt-1 bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                              {e.component_stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
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
