import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import ModelCombobox from '@/components/ModelCombobox';
import { useCreateTask } from '@/hooks/useProjectData';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, API_BASE } from '@/lib/api';
import { Bot, Loader2, Trash2, Plus } from 'lucide-react';
import { format, addDays, isSaturday, isSunday } from 'date-fns';

interface GeneratedTask {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimated_days: number;
  phase: string;
  selected: boolean;
}

const INDUSTRY_LABELS: Record<string, string> = {
  it_service: 'IT Service',
  food_pharma: 'อาหาร/ยา',
  tapioca_factory: 'โรงงานแป้งมัน',
  general: 'ทั่วไป',
};

const THEME_LABELS: Record<string, string> = {
  it_bottleneck: 'IT Bottleneck Audit',
  ai_governance: 'AI Governance',
  iso_compliance: 'ISO Compliance',
  general: 'ทั่วไป',
};

const PHASE_COLORS: Record<string, string> = {
  'requirement': 'bg-blue-500/15 text-blue-400',
  'design': 'bg-purple-500/15 text-purple-400',
  'development': 'bg-green-500/15 text-green-400',
  'testing': 'bg-orange-500/15 text-orange-400',
  'deployment': 'bg-red-500/15 text-red-400',
  'maintenance': 'bg-gray-500/15 text-gray-400',
  'management': 'bg-teal-500/15 text-teal-400',
};

interface Model {
  id: string;
  name?: string;
}

export interface SurveyContext {
  industry: string;
  theme: string;
  painPoints: string[];
  companyName: string;
}

interface AITaskGeneratorDialogProps {
  projectId: string;
  projectDescription?: string;
  surveyContext?: SurveyContext;
}

export default function AITaskGeneratorDialog({ projectId, projectDescription, surveyContext }: AITaskGeneratorDialogProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  const createTask = useCreateTask();
  const { toast } = useToast();

   // Load models when dialog opens
   useEffect(() => {
     if (!open || models.length > 0) return;
     const fetchModels = async () => {
       try {
         // First, fetch the default model from AI settings
         let defaultModelId: string | null = null;
         try {
           const settings: any = await apiFetch('/ai-settings.php');
           defaultModelId = settings.ai_default_model_id || null;
         } catch {
           // fall through: use default model selection logic below
         }

         // Then, fetch available models
         const response: any = await apiFetch('/chat.php?action=models');
         let modelList: Model[] = [];
         if (response.data && Array.isArray(response.data)) modelList = response.data;
         else if (Array.isArray(response)) modelList = response;
         else if (response.data?.data && Array.isArray(response.data.data)) modelList = response.data.data;

          setModels(modelList);
          if (modelList.length > 0) {
            // Priority: 1) default model from settings, 2) kilo-auto/free, 3) first model
            const selected = defaultModelId && modelList.some((m) => m.id === defaultModelId)
              ? defaultModelId
              : (modelList.find((m) => m.id.toLowerCase().includes('kilo-auto/free'))?.id || modelList[0].id);
            setSelectedModel(selected);
          }
       } catch {
         // models stay empty; UI shows no model selector
       }
     };
     fetchModels();
   }, [open, models.length]);

  // Pre-fill input when dialog opens: surveyContext takes priority over projectDescription
  useEffect(() => {
    if (open) {
      if (surveyContext) {
        const parts = [
          `บริษัท: ${surveyContext.companyName}`,
          `อุตสาหกรรม: ${INDUSTRY_LABELS[surveyContext.industry] || surveyContext.industry}`,
          `Strategic Theme: ${THEME_LABELS[surveyContext.theme] || surveyContext.theme}`,
        ];
        if (surveyContext.painPoints.length > 0) {
          parts.push(`Pain Points หลัก:\n${surveyContext.painPoints.map(p => `- ${p}`).join('\n')}`);
        }
        setInputText(parts.join('\n'));
      } else if (projectDescription && !inputText) {
        setInputText(projectDescription);
      }
    }
  }, [open, surveyContext, projectDescription]);
   

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setAnalyzing(true);
    setError('');
    setTasks([]);

    try {
      const response = await fetch(
        `${API_BASE}/chat.php`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: 'system',
                content: `คุณคือ Senior System Analyst ที่มีประสบการณ์ 15 ปี ในการวิเคราะห์และวางแผนโปรเจกต์ซอฟต์แวร์
หน้าที่ของคุณคือรับข้อความ (Scope of Work / Requirements / Description) แล้ววิเคราะห์แตก tasks ออกมาให้ครบถ้วนสมจริง เหมือน SA มืออาชีพ

## หลักการวิเคราะห์ (SDLC-based)
ให้ครอบคลุมทุก phase ที่เกี่ยวข้อง:

1. **Requirement** - รวบรวมความต้องการ, สัมภาษณ์ผู้ใช้, เขียน User Story, จัดทำ SRS
2. **Design** - ออกแบบ UI/UX (Wireframe/Mockup), ออกแบบ Database Schema, ออกแบบ System Architecture, ออกแบบ API Specification
3. **Development** - พัฒนา Frontend, พัฒนา Backend/API, เชื่อมต่อระบบ, พัฒนา Business Logic
4. **Testing** - เขียน Test Cases, Unit Test, Integration Test, UAT (User Acceptance Test), Bug Fix
5. **Deployment** - เตรียม Server/Infrastructure, Deploy, ทำ Documentation, Training ผู้ใช้
6. **Management** - ประชุม Kickoff, Review/Demo, ประสานงาน, Code Review

## กฎการประเมิน estimated_days
- ให้ประเมินจริงจังตาม complexity ไม่ประเมินต่ำเกินไป
- งาน Requirement: 1-5 วัน ขึ้นกับขอบเขต
- งาน Design: 1-5 วัน ต่อ module
- งาน Development: 2-10 วัน ต่อ feature (ขึ้นกับความซับซ้อน)
- งาน Testing: 1-3 วัน ต่อ feature
- งาน Deployment: 1-3 วัน
- ถ้าเป็นงานใหญ่ให้แตกย่อยออก อย่ารวมเป็นก้อนเดียว

## กฎการจัดลำดับความสำคัญ
- "high": งาน Critical Path, Blocker, Core Feature, Security
- "medium": งาน Feature ทั่วไป, UI/UX, Testing
- "low": งาน Nice-to-have, Documentation, Optimization

## รูปแบบผลลัพธ์
ตอบเป็น JSON array เท่านั้น ไม่ต้องมี markdown code block หรือข้อความอื่น ๆ
เรียงตามลำดับ phase: requirement → design → development → testing → deployment → management

แต่ละ item มี fields:
- "phase": หมวดหมู่ phase ("requirement", "design", "development", "testing", "deployment", "management")
- "title": ชื่องานสั้น ๆ กระชับ ระบุ scope ชัดเจน
- "description": รายละเอียดของงานที่ต้องทำ, deliverables, acceptance criteria
- "priority": "high" / "medium" / "low"
- "estimated_days": จำนวนวันทำงานโดยประมาณ (ตัวเลข, ขั้นต่ำ 1)

ตัวอย่าง:
[{"phase":"requirement","title":"รวบรวม Requirements ระบบ Login","description":"สัมภาษณ์ผู้ใช้, เขียน User Stories สำหรับ Login/Register/Forgot Password, กำหนด Acceptance Criteria","priority":"high","estimated_days":2},{"phase":"design","title":"ออกแบบ UI/UX หน้า Login","description":"สร้าง Wireframe และ Mockup หน้า Login, Register, Forgot Password ตาม Brand Guidelines","priority":"high","estimated_days":3},{"phase":"development","title":"พัฒนา Frontend หน้า Login","description":"Implement หน้า Login ด้วย React, Form validation, Error handling, Responsive design","priority":"high","estimated_days":3},{"phase":"development","title":"พัฒนา Backend API Authentication","description":"สร้าง REST API สำหรับ Login, Register, JWT Token management, Password hashing","priority":"high","estimated_days":4},{"phase":"testing","title":"ทดสอบระบบ Login","description":"เขียน Test Cases, Unit Test, Integration Test, ทดสอบ Edge Cases (wrong password, expired token)","priority":"medium","estimated_days":2}]`,
              },
              {
                role: 'user',
                content: inputText,
              },
            ],
          }),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      const content = result.data?.choices?.[0]?.message?.content || '';

      // Parse JSON from AI response - handle markdown code blocks
      let parsed: any[];
      const cleaned = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Try to find JSON array in the response
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('AI ไม่สามารถวิเคราะห์ข้อความได้ กรุณาลองใหม่');
        }
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('ไม่พบรายการงานจากข้อความ กรุณาลองเพิ่มรายละเอียด');
      }

      setTasks(
        parsed.map((t: any) => ({
          title: String(t.title || ''),
          description: String(t.description || ''),
          priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
          estimated_days: Math.max(1, Number(t.estimated_days) || 1),
          phase: String(t.phase || 'development'),
          selected: true,
        }))
      );
    } catch (err: any) {
      let errorMessage = err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์';
      
      // Handle timeout errors
      if (err.name === 'TypeError' && err.message.includes('Network request failed')) {
        errorMessage = 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองอีกครั้ง หรือลดขนาดข้อมูล';
      } else if (err.message && err.message.includes('timeout')) {
        errorMessage = 'การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองอีกครั้ง หรือลดขนาดข้อมูล';
      }
      
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  // Advance date by N working days, skipping weekends and holidays
  const addWorkingDays = (start: Date, days: number, holidaySet: Set<string>): Date => {
    let d = new Date(start);
    let added = 0;
    while (added < days) {
      d = addDays(d, 1);
      const key = format(d, 'yyyy-MM-dd');
      if (!isSaturday(d) && !isSunday(d) && !holidaySet.has(key)) added++;
    }
    return d;
  };

  // Find the next working day on-or-after the given date
  const nextWorkingDay = (d: Date, holidaySet: Set<string>): Date => {
    let cur = new Date(d);
    while (isSaturday(cur) || isSunday(cur) || holidaySet.has(format(cur, 'yyyy-MM-dd'))) {
      cur = addDays(cur, 1);
    }
    return cur;
  };

  const handleCreateAll = async () => {
    const selected = tasks.filter((t) => t.selected);
    if (selected.length === 0) return;

    setCreating(true);
    let successCount = 0;

    try {
      // Fetch holidays for next 2 years to cover any project timeline
      const yearEnd = format(addDays(new Date(), 730), 'yyyy-MM-dd');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const holidaySet = new Set<string>();
      try {
        const calData: any = await apiFetch(`/calendar.php?start=${todayStr}&end=${yearEnd}`);
        const events: any[] = Array.isArray(calData) ? calData : (calData?.data ?? []);
        events.forEach((e: any) => {
          if (e.event_type === 'holiday' || e.task_type === 'holiday') {
            const dateKey = (e.start_at ?? '').slice(0, 10);
            if (dateKey) holidaySet.add(dateKey);
          }
        });
      } catch { /* proceed without holidays if fetch fails */ }

      let currentStartDate = nextWorkingDay(new Date(), holidaySet);

      for (const task of selected) {
        // end date = start + (estimated_days - 1) working days
        const endDate = task.estimated_days > 1
          ? addWorkingDays(currentStartDate, task.estimated_days - 1, holidaySet)
          : currentStartDate;
        const phaseLabel = task.phase.charAt(0).toUpperCase() + task.phase.slice(1);
        await createTask.mutateAsync({
          project_id: projectId,
          title: `[${phaseLabel}] ${task.title}`,
          description: task.description,
          priority: task.priority,
          start_date: format(currentStartDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          estimated_days: task.estimated_days,
        });
        // Next task starts on the next working day after this one ends
        currentStartDate = nextWorkingDay(addDays(endDate, 1), holidaySet);
        successCount++;
      }
      toast({ title: `สร้างงานสำเร็จ ${successCount} รายการ` });
      setOpen(false);
      setTasks([]);
      setInputText('');
    } catch (err: any) {
      toast({
        title: `สร้างสำเร็จ ${successCount} รายการ`,
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const updateTask = (index: number, field: keyof GeneratedTask, value: any) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const addEmptyTask = () => {
    setTasks((prev) => [
      ...prev,
      { title: '', description: '', priority: 'medium', estimated_days: 1, phase: 'development', selected: true },
    ]);
  };

  const selectedCount = tasks.filter((t) => t.selected).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && (analyzing || creating)) return;
        setOpen(v);
        if (!v) {
          setTasks([]);
          setError('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bot className="h-4 w-4" />
          AI สร้างงาน
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-3xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI สร้างรายการงานอัตโนมัติ (WBS)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Model Selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">AI Model ที่ใช้งาน</Label>
            <ModelCombobox
              models={models}
              value={selectedModel}
              onChange={setSelectedModel}
              placeholder={models.length === 0 ? 'กำลังโหลด...' : 'ค้นหาโมเดล...'}
              disabled={models.length === 0}
              emptyMessage="ไม่พบโมเดล"
            />
          </div>

          {/* Input Section */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              ระบุรายละเอียดโครงการ / Scope of Work
            </Label>
            <Textarea
              placeholder="เช่น: ระบบบริหารจัดการคลังสินค้า, หน้า Dashboard สรุปยอดขาย, API เชื่อมต่อขนส่ง..."
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={analyzing}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground italic">
              * ยิ่งระบุรายละเอียดชัดเจน AI จะแตกงานได้แม่นยำยิ่งขึ้น
            </p>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || !inputText.trim() || !selectedModel}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังวิเคราะห์ข้อมูล...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                วิเคราะห์และแตกรายการงาน
              </>
            )}
          </Button>

          {error && (
            <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 p-3 rounded-lg flex items-center gap-2">
              <Plus className="h-4 w-4 rotate-45 shrink-0" />
              {error}
            </div>
          )}

          {/* Preview Section */}
          {tasks.length > 0 && (() => {
            const totalDays = tasks.filter(t => t.selected).reduce((s, t) => s + t.estimated_days, 0);
            const phaseGroups = tasks.reduce<Record<string, { count: number; days: number }>>((acc, t) => {
              if (!t.selected) return acc;
              if (!acc[t.phase]) acc[t.phase] = { count: 0, days: 0 };
              acc[t.phase].count++;
              acc[t.phase].days += t.estimated_days;
              return acc;
            }, {});
            const PHASE_LABELS: Record<string, string> = {
              requirement: 'Requirement',
              design: 'Design',
              development: 'Development',
              testing: 'Testing',
              deployment: 'Deployment',
              management: 'Management',
              maintenance: 'Maintenance',
            };

            return (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-primary rounded-full" />
                  รายการงานที่วิเคราะห์ได้ ({tasks.length} รายการ)
                </h4>
                <Button variant="ghost" size="sm" onClick={addEmptyTask} className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  เพิ่มงานเอง
                </Button>
              </div>

              {/* Summary Bar */}
              <div className="p-4 rounded-lg bg-muted/20 border space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">สรุปการประเมินเบื้องต้น:</span>
                  <div className="text-right">
                    <span className="font-bold text-primary text-lg">{totalDays}</span> <span className="text-xs">วันทำงาน</span>
                    <p className="text-[10px] text-muted-foreground">(ประมาณ {Math.ceil(totalDays / 5)} สัปดาห์)</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(phaseGroups).map(([phase, info]) => (
                    <span
                      key={phase}
                      className={`text-[10px] px-2 py-0.5 rounded-full border border-current font-medium ${PHASE_COLORS[phase] || 'bg-muted text-muted-foreground'}`}
                    >
                      {PHASE_LABELS[phase] || phase}: {info.days} วัน
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {tasks.map((task, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border transition-all ${
                      task.selected ? 'bg-card border-border shadow-sm' : 'bg-muted/10 border-transparent opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.selected}
                        onCheckedChange={(v) => updateTask(i, 'selected', !!v)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Input
                            value={task.title}
                            onChange={(e) => updateTask(i, 'title', e.target.value)}
                            placeholder="ชื่องาน"
                            className="font-medium flex-1 h-8 text-sm"
                          />
                        </div>
                        <Textarea
                          value={task.description}
                          onChange={(e) => updateTask(i, 'description', e.target.value)}
                          placeholder="รายละเอียด"
                          rows={2}
                          className="text-xs resize-none"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select
                            value={task.phase}
                            onValueChange={(v) => updateTask(i, 'phase', v)}
                          >
                            <SelectTrigger className="w-32 h-7 text-[11px] bg-muted/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="requirement">Requirement</SelectItem>
                              <SelectItem value="design">Design</SelectItem>
                              <SelectItem value="development">Development</SelectItem>
                              <SelectItem value="testing">Testing</SelectItem>
                              <SelectItem value="deployment">Deployment</SelectItem>
                              <SelectItem value="management">Management</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={task.priority}
                            onValueChange={(v) => updateTask(i, 'priority', v)}
                          >
                            <SelectTrigger className="w-24 h-7 text-[11px] bg-muted/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">สูง</SelectItem>
                              <SelectItem value="medium">กลาง</SelectItem>
                              <SelectItem value="low">ต่ำ</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1.5 ml-1">
                            <Input
                              type="number"
                              min={1}
                              value={task.estimated_days}
                              onChange={(e) =>
                                updateTask(i, 'estimated_days', Math.max(1, Number(e.target.value) || 1))
                              }
                              className="w-14 h-7 text-[11px] text-center"
                            />
                            <span className="text-[11px] text-muted-foreground">วัน</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive ml-auto"
                            onClick={() => removeTask(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
        </div>

        {tasks.length > 0 ? (
          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t mt-4">
            <div className="text-xs text-muted-foreground mr-auto flex flex-col">
              <span className="font-medium text-foreground">เลือก {selectedCount} จาก {tasks.length} รายการ</span>
              <span>งานจะถูกสร้างเรียงลำดับต่อเนื่องกัน</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setTasks([])} className="flex-1 sm:flex-none h-9 text-sm">
                ล้างทั้งหมด
              </Button>
              <Button onClick={handleCreateAll} disabled={creating || selectedCount === 0} className="flex-1 sm:flex-none h-9 text-sm px-6">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังสร้างงาน...
                  </>
                ) : (
                  `ยืนยันสร้าง ${selectedCount} งาน`
                )}
              </Button>
            </div>
          </DialogFooter>
        ) : (
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="h-9 text-sm">
              ยกเลิก
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
