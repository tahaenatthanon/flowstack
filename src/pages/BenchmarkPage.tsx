import { BarChart3, TrendingUp, TrendingDown, Award, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageShell from '@/components/PageShell';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

function isGood(yours: number, industry: number, better: string) {
  return better === 'higher' ? yours >= industry : yours <= industry;
}

export default function BenchmarkPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['benchmark'],
    queryFn: () => apiFetch('/benchmark.php'),
  });

  const benchmarks: any[] = data?.benchmarks ?? [];
  const meta: any         = data?.meta ?? {};

  const betterCount = benchmarks.filter(b => isGood(b.yours, b.industry, b.better)).length;
  const score = benchmarks.length > 0 ? Math.round(betterCount / benchmarks.length * 100) : 0;

  return (
    <PageShell
      breadcrumbs={[{ label: 'Benchmark', isCurrent: true }]}
      title="Benchmark"
      description="เปรียบเทียบประสิทธิภาพกับค่าเฉลี่ยอุตสาหกรรม"
    >

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-5 text-center">
            <Award className={cn('h-10 w-10 mx-auto mb-2', score >= 70 ? 'text-amber-400' : 'text-muted-foreground')} />
            <p className="text-3xl font-bold text-primary">{score}%</p>
            <p className="text-xs text-muted-foreground mt-1">คะแนนรวม Benchmark</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-green-500">{betterCount}</p>
            <p className="text-xs text-muted-foreground mt-1">ดีกว่าค่าเฉลี่ย</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-amber-500">{benchmarks.length - betterCount}</p>
            <p className="text-xs text-muted-foreground mt-1">ต้องปรับปรุง</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-blue-500">{meta.tasks_completed ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">งานที่เสร็จแล้ว</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">เปรียบเทียบรายละเอียด</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {benchmarks.map((b: any) => {
              const good = isGood(b.yours, b.industry, b.better);
              const pct  = b.industry > 0 ? Math.abs(b.yours - b.industry) / b.industry * 100 : 0;
              return (
                <div key={b.metric} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{b.metric}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">คุณ: <strong className={good ? 'text-green-600' : 'text-amber-600'}>{b.yours}{b.unit}</strong></span>
                      <span className="text-xs text-muted-foreground">เฉลี่ย: {b.industry}{b.unit}</span>
                    </div>
                  </div>
                  <div className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', good ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {pct.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
