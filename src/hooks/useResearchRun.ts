import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';

/**
 * Mandatory Research workflow — orchestrate Fetch/Reuse → Analyze → Generate
 * ผ่าน endpoint เดิม (`content-research.php` + `brand-content.php`)
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
  /** ส่งต่อไปยัง generate-article เมื่อผู้ใช้เลือก Knowledge Base article */
  kbArticleId?: string | null;
}

/**
 * Research seed ต้องเป็น Original User Topic (`source_topic`) เสมอ
 * เพราะ title/topic แก้ไขภายหลังได้และอาจถูก AI rewrite
 * ไม่มี `source_topic` (ข้อมูลเก่า) จึง fallback ไปใช้ Topic ปัจจุบัน
 *
 * ทุก Generation Entry Point ต้องเรียกฟังก์ชันนี้ ห้าม resolve seed เองซ้ำ
 */
export function researchSeedTopic(sourceTopic?: string | null, currentTopic?: string | null): string {
  return (sourceTopic ?? '').trim() || (currentTopic ?? '').trim();
}

export function useResearchRun() {
  const [step, setStep] = useState<ResearchStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
  }, []);

  const run = useCallback(async ({ topic, itemId, kbArticleId }: ResearchRunParams): Promise<any> => {
    setError(null);
    try {
      // The fetch endpoint is responsible for cache reuse: a valid Research Data
      // within the configured TTL is returned instead of fetching again.
      // ถ้า Fetch ใหม่ล้มเหลว endpoint จะคืน Research เดิมที่ยังใช้ได้เป็น Fallback
      // (`fallback: true`) และจะ error 502 เมื่อไม่มี Fallback — flow นี้จึงหยุดเอง
      setStep('fetching');
      const job: any = await apiFetch('/content-research.php?action=fetch', {
        method: 'POST',
        body: JSON.stringify({ seed_keyword: topic.trim(), content_item_id: itemId }),
      });
      const jobId = job?.job_id;
      if (!jobId) {
        throw new Error('ค้นข้อมูล Research ไม่สำเร็จ');
      }

      if (!job?.analysis) {
        setStep('analyzing');
        // Only analyze when the selected Research job has no existing brief.
        // A cached job with a valid brief is reused as-is.
        await apiFetch('/content-research.php?action=analyze', {
          method: 'POST',
          body: JSON.stringify({ job_id: jobId }),
        });
      }

      setStep('generating');
      const articleRes: any = await apiFetch('/brand-content.php?action=generate-article', {
        method: 'POST',
        body: JSON.stringify({
          item_id: itemId,
          research_job_id: jobId,
          ...(kbArticleId ? { kb_article_id: kbArticleId } : {}),
        }),
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
