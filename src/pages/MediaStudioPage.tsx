import { useState } from 'react';
import { Wand2, History, PenLine, FileText } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import FreePromptForm from '@/components/media/FreePromptForm';
import FromScriptForm from '@/components/media/FromScriptForm';
import JobHistoryTab from '@/components/media/JobHistoryTab';

type Mode = 'prompt' | 'script';

export default function MediaStudioPage() {
  const [mode, setMode] = useState<Mode>('prompt');

  return (
    <PageShell
      breadcrumbs={[{ label: 'การตลาด' }, { label: 'สตูดิโอสื่อ', isCurrent: true }]}
      title="สตูดิโอสื่อ"
      description="สร้างภาพด้วย AI ผ่าน Kie.ai"
    >
      <Tabs defaultValue="create" className="space-y-6">
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Wand2 className="h-3.5 w-3.5" />สร้างภาพ
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-3.5 w-3.5" />ประวัติ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('prompt')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                mode === 'prompt'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              )}
            >
              <PenLine className="h-4 w-4" />พิมพ์ Prompt
            </button>
            <button
              type="button"
              onClick={() => setMode('script')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                mode === 'script'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              )}
            >
              <FileText className="h-4 w-4" />จาก Video Script
            </button>
          </div>

          {mode === 'prompt' && <FreePromptForm />}
          {mode === 'script' && <FromScriptForm />}
        </TabsContent>

        <TabsContent value="history">
          <JobHistoryTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
