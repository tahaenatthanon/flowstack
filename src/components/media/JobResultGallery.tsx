import { Loader2, Download, ImageOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  resultUrls: string[];
  errorMessage?: string | null;
}

export default function JobResultGallery({ status, resultUrls, errorMessage }: Props) {
  if (status === 'idle') return null;

  if (status === 'pending' || status === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">AI กำลังสร้างภาพ...</p>
        <p className="text-xs">อาจใช้เวลา 10–60 วินาที</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm font-medium">สร้างภาพไม่สำเร็จ</p>
        {errorMessage && <p className="text-xs text-muted-foreground">{errorMessage}</p>}
      </div>
    );
  }

  if (status === 'completed' && resultUrls.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <ImageOff className="h-8 w-8" />
        <p className="text-sm">ไม่มีภาพในผลลัพธ์</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {resultUrls.map((url, i) => (
        <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
          <img src={url} alt={`ภาพที่ ${i + 1}`} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button size="sm" variant="secondary" asChild>
              <a href={url} download={`image-${i + 1}.png`} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5 mr-1.5" />ดาวน์โหลด
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
