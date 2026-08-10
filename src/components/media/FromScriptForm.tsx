import { useState } from 'react';
import { Sparkles, Loader2, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import JobResultGallery from './JobResultGallery';

const SIZES = [
  { id: '1:1',  label: '1:1 (สี่เหลี่ยมจัตุรัส)', width: 1024, height: 1024 },
  { id: '16:9', label: '16:9 (แนวนอน)',            width: 1344, height: 768  },
  { id: '9:16', label: '9:16 (แนวตั้ง / TikTok)',  width: 768,  height: 1344 },
];

interface ParsedScene {
  prompt: string;
  shot?: string;
  existingImageUrl?: string;
}

function parseScenes(articleContent: string): ParsedScene[] {
  if (!articleContent) return [];

  try {
    const obj = JSON.parse(articleContent);

    // Primary: video script format { scenes: [{ visual_prompt, shot, image_url }] }
    if (Array.isArray(obj.scenes) && obj.scenes.length > 0) {
      return obj.scenes
        .map((s: any) => ({
          prompt: (typeof s === 'string' ? s : (s?.visual_prompt ?? s?.content ?? s?.text ?? '')).trim(),
          shot: typeof s === 'object' ? (s?.shot ?? s?.shot_type ?? '') : '',
          existingImageUrl: typeof s === 'object' ? s?.image_url : undefined,
        }))
        .filter((s: ParsedScene) => s.prompt.length > 5)
        .slice(0, 12);
    }

    // Fallback: other content formats
    const candidates = obj.visuals ?? obj.script_sections ?? obj.scripts ?? [];
    if (Array.isArray(candidates) && candidates.length > 0) {
      return candidates
        .map((s: any) => ({
          prompt: (typeof s === 'string' ? s : (s?.content ?? s?.text ?? '')).trim(),
        }))
        .filter((s: ParsedScene) => s.prompt.length > 5)
        .slice(0, 12);
    }

    const text = obj.excerpt ?? obj.html?.replace(/<[^>]+>/g, ' ') ?? '';
    if (text) return parseScenes(text);
  } catch {
    // Not JSON — fall through
  }

  // Plain-text heuristic
  const lines = articleContent.split(/\n/).map(l => l.trim()).filter(l => l.length > 20);
  const result: ParsedScene[] = [];
  for (const line of lines) {
    const clean = line.replace(/^[\d.\-*[\]#]+\s*/, '').trim();
    if (clean.length > 20 && result.length < 12) result.push({ prompt: clean });
  }
  return result;
}

type JobStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
interface SceneJob {
  scene: ParsedScene;
  status: JobStatus;
  resultUrls: string[];
  errorMsg: string | null;
  jobId: string | null;
}

export default function FromScriptForm() {
  const { toast } = useToast();
  const [selectedContentId, setSelectedContentId] = useState('__none__');
  const [size, setSize] = useState(SIZES[2].id); // default 9:16 for video
  const [selectedScenes, setSelectedScenes] = useState<number[]>([]);
  const [sceneJobs, setSceneJobs] = useState<SceneJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: videoItems = [] } = useQuery<any[]>({
    queryKey: ['content-items-video'],
    queryFn: () => apiFetch('/brand-content.php?action=list-items&type=video'),
  });

  const selectedItem = videoItems.find((i: any) => i.id === selectedContentId);
  const scenes = selectedItem ? parseScenes(selectedItem.article_content ?? '') : [];

  const toggleScene = (idx: number) => {
    setSelectedScenes(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleCreate = async () => {
    if (!selectedContentId || selectedContentId === '__none__' || selectedScenes.length === 0) return;
    setIsSubmitting(true);

    const sizeConfig = SIZES.find(s => s.id === size)!;

    const initialJobs: SceneJob[] = scenes.map((scene, i) => ({
      scene,
      status: selectedScenes.includes(i) ? 'processing' : 'idle',
      resultUrls: [],
      errorMsg: null,
      jobId: null,
    }));
    setSceneJobs(initialJobs);

    // Process scenes sequentially — each call waits for AI to finish
    for (const sceneIdx of selectedScenes) {
      try {
        const res: any = await apiFetch('/media-jobs.php?action=create', {
          method: 'POST',
          body: JSON.stringify({
            prompt: scenes[sceneIdx].prompt,
            input_params: { width: sizeConfig.width, height: sizeConfig.height },
            source_content_id: selectedContentId,
          }),
        });
        setSceneJobs(prev => prev.map((j, i) => i === sceneIdx
          ? { ...j, status: res.status ?? 'completed', resultUrls: res.result_urls ?? [], jobId: res.job_id }
          : j
        ));
      } catch (e: any) {
        setSceneJobs(prev => prev.map((j, i) => i === sceneIdx
          ? { ...j, status: 'failed', errorMsg: e.message }
          : j
        ));
        toast({ title: `ฉาก ${sceneIdx + 1} ไม่สำเร็จ`, description: e.message, variant: 'destructive' });
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Script selector */}
      <div className="space-y-1.5">
        <Label>เลือก Video Script</Label>
        <Select
          value={selectedContentId}
          onValueChange={v => {
            setSelectedContentId(v);
            setSelectedScenes([]);
            setSceneJobs([]);
          }}
        >
          <SelectTrigger><SelectValue placeholder="เลือก script..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— เลือก script —</SelectItem>
            {videoItems.map((item: any) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title || 'ไม่มีชื่อ'}
                {item.platform && <span className="text-muted-foreground ml-1 text-xs">· {item.platform}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedContentId !== '__none__' && scenes.length === 0 && (
          <p className="text-xs text-destructive mt-1">
            ไม่พบ visual prompt ใน script นี้ — กรุณาสร้างสคริปต์วิดีโอก่อน (ต้องมีฉากพร้อม visual prompt)
          </p>
        )}
      </div>

      {/* Scene picker */}
      {scenes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>เลือกฉากที่ต้องการสร้างภาพ ({selectedScenes.length}/{scenes.length})</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                setSelectedScenes(
                  selectedScenes.length === scenes.length ? [] : scenes.map((_, i) => i)
                )
              }
            >
              {selectedScenes.length === scenes.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>

          <div className="space-y-2">
            {scenes.map((scene, i) => {
              const isSelected = selectedScenes.includes(i);
              const job = sceneJobs[i];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleScene(i)}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border text-xs transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                    isSubmitting && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      {scene.existingImageUrl
                        ? <img src={scene.existingImageUrl} alt="" className="w-8 h-8 rounded object-cover border" />
                        : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {scene.shot && (
                        <span className="inline-block mb-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {scene.shot}
                        </span>
                      )}
                      <p className="line-clamp-2 leading-relaxed">{scene.prompt}</p>
                    </div>
                    {job && job.status !== 'idle' && (
                      <div className="shrink-0 ml-1">
                        {(job.status === 'pending' || job.status === 'processing') && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        )}
                        {job.status === 'completed' && job.resultUrls[0] && (
                          <img src={job.resultUrls[0]} alt="" className="w-8 h-8 rounded object-cover border" />
                        )}
                        {job.status === 'completed' && !job.resultUrls[0] && (
                          <Image className="h-3.5 w-3.5 text-green-500" />
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Options row */}
      {scenes.length > 0 && (
        <div className="space-y-1.5 max-w-xs">
          <Label>ขนาดภาพ</Label>
          <Select value={size} onValueChange={setSize} disabled={isSubmitting}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SIZES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Submit button */}
      {scenes.length > 0 && (
        <div className="space-y-1">
          <Button
            onClick={handleCreate}
            disabled={selectedScenes.length === 0 || isSubmitting}
            className="gap-2"
          >
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 animate-spin" />AI กำลังสร้างภาพ...</>
              : <><Sparkles className="h-4 w-4" />สร้างภาพ {selectedScenes.length} ฉาก</>}
          </Button>
          {isSubmitting && (
            <p className="text-xs text-muted-foreground">กำลังสร้างทีละฉาก อาจใช้เวลา 15–60 วินาทีต่อฉาก</p>
          )}
        </div>
      )}

      {/* Result galleries */}
      {sceneJobs.filter(j => j.status !== 'idle').map((job, i) => (
        <div key={i} className="space-y-1 border rounded-lg p-3 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground line-clamp-1">
            ฉาก {i + 1}: {job.scene.prompt}
          </p>
          <JobResultGallery
            status={job.status}
            resultUrls={job.resultUrls}
            errorMessage={job.errorMsg}
          />
        </div>
      ))}
    </div>
  );
}
