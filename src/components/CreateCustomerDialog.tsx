import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateCustomer } from '@/hooks/useProjectData';
import CompanyCombobox from '@/components/CompanyCombobox';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';

const formSchema = z.object({
  company_id: z.string().min(1, 'กรุณาเลือกบริษัท'),
  first_name: z.string().min(1, 'กรุณากรอกชื่อ'),
  last_name: z.string().optional(),
  email: z.string().email('กรุณากรอกอีเมลที่ถูกต้อง').optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  is_primary_contact: z.boolean().default(false),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCustomerDialogProps {
  defaultCompanyId?: string;
}

export function CreateCustomerDialog({ defaultCompanyId }: CreateCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createCustomer = useCreateCustomer();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_id: defaultCompanyId || '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      is_primary_contact: false,
      notes: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createCustomer.mutateAsync({
        company_id: values.company_id,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || '',
        position: values.position || '',
        is_primary_contact: values.is_primary_contact,
        is_active: true,
        notes: values.notes || '',
      });

      toast({
        title: 'สร้างผู้ติดต่อสำเร็จ',
        description: `เพิ่มผู้ติดต่อ "${values.first_name} ${values.last_name}" เรียบร้อยแล้ว`,
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถสร้างผู้ติดต่อได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" />
          เพิ่มผู้ติดต่อ
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">เพิ่มผู้ติดต่อใหม่</DialogTitle>
          <DialogDescription className="text-xs">
            กรอกข้อมูลผู้ติดต่อของบริษัทลูกค้า
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">บริษัท <span className="text-destructive">*</span></FormLabel>
                  <CompanyCombobox
                    value={field.value || ''}
                    onChange={(id) => field.onChange(id === 'none' ? '' : id)}
                    placeholder="เลือกบริษัท"
                    allowNone={false}
                  />
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">ชื่อ <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="สมชาย" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">นามสกุล</FormLabel>
                    <FormControl>
                      <Input placeholder="ใจดี" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">อีเมล</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="somchai@company.com" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm">เบอร์โทรศัพท์</FormLabel>
                    <FormControl>
                      <Input placeholder="08X-XXX-XXXX" className="h-9 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">ตำแหน่ง</FormLabel>
                  <FormControl>
                    <Input placeholder="ผู้จัดการโครงการ, CTO, etc." className="h-9 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_primary_contact"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 bg-muted/20">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-medium">
                      ตั้งเป็นผู้ติดต่อหลัก
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">หมายเหตุ</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับผู้ติดต่อ..."
                      className="min-h-[60px] text-sm"
                      {...field} 
                    />
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
              <Button type="submit" className="px-8" disabled={createCustomer.isPending}>
                {createCustomer.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                สร้างผู้ติดต่อ
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
