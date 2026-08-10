import { useState, useMemo, useEffect } from 'react';
import { useCompanies, useCustomers, useProjects, useOpportunities, useUpdateCompany, useUpdateCustomer, useDeleteCompany, useDeleteCustomer, useCompaniesPaginated, useCustomersPaginated } from '@/hooks/useProjectData';
import { CreateCompanyDialog } from '@/components/CreateCompanyDialog';
import { CreateCustomerDialog } from '@/components/CreateCustomerDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import RowsPerPageSelector from '@/components/RowsPerPageSelector';
import PageShell from '@/components/PageShell';
import BusinessCardScanDialog from '@/components/BusinessCardScanDialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import CustomerActivityTimeline from '@/components/CustomerActivityTimeline';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Users, Mail, Phone, MapPin, Globe, FileText, Loader2, BarChart3, TrendingUp, Target, DollarSign, Pencil, Trash2, Search, X, Activity, CheckCircle2, AlertCircle, LayoutGrid, List, CalendarRange, Filter, Route } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import CustomerJourneySheet from '@/components/CustomerJourneySheet';
import type { CompanyEnrichResponse } from '@/types/project';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { endOfYear, format, parseISO, startOfYear } from 'date-fns';

const TIER_LABELS: Record<string, string> = {
  partner: 'Partner',
  high_value: 'High-Value',
  high_potential: 'High Potential',
  transactional: 'Transactional',
  low_volume: 'Low Volume',
};
const TIER_COLORS: Record<string, string> = {
  partner: 'bg-purple-100 text-purple-700 border-purple-200',
  high_value: 'bg-blue-100 text-blue-700 border-blue-200',
  high_potential: 'bg-amber-100 text-amber-700 border-amber-200',
  transactional: 'bg-gray-100 text-gray-600 border-gray-200',
  low_volume: 'bg-slate-100 text-slate-500 border-slate-200',
};

const COMPANY_TYPE_LABELS: Record<string, string> = {
  customer: 'ลูกค้า',
  partner: 'คู่ค้า',
  manufacturer: 'ผู้ผลิต',
};
const COMPANY_TYPE_COLORS: Record<string, string> = {
  customer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  partner: 'bg-sky-100 text-sky-700 border-sky-200',
  manufacturer: 'bg-orange-100 text-orange-700 border-orange-200',
};
const COMPANY_TYPES: { value: string; label: string }[] = [
  { value: 'customer', label: 'ลูกค้า' },
  { value: 'partner', label: 'คู่ค้า' },
  { value: 'manufacturer', label: 'ผู้ผลิต' },
];

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

function PaginationBar({ page, pages, loading, onChange }: {
  page: number; pages: number; loading?: boolean; onChange: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4 pb-2">
      <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onChange(page - 1)}>
        ← ก่อนหน้า
      </Button>
      <span className="text-sm text-muted-foreground">หน้า {page} / {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => onChange(page + 1)}>
        ถัดไป →
      </Button>
    </div>
  );
}

export default function CompaniesPage() {
  const { user } = useAuth();
  const isAdmin = Number(user?.is_admin) === 1;
  
  // Tab state
  const [activeTab, setActiveTab] = useState('companies');

  // Search + pagination state (declared early for hook dependencies)
  const [companySearch, setCompanySearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [companyPage, setCompanyPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [companyPerPage, setCompanyPerPage] = useState(12);
  const [customerPerPage, setCustomerPerPage] = useState(12);

  // Reset page to 1 when search or per_page changes
  useEffect(() => { setCompanyPage(1); }, [companySearch, companyPerPage]);
  useEffect(() => { setCustomerPage(1); }, [customerSearch, customerPerPage]);

  // Paginated hooks for card grids (server-side, fast initial load)
  const { data: companiesPaged, isLoading: companiesPagedLoading } = useCompaniesPaginated({
    page: companyPage, perPage: companyPerPage, search: companySearch,
  });
  const { data: customersPaged, isLoading: customersPagedLoading } = useCustomersPaginated({
    page: customerPage, perPage: customerPerPage, search: customerSearch,
  });

  // Full companies list — only needed for analytics charts + edit customer dropdown
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  // Projects & opportunities — only loaded when analytics tab is active
  const { data: projects = [], isLoading: projectsLoading } = useProjects(activeTab === 'analytics');
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useOpportunities(undefined, activeTab === 'analytics');
  const updateCompany = useUpdateCompany();
  const updateCustomer = useUpdateCustomer();
  const deleteCompany = useDeleteCompany();
  const deleteCustomer = useDeleteCustomer();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Year and date filter
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));

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
    setBusinessTypeFilter('__all__');
    setCompanyTypeFilter('__all__');
    setShowDateRange(false);
  };

  // Filter projects by date
  const filteredProjects = useMemo(() => {
    if (!startDate && !endDate) return projects;
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;
    return projects.filter((project: any) => {
      const projectStart = project.start_date ? parseISO(project.start_date) : null;
      const projectEnd = project.end_date ? parseISO(project.end_date) : null;
      if (!projectStart || !projectEnd) return false;
      if (filterStart && projectEnd < filterStart) return false;
      if (filterEnd && projectStart > filterEnd) return false;
      return true;
    });
  }, [projects, startDate, endDate]);

  // Filter opportunities by date
  const filteredOpportunities = useMemo(() => {
    if (!startDate && !endDate) return opportunities;
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;
    return opportunities.filter((opp: any) => {
      const closeDate = opp.expected_close_date ? parseISO(opp.expected_close_date) : null;
      if (!closeDate) return false;
      if (filterStart && closeDate < filterStart) return false;
      if (filterEnd && closeDate > filterEnd) return false;
      return true;
    });
  }, [opportunities, startDate, endDate]);

  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [activityCustomerId, setActivityCustomerId] = useState<string>('');
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyBusinessType, setCompanyBusinessType] = useState('');
  const [companyType, setCompanyType] = useState('customer');
  const [companySize, setCompanySize] = useState('');
  const [companyFoundedYear, setCompanyFoundedYear] = useState('');
  const [companyIsActive, setCompanyIsActive] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState<{ text: string; ok: boolean } | null>(null);

  // View mode
  const [companyViewMode, setCompanyViewMode] = useState<'grid' | 'list'>('list');
  const [customerViewMode, setCustomerViewMode] = useState<'grid' | 'list'>('list');
  const [showDateRange, setShowDateRange] = useState(false);
  const [journeyCompany, setJourneyCompany] = useState<{ id: string; name: string } | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [businessTypeFilter, setBusinessTypeFilter] = useState('__all__');
  const [companyTypeFilter, setCompanyTypeFilter] = useState('__all__');

  const filteredCompaniesData = useMemo(() => {
    let data = companiesPaged?.data ?? [];
    if (businessTypeFilter !== '__all__') data = data.filter((c: any) => c.business_type === businessTypeFilter);
    if (companyTypeFilter !== '__all__') data = data.filter((c: any) => (c.company_type || 'customer') === companyTypeFilter);
    return data;
  }, [companiesPaged?.data, businessTypeFilter, companyTypeFilter]);

  // Bulk select + enrich
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const [bulkEnrichProgress, setBulkEnrichProgress] = useState<{ done: number; total: number } | null>(null);

  const toggleCompanySelect = (id: string) =>
    setSelectedCompanyIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAllPage = () => {
    const pageIds = filteredCompaniesData.map((c: any) => c.id);
    const allSelected = pageIds.every((id) => selectedCompanyIds.has(id));
    if (allSelected) {
      setSelectedCompanyIds(prev => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedCompanyIds(prev => { const next = new Set(prev); pageIds.forEach(id => next.add(id)); return next; });
    }
  };

  const handleBulkEnrich = async () => {
    const ids = Array.from(selectedCompanyIds);
    if (!ids.length) return;
    setIsBulkEnriching(true);
    setBulkEnrichProgress({ done: 0, total: ids.length });
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const company = filteredCompaniesData.find((c: any) => c.id === id);
      if (!company) { setBulkEnrichProgress({ done: i + 1, total: ids.length }); continue; }
      try {
        const data = await apiFetch<CompanyEnrichResponse>('/company-enrich.php', {
          method: 'POST',
          body: JSON.stringify({ name: company.name, website: company.website, tax_id: company.tax_id }),
        });
        const updates: Record<string, any> = {};
        if (!company.description  && data.description)    updates.description   = data.description;
        if (!company.website      && data.website)        updates.website       = data.website;
        if (!company.phone        && data.phone)          updates.phone         = data.phone;
        if (!company.email        && data.email)          updates.email         = data.email;
        if (!company.address      && data.address)        updates.address       = data.address;
        if (!company.tax_id       && data.tax_id)         updates.tax_id        = data.tax_id;
        if (!company.business_type && data.business_type) updates.business_type = data.business_type;
        if (!company.company_size  && data.company_size)  updates.company_size  = data.company_size;
        if (!company.founded_year  && data.founded_year)  updates.founded_year  = data.founded_year;
        if (Object.keys(updates).length > 0) {
          await updateCompany.mutateAsync({ id, updates });
          successCount++;
        }
      } catch (_) { /* skip failed */ }
      setBulkEnrichProgress({ done: i + 1, total: ids.length });
    }
    setIsBulkEnriching(false);
    setBulkEnrichProgress(null);
    setSelectedCompanyIds(new Set());
    toast({ title: `อัพเดทข้อมูลสำเร็จ ${successCount} บริษัท` });
  };

  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerCompanyId, setCustomerCompanyId] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPosition, setCustomerPosition] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [customerIsPrimary, setCustomerIsPrimary] = useState(false);
  const [customerIsActive, setCustomerIsActive] = useState(true);

  const openEditCompany = (company: any) => {
    setEditingCompanyId(company.id);
    setCompanyName(company.name || '');
    setCompanyDescription(company.description || '');
    setCompanyAddress(company.address || '');
    setCompanyPhone(company.phone || '');
    setCompanyEmail(company.email || '');
    setCompanyWebsite(company.website || '');
    setCompanyTaxId(company.tax_id || '');
    setCompanyBusinessType(company.business_type || '');
    setCompanyType(company.company_type || 'customer');
    setCompanySize(company.company_size || '');
    setCompanyFoundedYear(company.founded_year ? String(company.founded_year) : '');
    setCompanyIsActive(Boolean(Number(company.is_active)));
    setEnrichNote(null);
    setIsCompanyDialogOpen(true);
  };

  const openEditCustomer = (customer: any) => {
    setEditingCustomerId(customer.id);
    setCustomerCompanyId(customer.company_id || '');
    setCustomerFirstName(customer.first_name || '');
    setCustomerLastName(customer.last_name || '');
    setCustomerEmail(customer.email || '');
    setCustomerPhone(customer.phone || '');
    setCustomerPosition(customer.position || '');
    setCustomerNotes(customer.notes || '');
    setCustomerIsPrimary(Boolean(Number(customer.is_primary_contact)));
    setCustomerIsActive(Boolean(Number(customer.is_active)));
    setIsCustomerDialogOpen(true);
  };

  const handleEnrichCompany = async () => {
    if (!companyName.trim()) return;
    setEnriching(true);
    setEnrichNote(null);
    try {
      const data = await apiFetch<CompanyEnrichResponse>('/company-enrich.php', {
        method: 'POST',
        body: JSON.stringify({ name: companyName, website: companyWebsite, tax_id: companyTaxId }),
      });
      // Fill only empty fields
      if (!companyDescription && data.description) setCompanyDescription(data.description);
      if (!companyWebsite    && data.website)     setCompanyWebsite(data.website);
      if (!companyPhone      && data.phone)       setCompanyPhone(data.phone);
      if (!companyEmail      && data.email)       setCompanyEmail(data.email);
      if (!companyAddress    && data.address)     setCompanyAddress(data.address);
      if (!companyTaxId      && data.tax_id)      setCompanyTaxId(data.tax_id);
      if (!companyBusinessType && data.business_type) setCompanyBusinessType(data.business_type);
      if (!companySize       && data.company_size) setCompanySize(data.company_size);
      if (!companyFoundedYear && data.founded_year) setCompanyFoundedYear(String(data.founded_year));
      const conf = data.confidence === 'high' ? 'สูง' : data.confidence === 'medium' ? 'ปานกลาง' : 'ต่ำ';
      setEnrichNote({ text: `${data.source_note} · ความมั่นใจ: ${conf}`, ok: true });
    } catch (err: any) {
      setEnrichNote({ text: err?.message ?? 'ค้นหาข้อมูลไม่สำเร็จ', ok: false });
    } finally {
      setEnriching(false);
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompanyId) return;
    try {
      await updateCompany.mutateAsync({
        id: editingCompanyId,
        updates: {
          name: companyName,
          description: companyDescription,
          address: companyAddress,
          phone: companyPhone,
          email: companyEmail,
          website: companyWebsite,
          tax_id: companyTaxId,
          business_type: companyBusinessType,
          company_type: companyType,
          company_size: companySize,
          founded_year: companyFoundedYear ? parseInt(companyFoundedYear) : null,
          is_active: companyIsActive,
        },
      });
      toast({ title: 'แก้ไขบริษัทสำเร็จ' });
      setIsCompanyDialogOpen(false);
      setEditingCompanyId(null);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerId) return;
    try {
      await updateCustomer.mutateAsync({
        id: editingCustomerId,
        updates: {
          company_id: customerCompanyId,
          first_name: customerFirstName,
          last_name: customerLastName,
          email: customerEmail,
          phone: customerPhone,
          position: customerPosition,
          notes: customerNotes,
          is_primary_contact: customerIsPrimary,
          is_active: customerIsActive,
        },
      });
      toast({ title: 'แก้ไขผู้ติดต่อสำเร็จ' });
      setIsCustomerDialogOpen(false);
      setEditingCustomerId(null);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteCompany = async (company: any) => {
    const ok = await confirm({ title: 'ลบบริษัท', description: `คุณต้องการลบบริษัท "${company.name}" หรือไม่?`, variant: 'destructive' });
    if (!ok) {
      return;
    }
    try {
      await deleteCompany.mutateAsync(company.id);
      toast({ title: 'ลบบริษัทสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteCustomer = async (customer: any) => {
    const ok2 = await confirm({ title: 'ลบผู้ติดต่อ', description: `คุณต้องการลบผู้ติดต่อ "${customer.first_name} ${customer.last_name}" หรือไม่?`, variant: 'destructive' });
    if (!ok2) {
      return;
    }
    try {
      await deleteCustomer.mutateAsync(customer.id);
      toast({ title: 'ลบผู้ติดต่อสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // Calculate company analytics
  const companyAnalytics = companies.map(company => {
    const companyProjects = filteredProjects.filter((p: any) => p.company_id === company.id);
    const companyOpportunities = filteredOpportunities.filter((o: any) => o.company_id === company.id);
    const totalValue = companyProjects.reduce((sum: number, p: any) => sum + (p.project_value || 0), 0);
    const oppValue = companyOpportunities.reduce((sum: number, o: any) => sum + (o.value || 0), 0);

    return {
      ...company,
      projectCount: companyProjects.length,
      opportunityCount: companyOpportunities.length,
      totalValue,
      oppValue,
      combinedValue: totalValue + oppValue,
    };
  });

  const topCompaniesByProjects = [...companyAnalytics]
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 10);

  const topCompaniesByValue = [...companyAnalytics]
    .sort((a, b) => b.combinedValue - a.combinedValue)
    .slice(0, 10);

  const totalProjects = filteredProjects.length;
  const totalOpportunities = filteredOpportunities.length;
  const totalProjectValue = filteredProjects.reduce((sum: number, p: any) => sum + (p.project_value || 0), 0);
  const totalOppValue = filteredOpportunities.reduce((sum: number, o: any) => sum + (o.value || 0), 0);

  const filtersContent = (
    <>
      {/* Company type filter (companies tab only) */}
      {activeTab === 'companies' && (
        <Select value={companyTypeFilter} onValueChange={setCompanyTypeFilter}>
          <SelectTrigger className="w-32 h-9 text-sm shrink-0">
            <SelectValue placeholder="ประเภทบริษัท" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">ทุกประเภทบริษัท</SelectItem>
            {COMPANY_TYPES.map((ct) => (
              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Business type filter (companies tab only) */}
      {activeTab === 'companies' && (
        <Select value={businessTypeFilter} onValueChange={setBusinessTypeFilter}>
          <SelectTrigger className="w-44 h-9 text-sm shrink-0">
            <SelectValue placeholder="ประเภทธุรกิจ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">ทุกประเภท</SelectItem>
            {BUSINESS_TYPES.map((bt) => (
              <SelectItem key={bt} value={bt}>{bt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Year */}
      <Select value={yearFilter} onValueChange={handleYearChange}>
        <SelectTrigger className="w-24 sm:w-28 h-9 text-sm shrink-0">
          <SelectValue placeholder="ปี" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกปี</SelectItem>
          {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((year) => (
            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range toggle */}
      <button
        onClick={() => setShowDateRange((v) => !v)}
        className={`relative h-9 w-9 shrink-0 rounded-md border flex items-center justify-center transition-colors ${showDateRange ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:text-foreground hover:bg-accent/20'}`}
        title="กรองช่วงวันที่"
      >
        <CalendarRange className="h-4 w-4" />
        {!showDateRange && (startDate || endDate) && (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </button>

      {/* Reset */}
      <button
        onClick={resetFilters}
        className="h-9 w-9 shrink-0 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
        title="ล้างตัวกรอง"
      >
        <X className="h-4 w-4" />
      </button>

      {/* View toggle */}
      {(activeTab === 'companies' || activeTab === 'customers') && (
        <div className="flex border rounded-md overflow-hidden shrink-0">
          <button
            onClick={() => activeTab === 'companies' ? setCompanyViewMode('grid') : setCustomerViewMode('grid')}
            className={`px-2.5 py-2 ${(activeTab === 'companies' ? companyViewMode : customerViewMode) === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => activeTab === 'companies' ? setCompanyViewMode('list') : setCustomerViewMode('list')}
            className={`px-2.5 py-2 ${(activeTab === 'companies' ? companyViewMode : customerViewMode) === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="List View"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Count */}
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {activeTab === 'companies' && `${companiesPaged?.total ?? 0} บริษัท`}
        {activeTab === 'customers' && `${customersPaged?.total ?? 0} ผู้ติดต่อ`}
        {activeTab === 'analytics' && `${totalProjects} โปรเจกต์, ${totalOpportunities} โอกาส`}
      </span>
    </>
  );

  return (
    <PageShell
      breadcrumbs={[{ label: 'จัดการบริษัท', isCurrent: true }]}
      title="จัดการบริษัทและลูกค้า"
      description="บริหารข้อมูลบริษัทลูกค้าและผู้ติดต่อ"
      actions={<><BusinessCardScanDialog /><CreateCompanyDialog /><CreateCustomerDialog /></>}
    >

      {/* Filters */}
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex gap-2 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                activeTab === 'companies'
                  ? 'ค้นหาบริษัท...'
                  : activeTab === 'customers'
                    ? 'ค้นหาผู้ติดต่อ...'
                  : 'ค้นหา...'
              }
              value={activeTab === 'companies' ? companySearch : customerSearch}
              onChange={(e) =>
                activeTab === 'companies'
                  ? setCompanySearch(e.target.value)
                  : setCustomerSearch(e.target.value)
              }
              className="pl-9 pr-8 h-9"
            />
            {(activeTab === 'companies' ? companySearch : customerSearch) && (
              <button
                onClick={() => activeTab === 'companies' ? setCompanySearch('') : setCustomerSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFiltersMobile(v => !v)}
            className={`h-9 w-9 shrink-0 rounded-md border flex items-center justify-center transition-colors sm:hidden ${showFiltersMobile ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
            title="ตัวกรอง"
          >
            <Filter className="h-4 w-4" />
          </button>

          {/* Desktop filters (always visible on sm+) */}
          <div className="hidden sm:flex gap-2 items-center flex-wrap">
            {filtersContent}
          </div>
        </div>

        {/* Mobile filters (collapsible) */}
        {showFiltersMobile && (
          <div className="sm:hidden flex gap-2 items-center flex-wrap pt-1 border-t">
            {filtersContent}
          </div>
        )}

        {/* Date range (collapsible) */}
        {showDateRange && (
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-foreground mb-1 block">วันที่เริ่ม</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-foreground mb-1 block">วันที่สิ้นสุด</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="companies" className="gap-1 sm:gap-2 px-2 sm:px-3">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">บริษัท <span className="hidden sm:inline">({companiesPaged?.total ?? companies.length})</span></span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-1 sm:gap-2 px-2 sm:px-3">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">ผู้ติดต่อ <span className="hidden sm:inline">({customersPaged?.total ?? 0})</span></span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1 sm:gap-2 px-2 sm:px-3">
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">วิเคราะห์</span>
            <span className="hidden sm:inline">การวิเคราะห์</span>
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          {companiesLoading || projectsLoading || opportunitiesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium">บริษัททั้งหมด</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{companies.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {customersPaged?.total ?? 0} ผู้ติดต่อ
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium">โปรเจกต์รวม</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalProjects}</div>
                    <p className="text-xs text-muted-foreground">
                      ทุกบริษัท
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium">โอกาสการขาย</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalOpportunities}</div>
                    <p className="text-xs text-muted-foreground">
                      ทุกบริษัท
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium">มูลค่ารวม</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round((totalProjectValue + totalOppValue) / 1000000)} ล้าน ฿
                    </div>
                    <p className="text-xs text-muted-foreground">
                      โปรเจกต์ + โอกาส
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Companies by Projects */}
                <Card>
                  <CardHeader>
                    <CardTitle>บริษัทที่มีโปรเจกต์มากสุด</CardTitle>
                    <CardDescription>Top 10 บริษัทตามจำนวนโปรเจกต์</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={topCompaniesByProjects}
                        layout="vertical"
                        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={90}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip />
                        <Bar dataKey="projectCount" fill="#3b82f6" name="โปรเจกต์" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Companies by Value */}
                <Card>
                  <CardHeader>
                    <CardTitle>บริษัทที่มีมูลค่าสูงสุด</CardTitle>
                    <CardDescription>Top 10 บริษัทตามมูลค่ารวม</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={topCompaniesByValue}
                        layout="vertical"
                        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number"
                          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={90}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value: number) => `${value.toLocaleString('th-TH')} ฿`}
                        />
                        <Bar dataKey="combinedValue" fill="#10b981" name="มูลค่ารวม" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Project Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>การกระจายโปรเจกต์</CardTitle>
                    <CardDescription>จำนวนโปรเจกต์ต่อบริษัท</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={topCompaniesByProjects.slice(0, 6).map((company, idx) => ({
                            name: company.name,
                            value: company.projectCount,
                            color: ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'][idx],
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => 
                            percent > 0 ? `${name.substring(0, 10)}... ${(percent * 100).toFixed(0)}%` : ''
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {topCompaniesByProjects.slice(0, 6).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'][index]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Value Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>การกระจายมูลค่า</CardTitle>
                    <CardDescription>มูลค่ารวมต่อบริษัท</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={topCompaniesByValue.slice(0, 6).map((company, idx) => ({
                            name: company.name,
                            value: company.combinedValue,
                            color: ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'][idx],
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => 
                            percent > 0 ? `${name.substring(0, 10)}... ${(percent * 100).toFixed(0)}%` : ''
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {topCompaniesByValue.slice(0, 6).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'][index]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => `${value.toLocaleString('th-TH')} ฿`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Top Companies Table */}
              <Card>
                <CardHeader>
                  <CardTitle>บริษัทชั้นนำ</CardTitle>
                  <CardDescription>รายละเอียดบริษัทที่มีโปรเจกต์และมูลค่าสูงสุด</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-medium">บริษัท</th>
                          <th className="text-right py-2 px-2 sm:py-3 sm:px-4 font-medium">โปรเจกต์</th>
                          <th className="text-right py-2 px-2 sm:py-3 sm:px-4 font-medium hidden sm:table-cell">โอกาส</th>
                          <th className="text-right py-2 px-2 sm:py-3 sm:px-4 font-medium hidden md:table-cell">มูลค่าโปรเจกต์</th>
                          <th className="text-right py-2 px-2 sm:py-3 sm:px-4 font-medium hidden md:table-cell">มูลค่าโอกาส</th>
                          <th className="text-right py-2 px-2 sm:py-3 sm:px-4 font-medium">รวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCompaniesByValue.slice(0, 10).map((company) => (
                          <tr key={company.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2 sm:py-3 sm:px-4 font-medium truncate max-w-[120px] sm:max-w-none">{company.name}</td>
                            <td className="text-right py-2 px-2 sm:py-3 sm:px-4">{company.projectCount}</td>
                            <td className="text-right py-2 px-2 sm:py-3 sm:px-4 hidden sm:table-cell">{company.opportunityCount}</td>
                            <td className="text-right py-2 px-2 sm:py-3 sm:px-4 hidden md:table-cell">
                              {company.totalValue.toLocaleString('th-TH')} ฿
                            </td>
                            <td className="text-right py-2 px-2 sm:py-3 sm:px-4 hidden md:table-cell">
                              {company.oppValue.toLocaleString('th-TH')} ฿
                            </td>
                            <td className="text-right py-2 px-2 sm:py-3 sm:px-4 font-bold">
                              {company.combinedValue.toLocaleString('th-TH')} ฿
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies">
          {companiesPagedLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div>
              {(companiesPaged?.total ?? 0) === 0 && !companySearch ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">ยังไม่มีบริษัทในระบบ</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      คลิกปุ่ม &quot;เพิ่มบริษัท&quot; เพื่อเริ่มต้น
                    </p>
                  </CardContent>
                </Card>
              ) : filteredCompaniesData.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">ไม่พบบริษัทที่ตรงกับ &quot;{companySearch}&quot;</p>
                  </CardContent>
                </Card>
              ) : (
              <>
              {/* Bulk action bar */}
              {selectedCompanyIds.size > 0 && (
                <div className="flex items-center gap-3 mb-3 p-3 bg-muted rounded-lg border">
                  <Checkbox
                    checked={filteredCompaniesData.every((c) => selectedCompanyIds.has(c.id))}
                    onCheckedChange={toggleSelectAllPage}
                  />
                  <span className="text-sm font-medium">เลือก {selectedCompanyIds.size} บริษัท</span>
                  <Button
                    size="sm"
                    className="gap-1.5 ml-auto"
                    onClick={handleBulkEnrich}
                    disabled={isBulkEnriching}
                  >
                    {isBulkEnriching ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {bulkEnrichProgress ? `${bulkEnrichProgress.done}/${bulkEnrichProgress.total}` : 'กำลังค้นหา...'}</>
                    ) : (
                      <><Globe className="h-3.5 w-3.5" />อัพเดทข้อมูลจากอินเทอร์เน็ต</>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedCompanyIds(new Set())}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {companyViewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filteredCompaniesData.map((company) => (
                  <Card
                    key={company.id}
                    className={`hover:shadow-lg transition-shadow relative ${selectedCompanyIds.has(company.id) ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="absolute top-3 left-3 z-10">
                      <Checkbox
                        checked={selectedCompanyIds.has(company.id)}
                        onCheckedChange={() => toggleCompanySelect(company.id)}
                      />
                    </div>
                    <CardHeader className="pl-9">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{company.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {company.description || 'ไม่มีคำอธิบาย'}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs border ${COMPANY_TYPE_COLORS[company.company_type || 'customer']}`} variant="outline">
                            {COMPANY_TYPE_LABELS[company.company_type || 'customer']}
                          </Badge>
                          {company.tier && (
                            <Badge className={`text-xs border ${TIER_COLORS[company.tier] || 'bg-muted text-muted-foreground'}`} variant="outline">
                              {TIER_LABELS[company.tier] || company.tier}
                            </Badge>
                          )}
                          {Number(company.is_active) ? (
                            <Badge variant="default">ใช้งาน</Badge>
                          ) : (
                            <Badge variant="secondary">ไม่ใช้งาน</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-violet-500 hover:text-violet-600"
                            onClick={() => setJourneyCompany({ id: company.id, name: company.name })}
                            title="ดู Customer Journey"
                          >
                            <Route className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteCompany(company)}
                              title="ลบบริษัท"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditCompany(company)}
                            title="แก้ไขบริษัท"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(company.business_type || company.company_size) && (
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {company.business_type && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              {company.business_type}
                            </Badge>
                          )}
                          {company.company_size && (
                            <Badge variant="outline" className="text-xs font-normal">
                              👥 {company.company_size} คน
                            </Badge>
                          )}
                          {company.founded_year && (
                            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                              ก่อตั้ง {company.founded_year}
                            </Badge>
                          )}
                        </div>
                      )}
                      {company.email && (
                        <div className="flex items-center text-sm">
                          <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                          <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline truncate">
                            {company.email}
                          </a>
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                          <a href={`tel:${company.phone}`} className="hover:text-blue-600">
                            {company.phone}
                          </a>
                        </div>
                      )}
                      {company.website && (
                        <div className="flex items-center text-sm">
                          <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                          <a href={company.website} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate">
                            {company.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                      {company.address && (
                        <div className="flex items-start text-sm">
                          <MapPin className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground line-clamp-2">{company.address}</span>
                        </div>
                      )}
                      {company.tax_id && (
                        <div className="flex items-center text-sm">
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-muted-foreground">เลขภาษี: {company.tax_id}</span>
                        </div>
                      )}
                      <div className="pt-3 border-t mt-3">
                        <span className="text-sm text-muted-foreground">
                          ผู้ติดต่อ: {Number(company.customer_count ?? 0)} คน
                        </span>
                      </div>
                    </CardContent>
                  </Card>
              ))}
              </div>
              ) : (
              <>
                {/* Mobile list cards */}
                <div className="sm:hidden space-y-3">
                  {filteredCompaniesData.map((company) => (
                    <Card
                      key={company.id}
                      className={`relative ${selectedCompanyIds.has(company.id) ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="absolute top-3 left-3 z-10">
                        <Checkbox
                          checked={selectedCompanyIds.has(company.id)}
                          onCheckedChange={() => toggleCompanySelect(company.id)}
                        />
                      </div>
                      <CardContent className="pt-3 pb-3 pl-9">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{company.name}</div>
                            {company.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{company.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-500 hover:text-violet-600"
                              onClick={() => setJourneyCompany({ id: company.id, name: company.name })}
                              title="ดู Customer Journey">
                              <Route className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteCompany(company)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => openEditCompany(company)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge className={`text-xs border ${COMPANY_TYPE_COLORS[company.company_type || 'customer']}`} variant="outline">
                            {COMPANY_TYPE_LABELS[company.company_type || 'customer']}
                          </Badge>
                          {company.tier ? (
                            <Badge className={`text-xs border ${TIER_COLORS[company.tier] || 'bg-muted text-muted-foreground'}`} variant="outline">
                              {TIER_LABELS[company.tier] || company.tier}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-muted/30 text-muted-foreground">ยังไม่จัดระดับ</Badge>
                          )}
                          {Number(company.is_active) ? (
                            <Badge variant="default" className="text-xs">ใช้งาน</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">ไม่ใช้งาน</Badge>
                          )}
                          {company.business_type && (
                            <Badge variant="secondary" className="text-xs font-normal">{company.business_type}</Badge>
                          )}
                          {company.company_size && (
                            <Badge variant="outline" className="text-xs font-normal">👥 {company.company_size} คน</Badge>
                          )}
                          {company.founded_year && (
                            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">ก่อตั้ง {company.founded_year}</Badge>
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          {company.phone && (
                            <div className="flex items-center text-xs gap-1.5">
                              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                              <a href={`tel:${company.phone}`} className="hover:text-blue-600 truncate">{company.phone}</a>
                            </div>
                          )}
                          {company.email && (
                            <div className="flex items-center text-xs gap-1.5">
                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                              <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline truncate">{company.email}</a>
                            </div>
                          )}
                          {company.website && (
                            <div className="flex items-center text-xs gap-1.5">
                              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {company.website.replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                          )}
                          {company.address && (
                            <div className="flex items-start text-xs gap-1.5">
                              <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground line-clamp-2">{company.address}</span>
                            </div>
                          )}
                          {company.tax_id && (
                            <div className="flex items-center text-xs gap-1.5">
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">เลขภาษี: {company.tax_id}</span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground pt-0.5">
                            ผู้ติดต่อ: {Number(company.customer_count ?? 0)} คน
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="w-8 py-2 px-3">
                          <Checkbox
                            checked={filteredCompaniesData.length > 0 && filteredCompaniesData.every((c) => selectedCompanyIds.has(c.id))}
                            onCheckedChange={toggleSelectAllPage}
                          />
                        </th>
                        <th className="text-left py-2 px-3 font-medium">ชื่อบริษัท</th>
                        <th className="text-left py-2 px-3 font-medium">ประเภท</th>
                        <th className="text-left py-2 px-3 font-medium hidden md:table-cell">ระดับ</th>
                        <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">ประเภทธุรกิจ</th>
                        <th className="text-left py-2 px-3 font-medium hidden xl:table-cell">ขนาด</th>
                        <th className="text-left py-2 px-3 font-medium hidden md:table-cell">ติดต่อ</th>
                        <th className="text-left py-2 px-3 font-medium hidden xl:table-cell">เว็บไซต์</th>
                        <th className="text-center py-2 px-3 font-medium">สถานะ</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompaniesData.map((company) => (
                        <tr
                          key={company.id}
                          className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${selectedCompanyIds.has(company.id) ? 'bg-primary/5' : ''}`}
                        >
                          <td className="py-2 px-3">
                            <Checkbox
                              checked={selectedCompanyIds.has(company.id)}
                              onCheckedChange={() => toggleCompanySelect(company.id)}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-medium">{company.name}</div>
                            {company.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{company.description}</div>
                            )}
                            {company.founded_year && (
                              <div className="text-xs text-muted-foreground">ก่อตั้ง {company.founded_year}</div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={`text-xs border ${COMPANY_TYPE_COLORS[company.company_type || 'customer']}`} variant="outline">
                              {COMPANY_TYPE_LABELS[company.company_type || 'customer']}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 hidden md:table-cell">
                            {company.tier ? (
                              <Badge className={`text-xs border ${TIER_COLORS[company.tier] || 'bg-muted text-muted-foreground'}`} variant="outline">
                                {TIER_LABELS[company.tier] || company.tier}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-muted/30 text-muted-foreground">ยังไม่จัดระดับ</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 hidden lg:table-cell">
                            {company.business_type ? (
                              <Badge variant="secondary" className="text-xs font-normal">{company.business_type}</Badge>
                            ) : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="py-2 px-3 hidden xl:table-cell text-muted-foreground">
                            {company.company_size ? `${company.company_size} คน` : '-'}
                          </td>
                          <td className="py-2 px-3 hidden md:table-cell">
                            <div className="space-y-0.5">
                              {company.phone && <div className="text-xs">{company.phone}</div>}
                              {company.email && (
                                <a href={`mailto:${company.email}`} className="text-xs text-blue-600 hover:underline block truncate max-w-[160px]">
                                  {company.email}
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 hidden xl:table-cell">
                            {company.website ? (
                              <a href={company.website} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline truncate max-w-[140px] block">
                                {company.website.replace(/^https?:\/\//, '')}
                              </a>
                            ) : <span className="text-muted-foreground text-xs">-</span>}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {Number(company.is_active) ? (
                              <Badge variant="default" className="text-xs">ใช้งาน</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">ไม่ใช้งาน</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-violet-500 hover:text-violet-600"
                                onClick={() => setJourneyCompany({ id: company.id, name: company.name })}
                                title="ดู Customer Journey"
                              >
                                <Route className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-600"
                                  onClick={() => handleDeleteCompany(company)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditCompany(company)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
              )}
              </>
              )}
              <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
                <RowsPerPageSelector value={companyPerPage} onChange={setCompanyPerPage} />
                <PaginationBar
                  page={companyPage}
                  pages={companiesPaged?.pages ?? 1}
                  loading={companiesPagedLoading}
                  onChange={setCompanyPage}
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* Customers Tab */}

        <TabsContent value="customers">
          {customersPagedLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div>
              {(customersPaged?.total ?? 0) === 0 && !customerSearch ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">ยังไม่มีผู้ติดต่อในระบบ</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      คลิกปุ่ม &quot;เพิ่มผู้ติดต่อ&quot; เพื่อเริ่มต้น
                    </p>
                  </CardContent>
                </Card>
              ) : (customersPaged?.data?.length ?? 0) === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">ไม่พบผู้ติดต่อที่ตรงกับ &quot;{customerSearch}&quot;</p>
                  </CardContent>
                </Card>
              ) : customerViewMode === 'list' ? (
              <>
                {/* Mobile customer list cards */}
                <div className="sm:hidden space-y-3">
                  {(customersPaged?.data ?? []).map((customer) => {
                    const company = companies.find((c) => c.id === customer.company_id);
                    return (
                      <Card key={customer.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {customer.first_name} {customer.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {company?.name || 'ไม่พบข้อมูลบริษัท'}
                              </div>
                              {customer.position && (
                                <div className="text-xs text-muted-foreground mt-0.5">{customer.position}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                                  onClick={() => handleDeleteCustomer(customer)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => openEditCustomer(customer)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {company && (
                              <Badge className={`text-xs border ${COMPANY_TYPE_COLORS[company.company_type || 'customer']}`} variant="outline">
                                {COMPANY_TYPE_LABELS[company.company_type || 'customer']}
                              </Badge>
                            )}
                            {Number(customer.is_active) ? (
                              <Badge variant="default" className="text-xs">ใช้งาน</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">ไม่ใช้งาน</Badge>
                            )}
                            {Number(customer.is_primary_contact) === 1 && (
                              <Badge variant="outline" className="text-xs">ผู้ติดต่อหลัก</Badge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1">
                            {customer.email && (
                              <div className="flex items-center text-xs gap-1.5">
                                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline truncate">{customer.email}</a>
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center text-xs gap-1.5">
                                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                <a href={`tel:${customer.phone}`} className="hover:text-blue-600 truncate">{customer.phone}</a>
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <Button variant="ghost" size="sm" className="text-xs h-7"
                              onClick={() => { setActivityCustomerId(customer.id); setActivityDialogOpen(true); }}>
                              <BarChart3 className="h-3 w-3 mr-1" /> ดูกิจกรรม
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Desktop customer table */}
                <div className="hidden sm:block overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">ชื่อ-นามสกุล</th>
                        <th className="text-left py-2 px-3 font-medium">บริษัท</th>
                        <th className="text-left py-2 px-3 font-medium hidden sm:table-cell">ตำแหน่ง</th>
                        <th className="text-left py-2 px-3 font-medium">ติดต่อ</th>
                        <th className="text-center py-2 px-3 font-medium">สถานะ</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(customersPaged?.data ?? []).map((customer) => {
                        const company = companies.find((c) => c.id === customer.company_id);
                        return (
                          <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3">
                              <div className="font-medium">{customer.first_name} {customer.last_name}</div>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{company?.name || '-'}</span>
                                {company && (
                                  <Badge className={`text-xs border shrink-0 ${COMPANY_TYPE_COLORS[company.company_type || 'customer']}`} variant="outline">
                                    {COMPANY_TYPE_LABELS[company.company_type || 'customer']}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 hidden sm:table-cell text-muted-foreground">
                              {customer.position || '-'}
                            </td>
                            <td className="py-2 px-3">
                              <div className="space-y-0.5">
                                {customer.email && (
                                  <a href={`mailto:${customer.email}`} className="text-xs text-blue-600 hover:underline block truncate max-w-[160px]">
                                    {customer.email}
                                  </a>
                                )}
                                {customer.phone && (
                                  <a href={`tel:${customer.phone}`} className="text-xs hover:text-blue-600 block">
                                    {customer.phone}
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex flex-col gap-1 items-center">
                                {Number(customer.is_active) ? (
                                  <Badge variant="default" className="text-xs">ใช้งาน</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">ไม่ใช้งาน</Badge>
                                )}
                                {Number(customer.is_primary_contact) === 1 && (
                                  <Badge variant="outline" className="text-xs">หลัก</Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="sm" className="h-7 text-xs"
                                  onClick={() => { setActivityCustomerId(customer.id); setActivityDialogOpen(true); }}>
                                  <Activity className="h-3 w-3 mr-1" /> กิจกรรม
                                </Button>
                                {isAdmin && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                                    onClick={() => handleDeleteCustomer(customer)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => openEditCustomer(customer)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
              ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {(customersPaged?.data ?? []).map((customer) => {
                const company = companies.find((c) => c.id === customer.company_id);
                return (
                  <Card key={customer.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {customer.first_name} {customer.last_name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {company?.name || 'ไม่พบข้อมูลบริษัท'}
                          </CardDescription>
                          {company && (
                            <Badge className={`text-xs border mt-1.5 ${COMPANY_TYPE_COLORS[company.company_type || 'customer']}`} variant="outline">
                              {COMPANY_TYPE_LABELS[company.company_type || 'customer']}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col gap-1">
                            {Number(customer.is_active) ? (
                              <Badge variant="default" className="text-xs">
                                ใช้งาน
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                ไม่ใช้งาน
                              </Badge>
                            )}
                            {Number(customer.is_primary_contact) === 1 && (
                              <Badge variant="outline" className="text-xs">
                                ผู้ติดต่อหลัก
                              </Badge>
                            )}
                          </div>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteCustomer(customer)}
                              title="ลบผู้ติดต่อ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditCustomer(customer)}
                            title="แก้ไขผู้ติดต่อ"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {customer.position && (
                        <div className="text-sm font-medium text-muted-foreground">
                          {customer.position}
                        </div>
                      )}
                      <div className="flex items-center text-sm">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        <a
                          href={`mailto:${customer.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {customer.email}
                        </a>
                      </div>
                      {customer.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                          <a
                            href={`tel:${customer.phone}`}
                            className="hover:text-blue-600"
                          >
                            {customer.phone}
                          </a>
                        </div>
                      )}
                      {customer.notes && (
                        <div className="pt-3 border-t mt-3">
                          <p className="text-sm text-muted-foreground italic">
                            {customer.notes}
                          </p>
                        </div>
                      )}
                      <div className="pt-2">
                        <Button variant="ghost" size="sm" className="text-xs"
                          onClick={() => { setActivityCustomerId(customer.id); setActivityDialogOpen(true); }}>
                          <BarChart3 className="h-3.5 w-3.5 mr-1" /> ดูกิจกรรม
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
              )}
              <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
                <RowsPerPageSelector value={customerPerPage} onChange={setCustomerPerPage} />
                <PaginationBar
                  page={customerPage}
                  pages={customersPaged?.pages ?? 1}
                  loading={customersPagedLoading}
                  onChange={setCustomerPage}
                />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Company Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขบริษัท</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCompanySubmit} className="space-y-4">
            <div>
              <Label>ชื่อบริษัท *</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            {/* Auto-enrich button */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                onClick={handleEnrichCompany} disabled={enriching || !companyName.trim()}>
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
            <div>
              <Label>รายละเอียด</Label>
              <Textarea value={companyDescription} onChange={(e) => setCompanyDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>เบอร์โทรศัพท์</Label>
                <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
              </div>
              <div>
                <Label>อีเมล</Label>
                <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>ที่อยู่</Label>
              <Textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>เว็บไซต์</Label>
                <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
              </div>
              <div>
                <Label>เลขประจำตัวผู้เสียภาษี</Label>
                <Input value={companyTaxId} onChange={(e) => setCompanyTaxId(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>ประเภทบริษัท</Label>
              <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">แยกประเภทเพื่อใช้ข้อมูลให้ถูกต้อง: ลูกค้า / คู่ค้า / ผู้ผลิต</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>ประเภทธุรกิจ</Label>
                <Select value={companyBusinessType || '__none__'} onValueChange={(v) => setCompanyBusinessType(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกประเภทธุรกิจ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- ไม่ระบุ --</SelectItem>
                    {BUSINESS_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ขนาดบริษัท (จำนวนพนักงาน)</Label>
                <Select value={companySize || '__none__'} onValueChange={(v) => setCompanySize(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกขนาด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- ไม่ระบุ --</SelectItem>
                    {COMPANY_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s} คน</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>ปีที่ก่อตั้ง (ค.ศ.)</Label>
              <Input type="number" placeholder="เช่น 2010" min="1800" max="2099" value={companyFoundedYear} onChange={(e) => setCompanyFoundedYear(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="company-active" checked={companyIsActive} onCheckedChange={(v) => setCompanyIsActive(!!v)} />
              <Label htmlFor="company-active">ใช้งาน</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={updateCompany.isPending}>
                {updateCompany.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ติดต่อ</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCustomerSubmit} className="space-y-4">
            <div>
              <Label>บริษัท *</Label>
              <Select value={customerCompanyId} onValueChange={setCustomerCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  {companies.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      ไม่พบบริษัท
                    </SelectItem>
                  ) : (
                    companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>ชื่อ *</Label>
                <Input value={customerFirstName} onChange={(e) => setCustomerFirstName(e.target.value)} required />
              </div>
              <div>
                <Label>นามสกุล</Label>
                <Input value={customerLastName} onChange={(e) => setCustomerLastName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>อีเมล</Label>
                <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>
              <div>
                <Label>เบอร์โทรศัพท์</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>ตำแหน่ง</Label>
              <Input value={customerPosition} onChange={(e) => setCustomerPosition(e.target.value)} />
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="customer-primary" checked={customerIsPrimary} onCheckedChange={(v) => setCustomerIsPrimary(!!v)} />
              <Label htmlFor="customer-primary">ผู้ติดต่อหลัก</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="customer-active" checked={customerIsActive} onCheckedChange={(v) => setCustomerIsActive(!!v)} />
              <Label htmlFor="customer-active">ใช้งาน</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCustomerDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={updateCustomer.isPending || !customerCompanyId}>
                {updateCustomer.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> ประวัติกิจกรรม
            </DialogTitle>
          </DialogHeader>
          {activityCustomerId && (
            <CustomerActivityTimeline customerId={activityCustomerId} />
          )}
        </DialogContent>
      </Dialog>

      {journeyCompany && (
        <CustomerJourneySheet
          companyId={journeyCompany.id}
          companyName={journeyCompany.name}
          onClose={() => setJourneyCompany(null)}
        />
      )}
    </PageShell>
  );
}
