import { AlertTriangle } from 'lucide-react';
import { useJourneyAlerts } from '@/hooks/useJourneys';
import type { JourneyAlert } from '@/types/journey';

const STAGE_LABEL: Record<string, string> = {
  marketing: 'การตลาด', sales: 'การขาย', project: 'โปรเจค',
  support: 'ซัพพอร์ต', renewal: 'ต่ออายุ',
};

interface Props {
  onViewAll?: () => void;
}

export function WorkflowAlertBar({ onViewAll }: Props) {
  const { data: alerts = [] } = useJourneyAlerts();
  if (alerts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 bg-red-50 border-b-2 border-red-200 px-4 py-1.5 text-xs">
      <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
      <span className="font-bold text-red-700">{alerts.length} Journey เกิน SLA</span>
      <span className="text-slate-400">·</span>
      <div className="flex gap-3 overflow-x-auto">
        {alerts.slice(0, 3).map((a: JourneyAlert) => (
          <span key={a.id} className="text-red-700 whitespace-nowrap">
            {a.company_name || a.journey_name || a.id} — {STAGE_LABEL[a.current_stage]} {a.days_in_stage} วัน
          </span>
        ))}
        {alerts.length > 3 && (
          <span className="text-slate-400">+{alerts.length - 3} รายการ</span>
        )}
      </div>
      <button
        onClick={onViewAll}
        className="ml-auto text-violet-600 underline font-semibold whitespace-nowrap hover:text-violet-800 transition-colors"
      >
        ดูทั้งหมด →
      </button>
    </div>
  );
}
