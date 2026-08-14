import {
  PenTool, Plus, Wand2, Bot, Settings2, Clock, AlertTriangle, ClipboardCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContentListTab from '@/components/content/tabs/ContentListTab';
import ContentApprovalTab from '@/components/content/tabs/ContentApprovalTab';
import SkillsTriggerTab from '@/components/content/tabs/SkillsTriggerTab';
import AISettingsTab from '@/components/content/tabs/AISettingsTab';
import ScheduleOverviewPanel from '@/components/content/tabs/ScheduleOverviewPanel';
import { BatchGenerateDialog } from '@/components/content/dialogs/BatchGenerateDialog';
import QuickCreateDialog from '@/components/content/dialogs/QuickCreateDialog';
import { useOverdueCount } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';

export default function ContentPage() {
  const [batchOpen, setBatchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'approval' ? 'approval' : 'content'
  );
  const { data: overdue } = useOverdueCount();
  const overdueCount = overdue?.count ?? 0;

  return (
    <PageShell
      breadcrumbs={[{ label: 'การตลาด', href: '/marketing' }, { label: 'คอนเทนต์', isCurrent: true }]}
      title="ผลงานคอนเทนต์"
      description="ดูผลงาน ตั้งเวลาโพสต์ และจัดการ Skills"
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => setQuickOpen(true)}>
            <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">สร้างคอนเทนต์</span><span className="sm:hidden">สร้าง</span>
          </Button>
          <Button className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md"
            onClick={() => setBatchOpen(true)}>
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Batch สร้าง</span>
            <span className="sm:hidden">Batch</span>
          </Button>
        </>
      }
    >

      <BatchGenerateDialog open={batchOpen} onOpenChange={setBatchOpen} />
      <QuickCreateDialog open={quickOpen} onOpenChange={setQuickOpen} />

      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span>มีโพสต์ที่เลยกำหนดส่ง <strong>{overdueCount}</strong> รายการ — กรุณาตรวจสอบในแท็บ "กำหนดการโพสต์"</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-5">
          <TabsTrigger value="content"  className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <PenTool className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">ผลงานทั้งหมด</span>
          </TabsTrigger>
          <TabsTrigger value="approval" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">รายการอนุมัติ</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">กำหนดการโพสต์</span>
          </TabsTrigger>
          <TabsTrigger value="skills"   className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <Bot className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Skills & Triggers</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <Settings2 className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">ตั้งค่า AI</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content"><ContentListTab /></TabsContent>
        <TabsContent value="approval"><ContentApprovalTab /></TabsContent>
        <TabsContent value="schedule">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />กำหนดการโพสต์อัตโนมัติ
              </CardTitle>
              <p className="text-xs text-muted-foreground">ระบบจะส่งโพสต์ตามเวลาที่ตั้งไว้ทุก 60 วินาทีอัตโนมัติ</p>
            </CardHeader>
            <CardContent><ScheduleOverviewPanel /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="skills"><SkillsTriggerTab /></TabsContent>
        <TabsContent value="settings"><AISettingsTab /></TabsContent>
      </Tabs>
    </PageShell>
  );
}
