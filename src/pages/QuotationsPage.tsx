import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import { apiFetch } from '@/lib/api';
import { useCompanies, useCompanySettings, useCustomers, useOpportunities, useQuotations, useUpdateQuotation } from '@/hooks/useProjectData';
import { CreateQuotationDialog } from '@/components/CreateQuotationDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, CheckCircle, XCircle, Clock, Pencil, Plus, Printer, Trash2, Mail, Download, Filter } from 'lucide-react';
import type { DbQuotationItem, QuotationSummary, QuotationStatus } from '@/types/project';
import { endOfYear, format, parseISO, startOfYear } from 'date-fns';
import { QUOTATION_STATUS_LABELS } from '@/lib/labels';

const STATUS_CONFIG: Record<QuotationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  draft: { label: QUOTATION_STATUS_LABELS.draft, variant: 'secondary', icon: Clock },
  sent: { label: QUOTATION_STATUS_LABELS.sent, variant: 'default', icon: FileText },
  approved: { label: QUOTATION_STATUS_LABELS.approved, variant: 'default', icon: CheckCircle },
  rejected: { label: QUOTATION_STATUS_LABELS.rejected, variant: 'destructive', icon: XCircle },
  expired: { label: QUOTATION_STATUS_LABELS.expired, variant: 'secondary', icon: Clock },
};

export default function QuotationsPage() {
  const [searchParams] = useSearchParams();
  const opportunityIdFromUrl = searchParams.get('opportunity_id') || undefined;
  const isNewQuotation = window.location.pathname === '/quotations/new';
  
  const { data: quotations = [], isLoading } = useQuotations();
  const { data: companies = [] } = useCompanies(true);
  const { data: customers = [] } = useCustomers();
  const { data: opportunities = [] } = useOpportunities();
  const { data: companySettings } = useCompanySettings();
  const updateQuotation = useUpdateQuotation();
  const { toast } = useToast();

  // Year and date filter
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const handleYearChange = (year: string) => {
    setYearFilter(year);
    if (year === '__all__') {
      setStartDate('');
      setEndDate('');
    } else {
      const selectedYear = parseInt(year, 10);
      setStartDate(format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
      setEndDate(format(endOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
    }
  };

  const resetFilters = () => {
    setYearFilter(String(currentYear));
    setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  };

  const filtersContent = (
    <>
      <Select value={yearFilter} onValueChange={handleYearChange}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="ปี" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกปี</SelectItem>
          {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-36" />
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-36" />
      </div>
      <Button variant="outline" onClick={resetFilters}>
        ล้างตัวกรอง
      </Button>
    </>
  );

  // Filter quotations by date
  const filteredQuotations = useMemo(() => {
    if (!startDate && !endDate) return quotations;
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;
    return quotations.filter((q: any) => {
      const qDate = q.issue_date ? parseISO(q.issue_date) : null;
      if (!qDate) return false;
      if (filterStart && qDate < filterStart) return false;
      if (filterEnd && qDate > filterEnd) return false;
      return true;
    });
  }, [quotations, startDate, endDate]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<QuotationSummary | null>(null);
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editOpportunityId, setEditOpportunityId] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editStatus, setEditStatus] = useState<QuotationStatus>('draft');
  const [editDiscount, setEditDiscount] = useState('0');
  const [editTaxRate, setEditTaxRate] = useState(0); // VAT as percentage e.g. 7 = 7%
  const [editSubject, setEditSubject] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<Array<DbQuotationItem>>([]);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [printLoadingId, setPrintLoadingId] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState<QuotationSummary | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const formatBaht = (value: number) => `${value.toLocaleString('th-TH')} ฿`;

  const mapItems = (items: any[] = []): Array<DbQuotationItem> => {
    return items.map((item, index) => ({
      id: item.id || `temp-${index}`,
      quotation_id: item.quotation_id || '',
      item_name: item.item_name || '',
      description: item.description || '',
      quantity: Number(item.quantity || 0),
      unit: item.unit || 'รายการ',
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      sort_order: Number(item.sort_order ?? index),
      created_at: item.created_at || '',
    }));
  };

  const recalcItemTotal = (item: DbQuotationItem) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    return Math.max(0, quantity * unitPrice);
  };

  const updateItem = (index: number, field: keyof DbQuotationItem, value: string | number) => {
    setEditItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value } as DbQuotationItem;
      if (field === 'quantity' || field === 'unit_price') {
        item.total_price = recalcItemTotal(item);
      }
      next[index] = item;
      return next;
    });
  };

  const addItem = () => {
    setEditItems((prev) => [
      ...prev,
      {
        id: `temp-${prev.length + 1}`,
        quotation_id: '',
        item_name: '',
        description: '',
        quantity: 1,
        unit: 'รายการ',
        unit_price: 0,
        total_price: 0,
        sort_order: prev.length,
        created_at: '',
      },
    ]);
  };

  const removeItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = editItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const discountValue = Number(editDiscount || 0);
  const afterDiscount = Math.max(0, totalAmount - discountValue);
  const taxValue = Math.round(afterDiscount * editTaxRate / 100 * 100) / 100;
  const grandTotal = afterDiscount + taxValue;

  const openEditQuotation = async (quotation: QuotationSummary) => {
    setEditingQuotation(quotation);
    setIsEditOpen(true);
    setIsEditLoading(true);
    try {
      const detail = await apiFetch<QuotationSummary & { items?: DbQuotationItem[] }>(`/quotations.php?id=${quotation.id}`);
      setEditCompanyId(detail.company_id || '');
      setEditCustomerId(detail.customer_id || '__none__');
      setEditOpportunityId(detail.opportunity_id || '__none__');
      setEditNumber(detail.quotation_number || '');
      setEditSubject((detail as any).subject || '');
      setEditIssueDate(detail.issue_date || '');
      setEditValidUntil(detail.valid_until || '');
      setEditStatus(detail.status || 'draft');
      setEditDiscount(String(detail.discount ?? 0));
      // Back-calculate VAT rate from stored tax amount
      const storedTotal = Number(detail.total_amount || 0);
      const storedDiscount = Number(detail.discount || 0);
      const storedTax = Number(detail.tax || 0);
      const base = storedTotal - storedDiscount;
      const inferredRate = base > 0
        ? Math.round(storedTax / base * 100 * 10) / 10
        : Number(companySettings?.default_tax_rate || 0);
      setEditTaxRate(inferredRate);
      setEditPaymentTerms(detail.payment_terms || '');
      setEditNotes(detail.notes || '');
      setEditItems(mapItems(detail.items || []));
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
      setIsEditOpen(false);
      setEditingQuotation(null);
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingQuotation) return;
    if (editItems.length === 0) {
      toast({ title: 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการ', variant: 'destructive' });
      return;
    }
    try {
      const payloadItems = editItems.map((item, index) => ({
        item_name: item.item_name,
        description: item.description || '',
        quantity: Number(item.quantity || 0),
        unit: item.unit || 'รายการ',
        unit_price: Number(item.unit_price || 0),
        total_price: Number(item.total_price || 0),
        sort_order: index,
      }));

      await updateQuotation.mutateAsync({
        id: editingQuotation.id,
        updates: {
          company_id: editCompanyId,
          customer_id: (!editCustomerId || editCustomerId === '__none__') ? null : editCustomerId,
          opportunity_id: (!editOpportunityId || editOpportunityId === '__none__') ? null : editOpportunityId,
          quotation_number: editNumber,
          subject: editSubject,
          issue_date: editIssueDate,
          valid_until: editValidUntil,
          total_amount: totalAmount,
          discount: discountValue,
          tax: taxValue,        // computed amount from vatRate %
          grand_total: grandTotal,
          status: editStatus,
          payment_terms: editPaymentTerms,
          notes: editNotes,
          items: payloadItems,
        },
      });
      toast({ title: 'แก้ไขใบเสนอราคาสำเร็จ' });
      setIsEditOpen(false);
      setEditingQuotation(null);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const escapeHtml = (value: string) => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const handlePrint = async (quotation: QuotationSummary) => {
    setPrintLoadingId(quotation.id);
    try {
      const detail = await apiFetch<QuotationSummary & { items?: DbQuotationItem[] }>(`/quotations.php?id=${quotation.id}`);
      const items = detail.items || [];
      const itemsRows = items.map((item, index) => {
        const qty = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const totalPrice = Number(item.total_price || 0);
        return `
          <tr>
            <td class="cell center">${index + 1}</td>
            <td class="cell">
              <div class="title">${escapeHtml(item.item_name || '')}</div>
              ${item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : ''}
            </td>
            <td class="cell center">${escapeHtml(String(item.unit || ''))}</td>
            <td class="cell right">${qty.toLocaleString('th-TH')}</td>
            <td class="cell right">${unitPrice.toLocaleString('th-TH')}</td>
            <td class="cell right">${totalPrice.toLocaleString('th-TH')}</td>
          </tr>
        `;
      }).join('');

      const totalAmountDetail = Number(detail.total_amount || 0);
      const discountDetail = Number(detail.discount || 0);
      const taxDetail = Number(detail.tax || 0);
      const grandTotalDetail = Number(detail.grand_total || 0);

      const companyName = companySettings?.company_name || detail.company_name || '';
      const companyNameEn = companySettings?.company_name_en || '';
      const companyAddress = companySettings?.address || '';
      const companyPhone = companySettings?.phone || '';
      const companyFax = companySettings?.fax || '';
      const companyEmail = companySettings?.email || '';
      const taxId = companySettings?.tax_id || '';
      const logoUrl = companySettings?.logo_url || '';
      const bankName = companySettings?.bank_name || '';
      const bankAccountName = companySettings?.bank_account_name || '';
      const bankAccountNumber = companySettings?.bank_account_number || '';
      const bankBranch = companySettings?.bank_branch || '';

      const customerName = detail.customer_name || '';
      const customerEmail = detail.customer_email || '';

      const currencySymbol = companySettings?.currency_symbol || '฿';
      const statusLabel = QUOTATION_STATUS_LABELS[detail.status] || detail.status || '';

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Quotation ${escapeHtml(detail.quotation_number || '')}</title>
            <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
              @page { margin: 12mm; size: A4; }
              * { box-sizing: border-box; }
              body {
                font-family: "Prompt", "Tahoma", sans-serif; color: #1f2937; margin: 0;
                -webkit-print-color-adjust: exact; print-color-adjust: exact;
              }
              h1,h2,h3 { margin: 0; }
              /* ── Company header ── */
              .doc-header { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fff; }
              .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
              .company-block { display: flex; align-items: flex-start; gap: 16px; flex: 1; }
              .company-logo { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }
              .company-info { flex: 1; }
              .company-name { font-size: 18px; font-weight: 700; }
              .company-name-en { font-size: 13px; color: #4b5563; margin-top: 2px; }
              .company-address { font-size: 12px; color: #6b7280; margin-top: 4px; white-space: pre-line; }
              .company-contacts { display: flex; flex-wrap: wrap; gap: 0 16px; font-size: 12px; color: #6b7280; margin-top: 4px; }
              .company-tax { font-size: 12px; color: #6b7280; margin-top: 2px; }
              .doc-title-block { text-align: right; flex-shrink: 0; }
              .doc-title { font-size: 18px; font-weight: 700; color: #1f2937; }
              .doc-title-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
              .doc-meta { margin-top: 10px; font-size: 12px; color: #6b7280; line-height: 1.9; }
              /* ── Rest of document ── */
              .panel { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-top: 16px; }
              .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
              .label { font-size: 12px; color: #6b7280; }
              .value { font-size: 14px; font-weight: 600; }
              .sub { font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th { background: #f3f4f6; text-align: left; padding: 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
              td { padding: 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
              tr { page-break-inside: avoid; }
              .cell.center { text-align: center; }
              .cell.right { text-align: right; }
              .desc { font-size: 12px; color: #6b7280; margin-top: 4px; }
              .totals { margin-left: auto; width: 320px; }
              .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
              .totals-row.total { font-size: 16px; font-weight: 700; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 6px; }
              .note { font-size: 12px; color: #6b7280; white-space: pre-line; }
              .status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
              .status-draft { background: #f3f4f6; color: #6b7280; }
              .status-sent { background: #dbeafe; color: #1d4ed8; }
              .status-approved { background: #dcfce7; color: #15803d; }
              .status-rejected { background: #fee2e2; color: #dc2626; }
              .status-expired { background: #f3f4f6; color: #9ca3af; }
              .footer-note { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
            </style>
          </head>
          <body>
            <div class="doc-header">
              <div class="header-row">
                <div class="company-block">
                  ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="company-logo" onerror="this.style.display='none'">` : ''}
                  <div class="company-info">
                    <div class="company-name">${escapeHtml(companyName || 'ชื่อบริษัท')}</div>
                    ${companyNameEn ? `<div class="company-name-en">${escapeHtml(companyNameEn)}</div>` : ''}
                    ${companyAddress ? `<div class="company-address">${escapeHtml(companyAddress)}</div>` : ''}
                    <div class="company-contacts">
                      ${companyPhone ? `<span>โทร: ${escapeHtml(companyPhone)}</span>` : ''}
                      ${companyFax ? `<span>แฟกซ์: ${escapeHtml(companyFax)}</span>` : ''}
                      ${companyEmail ? `<span>อีเมล: ${escapeHtml(companyEmail)}</span>` : ''}
                    </div>
                    ${taxId ? `<div class="company-tax">เลขประจำตัวผู้เสียภาษี: ${escapeHtml(taxId)}</div>` : ''}
                  </div>
                </div>
                <div class="doc-title-block">
                  <div class="doc-title">ใบเสนอราคา</div>
                  <div class="doc-title-sub">Quotation</div>
                  <div class="doc-meta">
                    <div>เลขที่: ${escapeHtml(detail.quotation_number || '')}</div>
                    <div>วันที่ออก: ${escapeHtml(detail.issue_date || '')}</div>
                    <div>ใช้ได้ถึง: ${escapeHtml(detail.valid_until || '')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="panel grid">
              <div>
                <div class="label">ลูกค้า</div>
                <div class="value">${escapeHtml(customerName || '-')}</div>
                ${customerEmail ? `<div class="sub muted">${escapeHtml(customerEmail)}</div>` : ''}
              </div>
              <div>
                <div class="label">สถานะ</div>
                <div class="value"><span class="status-badge status-${escapeHtml(detail.status || '')}">${escapeHtml(statusLabel)}</span></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px;" class="center">#</th>
                  <th>รายการ</th>
                  <th style="width: 70px;" class="center">หน่วย</th>
                  <th style="width: 90px;" class="right">จำนวน</th>
                  <th style="width: 120px;" class="right">ราคาต่อหน่วย</th>
                  <th style="width: 120px;" class="right">รวม</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows || '<tr><td class="cell" colspan="6">ไม่มีรายการ</td></tr>'}
              </tbody>
            </table>

            <div class="panel totals">
              <div class="totals-row"><span>รวมก่อนหักส่วนลด</span><span>${totalAmountDetail.toLocaleString('th-TH')} ${currencySymbol}</span></div>
              ${discountDetail > 0 ? `<div class="totals-row"><span>ส่วนลด</span><span>- ${discountDetail.toLocaleString('th-TH')} ${currencySymbol}</span></div>` : ''}
              ${taxDetail > 0 ? (() => {
                const base = totalAmountDetail - discountDetail;
                const rate = base > 0 ? Math.round(taxDetail / base * 100 * 10) / 10 : 0;
                return `<div class="totals-row"><span>VAT${rate > 0 ? ` ${rate}%` : ''}</span><span>${taxDetail.toLocaleString('th-TH')} ${currencySymbol}</span></div>`;
              })() : ''}
              <div class="totals-row total"><span>ยอดรวมสุทธิ</span><span>${grandTotalDetail.toLocaleString('th-TH')} ${currencySymbol}</span></div>
            </div>

            <div class="panel grid">
              <div>
                <div class="label">เงื่อนไขการชำระเงิน</div>
                <div class="note">${escapeHtml(detail.payment_terms || '-')}</div>
              </div>
              <div>
                <div class="label">ข้อมูลบัญชี</div>
                <div class="note">
                  ${bankName ? `ธนาคาร: ${escapeHtml(bankName)}<br/>` : ''}
                  ${bankBranch ? `สาขา: ${escapeHtml(bankBranch)}<br/>` : ''}
                  ${bankAccountName ? `ชื่อบัญชี: ${escapeHtml(bankAccountName)}<br/>` : ''}
                  ${bankAccountNumber ? `เลขที่บัญชี: ${escapeHtml(bankAccountNumber)}` : 'ยังไม่มีเลขที่บัญชี'}
                </div>
              </div>
            </div>

            ${detail.notes ? `<div class="panel"><div class="label">หมายเหตุ</div><div class="note">${escapeHtml(detail.notes)}</div></div>` : ''}

            <div class="footer-note">
              เอกสารนี้ออกโดยระบบ FlowStack — ${escapeHtml(companyName || '')} | เลขที่ ${escapeHtml(detail.quotation_number || '')}
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=900,height=720');
      if (!printWindow) {
        toast({ title: 'ไม่สามารถเปิดหน้าพิมพ์ได้', variant: 'destructive' });
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onafterprint = () => printWindow.close();
      printWindow.print();
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setPrintLoadingId(null);
    }
  };

  const handleDownloadPdf = async (quotation: QuotationSummary) => {
    await handlePrint(quotation);
  };

  const handleOpenEmail = async (quotation: QuotationSummary) => {
    setEmailTarget(quotation);
    // Pre-fill customer email if available
    const detail = await apiFetch<QuotationSummary & { items?: DbQuotationItem[] }>(`/quotations.php?id=${quotation.id}`);
    setEmailTo(detail.customer_email || '');
    setEmailSubject(`ใบเสนอราคา ${detail.quotation_number} — ${detail.company_name}`);
    setEmailNote('');
    setEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailTarget || !emailTo.trim()) {
      toast({ title: 'กรุณาระบุอีเมลผู้รับ', variant: 'destructive' });
      return;
    }
    setEmailSending(true);
    try {
      const detail = await apiFetch<QuotationSummary & { items?: DbQuotationItem[] }>(`/quotations.php?id=${emailTarget.id}`);
      const items = detail.items || [];
      const currencySymbol = companySettings?.currency_symbol || '฿';
      const statusLabel = QUOTATION_STATUS_LABELS[detail.status] || detail.status || '';

      const itemsRows = items.map((item, index) => {
        const qty = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const totalPrice = Number(item.total_price || 0);
        return `
          <tr>
            <td style="text-align:center;padding:8px;border-bottom:1px solid #f3f4f6">${index + 1}</td>
            <td style="padding:8px;border-bottom:1px solid #f3f4f6">
              <strong>${escapeHtml(item.item_name || '')}</strong>
              ${item.description ? `<br><span style="font-size:12px;color:#6b7280">${escapeHtml(item.description)}</span>` : ''}
            </td>
            <td style="text-align:center;padding:8px;border-bottom:1px solid #f3f4f6">${escapeHtml(String(item.unit || ''))}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${qty.toLocaleString('th-TH')}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${unitPrice.toLocaleString('th-TH')}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #f3f4f6">${totalPrice.toLocaleString('th-TH')}</td>
          </tr>
        `;
      }).join('');

      const htmlBody = `
        <div style="max-width:700px;margin:0 auto;font-family:'Prompt','Tahoma',sans-serif;color:#1f2937">
          <h2 style="margin:0 0 4px">ใบเสนอราคา ${escapeHtml(detail.quotation_number || '')}</h2>
          <p style="margin:0 0 16px;color:#6b7280;font-size:13px">
            บริษัท ${escapeHtml(detail.company_name || '')} &mdash;
            วันที่ ${escapeHtml(detail.issue_date || '')} &mdash;
            ใช้ได้ถึง ${escapeHtml(detail.valid_until || '')}
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb">#</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #e5e7eb">รายการ</th>
                <th style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb">หน่วย</th>
                <th style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb">จำนวน</th>
                <th style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb">ราคา/หน่วย</th>
                <th style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb">รวม</th>
              </tr>
            </thead>
            <tbody>${itemsRows || '<tr><td colspan="6" style="padding:8px">ไม่มีรายการ</td></tr>'}</tbody>
          </table>

          <div style="margin-top:16px;text-align:right;font-size:14px">
            <p style="margin:4px 0">รวมก่อนหักส่วนลด: <strong>${Number(detail.total_amount || 0).toLocaleString('th-TH')} ${currencySymbol}</strong></p>
            ${Number(detail.discount || 0) > 0 ? `<p style="margin:4px 0">ส่วนลด: <strong>- ${Number(detail.discount || 0).toLocaleString('th-TH')} ${currencySymbol}</strong></p>` : ''}
            ${Number(detail.tax || 0) > 0 ? `<p style="margin:4px 0">VAT: <strong>${Number(detail.tax || 0).toLocaleString('th-TH')} ${currencySymbol}</strong></p>` : ''}
            <p style="margin:8px 0;font-size:16px;border-top:1px solid #e5e7eb;padding-top:8px">ยอดรวมสุทธิ: <strong>${Number(detail.grand_total || 0).toLocaleString('th-TH')} ${currencySymbol}</strong></p>
          </div>

          ${detail.payment_terms ? `<p style="margin:16px 0 4px;font-size:12px;color:#6b7280">เงื่อนไข: ${escapeHtml(detail.payment_terms)}</p>` : ''}
          <p style="margin:4px 0;font-size:12px;color:#6b7280">สถานะ: ${escapeHtml(statusLabel)}</p>
        </div>
      `;

      await apiFetch('/report-email.php', {
        method: 'POST',
        body: JSON.stringify({ to: emailTo.trim(), subject: emailSubject, html_body: htmlBody, note: emailNote }),
      });
      toast({ title: 'ส่งอีเมลสำเร็จ' });
      setEmailOpen(false);
      setEmailTarget(null);
    } catch (e: any) {
      toast({ title: 'ส่งอีเมลไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally { setEmailSending(false); }
  };

  const filteredCustomers = editCompanyId
    ? customers.filter((customer: any) => customer.company_id === editCompanyId)
    : [];

  // Calculate statistics — all counts from filteredQuotations (respects date filter)
  const stats = {
    total: filteredQuotations.length,
    draft: filteredQuotations.filter(q => q.status === 'draft').length,
    sent: filteredQuotations.filter(q => q.status === 'sent').length,
    approved: filteredQuotations.filter(q => q.status === 'approved').length,
    totalValue: filteredQuotations
      .filter(q => q.status === 'approved')
      .reduce((sum, q) => sum + Number(q.grand_total || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell
      breadcrumbs={[{ label: 'ใบเสนอราคา', isCurrent: true }]}
      title="ใบเสนอราคา"
      description="จัดการใบเสนอราคาทั้งหมด"
      actions={<><CreateQuotationDialog
initialOpen={isNewQuotation || !!opportunityIdFromUrl} 
initialOpportunityId={opportunityIdFromUrl} 
/></>}
    >

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            ผลลัพธ์ {filteredQuotations.length} ใบเสนอราคา
          </span>
          <Button
            variant="outline"
            size="sm"
            className="sm:hidden gap-2"
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
          >
            <Filter className="h-4 w-4" />
            ตัวกรอง
          </Button>
        </div>
        <div className="hidden sm:flex gap-2 items-center flex-wrap">
          {filtersContent}
        </div>
        {showFiltersMobile && (
          <div className="sm:hidden flex flex-wrap items-center gap-2 pt-1 border-t">
            {filtersContent}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ทั้งหมด</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">ใบเสนอราคา</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">แบบร่าง</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.draft / stats.total) * 100) : 0}% ของทั้งหมด
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ส่งแล้ว</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}% ของทั้งหมด
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">อนุมัติ</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% ของทั้งหมด
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">มูลค่าที่อนุมัติ</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-green-600">
                {stats.totalValue.toLocaleString('th-TH')} ฿
              </div>
              <p className="text-xs text-muted-foreground">
                มูลค่ารวม
              </p>
            </CardContent>
          </Card>
        </div>

      {/* Quotations List */}
      <div className="space-y-4">
        {filteredQuotations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">ยังไม่มีใบเสนอราคาในระบบ</p>
              <p className="text-sm text-muted-foreground mb-4">
                คลิกปุ่ม "สร้างใบเสนอราคา" เพื่อเริ่มต้น
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {quotations.map((quotation) => {
              const statusConfig = STATUS_CONFIG[quotation.status];
              const StatusIcon = statusConfig.icon;

              return (
                <Card key={quotation.quotation_id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {quotation.quotation_number}
                          <Badge variant={statusConfig.variant}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {quotation.company_name}
                        </CardDescription>
                        {quotation.customer_name && (
                          <p className="text-sm text-muted-foreground mt-1">
                            👤 {quotation.customer_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePrint(quotation)}
                          disabled={printLoadingId === quotation.quotation_id}
                          title="พิมพ์ใบเสนอราคา"
                        >
                          {printLoadingId === quotation.quotation_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadPdf(quotation)}
                          disabled={printLoadingId === quotation.quotation_id}
                          title="ดาวน์โหลด PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEmail(quotation)}
                          title="ส่งทางอีเมล"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditQuotation(quotation)}
                          title="แก้ไขใบเสนอราคา"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {quotation.opportunity_name && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {quotation.opportunity_name}
                        </Badge>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">วันที่ออก</p>
                        <p className="font-medium">
                          {new Date(quotation.issue_date).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ใช้ได้ถึง</p>
                        <p className="font-medium">
                          {new Date(quotation.valid_until).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">ยอดรวมสุทธิ</span>
                        <span className="text-lg font-bold text-primary">
                          {quotation.grand_total.toLocaleString('th-TH')} ฿
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{quotation.item_count || 0} รายการ</span>
                      <span>โดย {quotation.created_by_name}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขใบเสนอราคา</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {isEditLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลดข้อมูลใบเสนอราคา...
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>บริษัท *</Label>
                <Select value={editCompanyId} onValueChange={setEditCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกบริษัท" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        ไม่พบบริษัท
                      </SelectItem>
                    ) : (
                      companies.map((company: any) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ผู้ติดต่อ</Label>
                <Select value={editCustomerId} onValueChange={setEditCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={editCompanyId ? 'เลือกผู้ติดต่อ' : 'เลือกบริษัทก่อน'} />
                  </SelectTrigger>
                  <SelectContent>
                    {editCompanyId === '' ? (
                      <SelectItem value="empty" disabled>
                        เลือกบริษัทก่อน
                      </SelectItem>
                    ) : (
                      <>
                        <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                        {filteredCustomers.map((customer: any) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.first_name} {customer.last_name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>หัวข้อ / เรื่อง</Label>
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="เช่น ใบเสนอราคาระบบ ERP สำหรับโรงงาน"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>เลขที่ใบเสนอราคา *</Label>
                <Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} required />
              </div>
              <div>
                <Label>โอกาสการขาย</Label>
                <Select value={editOpportunityId} onValueChange={setEditOpportunityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกโอกาสการขาย" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ไม่ระบุ</SelectItem>
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
              <div>
                <Label>วันที่ออก</Label>
                <Input type="date" value={editIssueDate} onChange={(e) => setEditIssueDate(e.target.value)} required />
              </div>
              <div>
                <Label>ใช้ได้ถึงวันที่ *</Label>
                <Input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)} required />
              </div>
              <div>
                <Label>สถานะ</Label>
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as QuotationStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">แบบร่าง</SelectItem>
                    <SelectItem value="sent">ส่งแล้ว</SelectItem>
                    <SelectItem value="approved">อนุมัติ</SelectItem>
                    <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                    <SelectItem value="expired">หมดอายุ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">รายการสินค้า/บริการ</div>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                  เพิ่มรายการ
                </Button>
              </div>

              {editItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
              ) : (
                editItems.map((item, index) => (
                  <div key={item.id} className="space-y-3 border rounded-md p-3">
                    <div>
                      <Label>รายการ</Label>
                      <Input
                        value={item.item_name}
                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <Label>จำนวน</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value || 0))}
                        />
                      </div>
                      <div>
                        <Label>หน่วย</Label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>ราคาต่อหน่วย</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value || 0))}
                        />
                      </div>
                      <div>
                        <Label>รวม</Label>
                        <Input value={Number(item.total_price || 0).toLocaleString('th-TH')} readOnly />
                      </div>
                    </div>
                    <div>
                      <Label>รายละเอียด</Label>
                      <Textarea
                        value={item.description || ''}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive gap-2"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                        ลบรายการ
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>ส่วนลด (฿)</Label>
                <Input type="number" min="0" step="0.01" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
              </div>
              <div>
                <Label>VAT (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={editTaxRate}
                    onChange={(e) => setEditTaxRate(Number(e.target.value) || 0)}
                    className="text-right"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    = {taxValue.toLocaleString('th-TH')} ฿
                  </span>
                </div>
              </div>
              <div>
                <Label>เลขที่บัญชี</Label>
                <Input value={companySettings?.bank_account_number || ''} placeholder="ยังไม่ได้ตั้งค่า" readOnly />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>เงื่อนไขการชำระเงิน</Label>
                <Textarea value={editPaymentTerms} onChange={(e) => setEditPaymentTerms(e.target.value)} />
              </div>
              <div>
                <Label>หมายเหตุ</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">รวมก่อนหักส่วนลด</span>
                <span className="font-medium">{formatBaht(totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ส่วนลด</span>
                <span className="font-medium">- {formatBaht(discountValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VAT {editTaxRate > 0 ? `${editTaxRate}%` : ''}</span>
                <span className="font-medium">{formatBaht(taxValue)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold border-t pt-2">
                <span>ยอดรวมสุทธิ</span>
                <span>{formatBaht(grandTotal)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isEditLoading || updateQuotation.isPending || !editCompanyId}>
                {updateQuotation.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={(v) => { if (!v) { setEmailOpen(false); setEmailTarget(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ส่งใบเสนอราคาทางอีเมล</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ถึง (อีเมล)</Label>
              <Input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>หัวข้อ</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>ข้อความเพิ่มเติม (ไม่บังคับ)</Label>
              <Textarea
                value={emailNote}
                onChange={(e) => setEmailNote(e.target.value)}
                rows={3}
                className="mt-1"
                placeholder="ข้อความแนบท้ายอีเมล..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmailOpen(false); setEmailTarget(null); }}>
              ยกเลิก
            </Button>
            <Button onClick={handleSendEmail} disabled={emailSending || !emailTo.trim()}>
              {emailSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
              ส่งอีเมล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
