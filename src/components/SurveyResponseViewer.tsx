// src/components/SurveyResponseViewer.tsx
import { SURVEY_PRIORITY_LABELS } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurveyResponse } from '@/hooks/useSurveys';

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: SURVEY_PRIORITY_LABELS.critical, className: 'bg-red-100 text-red-800 border-red-300' },
  high:     { label: SURVEY_PRIORITY_LABELS.high,   className: 'bg-orange-100 text-orange-800 border-orange-300' },
  medium:   { label: SURVEY_PRIORITY_LABELS.medium, className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  low:      { label: SURVEY_PRIORITY_LABELS.low,   className: 'bg-gray-100 text-gray-700 border-gray-300' },
};

interface Props {
  response: SurveyResponse;
}

export function SurveyResponseViewer({ response }: Props) {
  const priorityConfig = response.pain_priority ? PRIORITY_CONFIG[response.pain_priority] : null;
  const percentage = response.pain_point_score != null
    ? Math.round(response.pain_point_score)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{response.template?.name ?? response.template_name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {response.submitted_at
                ? `ส่งเมื่อ ${new Date(response.submitted_at).toLocaleDateString('th-TH')}`
                : response.status === 'pending' ? 'รอการตอบ' : response.status}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {priorityConfig && (
              <Badge variant="outline" className={priorityConfig.className}>
                {priorityConfig.label}
              </Badge>
            )}
            {percentage != null && (
              <span className="text-xs font-semibold text-muted-foreground">
                {percentage}%
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      {response.answers && response.answers.length > 0 && (
        <CardContent className="space-y-3 pt-0">
          {response.answers.map((a, i) => (
            <div key={a.question_id} className="text-sm space-y-0.5">
              <p className="text-muted-foreground text-xs">{i + 1}. {a.question_text}</p>
              <p className="font-medium">
                {a.question_type === 'yes_no'
                  ? (a.answer_value === 'yes' ? 'ใช่' : 'ไม่ใช่')
                  : a.answer_value}
              </p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
