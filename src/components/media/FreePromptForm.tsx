import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import JobResultGallery from './JobResultGallery';

const SIZES = [
  { id: '1:1',  label: '1:1 (สี่เหลี่ยมจัตุรัส)', width: 1024, height: 1024 },
  { id: '16:9', label: '16:9 (แนวนอน)',            width: 1344, height: 768  },
  { id: '9:16', label: '9:16 (แนวตั้ง)',            width: 768,  height: 1344 },
];

type JobStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export default function FreePromptForm() {
  const { toast } = useToast();
  const [prompt, setPrompt]   = useState('');
  const [size, setSize]       = useState(SIZES[0].id);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  const handleCreate = async () => {
    if (!prompt.trim()) return;
    const sizeConfig = SIZES.find(s => s.id === size)!;
    setJobStatus('processing');
    setResultUrls([]);
    setErrorMsg(null);

    try {
      const res: any = await apiFetch('/media-jobs.php?action=create', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.trim(),
          input_params: { width: sizeConfig.width, height: sizeConfig.height },
          source_content_id: null,
        }),
      });
      setJobStatus(res.status ?? 'completed');
      setResultUrls(res.result_urls ?? []);
    } catch (e: any) {
      setJobStatus('failed');
      setErrorMsg(e.message);
      toast({ title: 'สร้างไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  };

  const isRunning = jobStatus === 'processing';

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="space-y-1.5">
        <Label>คำอธิบายภาพ <span className="text-destructive">*</span></Label>
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="อธิบายภาพที่ต้องการ เช่น: A modern Thai office building at golden hour, photorealistic, 4K"
          className="min-h-[100px] text-sm"
          disabled={isRunning}
        />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label>ขนาดภาพ</Label>
        <Select value={size} onValueChange={setSize} disabled={isRunning}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SIZES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleCreate} disabled={!prompt.trim() || isRunning} className="gap-2">
        {isRunning
          ? <><Loader2 className="h-4 w-4 animate-spin" />AI กำลังสร้างภาพ...</>
          : <><Sparkles className="h-4 w-4" />สร้างภาพ</>}
      </Button>
      {isRunning && (
        <p className="text-xs text-muted-foreground">อาจใช้เวลา 15–60 วินาที กรุณาอย่าปิดหน้านี้</p>
      )}

      <JobResultGallery status={jobStatus} resultUrls={resultUrls} errorMessage={errorMsg} />
    </div>
  );
}
