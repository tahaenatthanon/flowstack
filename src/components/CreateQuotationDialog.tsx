import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateQuotation, useQuotation, useUpdateQuotation, useCustomers, useOpportunities, useCompanySettings, useNextQuotationNumber } from '@/hooks/useProjectData';
import CompanyCombobox from '@/components/CompanyCombobox';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, GripVertical, TrendingUp , Sparkles, Wand2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';

const quotationItemSchema = z.object({
  item_name: z.string().min(1, 'กรุณาระบุชื่อรายการ'),
  description: z.string().optional(),
  quantity: z.number().min(0.01, 'จำนวนต้องมากกว่า 0'),
  unit: z.string().optional(),
  unit_price: z.number().min(0, 'ราคาต่อหน่วยต้องมากกว่าหรือเท่ากับ 0'),
  total_price: z.number(),
  sort_order: z.number().optional(),
});

const quotationSchema = z.object({
  company_id: z.string().min(1, 'กรุณาเลือกบริษัท'),
  customer_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  quotation_number: z.string().min(1, 'กรุณาระบุเลขที่ใบเสนอราคา'),
  subject: z.string().optional(),
  issue_date: z.string(),
  valid_until: z.string().min(1, 'กรุณาระบุวันหมดอายุ'),
  discount: z.number().min(0),
  tax: z.number().min(0),
  status: z.enum(['draft', 'sent', 'approved', 'rejected', 'expired']),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการ'),
});

type QuotationFormData = z.infer<typeof quotationSchema>;

interface CreateQuotationDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialOpportunityId?: string;
  quotationId?: string; // For edit mode
}

export function CreateQuotationDialog({ open: controlledOpen, onOpenChange, initialOpportunityId, quotationId }: CreateQuotationDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) setUncontrolledOpen(value);
    onOpenChange?.(value);
  };
  const [editingQuotationId, setEditingQuotationId] = useState<string | undefined>(quotationId);
  const isEditMode = !!editingQuotationId;
  
  // Sync editingQuotationId when prop changes
  useEffect(() => {
    setEditingQuotationId(quotationId);
  }, [quotationId]);
  
  const [vatRate, setVatRate] = useState(0); // VAT as percentage e.g. 7 = 7%
  const [displayData, setDisplayData] = useState({
    companyName: '',
    customerName: '',
    opportunityName: '',
  });
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();

  // ── AI generation state ───────────────────────────────────────────────────
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiTemplateId, setAiTemplateId] = useState('');
  const [aiBrief, setAiBrief] = useState('');
  const [aiFilling, setAiFilling] = useState(false);
  const [excelParsing, setExcelParsing] = useState(false);
  const { data: aiTemplates = [] } = useQuery<Array<{ id: string; name: string; source?: string; source_file_path?: string }>>({
    queryKey: ['quotation-templates'],
    queryFn: () => apiFetch('/quotation-templates.php'),
    enabled: open && showAiPanel,
  });
  const aiGenerate = useMutation<
    { items?: any[]; discount?: number; tax?: number; notes?: string; payment_terms?: string },
    Error
  >({
    mutationFn: () => apiFetch('/quotations.php?action=ai-generate', {
      method: 'POST',
      body: JSON.stringify({ template_id: aiTemplateId, brief: aiBrief.trim() }),
    }),
    onSuccess: (data) => {
      if (Array.isArray(data.items) && data.items.length > 0) {
        setValue('items', data.items.map((it: any, idx: number) => ({
          item_name: it.item_name ?? '',
          description: it.description ?? '',
          quantity: Number(it.quantity ?? 1),
          unit: it.unit ?? 'รายการ',
          unit_price: Number(it.unit_price ?? 0),
          total_price: Number(it.total_price ?? Number(it.quantity ?? 1) * Number(it.unit_price ?? 0)),
          sort_order: idx,
        })));
      }
      if (typeof data.discount === 'number') setValue('discount', data.discount);
      if (typeof data.tax === 'number')      setValue('tax', data.tax);
      if (typeof data.notes === 'string')    setValue('notes', data.notes);
      if (typeof data.payment_terms === 'string') setValue('payment_terms', data.payment_terms);
      toast.success(`AI สร้างให้ ${data.items?.length ?? 0} รายการ — ตรวจสอบและปรับก่อนบันทึก`);
      setShowAiPanel(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // AI fill from opportunity context
  const handleAiFill = async () => {
    const oppId = watch('opportunity_id');
    if (!oppId) { toast.error('เลือก Opportunity ก่อน'); return; }
    setAiFilling(true);
    try {
      const res = await apiFetch('/quotations.php?action=ai-fill', {
        method: 'POST',
        body: JSON.stringify({ opportunity_id: oppId, template_id: aiTemplateId || undefined }),
      });
      if (res?.items?.length) {
        setValue('items', res.items.map((it: any, idx: number) => ({
          item_name: it.item_name ?? '',
          description: it.description ?? '',
          quantity: Number(it.quantity ?? 1),
          unit: it.unit ?? 'รายการ',
          unit_price: Number(it.unit_price ?? 0),
          total_price: Number(it.total_price ?? Number(it.quantity ?? 1) * Number(it.unit_price ?? 0)),
          sort_order: idx,
        })));
        toast.success(`AI สร้าง ${res.items.length} รายการจากข้อมูล Opportunity`);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setAiFilling(false); }
  };

  // Excel parse from uploaded template
  const handleExcelParse = async (templateId: string) => {
    setExcelParsing(true);
    try {
      const res = await apiFetch(`/quotation-templates.php?action=parse-excel&id=${templateId}`);
      if (res?.items?.length) {
        const currentItems = watch('items');
        const newItems = res.items.map((it: any) => ({
          item_name: it.description ?? '',
          description: '',
          quantity: Number(it.quantity ?? 1),
          unit: it.unit ?? 'รายการ',
          unit_price: Number(it.unit_price ?? 0),
          total_price: Number(it.amount ?? Number(it.quantity ?? 1) * Number(it.unit_price ?? 0)),
          sort_order: currentItems.length,
        }));
        setValue('items', [...currentItems, ...newItems]);
        toast.success(`นำเข้า ${res.items.length} รายการจาก Excel`);
      } else {
        toast.error('ไม่พบรายการในไฟล์ Excel');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setExcelParsing(false); }
  };

  const { data: allCustomers = [] } = useCustomers();
  const { data: opportunities = [] } = useOpportunities();
  const { data: companySettings } = useCompanySettings();
  const { data: nextNumber } = useNextQuotationNumber(open);
  const { data: quotationData, isLoading: isLoadingQuotation } = useQuotation(editingQuotationId || '');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      status: 'draft',
      discount: 0,
      tax: 0,
      issue_date: new Date().toISOString().split('T')[0],
      items: [
        {
          item_name: '',
          description: '',
          quantity: 1,
          unit: 'รายการ',
          unit_price: 0,
          total_price: 0,
          sort_order: 0,
        },
      ],
    },
  });

  // Effect to set initial opportunity_id and auto-fill company/customer
  useEffect(() => {
    if (initialOpportunityId && opportunities.length > 0) {
      const opp = opportunities.find((o: any) => o.id === initialOpportunityId || o.opportunity_id === initialOpportunityId);
      if (opp) {
        setValue('opportunity_id', initialOpportunityId);
        setValue('company_id', opp.company_id);
        // Set subject from opportunity name
        setValue('subject', opp.opportunity_name || '');
        
        // Set display data
        setDisplayData({
          companyName: opp.company_name || '',
          customerName: '',
          opportunityName: opp.opportunity_name || '',
        });
        
        // Try to find primary contact for this company
        if (allCustomers.length > 0) {
          const primaryContact = allCustomers.find((c: any) => 
            c.company_id === opp.company_id && c.is_primary_contact === 1
          );
          if (primaryContact) {
            setValue('customer_id', primaryContact.id);
            setDisplayData(prev => ({
              ...prev,
              customerName: `${primaryContact.first_name} ${primaryContact.last_name}`,
            }));
          }
        }
      }
    }
  }, [initialOpportunityId, opportunities, allCustomers, setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Load quotation data when in edit mode
  useEffect(() => {
    if (isEditMode && quotationData && open) {
      setValue('company_id', quotationData.company_id);
      setValue('customer_id', quotationData.customer_id);
      setValue('opportunity_id', quotationData.opportunity_id);
      setValue('quotation_number', quotationData.quotation_number);
      setValue('subject', quotationData.subject || '');
      setValue('issue_date', quotationData.issue_date);
      setValue('valid_until', quotationData.valid_until);
      setValue('discount', quotationData.discount || 0);
      setValue('status', quotationData.status);
      setValue('payment_terms', quotationData.payment_terms || '');
      setValue('notes', quotationData.notes || '');
      
      if (quotationData.items && quotationData.items.length > 0) {
        setValue('items', quotationData.items.map((item: any) => ({
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.total_price,
          sort_order: item.sort_order,
        })));
      }
      
      // Set display data
      setDisplayData({
        companyName: quotationData.company_name || '',
        customerName: quotationData.customer_name ? `${quotationData.customer_name}` : '',
        opportunityName: quotationData.opportunity_name || '',
      });
    }
  }, [isEditMode, quotationData, setValue]);

  // Apply defaults from company settings when dialog opens
  useEffect(() => {
    if (open && companySettings) {
      const today = new Date();
      const validityDays = Number(companySettings.default_validity_days) || 30;
      const validUntil = format(addDays(today, validityDays), 'yyyy-MM-dd');

      setValue('valid_until', validUntil);
      setValue('payment_terms', companySettings.default_payment_terms || '');
      setVatRate(Number(companySettings.default_tax_rate) || 0);
    }
  }, [open, companySettings]);

  // Set quotation number from API when available
  useEffect(() => {
    if (open && nextNumber?.next_number) {
      setValue('quotation_number', nextNumber.next_number);
    }
  }, [open, nextNumber]);

  const selectedCompany = watch('company_id');
  const items = watch('items');
  const discount = watch('discount');

  // Filter customers by selected company
  const filteredCustomers = selectedCompany
    ? allCustomers.filter((c) => c.company_id === selectedCompany)
    : [];

  // Calculate totals — tax is derived from vatRate %
  const totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const afterDiscount = Math.max(0, totalAmount - (discount || 0));
  const taxAmount = Math.round(afterDiscount * vatRate / 100 * 100) / 100;
  const grandTotal = afterDiscount + taxAmount;

  const onSubmit = async (data: QuotationFormData) => {
    try {
      const quotationData = {
        ...data,
        tax: taxAmount,          // override with computed VAT amount
        total_amount: totalAmount,
        grand_total: grandTotal,
      };

      if (isEditMode && editingQuotationId) {
        await updateQuotation.mutateAsync({ id: editingQuotationId, updates: quotationData });
        toast.success('แก้ไขใบเสนอราคาสำเร็จ');
      } else {
        await createQuotation.mutateAsync(quotationData);
        toast.success('สร้างใบเสนอราคาสำเร็จ');
      }
      setOpen(false);
      reset();
    } catch (error: any) {
      toast.error(error.message || (isEditMode ? 'เกิดข้อผิดพลาดในการแก้ไขใบเสนอราคา' : 'เกิดข้อผิดพลาดในการสร้างใบเสนอราคา'));
    }
  };

  const updateItemTotal = (index: number) => {
    const quantity = items[index]?.quantity || 0;
    const unitPrice = items[index]?.unit_price || 0;
    setValue(`items.${index}.total_price`, quantity * unitPrice);
  };

  const addItem = () => {
    append({
      item_name: '',
      description: '',
      quantity: 1,
      unit: 'รายการ',
      unit_price: 0,
      total_price: 0,
      sort_order: fields.length,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && (createQuotation.isPending || updateQuotation?.isPending || aiGenerate.isPending || aiFilling || excelParsing)) return; setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          สร้างใบเสนอราคา
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'แก้ไขใบเสนอราคา' : 'สร้างใบเสนอราคาใหม่'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'แก้ไขข้อมูลใบเสนอราคา' : 'บันทึกใบเสนอราคาพร้อมรายการสินค้า/บริการ'}
          </DialogDescription>
        </DialogHeader>

        {/* Opportunity Info Display - shown when opened from sales detail */}
        {initialOpportunityId && displayData.companyName && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              ข้อมูลจากโอกาสการขาย
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">โอกาสการขาย</p>
                <p className="font-medium">{displayData.opportunityName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">บริษัท</p>
                <p className="font-medium">{displayData.companyName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ผู้ติดต่อ</p>
                <p className="font-medium">{displayData.customerName || '-'}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Basic Info - Hide when opened from opportunity or in edit mode */}
          {(!isEditMode && !initialOpportunityId) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company */}
            <div className="space-y-2">
              <Label htmlFor="company_id">
                บริษัท <span className="text-red-500">*</span>
              </Label>
              <CompanyCombobox
                value={selectedCompany || ''}
                onChange={(id) => setValue('company_id', id === 'none' ? '' : id)}
                placeholder="เลือกบริษัท"
                allowNone={false}
              />
              {errors.company_id && (
                <p className="text-sm text-red-500">{errors.company_id.message}</p>
              )}
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <Label htmlFor="customer_id">ผู้ติดต่อ</Label>
              <Select
                onValueChange={(value) => setValue('customer_id', value)}
                disabled={!selectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCompany ? "เลือกผู้ติดต่อ" : "เลือกบริษัทก่อน"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quotation Number */}
            <div className="space-y-2">
              <Label htmlFor="quotation_number">
                เลขที่ใบเสนอราคา <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quotation_number"
                placeholder="QT-202602-0001"
                {...register('quotation_number')}
              />
              {errors.quotation_number && (
                <p className="text-sm text-red-500">{errors.quotation_number.message}</p>
              )}
            </div>

            {/* Opportunity */}
            <div className="space-y-2">
              <Label htmlFor="opportunity_id">โอกาสการขาย</Label>
              <Select onValueChange={(value) => setValue('opportunity_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกโอกาสการขาย (ถ้ามี)" />
                </SelectTrigger>
                <SelectContent>
                  {opportunities.map((opp: any) => (
                    <SelectItem key={opp.opportunity_id} value={opp.opportunity_id}>
                      {opp.opportunity_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Issue Date */}
            <div className="space-y-2">
              <Label htmlFor="issue_date">วันที่ออก</Label>
              <Input
                id="issue_date"
                type="date"
                {...register('issue_date')}
              />
            </div>

            {/* Valid Until */}
            <div className="space-y-2">
              <Label htmlFor="valid_until">
                ใช้ได้ถึงวันที่ <span className="text-red-500">*</span>
              </Label>
              <Input
                id="valid_until"
                type="date"
                {...register('valid_until')}
              />
              {errors.valid_until && (
                <p className="text-sm text-red-500">{errors.valid_until.message}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>สถานะ</Label>
              <Select
                defaultValue="draft"
                onValueChange={(value) => setValue('status', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">แบบร่าง</SelectItem>
                  <SelectItem value="sent">ส่งแล้ว</SelectItem>
                  <SelectItem value="approved">อนุมัติ</SelectItem>
                  <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>รายการสินค้า/บริการ <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm"
                  onClick={() => setShowAiPanel(v => !v)}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  สร้างด้วย AI
                </Button>
                <Button type="button" variant="outline" size="sm"
                  onClick={handleAiFill}
                  disabled={!watch('opportunity_id') || aiFilling}>
                  {aiFilling ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  AI จาก Opportunity
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                เพิ่มรายการ
              </Button>
              </div>
            </div>

            {/* AI Generation Panel */}
            {showAiPanel && (
              <div className="rounded-lg border bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5 text-violet-600" />
                    สร้างใบเสนอราคาอัตโนมัติด้วย AI
                  </p>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => setShowAiPanel(false)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">เลือก Template ต้นแบบ</Label>
                  <Select value={aiTemplateId} onValueChange={setAiTemplateId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={aiTemplates.length === 0 ? 'ยังไม่มี template — อัปโหลดที่ Admin > Quotation Templates' : 'เลือก template'} />
                    </SelectTrigger>
                    <SelectContent>
                      {aiTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Brief (ความต้องการ, ปริมาณ, ระยะเวลา)</Label>
                  <Textarea value={aiBrief} onChange={e => setAiBrief(e.target.value)}
                    placeholder="เช่น ระบบ ERP สำหรับโรงงาน 200 user 6 เดือน รวมฝึกอบรม"
                    rows={3} className="text-xs" />
                </div>
                <Button type="button" size="sm" className="w-full"
                  onClick={() => aiGenerate.mutate()}
                  disabled={!aiTemplateId || aiBrief.trim().length < 10 || aiGenerate.isPending}>
                  {aiGenerate.isPending ? (
                    <span className="flex items-center"><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />AI กำลังคิด…</span>
                  ) : (
                    <span className="flex items-center"><Sparkles className="h-3.5 w-3.5 mr-1" />Generate รายการ</span>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  AI อ้างอิงโครงสร้างและช่วงราคาจาก template — ผลลัพธ์เป็น draft ที่ปรับได้
                </p>
                {aiTemplateId && (
                  <Button type="button" variant="outline" size="sm" className="w-full"
                    onClick={() => handleExcelParse(aiTemplateId)}
                    disabled={excelParsing}>
                    {excelParsing ? (
                      <span className="flex items-center"><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />กำลังอ่าน Excel…</span>
                    ) : (
                      <span className="flex items-center">นำเข้ารายการจากไฟล์ Excel</span>
                    )}
                  </Button>
                )}
              </div>
            )}

            {errors.items && typeof errors.items.message === 'string' && (
              <p className="text-sm text-red-500">{errors.items.message}</p>
            )}

            <div className="space-y-2">
              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-6" />
                      <div className="flex-1 space-y-3">
                        <Input
                          placeholder="ชื่อรายการ *"
                          {...register(`items.${index}.item_name`)}
                        />
                        <Textarea
                          placeholder="รายละเอียด"
                          rows={2}
                          {...register(`items.${index}.description`)}
                        />
                        <div className="grid grid-cols-4 gap-2">
                          <Input
                            type="number"
                            placeholder="จำนวน"
                            step="0.01"
                            {...register(`items.${index}.quantity`, {
                              valueAsNumber: true,
                              onChange: () => updateItemTotal(index),
                            })}
                          />
                          <Input
                            placeholder="หน่วย"
                            {...register(`items.${index}.unit`)}
                          />
                          <Input
                            type="number"
                            placeholder="ราคา/หน่วย"
                            step="0.01"
                            {...register(`items.${index}.unit_price`, {
                              valueAsNumber: true,
                              onChange: () => updateItemTotal(index),
                            })}
                          />
                          <Input
                            type="number"
                            placeholder="ราคารวม"
                            value={items[index]?.total_price || 0}
                            disabled
                          />
                        </div>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Totals */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">ยอดรวมก่อนหักส่วนลด</span>
                <span className="font-medium">{totalAmount.toLocaleString('th-TH')} ฿</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm">ส่วนลด</span>
                <Input
                  type="number"
                  className="w-32 text-right"
                  step="0.01"
                  min="0"
                  {...register('discount', { valueAsNumber: true })}
                />
              </div>
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">VAT</span>
                  <Input
                    type="number"
                    className="w-16 text-right"
                    step="0.1"
                    min="0"
                    max="100"
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <span className="font-medium">{taxAmount.toLocaleString('th-TH')} ฿</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>ยอดรวมสุทธิ</span>
                <span className="text-primary">{grandTotal.toLocaleString('th-TH')} ฿</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <div className="space-y-2">
            <Label htmlFor="payment_terms">เงื่อนไขการชำระเงิน</Label>
            <Textarea
              id="payment_terms"
              placeholder="เช่น มัดจำ 30%, ชำระ 50% เมื่อส่งมอบ Phase 1, ชำระ 20% เมื่อส่งมอบสมบูรณ์"
              rows={2}
              {...register('payment_terms')}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">หมายเหตุ</Label>
            <Textarea
              id="notes"
              placeholder="หมายเหตุเพิ่มเติม"
              rows={2}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={createQuotation.isPending}>
              {createQuotation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              สร้างใบเสนอราคา
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
