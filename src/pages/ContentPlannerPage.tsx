import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useContentPlans, useContentSkills, useContentTriggers,
  useBrandContexts, usePublishChannels, useAIGatewaySettings,
  useDeleteContentPlan, usePostingAnalytics, useUpdatePlanItemDate,
} from '@/hooks/useContent';
import { useResearchRun } from '@/hooks/useResearchRun';
import type { ContentPlan, PlanItem, CalendarView } from '@/components/content/types';
import { TYPE_MAP, PLATFORM_MAP } from '@/components/content/types';
import { ContentPlannerCalendar } from '@/components/content/ContentPlannerCalendar';
import { ContentPlannerAI } from '@/components/content/ContentPlannerAI';
import { ContentItemList } from '@/components/content/ContentItemList';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import { BestTimeAnalyticsPanel } from '@/components/content/BestTimeAnalyticsPanel';
import { toDateKey } from '@/components/content/calendarUtils';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { getPlatformColors } from '@/lib/platformConfig';
import { CalendarDays, Wand2, Info, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageShell from '@/components/PageShell';

export default function ContentPlannerPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [contentView, setContentView] = useState<'calendar' | 'list'>('calendar');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateItems, setSelectedDateItems] = useState<PlanItem[]>([]);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

  const [recalculating, setRecalculating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingArticles, setGeneratingArticles] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');

  const { data: plans = [], isLoading: loadPlans, refetch } = useContentPlans();
  const { data: skills = [] } = useContentSkills();
  const { data: contexts = [] } = useBrandContexts();
  const { data: triggers = [] } = useContentTriggers();
  const { data: channels = [] } = usePublishChannels();
  const { data: gwSettings } = useAIGatewaySettings();
  const { data: analytics, isLoading: loadAnalytics, refetch: refetchAnalytics } = usePostingAnalytics();

  const delPlanMut = useDeleteContentPlan();
  const updateItemDateMut = useUpdatePlanItemDate();
  const { run: runResearch } = useResearchRun();

  const gwModelName = gwSettings?.content_text_model_name ?? gwSettings?.model_name;

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleDateClick = useCallback((date: Date, items: PlanItem[]) => {
    setSelectedDate(date);
    setSelectedDateItems(items);
    setEditingItem(null);
    setCardDialogOpen(true);
  }, []);

  const handleEditItemFromList = useCallback((item: PlanItem) => {
    setSelectedDate(null);
    setSelectedDateItems([item]);
    setEditingItem(item);
    setCardDialogOpen(true);
  }, []);

  const handleDeleteItemFromList = useCallback(async (itemId: string) => {
    await apiFetch(`/brand-content.php?action=plan-items&id=${itemId}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    toast({ title: 'ลบรายการแล้ว' });
  }, [qc, toast]);

  const handleDateDragOver = useCallback((e: React.DragEvent, _date: Date) => {
    e.currentTarget.classList.add('ring-2', 'ring-primary');
  }, []);

  const handleDateDrop = useCallback((e: React.DragEvent, date: Date) => {
    e.currentTarget.classList.remove('ring-2', 'ring-primary');
    const key = toDateKey(date);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.itemId) {
        updateItemDateMut.mutate({ item_id: data.itemId, scheduled_date: key });
        toast({ title: 'ย้ายรายการแล้ว', description: key });
      }
    } catch {
      // drop from external source — ignore
    }
  }, [updateItemDateMut, toast]);

  const handleSaveCard = useCallback(async (data: { item_id?: string; topic: string; caption: string; platform: string; scheduled_date: string; image_brief?: string; article_content?: string }) => {
    const effectiveItemId = data.item_id || editingItem?.id;
    const effectiveItem = editingItem || (effectiveItemId ? selectedDateItems.find(i => i.id === effectiveItemId) : null);
    if (effectiveItem) {
      // Update existing item
      await apiFetch(`/brand-content.php?action=plans&id=${effectiveItem.plan_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          item_id: effectiveItem.id,
          topic: data.topic,
          caption: data.caption,
          platform: data.platform,
          scheduled_date: data.scheduled_date,
          image_brief: data.image_brief || '',
        }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'อัพเดทคอนเทนต์แล้ว' });
    } else {
      let planId = plans[0]?.id;
      if (!planId) {
        const newPlan: ContentPlan = await apiFetch('/brand-content.php?action=plans', {
          method: 'POST',
          body: JSON.stringify({
            title: 'แผนคอนเทนต์ ' + new Date().toLocaleDateString('th-TH'),
            plan_type: 'monthly',
            plan_start: data.scheduled_date,
            plan_end: data.scheduled_date,
            trigger_command: 'manual',
          }),
        });
        planId = newPlan.id;
      }
      await apiFetch('/brand-content.php?action=plan-items', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, ...data }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      toast({ title: 'สร้างคอนเทนต์แล้ว' });
    }
  }, [plans, qc, toast, editingItem, selectedDateItems]);

  const handleDeleteCard = useCallback(async (itemId: string) => {
    await apiFetch(`/brand-content.php?action=plan-items&id=${itemId}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    toast({ title: 'ลบรายการแล้ว' });
  }, [qc, toast]);

  const handleRequestAI = useCallback(async (data: { topic: string; platform: string; scheduled_date: string }) => {
    const item = editingItem;
    if (!item?.id) {
      toast({ title: 'กรุณาบันทึกก่อนใช้ AI เขียน', variant: 'destructive' });
      return;
    }
    toast({ title: 'AI กำลังเขียนบทความ...', description: 'โปรดรอสักครู่ (อาจใช้เวลา 30-60 วินาที)' });
    try {
      await runResearch({ topic: data.topic, itemId: item.id });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      toast({ title: 'AI เขียนบทความสำเร็จ!', description: 'ไปที่หน้า "บทความทั้งหมด" เพื่อดูผลลัพธ์' });
    } catch (e: any) {
      toast({ title: 'สร้างบทความไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  }, [editingItem, qc, toast, runResearch]);

  const handleGenerateImage = useCallback(async (itemId: string, imageBrief: string) => {
    setGeneratingImage(true);
    try {
      const res = await apiFetch('/brand-content.php?action=generate-image', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, image_brief: imageBrief }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      if (res.image_url) {
        toast({ title: 'สร้างภาพสำเร็จ!', description: 'รีเฟรชเพื่อดูภาพ' });
      } else if (res.message) {
        toast({ title: 'สร้างภาพแล้ว', description: res.message });
      } else {
        toast({ title: 'สร้างภาพสำเร็จ' });
      }
    } catch (e: any) {
      toast({ title: 'สร้างภาพไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  }, [qc, toast]);

  const handleGenerate = useCallback(async (params: {
    trigger_command: string;
    skill_id: string | null;
    brand_context_ids: string[];
    plan_type: string;
    plan_start: string | null;
    plan_end: string | null;
    platforms: string[];
  }) => {
    setGenerating(true);
    try {
      const plan: ContentPlan = await apiFetch('/brand-content.php?action=generate-plan', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          week_start: params.plan_start || new Date().toISOString().split('T')[0],
          platforms: params.platforms,
        }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'สร้างแผนสำเร็จ!', description: plan.title });

      const items = plan.items || [];
      if (items.length > 0) {
        setGenerating(false);
        setGeneratingArticles(true);
        let done = 0;
        const total = items.length;
        for (const item of items) {
          done++;
          setGenerateProgress(`${done}/${total}`);
          try {
            await apiFetch('/brand-content.php?action=generate-article', {
              method: 'POST',
              body: JSON.stringify({ item_id: item.id }),
            });
          } catch (e: any) {
            // Continue to next item even if one fails
            toast({ title: `ข้าม "${item.topic}" — ${e.message}`, variant: 'destructive' });
            continue;
          }
        }
        qc.invalidateQueries({ queryKey: ['content', 'plans'] });
        qc.invalidateQueries({ queryKey: ['content', 'items'] });
        setGenerateProgress('');
        toast({ title: `สร้างบทความครบ ${done}/${total} รายการแล้ว` });
      }
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
      setGeneratingArticles(false);
    }
  }, [qc, toast]);

  const handleSelectPlan = useCallback(async (plan: ContentPlan) => {
    try {
      const fullPlan: ContentPlan = await apiFetch(`/brand-content.php?action=plans&id=${plan.id}`);
      if (fullPlan.plan_start) {
        const d = new Date(fullPlan.plan_start + 'T00:00:00');
        setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
      } else if (fullPlan.week_start) {
        const d = new Date(fullPlan.week_start + 'T00:00:00');
        setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
      refetch();
    } catch (e: any) {
      toast({ title: 'โหลดแผนไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  }, [refetch, toast]);

  const handleDeletePlan = useCallback(async (planId: string) => {
    if (await confirm({ title: 'ลบแผน', description: 'ลบแผนนี้?', variant: 'destructive' })) {
      delPlanMut.mutate(planId, {
        onSuccess: () => toast({ title: 'ลบแผนแล้ว' }),
      });
    }
  }, [delPlanMut, toast, confirm]);

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true);
    try {
      await apiFetch('/brand-content.php?action=analytics-recalculate', { method: 'POST' });
      refetchAnalytics();
      toast({ title: 'คำนวณใหม่สำเร็จ' });
    } catch (e: any) {
      toast({ title: 'คำนวณไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  }, [refetchAnalytics, toast]);

  const goToArticles = useCallback(() => {
    navigate('/content');
  }, [navigate]);

  return (
    <div className="flex flex-col h-full">
      <PageShell
        breadcrumbs={[{ label: 'การตลาด', href: '/marketing' }, { label: 'ปฏิทินคอนเทนต์', isCurrent: true }]}
        title="วางแผนคอนเทนต์"
        description="วางแผนคอนเทนต์รายเดือน / ไตรมาส / ปี พร้อม AI ช่วยสร้างและวิเคราะห์เวลาโพสต์"
        className="pb-0 shrink-0 space-y-4"
        actions={
          <div className="flex flex-wrap gap-1.5 items-center w-full sm:w-auto">
            <Button
              variant="ghost"
              size="xs"
              className="gap-1 text-xs text-muted-foreground hidden sm:flex"
              onClick={() => setShowGuide(v => !v)}
            >
              <Info className="h-3 w-3" />
              <span className="hidden xs:inline">{showGuide ? 'ซ่อนคำแนะนำ' : 'วิธีใช้งาน'}</span>
            </Button>
            <div className="flex gap-1 bg-muted rounded p-0.5">
              <Button
                size="xs"
                variant={contentView === 'calendar' ? 'default' : 'ghost'}
                className="h-7 text-xs px-2"
                onClick={() => setContentView('calendar')}
              >
                <CalendarDays className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">ปฏิทิน</span>
              </Button>
              <Button
                size="xs"
                variant={contentView === 'list' ? 'default' : 'ghost'}
                className="h-7 text-xs px-2"
                onClick={() => setContentView('list')}
              >
                <LayoutList className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">รายการ</span>
              </Button>
            </div>
            <Button
              variant="outline"
              size="xs"
              className="gap-1 text-xs px-2"
              onClick={goToArticles}
            >
              <span className="hidden xs:inline">บทความทั้งหมด</span>
              <span className="inline xs:hidden">บทความ</span>
            </Button>
            <Button
              className="gap-1 bg-gradient-to-r from-primary to-violet-600 text-white shadow-md text-xs px-2"
              size="xs"
              onClick={() => setAiPanelOpen(v => !v)}
            >
              <Wand2 className="h-3 w-3" />
              <span className="hidden sm:inline">AI สร้างแผน</span>
              <span className="inline sm:hidden">AI</span>
            </Button>
          </div>
        }
      >

        {/* Type Filter */}
        <div className="flex flex-wrap gap-1.5 items-center mb-2">
          <span className="text-[11px] text-muted-foreground shrink-0 hidden xs:inline">ประเภท:</span>
          <div className="flex gap-1 flex-wrap">
            {[
              { key: 'all', label: 'ทั้งหมด' },
              ...Object.entries(TYPE_MAP).map(([key, val]) => ({ key, label: val.label })),
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  typeFilter === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0 ml-2 hidden xs:inline">แพลตฟอร์ม:</span>
          <div className="flex gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                platformFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              ทั้งหมด
            </button>
            {Object.entries(PLATFORM_MAP).map(([key, val]) => {
              const colors = getPlatformColors(key);
              const isActive = platformFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlatformFilter(key)}
                  className="text-[11px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1"
                  style={isActive
                    ? { backgroundColor: colors.text, color: '#fff', borderColor: colors.text }
                    : { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }
                  }
                >
                  <PlatformIcon platform={key} size={10} />
                  {val.label}
                </button>
              );
            })}
          </div>
        </div>

        {showGuide && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-200 flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-violet-600" />
                AI Panel →
              </p>
              <p className="text-xs text-violet-700 dark:text-violet-400">
                ใส่หัวข้อ → เลือก Skill/Context → AI สร้างแผนคอนเทนต์ให้ พร้อมแคปชั่นและ image brief
              </p>
            </div>
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <LayoutList className="h-4 w-4 text-blue-600" />
                Calendar + List + Drag
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                สลับมุมมอง ปฏิทิน/รายการ · ลากจากรายการลงวันที่ · คลิกวันที่หรือกดแก้ไขเพื่อแก้ไข · ลากย้ายวันได้
              </p>
            </div>
            <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-green-900 dark:text-green-200 flex items-center gap-2">
                <Info className="h-4 w-4 text-green-600" />
                วิเคราะห์เวลาโพสต์
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                ดูได้ด้านล่าง · จุดสีเขียว = วันที่มี engagement สูง · กดคำนวณใหม่เพื่อรีเฟรชข้อมูล
              </p>
            </div>
          </div>
        )}
      </PageShell>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 p-4 sm:p-6 lg:p-8 gap-4 md:gap-0">
        <div className="flex-1 min-w-0 overflow-y-auto">
          {contentView === 'calendar' ? (
            <ContentPlannerCalendar
              plans={plans}
              view={view}
              currentDate={currentDate}
              onNavigate={handleNavigate}
              onViewChange={setView}
              onDateClick={handleDateClick}
              onDateDragOver={handleDateDragOver}
              onDateDrop={handleDateDrop}
              analytics={analytics}
              isLoading={loadPlans}
              typeFilter={typeFilter}
              platformFilter={platformFilter}
            />
          ) : (
            <ContentItemList
              plans={plans}
              onEditItem={handleEditItemFromList}
              onDeleteItem={handleDeleteItemFromList}
              typeFilter={typeFilter}
              platformFilter={platformFilter}
            />
          )}
        </div>

        <ContentPlannerAI
          isOpen={aiPanelOpen}
          onToggle={() => setAiPanelOpen(v => !v)}
          plans={plans}
          skills={skills}
          contexts={contexts}
          triggers={triggers}
          gwModelName={gwModelName}
          selectedPlanId={null}
          onSelectPlan={handleSelectPlan}
          onDeletePlan={handleDeletePlan}
          onGenerate={handleGenerate}
          isGenerating={generating}
          isGeneratingArticles={generatingArticles}
          generateProgress={generateProgress}
        />
      </div>

      <BestTimeAnalyticsPanel
        analytics={analytics}
        isLoading={loadAnalytics}
        onRecalculate={handleRecalculate}
        isRecalculating={recalculating}
      />

      <ContentCardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        date={selectedDate}
        planId={editingItem?.plan_id || plans[0]?.id || ''}
        existingItem={editingItem || (selectedDateItems[0] ?? null)}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        onRequestAI={handleRequestAI}
        onGenerateImage={handleGenerateImage}
        isGeneratingImage={generatingImage}
      />
    </div>
  );
}
