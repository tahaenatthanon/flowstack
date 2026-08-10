import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Zap, AlertCircle } from 'lucide-react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { useCreateTask, useProjects, useAllTasks, useCreateTaskDependency, useCreateTaskHistory, useUsers } from '@/hooks/useProjectData';
import ProjectCombobox from '@/components/ProjectCombobox';
import UserCombobox from '@/components/UserCombobox';
import { useToast } from '@/hooks/use-toast';
import { calculateImpactSimulation, checkResourceConflict } from '@/lib/projectUtils';
import ImpactSimulationDialog from './ImpactSimulationDialog';
import type { ImpactSimulation, DependencyReasonCode } from '@/types/project';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';

interface InsertAdHocTaskDialogProps {
  projectId?: string;
}

function Required() {
  return <span className="text-destructive ml-0.5">*</span>;
}

const InsertAdHocTaskDialog = ({ projectId }: InsertAdHocTaskDialogProps) => {
  const [open, setOpen] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulation, setSimulation] = useState<ImpactSimulation | null>(null);
  const [resourceConflict, setResourceConflict] = useState<{ hasConflict: boolean; count: number } | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('high'); // งานแทรกมักเป็น high priority
  const [taskType, setTaskType] = useState('task');
  const [assignee, setAssignee] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [reasonCode, setReasonCode] = useState<DependencyReasonCode>('URGENT_INSERT');
  const [reasonDescription, setReasonDescription] = useState('');

  const createTask = useCreateTask();
  const createDependency = useCreateTaskDependency();
   const createHistory = useCreateTaskHistory();
   const { data: projects = [] } = useProjects();
   const { data: tasksPage = { data: [] } } = useAllTasks();
   const allTasks = tasksPage.data;
   const { data: users = [], isLoading: usersLoading } = useUsers();
  const { activeTaskExecutionTypes } = useWorkTypeCatalog();
   const { toast } = useToast();

  const estimatedDays = Math.max(1, differenceInDays(parseISO(endDate), parseISO(startDate)));

  // คำนวณผลกระทบเมื่อมีการเปลี่ยน assignee หรือวันที่
  useEffect(() => {
    if (assignee && startDate && endDate) {
      const assigneeName = users.find(u => u.id === assignee)?.display_name || '';
      const conflict = checkResourceConflict(assigneeName, startDate, endDate, allTasks);
      setResourceConflict({
        hasConflict: conflict.hasConflict,
        count: conflict.conflictingTasks.length 
      });
    } else {
      setResourceConflict(null);
    }
  }, [assignee, startDate, endDate, allTasks]);

  const handlePreviewImpact = () => {
    if (!assignee || !startDate || !endDate) {
      toast({ 
        title: 'ข้อมูลไม่ครบ', 
        description: 'กรุณาระบุผู้รับผิดชอบและวันที่', 
        variant: 'destructive' 
      });
      return;
    }

    const assigneeName = users.find(u => u.id === assignee)?.display_name || '';
    const impactResult = calculateImpactSimulation(
      { start_date: startDate, end_date: endDate, assignee: assigneeName, estimated_days: estimatedDays },
      allTasks,
      projects
    );
    
    setSimulation(impactResult);
    setShowSimulation(true);
  };

  const handleConfirmAndSave = async () => {
    try {
      // 1. สร้างงานแทรก
      const newTaskResult: any = await createTask.mutateAsync({
        project_id: selectedProjectId,
        title,
        description,
        priority,
        assignee: (!assignee || assignee === 'none') ? '' : (users.find(u => u.id === assignee)?.display_name || ''),
        assignee_user_id: (!assignee || assignee === 'none') ? null : assignee,
        start_date: startDate,
        end_date: endDate,
        estimated_days: estimatedDays,
        is_ad_hoc: true,
        status: 'in-progress', // งานแทรกมักเริ่มทำทันที
        task_type: taskType,
      });

      const newTask = newTaskResult;
      if (newTaskResult?.warnings?.length) {
        newTaskResult.warnings.forEach((w: string) => toast({ title: `⚠️ ${w}` }));
      }

      // 2. บันทึก Dependencies สำหรับงานที่ถูกกระทบ
      if (simulation && simulation.affectedTasks.length > 0) {
        for (const affectedTask of simulation.affectedTasks) {
          await createDependency.mutateAsync({
            task_id: affectedTask.taskId,          // งานที่ถูกกระทบ (ต้องรองาน ad-hoc)
            depends_on_task_id: newTask.id,        // งานแทรก (blocker)
            dependency_type: 'blocks',             // ad-hoc blocks the affected task
            notes: reasonDescription || `งานแทรก: ${title} (${reasonCode})`,
          });

          // 3. บันทึก History
          await createHistory.mutateAsync({
            task_id: affectedTask.taskId,
            action: 'PAUSED',
            reason: `ถูก Block โดยงานแทรก "${title}" (${reasonCode})`,
            related_task_id: newTask.id,
          });
        }
      }

      toast({ title: 'บันทึกงานแทรกสำเร็จ', description: `งาน "${title}" ถูกสร้างและวิเคราะห์ผลกระทบเรียบร้อย` });
      setOpen(false);
      setShowSimulation(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignee('');
    setReasonDescription('');
    setSimulation(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2">
            <Zap className="w-4 h-4" />
            เพิ่มงานแทรก (Ad-hoc)
          </Button>
        </DialogTrigger>
        <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <Zap className="w-5 h-5 text-warning" />
              เพิ่มงานแทรกด่วน
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            <Alert className="border-warning/30 bg-warning/5">
              <AlertDescription className="text-xs text-warning-foreground/80">
                <strong>งานแทรก (Ad-hoc)</strong> คืองานที่เข้ามาระหว่างโปรเจกต์ ระบบจะวิเคราะห์ผลกระทบต่อ Timeline เดิมของสมาชิกในทีมให้อัตโนมัติ
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label className="text-sm">ชื่องานแทรก <Required /></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="เช่น ลูกค้าเรียกประชุมด่วน" className="h-9 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">รายละเอียด</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." rows={2} className="text-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">โปรเจกต์ที่เกี่ยวข้อง <Required /></Label>
                <ProjectCombobox
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  placeholder="เลือกโปรเจกต์"
                  allowNone={false}
                  includeBaseCalendar={true}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ผู้รับผิดชอบ <Required /></Label>
                <UserCombobox
                  value={assignee}
                  onChange={(id) => setAssignee(id)}
                  placeholder="เลือกผู้รับผิดชอบ"
                  allowNone={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">ประเภทงาน</Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeTaskExecutionTypes.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ความสำคัญ</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">สูง (High)</SelectItem>
                    <SelectItem value="medium">ปานกลาง (Medium)</SelectItem>
                    <SelectItem value="low">ต่ำ (Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">วันเริ่มต้น <Required /></Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">วันสิ้นสุด <Required /></Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">เหตุผลที่งานแทรกเข้ามา <Required /></Label>
              <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as DependencyReasonCode)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENT_INSERT">งานด่วนแทรกเข้ามา</SelectItem>
                  <SelectItem value="CUSTOMER_REQUEST">ลูกค้าร้องขอ</SelectItem>
                  <SelectItem value="TECHNICAL_BLOCKER">ติดปัญหาเทคนิค</SelectItem>
                  <SelectItem value="RESOURCE_CONFLICT">ทรัพยากรขัดแย้ง</SelectItem>
                  <SelectItem value="OTHER">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {resourceConflict && resourceConflict.hasConflict && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span><strong>พบภาระงานซ้อนทับ!</strong> {assignee} มีงานอื่นในช่วงเวลาเดียวกัน {resourceConflict.count} งาน</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button 
                type="button" 
                onClick={handlePreviewImpact} 
                className="px-6 bg-blue-600 hover:bg-blue-700"
                disabled={!title || !assignee || !selectedProjectId}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                วิเคราะห์ผลกระทบ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImpactSimulationDialog
        open={showSimulation}
        onOpenChange={setShowSimulation}
        simulation={simulation}
        onConfirm={handleConfirmAndSave}
        onCancel={() => setShowSimulation(false)}
        isLoading={createTask.isPending || createDependency.isPending}
      />
    </>
  );
};

export default InsertAdHocTaskDialog;
