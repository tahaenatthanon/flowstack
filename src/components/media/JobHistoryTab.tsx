import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Loader2, ImageOff, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; class: string }> = {
  pending:    { label: 'รอคิว',     icon: Clock,         class: 'text-muted-foreground' },
  processing: { label: 'กำลังสร้าง', icon: Loader2,       class: 'text-blue-500 animate-spin' },
  completed:  { label: 'สำเร็จ',    icon: CheckCircle2,  class: 'text-green-500' },
  failed:     { label: 'ล้มเหลว',   icon: XCircle,       class: 'text-destructive' },
};

export default function JobHistoryTab() {
  const { data, isLoading } = useQuery<{ jobs: any[] }>({
    queryKey: ['media-jobs-history'],
    queryFn: () => apiFetch('/media-jobs.php?action=list'),
    refetchInterval: 5000,
  });

  const jobs = data?.jobs ?? [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <ImageOff className="h-10 w-10 opacity-30" />
        <p className="text-sm">ยังไม่มีประวัติการสร้างภาพ</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job: any) => {
        const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.processing;
        const Icon = cfg.icon;
        const firstImage = job.result_urls?.[0];
        return (
          <div key={job.id} className="flex gap-3 p-3 border rounded-lg bg-card hover:bg-muted/20 transition-colors">
            <div className="w-16 h-16 rounded-md overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
              {firstImage
                ? <img src={firstImage} alt="ผลลัพธ์" className="w-full h-full object-cover" />
                : <Icon className={`h-5 w-5 ${cfg.class}`} />}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-medium line-clamp-2">{job.prompt}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{job.model}</Badge>
                <span className={`flex items-center gap-1 text-[10px] ${cfg.class}`}>
                  <Icon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                  {cfg.label}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(job.created_at).toLocaleString('th-TH')}
              </p>
              {job.result_urls?.length > 0 && (
                <p className="text-[10px] text-primary">{job.result_urls.length} ภาพ</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
