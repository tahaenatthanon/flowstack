// src/components/SurveyPublicForm.tsx
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { type SurveyQuestion, type SurveyAnswer, parseOptions } from '@/hooks/useSurveys';

interface Props {
  questions: SurveyQuestion[];
  onSubmit: (answers: SurveyAnswer[]) => void;
  submitting: boolean;
}

export function SurveyPublicForm({ questions, onSubmit, submitting }: Props) {
  const initialValues = useMemo(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.question_type === 'scale_1_5') {
        init[q.id] = '3';
      }
    }
    return init;
  }, [questions]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);

  function setValue(questionId: string, value: string) {
    setValues(prev => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const answers: SurveyAnswer[] = questions.map(q => ({
      question_id: q.id,
      answer_value: values[q.id] ?? '',
    }));
    onSubmit(answers);
  }

  const allAnswered = questions.every(q => values[q.id] !== undefined && values[q.id] !== '');

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {questions.map((q, idx) => (
        <div key={q.id} className="space-y-3">
          <Label className="text-base font-medium">
            {idx + 1}. {q.question_text}
            {q.is_critical === 1 && (
              <span className="ml-2 text-xs text-red-500 font-normal">(สำคัญ)</span>
            )}
          </Label>

          {q.question_type === 'yes_no' && (
            <RadioGroup
              value={values[q.id] ?? ''}
              onValueChange={v => setValue(q.id, v)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                <Label htmlFor={`${q.id}-yes`}>ใช่</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id={`${q.id}-no`} />
                <Label htmlFor={`${q.id}-no`}>ไม่ใช่</Label>
              </div>
            </RadioGroup>
          )}

          {q.question_type === 'scale_1_5' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>น้อยมาก (1)</span>
                <span className="font-semibold text-foreground">{values[q.id]}</span>
                <span>มากที่สุด (5)</span>
              </div>
              <Slider
                min={1} max={5} step={1}
                value={[Number(values[q.id])]}
                onValueChange={([v]) => setValue(q.id, String(v))}
              />
            </div>
          )}

          {q.question_type === 'multiple_choice' && q.options_json && (
            <RadioGroup
              value={values[q.id] ?? ''}
              onValueChange={v => setValue(q.id, v)}
              className="space-y-2"
            >
              {parseOptions(q.options_json).map(opt => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                  <Label htmlFor={`${q.id}-${opt.value}`}>{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {q.question_type === 'text' && (
            <Textarea
              value={values[q.id] ?? ''}
              onChange={e => setValue(q.id, e.target.value)}
              placeholder="กรอกคำตอบ..."
              rows={3}
            />
          )}
        </div>
      ))}

      <Button type="submit" disabled={!allAnswered || submitting} className="w-full">
        {submitting ? 'กำลังส่ง...' : 'ส่งแบบสอบถาม'}
      </Button>
    </form>
  );
}
