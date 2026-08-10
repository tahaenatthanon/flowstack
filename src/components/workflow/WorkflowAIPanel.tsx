import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Zap, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import type { AIRecommendation } from '@/types/workflow';
import { useToast } from '@/hooks/use-toast';

interface Props { definitionId: string; }

export function WorkflowAIPanel({ definitionId }: Props) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiFetch('/workflow-ai.php', { method: 'POST', body: JSON.stringify({ definition_id: definitionId }) }),
    onSuccess: (data: { recommendations: AIRecommendation[] }) => setRecommendations(data.recommendations),
    onError: () => toast({ title: 'ไม่สามารถรับคำแนะนำจาก AI ได้', variant: 'destructive' }),
  });

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-700">
          <Sparkles size={16} />
          <span className="font-semibold text-sm">AI แนะนำ</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending || !definitionId}>
          {mutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
          วิเคราะห์
        </Button>
      </div>

      {recommendations.length === 0 && !mutation.isPending && (
        <p className="text-xs text-slate-400 text-center mt-8">กด "วิเคราะห์" เพื่อให้ AI ตรวจสอบ workflow</p>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto">
        {recommendations.map((r, i) => (
          <div key={i} className={`rounded-lg border p-3 ${r.type === 'quick_fix' ? 'border-amber-200 bg-amber-50' : 'border-purple-200 bg-purple-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {r.type === 'quick_fix' ? <Zap size={12} className="text-amber-600" /> : <TrendingUp size={12} className="text-purple-600" />}
              <Badge variant="outline" className={`text-xs ${r.type === 'quick_fix' ? 'text-amber-700 border-amber-300' : 'text-purple-700 border-purple-300'}`}>
                {r.type === 'quick_fix' ? 'แก้ด่วน' : 'ปรับปรุง process'}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-slate-700">{r.title}</p>
            <p className="text-xs text-slate-600 mt-1">{r.description}</p>
            <p className="text-xs text-slate-500 mt-1 italic">ผลที่คาด: {r.impact}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
