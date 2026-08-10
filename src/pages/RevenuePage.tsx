import { useState, useMemo } from 'react';
import { useProjectsWithCompanyCustomer, useOpportunities, useQuotations } from '@/hooks/useProjectData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, Download, BarChart3, FolderKanban, Building2, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PageShell from '@/components/PageShell';
import { exportRevenueToCSV } from '@/lib/exportUtils';
import { endOfYear, format, isValid, parseISO, startOfYear } from 'date-fns';

const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'รอชำระ', color: 'bg-gray-100 text-gray-800', icon: Clock },
  partial: { label: 'ชำระบางส่วน', color: 'bg-blue-100 text-blue-800', icon: TrendingUp },
  paid: { label: 'ชำระแล้ว', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  overdue: { label: 'เกินกำหนด', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

export default function RevenuePage() {
  const { data: projects = [], isLoading: projectsLoading } = useProjectsWithCompanyCustomer();
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useOpportunities();
  const { data: quotations = [], isLoading: quotationsLoading } = useQuotations();

  const isLoading = projectsLoading || opportunitiesLoading || quotationsLoading;

  // Year and date filter — default to current year
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(format(startOfYear(new Date(currentYear, 0, 1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date(currentYear, 0, 1)), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all');
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
    setYearFilter('__all__');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const filtersContent = (
    <>
      <Select value={yearFilter} onValueChange={handleYearChange}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="ปี" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">ทุกปี</SelectItem>
          {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5].map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="สถานะการชำระ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกสถานะ</SelectItem>
          <SelectItem value="pending">{PAYMENT_STATUS_CONFIG.pending.label}</SelectItem>
          <SelectItem value="partial">{PAYMENT_STATUS_CONFIG.partial.label}</SelectItem>
          <SelectItem value="paid">{PAYMENT_STATUS_CONFIG.paid.label}</SelectItem>
          <SelectItem value="overdue">{PAYMENT_STATUS_CONFIG.overdue.label}</SelectItem>
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

  // Filter projects by end_date year (revenue recognized when project ends)
  // Status filter is NOT applied here — charts show full distribution for selected year
  const filteredProjects = useMemo(() => {
    if (!startDate && !endDate) return projects;
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;
    return projects.filter((p: any) => {
      const projectEnd = p.end_date ? parseISO(p.end_date) : null;
      if (!projectEnd || !isValid(projectEnd)) return false; // exclude 0000-00-00 / null
      if (filterStart && projectEnd < filterStart) return false;
      if (filterEnd && projectEnd > filterEnd) return false;
      return true;
    });
  }, [projects, startDate, endDate]);

  // Payment-status-filtered projects — for table display only
  const filteredProjectsTable = useMemo(() => {
    if (statusFilter === 'all') return filteredProjects;
    return filteredProjects.filter((p: any) => p.payment_status === statusFilter);
  }, [filteredProjects, statusFilter]);

  // Filter opportunities by close date — use expected_close_date then actual_close_date
  // Do NOT fall back to created_at: imported historical records have created_at=2026 which
  // would incorrectly show them in 2026 filter even though they are not 2026 opportunities.
  const filteredOpportunities = useMemo(() => {
    if (!startDate && !endDate) return opportunities;
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;
    return opportunities.filter((o: any) => {
      // Try expected_close_date then actual_close_date; skip null / '0000-00-00'
      let closeDate: Date | null = null;
      for (const raw of [o.expected_close_date, o.actual_close_date]) {
        if (!raw) continue;
        const d = parseISO(raw);
        if (isValid(d)) { closeDate = d; break; }
      }
      if (!closeDate) return false; // no valid date → exclude from year-specific filter
      if (filterStart && closeDate < filterStart) return false;
      if (filterEnd && closeDate > filterEnd) return false;
      return true;
    });
  }, [opportunities, startDate, endDate]);

  // Filter quotations by issue_date (no status filter — quotation status ≠ payment status)
  const filteredQuotations = useMemo(() => {
    if (!startDate && !endDate) return quotations;
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;
    return quotations.filter((q: any) => {
      const qDate = q.issue_date ? parseISO(q.issue_date) : null;
      if (!qDate || !isValid(qDate)) return false; // exclude invalid/zero dates
      if (filterStart && qDate < filterStart) return false;
      if (filterEnd && qDate > filterEnd) return false;
      return true;
    });
  }, [quotations, startDate, endDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Opportunity revenue calculations (using opportunities instead of project_value)
  const opportunitiesWithValue = filteredOpportunities.filter((o: any) => Number(o.value) > 0);

  // Sales revenue
  const wonOpportunities = filteredOpportunities.filter((o: any) => o.stage === 'won');
  const salesRevenue = wonOpportunities.reduce((sum: number, o: any) => sum + Number(o.value || 0), 0);

  const revenueStats = {
    totalProjectValue: opportunitiesWithValue.reduce((sum: number, o: any) => sum + Number(o.value || 0), 0),
    paidProjects: opportunitiesWithValue.filter((o: any) => o.stage === 'won').length,
    pendingProjects: opportunitiesWithValue.filter((o: any) => ['lead', 'qualified', 'proposal', 'negotiation'].includes(o.stage)).length,
    partialProjects: 0,
    overdueProjects: 0,
    totalAmountPaid: wonOpportunities.reduce((sum: number, o: any) => sum + Number(o.value || 0), 0),
  };

  // Quotation revenue
  const approvedQuotations = filteredQuotations.filter((q: any) => q.status === 'approved');
  const quotationRevenue = approvedQuotations.reduce((sum: number, q: any) => sum + Number(q.grand_total || 0), 0);

  // Payment status distribution (with amounts for each status) - using opportunities
  const amountByStatus = (stage: string) =>
    opportunitiesWithValue
      .filter((o: any) => o.stage === stage)
      .reduce((sum: number, o: any) => sum + Number(o.value || 0), 0);

  const paymentDistribution = [
    { name: 'ปิดการขายแล้ว', value: revenueStats.paidProjects, amount: amountByStatus('won') },
    { name: 'อยู่ระหว่างดำเนินการ', value: revenueStats.pendingProjects, amount: amountByStatus('lead') + amountByStatus('qualified') + amountByStatus('proposal') + amountByStatus('negotiation') },
  ];

  const groupByCompany = (list: any[]) =>
    list.reduce((acc: any[], item: any) => {
      // For opportunities, use company_name from the opportunity or look up from companies
      const compName = item.company_name || 'ไม่ระบุบริษัท';
      const existing = acc.find((i: any) => i.company === compName);
      if (existing) {
        existing.value += Number(item.value || 0);
        existing.projects += 1;
      } else {
        acc.push({ company: compName, value: Number(item.value || 0), projects: 1 });
      }
      return acc;
    }, []).sort((a: any, b: any) => b.value - a.value).slice(0, 10);

  // Revenue by company — only won opportunities
  const revenueByCompany = groupByCompany(wonOpportunities);
  const revenueByCompanyTable = groupByCompany(wonOpportunities);

  return (
    <PageShell
      breadcrumbs={[{ label: 'รายงานรายได้', isCurrent: true }]}
      title="รายงานรายได้"
      description="รายงานรายได้และการชำระเงิน"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportRevenueToCSV(opportunitiesWithValue)}
        >
          <Download className="h-4 w-4 mr-2" />
          ส่งออกรายงานรายได้
        </Button>
      }
    >

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            แสดง {filteredProjectsTable.length} จาก {projects.length} โปรเจกต์
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

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pb-1">
        <TabsList className="flex sm:grid w-full sm:grid-cols-3 text-xs sm:text-sm">
          <TabsTrigger value="overview" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ภาพรวม</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <FolderKanban className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">โปรเจกต์</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">รายบริษัท</span>
          </TabsTrigger>
        </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">มูลค่าโปรเจกต์รวม</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {revenueStats.totalProjectValue.toLocaleString('th-TH')} ฿
                </div>
                <p className="text-xs text-muted-foreground">
                  {opportunitiesWithValue.length} โอกาส
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">รายได้จากการขาย</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {salesRevenue.toLocaleString('th-TH')} ฿
                </div>
                <p className="text-xs text-muted-foreground">
                  จาก {wonOpportunities.length} ดีล
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ใบเสนอราคาอนุมัติ</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {quotationRevenue.toLocaleString('th-TH')} ฿
                </div>
                <p className="text-xs text-muted-foreground">
                  {approvedQuotations.length} ฉบับ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ยอดรับจริง</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {revenueStats.totalAmountPaid.toLocaleString('th-TH')} ฿
                </div>
                <p className="text-xs text-muted-foreground">
                  จากการชำระเงินจริง
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>สถานะการชำระเงิน</CardTitle>
                <CardDescription>การกระจายตามสถานะ</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Companies by Revenue */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 บริษัทรายได้สูงสุด</CardTitle>
                <CardDescription>จากมูลค่าโปรเจกต์</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueByCompany.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="company" type="category" width={100} />
                    <Tooltip 
                      formatter={(value: any) => `${Number(value).toLocaleString('th-TH')} ฿`}
                    />
                    <Bar dataKey="value" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Payment Status Summary */}
          <Card>
            <CardHeader>
              <CardTitle>สรุปสถานะการชำระเงิน</CardTitle>
              <CardDescription>รายละเอียดการชำระเงินทั้งหมด</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentDistribution.map((status, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    <span className="text-sm font-medium">{status.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{status.value} โปรเจกต์</span>
                    <span className="text-sm font-medium">
                      {status.amount.toLocaleString('th-TH')} ฿
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>โอกาสทางการขาย (ปิดการขายแล้ว)</CardTitle>
              <CardDescription>รายการดีลที่ชนะและรับรายได้แล้ว</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {wonOpportunities.map((item: any) => {
                  const itemValue = Number(item.value || 0);
                  return (
                    <Card key={item.opportunity_id || item.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{item.opportunity_name || item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.company_name || '-'}</p>
                          </div>
                          <Badge variant="default">ชนะ</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">มูลค่า</span>
                          <span className="font-mono font-medium">{itemValue.toLocaleString('th-TH')} ฿</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">วันที่ปิด</span>
                          <span className="text-muted-foreground">{item.actual_close_date || item.expected_close_date || '-'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {wonOpportunities.length === 0 && (
                  <Card>
                    <CardContent className="p-3 text-center text-muted-foreground text-sm">
                      ไม่มีโอกาสทางการขายที่ปิดแล้ว
                    </CardContent>
                  </Card>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>โอกาส</TableHead>
                      <TableHead className="hidden sm:table-cell">บริษัท</TableHead>
                      <TableHead className="text-right">มูลค่า</TableHead>
                      <TableHead className="hidden lg:table-cell">วันที่ปิด</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wonOpportunities.map((item: any) => {
                      const itemValue = Number(item.value || 0);
                      return (
                        <TableRow key={item.opportunity_id || item.id}>
                          <TableCell className="font-medium">
                            <div>{item.opportunity_name || item.name}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">{item.company_name || '-'}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{item.company_name || '-'}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {itemValue.toLocaleString('th-TH')} ฿
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                            {item.actual_close_date || item.expected_close_date || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">ชนะ</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {wonOpportunities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          ไม่มีโอกาสทางการขายที่ปิดแล้ว
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>รายได้แยกตามบริษัท</CardTitle>
              <CardDescription>Top 10 บริษัทที่มีมูลค่าสูงสุด</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {revenueByCompanyTable.map((item: any, index: number) => (
                  <Card key={`company-row-mobile-${index}`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{item.company}</p>
                        <span className="text-xs text-muted-foreground">อันดับ #{index + 1}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">จำนวนโปรเจกต์</span>
                        <span>{item.projects}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">มูลค่ารวม</span>
                        <span className="font-mono font-medium">{item.value.toLocaleString('th-TH')} ฿</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">เฉลี่ยต่อโปรเจกต์</span>
                        <span className="font-mono">{Math.round(item.value / item.projects).toLocaleString('th-TH')} ฿</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {revenueByCompanyTable.length === 0 && (
                  <Card>
                    <CardContent className="p-3 text-center text-muted-foreground text-sm">
                      ไม่มีข้อมูลรายได้ตามบริษัท
                    </CardContent>
                  </Card>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>อันดับ</TableHead>
                      <TableHead>บริษัท</TableHead>
                      <TableHead className="text-right">จำนวนโปรเจกต์</TableHead>
                      <TableHead className="text-right">มูลค่ารวม</TableHead>
                      <TableHead className="text-right">เฉลี่ยต่อโปรเจกต์</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueByCompanyTable.map((item: any, index: number) => (
                      <TableRow key={`company-row-${index}`}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{item.company}</TableCell>
                        <TableCell className="text-right">{item.projects}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {item.value.toLocaleString('th-TH')} ฿
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {Math.round(item.value / item.projects).toLocaleString('th-TH')} ฿
                        </TableCell>
                      </TableRow>
                    ))}
                    {revenueByCompanyTable.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          ไม่มีข้อมูลรายได้ตามบริษัท
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
