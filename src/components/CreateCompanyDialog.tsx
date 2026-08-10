import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateCompany } from '@/hooks/useProjectData';
import type { CompanyEnrichResponse } from '@/types/project';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const BUSINESS_TYPES = [
  'เทคโนโลยีสารสนเทศ (IT)',
  'การเงิน / ธนาคาร',
  'ประกันภัย',
  'อสังหาริมทรัพย์',
  'การผลิต / อุตสาหกรรม',
  'ค้าปลีก / ค้าส่ง',
  'การแพทย์ / สุขภาพ',
  'การศึกษา',
  'พลังงาน',
  'โทรคมนาคม',
  'การขนส่ง / โลจิสติกส์',
  'อาหาร / เครื่องดื่ม',
  'การท่องเที่ยว / โรงแรม',
  'สื่อ / โฆษณา',
  'ก่อสร้าง / วิศวกรรม',
  'เกษตรกรรม',
  'อื่น ๆ',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const COMPANY_TYPES: { value: 'customer' | 'partner' | 'manufacturer'; label: string }[] = [
  { value: 'customer', label: 'ลูกค้า' },
  { value: 'partner', label: 'คู่ค้า' },
  { value: 'manufacturer', label: 'ผู้ผลิต' },
];

const formSchema = z.object({
  name: z.string().min(2, 'ชื่อบริษัทต้องมีอย่างน้อย 2 ตัวอักษร'),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('กรุณากรอกอีเมลที่ถูกต้อง').optional().or(z.literal('')),
  website: z.string().url('กรุณากรอก URL ที่ถูกต้อง').optional().or(z.literal('')),
  tax_id: z.string().optional(),
  business_type: z.string().optional(),
  company_type: z.enum(['customer', 'partner', 'manufacturer']).optional(),
  company_size: z.string().optional(),
  founded_year: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateCompanyDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createCompany = useCreateCompany();
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState<{ text: string; ok: boolean } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      tax_id: '',
      business_type: '',
      company_type: 'customer',
      company_size: '',
      founded_year: '',
    },
  });

  const handleEnrich = async () => {
    const name = form.getValues('name').trim();
    if (!name) {
      toast({ title: 'กรุณากรอกชื่อบริษัทก่อน', variant: 'destructive' });
      return;
    }
    setEnriching(true);
    setEnrichNote(null);
    try {
      const data = await apiFetch<CompanyEnrichResponse>('/company-enrich.php', {
        method: 'POST',
        body: JSON.stringify({
          name,
          website: form.getValues('website'),
          tax_id: form.getValues('tax_id'),
        }),
      });
      // Fill only empty fields (don't overwrite what the user typed)
      const fill = (field: keyof FormValues, value: any) => {
        if (!form.getValues(field) && value) form.setValue(field, String(value));
      };
      fill('description',    data.description);
      fill('website',        data.website);
      fill('phone',          data.phone);
      fill('email',          data.email);
      fill('address',        data.address);
      fill('tax_id',         data.tax_id);
      fill('business_type',  data.business_type);
      fill('company_size',   data.company_size);
      fill('founded_year',   data.founded_year ? String(data.founded_year) : '');
      const conf = data.confidence === 'high' ? 'สูง' : data.confidence === 'medium' ? 'ปานกลาง' : 'ต่ำ';
      setEnrichNote({ text: `${data.source_note} · ความมั่นใจ: ${conf}`, ok: true });
    } catch (err: any) {
      setEnrichNote({ text: err?.message ?? 'ค้นหาข้อมูลไม่สำเร็จ', ok: false });
    } finally {
      setEnriching(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await createCompany.mutateAsync({
        name: values.name.toUpperCase().trim(),
        description: values.description || '',
        address: values.address || '',
        phone: values.phone || '',
        email: values.email || '',
        website: values.website || '',
        tax_id: values.tax_id || '',
        logo_url: '',
        is_active: true,
        business_type: values.business_type || '',
        company_type: values.company_type || 'customer',
        company_size: values.company_size || '',
        founded_year: values.founded_year ? parseInt(values.founded_year) : undefined,
      });

      toast({
        title: 'สร้างบริษัทสำเร็จ',
        description: `เพิ่มบริษัท "${values.name}" เรียบร้อยแล้ว`,
      });

      form.reset();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error?.message || 'ไม่สามารถสร้างบริษัทได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setEnrichNote(null); } }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Building2 className="h-4 w-4" />
          เพิ่มบริษัท
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">เพิ่มบริษัทใหม่</DialogTitle>
          <DialogDescription className="text-xs">
            กรอกข้อมูลบริษัทลูกค้าเพื่อเพิ่มเข้าระบบ
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">ชื่อบริษัท <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="บริษัท ABC จำกัด" className="h-9 text-sm" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Auto-enrich button */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleEnrich}
                disabled={enriching}
              >
                {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                {enriching ? 'กำลังค้นหา...' : 'ค้นหาข้อมูลจากอินเทอร์เน็ต'}
              </Button>
              {enrichNote && (
                <span className={`flex items-center gap-1 text-xs ${enrichNote.ok ? 'text-green-600' : 'text-destructive'}`}>
                  {enrichNote.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {enrichNote.text}
                </span>
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">รายละเอียด</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="คำอธิบายเกี่ยวกับบริษัท..."
                      className="min-h-[60px] text-sm"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_type"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">ประเภทบริษัท</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="เลือกประเภท" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMPANY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-[11px]">แยกประเภทเพื่อใช้ข้อมูลให้ถูกต้อง: ลูกค้า / คู่ค้า / ผู้ผลิต</FormDescription>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">เบอร์โทรศัพท์</FormLabel>
                    <FormControl>
                      <Input placeholder="02-XXX-XXXX" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">อีเมล</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="info@company.com" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">ที่อยู่</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="123 ถนน... แขวง... เขต... กรุงเทพฯ"
                      className="min-h-[60px] text-sm"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">เว็บไซต์</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.company.com" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">เลขประจำตัวผู้เสียภาษี <span className="text-muted-foreground font-normal">(ไม่บังคับ)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="0123456789012" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="business_type"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">ประเภทธุรกิจ</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="เลือกประเภทธุรกิจ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_size"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">ขนาดบริษัท (จำนวนพนักงาน)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="เลือกขนาด" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMPANY_SIZES.map((s) => (
                          <SelectItem key={s} value={s}>{s} คน</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="founded_year"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">ปีที่ก่อตั้ง (ค.ศ.)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="เช่น 2010" min="1800" max="2099" className="h-9 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" className="px-8" disabled={createCompany.isPending}>
                {createCompany.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                สร้างบริษัท
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
