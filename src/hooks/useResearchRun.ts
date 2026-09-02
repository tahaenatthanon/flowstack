import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';

/**
 * AI Research workflow (Option B) — orchestrate Fetch → Analyze → Generate
 * ผ่าน endpoint เดิม (`content-research.php` + `brand-content.php`) โดยไม่แตะ backend
 *
 * ทั้ง fetch และ analyze เป็น synchronous (คืน job `done` หรือ throw error)
 * จึงไม่ต้อง poll — ไล่ขั้นตาม state machine: fetching → analyzing → generating → done
 */

export type ResearchStep = 'idle' | 'fetching' | 'analyzing' | 'generating' | 'done' | 'failed';

export const RESEARCH_STEP_LABELS: Record<string, string> = {
  fetching: 'ค้นข้อมูล',
  analyzing: 'วิเคราะห์',
  generating: 'เขียนบทความ',
};

export interface ResearchRunParams {
  topic: string;
  itemId: string;
}

export function useResearchRun() {
  const [step, setStep] = useState<ResearchStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
  }, []);

  const run = useCallback(async ({ topic, itemId }: ResearchRunParams): Promise<any> => {
    setError(null);
    try {
      setStep('fetching');
      const job: any = await apiFetch('/content-research.php?action=fetch', {
        method: 'POST',
        body: JSON.stringify({ seed_keyword: topic.trim(), content_item_id: itemId }),
      });
      const jobId = job?.job_id;
      if (!jobId) {
        throw new Error('ค้นข้อมูล Research ไม่สำเร็จ');
      }

      setStep('analyzing');
      await apiFetch('/content-research.php?action=analyze', {
        method: 'POST',
        body: JSON.stringify({ job_id: jobId }),
      });

      setStep('generating');
      const articleRes: any = await apiFetch('/brand-content.php?action=generate-article', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, research_job_id: jobId }),
      });

      setStep('done');
      return articleRes;
    } catch (e: any) {
      setStep('failed');
      setError(e?.message || 'เกิดข้อผิดพลาด');
      throw e;
    }
  }, []);

  return { run, step, error, reset };
}
