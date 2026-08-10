import { useEffect, useState, useMemo } from 'react';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useProjectData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Building2, FileText, Landmark, Eye } from 'lucide-react';
import { APP_URL } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { CompanySettings } from '@/types/project';

type FormData = Omit<CompanySettings, 'id' | 'updated_at'>;

const FORMAT_PRESETS = [
  { value: '{PREFIX}{YYYY}{MM}-{NNNN}', label: 'รายเดือน — QT-202602-0001', description: 'reset ทุกเดือน' },
  { value: '{PREFIX}{YYYY}-{NNNN}', label: 'รายปี — QT-2026-0001', description: 'reset ทุกปี' },
  { value: '{PREFIX}{NNNN}', label: 'ต่อเนื่อง — QT-0001', description: 'ไม่ reset' },
  { value: 'custom', label: 'กำหนดเอง...', description: '' },
];

function formatPreview(format: string, prefix: string): string {
  const now = new Date();
  let result = format;
  result = result.replace(/\{PREFIX\}/g, prefix);
  result = result.replace(/\{YYYY\}/g, now.getFullYear().toString());
  result = result.replace(/\{YY\}/g, now.getFullYear().toString().slice(-2));
  result = result.replace(/\{MM\}/g, String(now.getMonth() + 1).padStart(2, '0'));
  result = result.replace(/\{DD\}/g, String(now.getDate()).padStart(2, '0'));

  // Replace {NNN...} with padded "1"
  result = result.replace(/\{(N+)\}/g, (_, ns: string) => {
    return '1'.padStart(ns.length, '0');
  });
  return result;
}

function getResetLabel(format: string): string {
  if (format.includes('{MM}')) return 'reset รายเดือน';
  if (format.includes('{YYYY}') || format.includes('{YY}')) return 'reset รายปี';
  return 'ไม่ reset (ต่อเนื่อง)';
}

const defaultForm: FormData = {
  company_name: '',
  company_name_en: '',
  address: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  tax_id: '',
  logo_url: '',
  app_base_url: '',
  quotation_prefix: 'QT-',
  quotation_running_number: 1,
  quotation_number_format: '{PREFIX}{YYYY}{MM}-{NNNN}',
  default_validity_days: 30,
  default_payment_terms: '',
  default_tax_rate: 7,
  max_task_hours: 16,
  currency: 'THB',
  currency_symbol: '฿',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_branch: '',
};

export default function CompanySettingsForm() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(defaultForm);
  const [showPreview, setShowPreview] = useState(false);
  const [isCustomFormat, setIsCustomFormat] = useState(false);

  useEffect(() => {
    if (settings) {
      const fmt = settings.quotation_number_format || '{PREFIX}{YYYY}{MM}-{NNNN}';
      setForm({
        company_name: settings.company_name || '',
        company_name_en: settings.company_name_en || '',
        address: settings.address || '',
        phone: settings.phone || '',
        fax: settings.fax || '',
        email: settings.email || '',
        website: settings.website || '',
        tax_id: settings.tax_id || '',
        logo_url: settings.logo_url || '',
        app_base_url: settings.app_base_url || '',
        quotation_prefix: settings.quotation_prefix || 'QT-',
        quotation_running_number: Number(settings.quotation_running_number) || 1,
        quotation_number_format: fmt,
        default_validity_days: Number(settings.default_validity_days) || 30,
        default_payment_terms: settings.default_payment_terms || '',
        default_tax_rate: Number(settings.default_tax_rate) || 7,
        max_task_hours: Number(settings.max_task_hours) || 16,
        currency: settings.currency || 'THB',
        currency_symbol: settings.currency_symbol || '฿',
        bank_name: settings.bank_name || '',
        bank_account_name: settings.bank_account_name || '',
        bank_account_number: settings.bank_account_number || '',
        bank_branch: settings.bank_branch || '',
      });

      // Check if format matches a preset
      const matchesPreset = FORMAT_PRESETS.some(
        (p) => p.value !== 'custom' && p.value === fmt
      );
      setIsCustomFormat(!matchesPreset);
    }
  }, [settings]);

  const handleChange = (field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormatPresetChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomFormat(true);
    } else {
      setIsCustomFormat(false);
      handleChange('quotation_number_format', value);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      toast({ title: 'บันทึกสำเร็จ', description: 'อัปเดตข้อมูลบริษัทแล้ว' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const previewNumber = useMemo(
    () => formatPreview(form.quotation_number_format, form.quotation_prefix),
    [form.quotation_number_format, form.quotation_prefix]
  );

  const currentPresetValue = useMemo(() => {
    if (isCustomFormat) return 'custom';
    const match = FORMAT_PRESETS.find(
      (p) => p.value !== 'custom' && p.value === form.quotation_number_format
    );
    return match ? match.value : 'custom';
  }, [form.quotation_number_format, isCustomFormat]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save button bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          กรอกข้อมูลบริษัทที่ใช้งานระบบ สำหรับออกหัวใบเสนอราคาและเอกสารต่าง ๆ
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'ซ่อน Preview' : 'ดูตัวอย่าง'}
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSave}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            บันทึก
          </Button>
        </div>
      </div>

      {/* Preview card */}
      {showPreview && (
        <Card className="border-dashed border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">ตัวอย่างหัวใบเสนอราคา</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-white text-black">
              <div className="flex items-start gap-4">
                {form.logo_url && (
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="w-16 h-16 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold">
                    {form.company_name || 'ชื่อบริษัท (ภาษาไทย)'}
                  </h3>
                  {form.company_name_en && (
                    <p className="text-sm text-gray-600">{form.company_name_en}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">
                    {form.address || 'ที่อยู่บริษัท'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mt-1">
                    {form.phone && <span>โทร: {form.phone}</span>}
                    {form.fax && <span>แฟกซ์: {form.fax}</span>}
                    {form.email && <span>อีเมล: {form.email}</span>}
                  </div>
                  {form.tax_id && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      เลขประจำตัวผู้เสียภาษี: {form.tax_id}
                    </p>
                  )}
                </div>
              </div>
              <div className="border-t mt-4 pt-3 text-center">
                <p className="font-bold">ใบเสนอราคา / Quotation</p>
                <p className="text-xs text-gray-500">
                  เลขที่: {previewNumber}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Company Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>ข้อมูลบริษัท</CardTitle>
              <CardDescription>ข้อมูลสำหรับหัวกระดาษใบเสนอราคาและเอกสาร</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">ชื่อบริษัท (ภาษาไทย)</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder="บริษัท ตัวอย่าง จำกัด"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name_en">ชื่อบริษัท (English)</Label>
              <Input
                id="company_name_en"
                value={form.company_name_en}
                onChange={(e) => handleChange('company_name_en', e.target.value)}
                placeholder="Example Company Co., Ltd."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">ที่อยู่</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="123 ถนนตัวอย่าง แขวง... เขต... กรุงเทพฯ 10xxx"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="02-xxx-xxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">แฟกซ์</Label>
              <Input
                id="fax"
                value={form.fax}
                onChange={(e) => handleChange('fax', e.target.value)}
                placeholder="02-xxx-xxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="info@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">เว็บไซต์</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://www.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_base_url">URL ฐานระบบ (สำหรับลิงค์ในอีเมล)</Label>
              <Input
                id="app_base_url"
                value={form.app_base_url}
                onChange={(e) => handleChange('app_base_url', e.target.value)}
                placeholder={`${APP_URL}/flowstack`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                id="tax_id"
                value={form.tax_id}
                onChange={(e) => handleChange('tax_id', e.target.value)}
                placeholder="0105558xxxxxx"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo_url">URL โลโก้บริษัท</Label>
            <Input
              id="logo_url"
              value={form.logo_url}
              onChange={(e) => handleChange('logo_url', e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              ใส่ URL ของรูปโลโก้ (แนะนำขนาด 200x200px, PNG หรือ SVG)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Quotation Defaults */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>ค่าเริ่มต้นใบเสนอราคา</CardTitle>
              <CardDescription>กำหนดค่า default เมื่อสร้างใบเสนอราคาใหม่</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prefix */}
          <div className="space-y-2">
            <Label htmlFor="quotation_prefix">Prefix เลขที่ใบเสนอราคา</Label>
            <Input
              id="quotation_prefix"
              value={form.quotation_prefix}
              onChange={(e) => handleChange('quotation_prefix', e.target.value)}
              placeholder="QT-"
              className="w-full sm:w-48"
            />
          </div>

          {/* Format selector */}
          <div className="space-y-2">
            <Label>รูปแบบเลขที่ใบเสนอราคา</Label>
            <Select value={currentPresetValue} onValueChange={handleFormatPresetChange}>
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue placeholder="เลือกรูปแบบ" />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom format input */}
          {isCustomFormat && (
            <div className="space-y-2">
              <Label htmlFor="custom_format">รูปแบบกำหนดเอง</Label>
              <Input
                id="custom_format"
                value={form.quotation_number_format}
                onChange={(e) => handleChange('quotation_number_format', e.target.value)}
                placeholder="{PREFIX}{YYYY}{MM}-{NNNN}"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Tokens: {'{PREFIX}'} {'{YYYY}'} {'{YY}'} {'{MM}'} {'{DD}'} {'{NNNN}'} (จำนวน N = จำนวนหลัก)
              </p>
            </div>
          )}

          {/* Live preview */}
          <div className="p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ตัวอย่างเลขที่ถัดไป</p>
                <p className="text-lg font-bold font-mono">{previewNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">การ Reset</p>
                <p className="text-sm font-medium">{getResetLabel(form.quotation_number_format)}</p>
              </div>
            </div>
          </div>

          {/* Validity days */}
          <div className="space-y-2">
            <Label htmlFor="default_validity_days">วันที่มีผล (วัน)</Label>
            <Input
              id="default_validity_days"
              type="number"
              min={1}
              value={form.default_validity_days}
              onChange={(e) => handleChange('default_validity_days', parseInt(e.target.value) || 30)}
              className="w-full sm:w-48"
            />
          </div>

          {/* Tax rate */}
          <div className="space-y-2">
            <Label htmlFor="default_tax_rate">อัตราภาษีเริ่มต้น (%)</Label>
            <Input
              id="default_tax_rate"
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={form.default_tax_rate}
              onChange={(e) => handleChange('default_tax_rate', parseFloat(e.target.value) || 0)}
              className="w-full sm:w-48"
            />
          </div>

          {/* Max task hours */}
          <div className="space-y-2">
            <Label htmlFor="max_task_hours">ชม.สูงสุดต่องานใบเดี่ยว</Label>
            <p className="text-[11px] text-muted-foreground">จำนวนชั่วโมงสูงสุดที่อนุญาตต่องานวันเดียว (ค่าเริ่มต้น 16)</p>
            <Input
              id="max_task_hours"
              type="number"
              step="0.5"
              min={1}
              max={24}
              value={form.max_task_hours}
              onChange={(e) => handleChange('max_task_hours', parseFloat(e.target.value) || 16)}
              className="w-full sm:w-48"
            />
          </div>

          {/* Payment terms */}
          <div className="space-y-2">
            <Label htmlFor="default_payment_terms">เงื่อนไขการชำระเงินเริ่มต้น</Label>
            <Textarea
              id="default_payment_terms"
              value={form.default_payment_terms}
              onChange={(e) => handleChange('default_payment_terms', e.target.value)}
              placeholder="ชำระภายใน 30 วันนับจากวันที่ในใบแจ้งหนี้"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Bank Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>ข้อมูลบัญชีธนาคาร</CardTitle>
              <CardDescription>สำหรับแสดงในใบเสนอราคาและเอกสารการเงิน</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">สกุลเงิน</Label>
              <Input
                id="currency"
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                placeholder="THB"
                className="w-full sm:w-32"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_symbol">สัญลักษณ์สกุลเงิน</Label>
              <Input
                id="currency_symbol"
                value={form.currency_symbol}
                onChange={(e) => handleChange('currency_symbol', e.target.value)}
                placeholder="฿"
                className="w-full sm:w-32"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">ชื่อธนาคาร</Label>
              <Input
                id="bank_name"
                value={form.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="ธนาคารกรุงเทพ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_branch">สาขา</Label>
              <Input
                id="bank_branch"
                value={form.bank_branch}
                onChange={(e) => handleChange('bank_branch', e.target.value)}
                placeholder="สาขาสำนักงานใหญ่"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_account_name">ชื่อบัญชี</Label>
              <Input
                id="bank_account_name"
                value={form.bank_account_name}
                onChange={(e) => handleChange('bank_account_name', e.target.value)}
                placeholder="บริษัท ตัวอย่าง จำกัด"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_account_number">เลขที่บัญชี</Label>
              <Input
                id="bank_account_number"
                value={form.bank_account_number}
                onChange={(e) => handleChange('bank_account_number', e.target.value)}
                placeholder="xxx-x-xxxxx-x"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom save button */}
      <div className="flex justify-end">
        <Button
          className="gap-2"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          บันทึกการตั้งค่า
        </Button>
      </div>
    </div>
  );
}
