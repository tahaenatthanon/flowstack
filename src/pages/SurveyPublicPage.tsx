// src/pages/SurveyPublicPage.tsx
import { useParams } from 'react-router-dom';
import { useSurveyPublic, useSubmitSurveyPublic } from '@/hooks/useSurveys';
import { SurveyPublicForm } from '@/components/SurveyPublicForm';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { SurveyAnswer } from '@/hooks/useSurveys';
import { useToast } from '@/hooks/use-toast';

export default function SurveyPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useSurveyPublic(token);
  const submitMutation = useSubmitSurveyPublic();
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(answers: SurveyAnswer[]) {
    if (!token) return;
    try {
      await submitMutation.mutateAsync({ token, answers });
      setSubmitted(true);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-lg font-medium">ลิงก์ไม่ถูกต้องหรือหมดอายุ</p>
          <p className="text-muted-foreground text-sm">กรุณาติดต่อผู้ส่งแบบสอบถาม</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <p className="text-xl font-semibold">ขอบคุณสำหรับการตอบแบบสอบถาม</p>
          <p className="text-muted-foreground">ข้อมูลของคุณถูกส่งเรียบร้อยแล้ว</p>
        </div>
      </div>
    );
  }

  const { template, company_name } = data;

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{company_name}</p>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && (
            <p className="text-muted-foreground">{template.description}</p>
          )}
        </div>

        {/* Form */}
        <SurveyPublicForm
          questions={template.questions}
          onSubmit={handleSubmit}
          submitting={submitMutation.isPending}
        />
      </div>
    </div>
  );
}
