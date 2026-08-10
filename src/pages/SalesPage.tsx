import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useCompanies, useOpportunities, useUpdateOpportunity, useUsers, useDeleteOpportunity, useSalesActivityEval, useCustomers } from '@/hooks/useProjectData';
import { useEmailCampaigns } from '@/hooks/useMarketing';
import type { SalesActivityEvalCompany } from '@/hooks/useProjectData';
import { CreateOpportunityDialog } from '@/components/CreateOpportunityDialog';
import ScrollableKanban from '@/components/ScrollableKanban';
import CompanyCombobox from '@/components/CompanyCombobox';
import OpportunityCombobox from '@/components/OpportunityCombobox';
import LeadSourceCombobox from '@/components/LeadSourceCombobox';
import RowsPerPageSelector from '@/components/RowsPerPageSelector';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Loader2, TrendingUp, DollarSign, Users, Target, BarChart3, Pencil, Trash2, Search, X, LayoutGrid, Kanban, CalendarRange, Activity, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Mail, Phone, Table2, List, Plus, ClipboardList, Filter, UserCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { SendSurveyDialog } from '@/components/SendSurveyDialog';
import { useSurveyResponses } from '@/hooks/useSurveys';
import type { SalesPipelineSummary, OpportunityStage } from '@/types/project';
import { STAGE_LABELS } from '@/lib/labels';
import { endOfYear, format, isValid, parseISO, startOfYear } from 'date-fns';
import { AllActivitiesTab } from '@/components/sales/AllActivitiesTab';
import { SalesActivitiesTab } from '@/components/sales/SalesActivitiesTab';
import { WbsSurveyPrompt } from '@/components/sales/WbsSurveyPrompt';

const STAGES: { value: OpportunityStage; label: string; color: string; headerBg: string; headerText: string; borderColor: string; cardBorder: string }[] = [
  { value: 'lead', label: STAGE_LABELS.lead, color: 'bg-gray-100 text-gray-800', headerBg: 'bg-gray-100 dark:bg-gray-800', headerText: 'text-gray-700 dark:text-gray-300', borderColor: 'border-gray-300 dark:border-gray-600', cardBorder: 'border-l-4 border-l-gray-400' },
  { value: 'qualified', label: STAGE_LABELS.qualified, color: 'bg-blue-100 text-blue-800', headerBg: 'bg-blue-50 dark:bg-blue-950', headerText: 'text-blue-700 dark:text-blue-300', borderColor: 'border-blue-300 dark:border-blue-600', cardBorder: 'border-l-4 border-l-blue-500' },
  { value: 'proposal', label: STAGE_LABELS.proposal, color: 'bg-yellow-100 text-yellow-800', headerBg: 'bg-yellow-50 dark:bg-yellow-950', headerText: 'text-yellow-700 dark:text-yellow-300', borderColor: 'border-yellow-300 dark:border-yellow-600', cardBorder: 'border-l-4 border-l-yellow-500' },
  { value: 'negotiation', label: STAGE_LABELS.negotiation, color: 'bg-orange-100 text-orange-800', headerBg: 'bg-orange-50 dark:bg-orange-950', headerText: 'text-orange-700 dark:text-orange-300', borderColor: 'border-orange-300 dark:border-orange-600', cardBorder: 'border-l-4 border-l-orange-500' },
  { value: 'won', label: STAGE_LABELS.won, color: 'bg-green-100 text-green-800', headerBg: 'bg-green-50 dark:bg-green-950', headerText: 'text-green-700 dark:text-green-300', borderColor: 'border-green-300 dark:border-green-600', cardBorder: 'border-l-4 border-l-green-500' },
  { value: 'lost', label: STAGE_LABELS.lost, color: 'bg-red-100 text-red-800', headerBg: 'bg-red-50 dark:bg-red-950', headerText: 'text-red-700 dark:text-red-300', borderColor: 'border-red-300 dark:border-red-600', cardBorder: 'border-l-4 border-l-red-500' },
];

export default function SalesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: opportunities = [], isLoading } = useOpportunities();
  const { data: companies = [] } = useCompanies(true);

  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) =>
      (a.opportunity_name || '').localeCompare(b.opportunity_name || '', 'th')
    );
  }, [opportunities]);

  const myBDStats = useMemo(() => {
    const myLeads = opportunities.filter((o: any) => o.created_by === user?.id);
    const wonLeads = myLeads.filter((o: any) => o.stage === 'won');
    const activeLeads = myLeads.filter((o: any) => !['won', 'lost'].includes(o.stage));
    return {
      total: myLeads.length,
      won: wonLeads.length,
      active: activeLeads.length,
      wonValue: wonLeads.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0),
      pipelineValue: activeLeads.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0),
    };
  }, [opportunities, user?.id]);
  const { data: users = [] } = useUsers();
  const updateOpportunity = useUpdateOpportunity();
  const deleteOpportunity = useDeleteOpportunity();
  const [editCompanyId, setEditCompanyId] = useState('');
  const { data: editCustomers = [] } = useCustomers(editCompanyId || undefined, false);
  const { data: campaigns = [] } = useEmailCampaigns();
  const isAdmin = Number(user?.is_admin) === 1;
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<OpportunityStage | 'all'>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  // Local state for drag and drop to update UI immediately
  const [pipelineOpportunities, setPipelineOpportunities] = useState(opportunities);

  // Sync pipeline opportunities when opportunities data changes
  useEffect(() => {
    setPipelineOpportunities(opportunities);
  }, [opportunities]);

  // Handle drag and drop
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStage = destination.droppableId as OpportunityStage;

    // Optimistically update UI
    setPipelineOpportunities(prev => 
      prev.map(opp => 
        opp.opportunity_id === draggableId 
          ? { ...opp, stage: newStage }
          : opp
      )
    );

    try {
      const today = new Date().toISOString().slice(0, 10);
      const closedStages = ['won', 'lost'];
      // Find the original opportunity to check its current actual_close_date
      const originalOpp = opportunities.find(o => o.opportunity_id === draggableId);
      const updates: Record<string, any> = { stage: newStage };
      if (closedStages.includes(newStage) && !originalOpp?.actual_close_date) {
        updates.actual_close_date = today;
      } else if (!closedStages.includes(newStage)) {
        // Moving back to active — clear actual_close_date
        updates.actual_close_date = null;
      }
      await updateOpportunity.mutateAsync({ id: draggableId, updates });
      toast({ title: 'อัปเดตขั้นตอนสำเร็จ' });
      if (newStage === 'won') {
        const draggedOpp = opportunities.find(o => o.opportunity_id === draggableId);
        if (draggedOpp) {
          setWbsOpp({ id: draggableId, company_id: draggedOpp.company_id, name: draggedOpp.opportunity_name });
        }
      }
    } catch (err: any) {
      // Revert on error
      setPipelineOpportunities(opportunities);
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };
  const formatBaht = (value: number) => `${value.toLocaleString('th-TH')} ฿`;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<SalesPipelineSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStage, setEditStage] = useState<OpportunityStage>('lead');
  const [editValue, setEditValue] = useState('0');
  const [editProbability, setEditProbability] = useState('0');
  const [editExpectedClose, setEditExpectedClose] = useState('');
  const [editActualClose, setEditActualClose] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editLeadSource, setEditLeadSource] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editCampaignId, setEditCampaignId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCreatedBy, setEditCreatedBy] = useState('');
  const [editAdvancedOpen, setEditAdvancedOpen] = useState(false);

  // Activities tab state
  const [actOppId, setActOppId] = useState<string>('');
  const [actDialogOpen, setActDialogOpen] = useState(false);
  const [actEditId, setActEditId] = useState<string | null>(null);
  const [actType, setActType] = useState('call');
  const [actSubject, setActSubject] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actDate, setActDate] = useState(new Date().toISOString().slice(0, 16));
  
  // Year and date filter
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [showDateRange, setShowDateRange] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const openEditOpportunity = (opp: SalesPipelineSummary) => {
    setEditingOpportunity(opp);
    setEditName(opp.opportunity_name || '');
    setEditDescription(opp.description || '');
    setEditStage(opp.stage || 'lead');
    setEditValue(String(opp.value ?? 0));
    setEditProbability(String(opp.probability ?? 0));
    setEditExpectedClose(opp.expected_close_date ?? '');
    setEditActualClose(opp.actual_close_date ?? '');
    setEditCompanyId(opp.company_id ?? '');
    setEditAssignedTo(opp.assigned_user_id ?? '');
    setEditLeadSource(opp.lead_source ?? '');
    setEditCustomerId((opp as any).contact_id ?? '');
    setEditCampaignId((opp as any).campaign_id ?? '');
    setEditNotes((opp as any).notes ?? '');
    setEditCreatedBy((opp as any).created_by ?? '');
    setEditAdvancedOpen(false);
    setIsEditOpen(true);
  };

  const handleDeleteOpportunity = async (opp: SalesPipelineSummary) => {
    const ok = await confirm({ title: 'ลบโอกาสการขาย', description: `ต้องการลบโอกาสการขาย "${opp.opportunity_name}" ใช่หรือไม่?`, variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteOpportunity.mutateAsync(opp.opportunity_id);
      toast({ title: 'ลบโอกาสการขายสำเร็จ' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingOpportunity) return;
    try {
      await updateOpportunity.mutateAsync({
        id: editingOpportunity.opportunity_id,
        updates: {
          name: editName,
          description: editDescription,
          stage: editStage,
          value: Number(editValue || 0),
          probability: Number(editProbability || 0),
          expected_close_date: editExpectedClose || null,
          actual_close_date: editActualClose || null,
          company_id: editCompanyId,
          assigned_to: editAssignedTo,
          lead_source: editLeadSource,
          contact_id: editCustomerId || null,
          campaign_id: editCampaignId || null,
          notes: editNotes,
          ...(editCreatedBy ? { created_by: editCreatedBy } : {}),
        },
      });
      toast({ title: 'แก้ไขโอกาสการขายสำเร็จ' });
      setIsEditOpen(false);
      setEditingOpportunity(null);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  // Filter opportunities
  const filteredOpportunitiesBase = useMemo(() => {
    const q = search.trim().toLowerCase();
    return opportunities.filter(o => {
      if (selectedStage !== 'all' && o.stage !== selectedStage) return false;
      if (selectedCompanyId !== 'all' && o.company_id !== selectedCompanyId) return false;
      if (q) {
        const haystack = [o.opportunity_name, o.company_name, o.description, o.assigned_user_name]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [opportunities, selectedStage, selectedCompanyId, search]);

  const filteredOpportunities = useMemo(() => {
    const filterStart = startDate ? parseISO(startDate) : null;
    const filterEnd = endDate ? parseISO(endDate) : null;

    if (!filterStart && !filterEnd) return filteredOpportunitiesBase;

    return filteredOpportunitiesBase.filter((opp: SalesPipelineSummary) => {
      // For won/lost deals, use actual_close_date; for active deals use expected_close_date
      const isClosedDeal = opp.stage === 'won' || opp.stage === 'lost';
      const dateStr = isClosedDeal ? (opp.actual_close_date || opp.expected_close_date) : opp.expected_close_date;
      if (!dateStr) return isClosedDeal; // include won/lost with no date
      const closeDate = parseISO(dateStr);
      if (!isValid(closeDate)) return isClosedDeal; // exclude invalid for active, include for won/lost
      if (filterStart && closeDate < filterStart) return false;
      if (filterEnd && closeDate > filterEnd) return false;
      return true;
    });
  }, [filteredOpportunitiesBase, startDate, endDate]);

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
    setSearch('');
    setYearFilter(String(currentYear));
    setSelectedStage('all');
    setSelectedCompanyId('all');
    setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  };

  // Calculate statistics
  const stats = {
    totalValue: filteredOpportunities.reduce((sum, opp) => sum + Number(opp.value || 0), 0),
    activeCount: filteredOpportunities.filter(o => !['won', 'lost'].includes(o.stage)).length,
    wonCount: filteredOpportunities.filter(o => o.stage === 'won').length,
    avgProbability: filteredOpportunities.length > 0
      ? Math.round(filteredOpportunities.reduce((sum, o) => sum + Number(o.probability || 0), 0) / filteredOpportunities.length)
      : 0,
  };

  // Group by stage - use filtered pipeline opportunities for drag-drop
  const pipelineOpportunitiesByStage = useMemo(() => {
    return STAGES.reduce((acc, stage) => {
      acc[stage.value] = filteredOpportunities.filter(o => o.stage === stage.value);
      return acc;
    }, {} as Record<OpportunityStage, SalesPipelineSummary[]>);
  }, [filteredOpportunities]);

  // Group by stage for charts (uses filtered opportunities)
  const opportunitiesByStage = STAGES.reduce((acc, stage) => {
    acc[stage.value] = filteredOpportunities.filter(o => o.stage === stage.value);
    return acc;
  }, {} as Record<OpportunityStage, SalesPipelineSummary[]>);

  // Activity evaluation tab
  const { data: evalData, isLoading: evalLoading } = useSalesActivityEval(
    startDate || endDate ? { start_date: startDate || undefined, end_date: endDate || undefined } : undefined
  );
  const [evalSortField, setEvalSortField] = useState<keyof SalesActivityEvalCompany>('engagement_score');
  const [evalSortDir, setEvalSortDir] = useState<'asc' | 'desc'>('desc');
  const [cardViewMode, setCardViewMode] = useState<'card' | 'table'>('table');
  const [oppPerPage, setOppPerPage] = useState(50);
  const [oppPage, setOppPage] = useState(1);
  const [selectedOppIds, setSelectedOppIds] = useState<Set<string>>(new Set());
  const [bulkOppField, setBulkOppField] = useState('');
  const [bulkOppValue, setBulkOppValue] = useState('');
  const [isBulkOppSaving, setIsBulkOppSaving] = useState(false);
  const [surveyDialogOpp, setSurveyDialogOpp] = useState<{ id: string; company_id: string; name: string } | null>(null);
  const [wbsOpp, setWbsOpp] = useState<{ id: string; company_id: string; name: string } | null>(null);

  const handleEvalSort = (field: keyof SalesActivityEvalCompany) => {
    if (evalSortField === field) {
      setEvalSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setEvalSortField(field);
      setEvalSortDir('desc');
    }
  };

  useEffect(() => { setOppPage(1); }, [search, selectedStage, selectedCompanyId, startDate, endDate, oppPerPage]);

  const paginatedOpportunities = useMemo(() => {
    if (oppPerPage >= 99999) return filteredOpportunities;
    const start = (oppPage - 1) * oppPerPage;
    return filteredOpportunities.slice(start, start + oppPerPage);
  }, [filteredOpportunities, oppPage, oppPerPage]);

  const totalPages = oppPerPage >= 99999 ? 1 : Math.max(1, Math.ceil(filteredOpportunities.length / oppPerPage));

  const toggleOppSelect = (id: string) => setSelectedOppIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkOppSave = async () => {
    if (!bulkOppField || !bulkOppValue || selectedOppIds.size === 0) return;
    setIsBulkOppSaving(true);
    const count = selectedOppIds.size;
    try {
      await Promise.all([...selectedOppIds].map(id =>
        updateOpportunity.mutateAsync({ id, updates: { [bulkOppField]: bulkOppValue } })
      ));
      setSelectedOppIds(new Set());
      setBulkOppField('');
      setBulkOppValue('');
      toast({ title: 'อัปเดตสำเร็จ', description: `อัปเดต ${count} โอกาสการขายแล้ว` });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setIsBulkOppSaving(false);
    }
  };

  const evalCompanies = useMemo(() => {
    const rows = evalData?.companies ?? [];
    return [...rows].sort((a, b) => {
      const av = (a[evalSortField] as number | null) ?? -1;
      const bv = (b[evalSortField] as number | null) ?? -1;
      return evalSortDir === 'asc' ? av - bv : bv - av;
    });
  }, [evalData, evalSortField, evalSortDir]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtersContent = (
    <>
      {/* Stage */}
      <Select value={selectedStage} onValueChange={(value) => setSelectedStage(value as OpportunityStage | 'all')}>
        <SelectTrigger className="w-36 h-9 text-sm shrink-0">
          <SelectValue placeholder="สถานะ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกสถานะ</SelectItem>
          {STAGES.map((stage) => (
            <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Company */}
      <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
        <SelectTrigger className="w-44 h-9 text-sm shrink-0">
          <SelectValue placeholder="บริษัท" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกบริษัท</SelectItem>
          {companies
            .filter((c: any) => opportunities.some(o => o.company_id === c.id))
            .map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
        </SelectContent>
      </Select>

      {/* Year */}
      <Select value={yearFilter} onValueChange={handleYearChange}>
        <SelectTrigger className="w-28 h-9 text-sm shrink-0">
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

      <RowsPerPageSelector value={oppPerPage} onChange={(v) => { setOppPerPage(v); setOppPage(1); }} />

      {/* View toggle */}
      <div className="flex border rounded-md overflow-hidden shrink-0">
        <button
          onClick={() => setCardViewMode('card')}
          className={`px-2.5 py-2 ${cardViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          title="Grid View"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => setCardViewMode('table')}
          className={`px-2.5 py-2 ${cardViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          title="List View"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {filteredOpportunities.length} / {opportunities.length} โอกาสการขาย
      </span>
      {cardViewMode === 'table' && totalPages > 1 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOppPage(p => Math.max(1, p-1))} disabled={oppPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <span>{oppPage}/{totalPages}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOppPage(p => Math.min(totalPages, p+1))} disabled={oppPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </>
  );

  return (
    <PageShell
      breadcrumbs={[{ label: 'ไปป์ไลน์การขาย', isCurrent: true }]}
      title="ไปป์ไลน์การขาย"
      description="ติดตามโอกาสการขายและใบเสนอราคา"
      actions={<><CreateOpportunityDialog /></>}
    >

        {/* Filters */}
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาโอกาสการขาย..."
                className="pl-9 pr-8 h-9"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
            <div className="sm:hidden flex flex-wrap items-center gap-2 pt-1 border-t">
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

        {/* Statistics Cards */}
        {/* Stats moved inside cards tab to match Projects page layout */}

        {/* Charts Section */}
        <Tabs defaultValue="cards" className="space-y-6">
          <TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-7">
            <TabsTrigger value="cards" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">การ์ด</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <Kanban className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ไปป์ไลน์</span>
            </TabsTrigger>
            <TabsTrigger value="funnel" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">กรวยการขาย</span>
            </TabsTrigger>
            <TabsTrigger value="value" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <DollarSign className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">วิเคราะห์มูลค่า</span>
            </TabsTrigger>
            <TabsTrigger value="distribution" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">การแจกแจง</span>
            </TabsTrigger>
            <TabsTrigger value="activity-eval" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <Activity className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ประเมินกิจกรรม</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <List className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">กิจกรรมทั้งหมด</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="space-y-6">
            {/* Statistics Cards - inside cards tab to match Projects page layout */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">มูลค่ารวม</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatBaht(stats.totalValue)}
                  </div>
                  <p className="text-xs text-muted-foreground">ทุกโอกาส</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">โอกาสที่กำลังดำเนินการ</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeCount}</div>
                  <p className="text-xs text-muted-foreground">ยังไม่ปิด</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ปิดการขายสำเร็จ</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.wonCount}</div>
                  <p className="text-xs text-muted-foreground">ดีล</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">โอกาสเฉลี่ย</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgProbability}%</div>
                  <p className="text-xs text-muted-foreground">ความน่าจะเป็น</p>
                </CardContent>
              </Card>
            </div>

            {filteredOpportunities.length === 0 ? (
              <div className="text-center py-20">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold font-heading mb-2">ไม่พบโอกาสการขาย</h2>
                <p className="text-muted-foreground mb-6">ปรับตัวกรองหรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p>
                <Button variant="outline" onClick={resetFilters}>ล้างตัวกรอง</Button>
              </div>
            ) : cardViewMode === 'table' ? (() => {
              const allIds = filteredOpportunities.map((o: any) => o.opportunity_id as string);
              const allSelected = allIds.length > 0 && allIds.every(id => selectedOppIds.has(id));
              const toggleAll = () => {
                if (allSelected) setSelectedOppIds(prev => { const n = new Set(prev); allIds.forEach(id => n.delete(id)); return n; });
                else setSelectedOppIds(prev => { const n = new Set(prev); allIds.forEach(id => n.add(id)); return n; });
              };
              return (
                <>
                  {selectedOppIds.size > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-sm font-medium text-primary shrink-0">เลือก {selectedOppIds.size} รายการ</span>
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <Select value={bulkOppField} onValueChange={v => { setBulkOppField(v); setBulkOppValue(''); }}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="เลือกฟิลด์" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stage">สถานะ</SelectItem>
                            <SelectItem value="company_id">บริษัท</SelectItem>
                            <SelectItem value="assigned_to">ผู้รับผิดชอบ</SelectItem>
                            <SelectItem value="expected_close_date">วันคาดปิด</SelectItem>
                          </SelectContent>
                        </Select>
                        {bulkOppField === 'stage' && (
                          <Select value={bulkOppValue} onValueChange={setBulkOppValue}>
                            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
                            <SelectContent>
                              {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {bulkOppField === 'company_id' && (
                          <Select value={bulkOppValue} onValueChange={setBulkOppValue}>
                            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="เลือกบริษัท" /></SelectTrigger>
                            <SelectContent>
                              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {bulkOppField === 'assigned_to' && (
                          <Select value={bulkOppValue} onValueChange={setBulkOppValue}>
                            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="เลือกผู้รับผิดชอบ" /></SelectTrigger>
                            <SelectContent>
                              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {bulkOppField === 'expected_close_date' && (
                          <input type="date" value={bulkOppValue} onChange={e => setBulkOppValue(e.target.value)}
                            className="h-8 px-2 text-xs rounded-md border border-input bg-background" />
                        )}
                        <Button size="sm" className="h-8 text-xs" disabled={!bulkOppField || !bulkOppValue || isBulkOppSaving} onClick={handleBulkOppSave}>
                          {isBulkOppSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}บันทึก
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSelectedOppIds(new Set()); setBulkOppField(''); setBulkOppValue(''); }}>
                          ยกเลิก
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Mobile list cards */}
                  <div className="md:hidden space-y-3">
                    {paginatedOpportunities.map((opp: any) => {
                      const stage = STAGES.find(s => s.value === opp.stage);
                      const isSel = selectedOppIds.has(opp.opportunity_id);
                      return (
                        <Card
                          key={opp.opportunity_id}
                          className={`relative cursor-pointer ${isSel ? 'ring-2 ring-primary' : ''} ${stage?.cardBorder || ''}`}
                          onClick={() => navigate(`/sales/${opp.opportunity_id}`)}
                        >
                          <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={isSel} onCheckedChange={() => toggleOppSelect(opp.opportunity_id)} />
                          </div>
                          <CardContent className="pt-3 pb-3 pl-9">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm line-clamp-2">{opp.opportunity_name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{opp.company_name}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isAdmin && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDeleteOpportunity(opp); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditOpportunity(opp); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <Badge className={`text-xs ${stage?.color || ''}`}>{stage?.label || opp.stage}</Badge>
                              <span className="text-sm font-semibold">{formatBaht(Number(opp.value || 0))}</span>
                              <Badge variant="outline" className="text-xs">{opp.probability}%</Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              {opp.expected_close_date && (
                                <span>ปิด: {new Date(opp.expected_close_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              )}
                              {opp.assigned_user_name && <span className="ml-auto">{opp.assigned_user_name}</span>}
                            </div>
                            <div className="mt-2 flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setSurveyDialogOpp({ id: opp.opportunity_id, company_id: opp.company_id, name: opp.opportunity_name }); }}>
                                <ClipboardList className="h-3 w-3 mr-1" /> Survey
                              </Button>
                              {opp.quotation_count > 0 && (
                                <span className="text-xs text-muted-foreground ml-auto">{opp.quotation_count} ใบเสนอราคา</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="w-10 px-3 py-3">
                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                          </th>
                          <th className="text-left px-4 py-3 font-medium">โอกาสการขาย</th>
                          <th className="text-left px-4 py-3 font-medium">บริษัท</th>
                          <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                          <th className="text-right px-4 py-3 font-medium">มูลค่า</th>
                          <th className="text-right px-4 py-3 font-medium">โอกาส</th>
                          <th className="text-left px-4 py-3 font-medium">คาดปิด</th>
                          <th className="text-left px-4 py-3 font-medium">ผู้รับผิดชอบ</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {paginatedOpportunities.map((opp: any) => {
                          const stage = STAGES.find(s => s.value === opp.stage);
                          const isSel = selectedOppIds.has(opp.opportunity_id);
                          return (
                            <tr key={opp.opportunity_id} className={`hover:bg-muted/30 transition-colors cursor-pointer ${isSel ? 'bg-primary/5' : ''}`}
                              onClick={() => navigate(`/sales/${opp.opportunity_id}`)}>
                              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                <Checkbox checked={isSel} onCheckedChange={() => toggleOppSelect(opp.opportunity_id)} className="shrink-0" />
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium line-clamp-1">{opp.opportunity_name}</div>
                                {opp.quotation_count > 0 && (
                                  <span className="text-xs text-muted-foreground">{opp.quotation_count} ใบเสนอราคา</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{opp.company_name}</td>
                              <td className="px-4 py-3">
                                <Badge className={`text-xs ${stage?.color || ''}`}>{stage?.label || opp.stage}</Badge>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">{formatBaht(Number(opp.value || 0))}</td>
                              <td className="px-4 py-3 text-right">
                                <Badge variant="outline" className="text-xs">{opp.probability}%</Badge>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-sm">
                                {opp.expected_close_date
                                  ? new Date(opp.expected_close_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{opp.assigned_user_name}</td>
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-1 justify-end">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); setSurveyDialogOpp({ id: opp.opportunity_id, company_id: opp.company_id, name: opp.opportunity_name }); }} title="ส่ง Survey">
                                    <ClipboardList className="h-3.5 w-3.5" />
                                  </Button>
                                  {isAdmin && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteOpportunity(opp)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditOpportunity(opp)}>
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
              );
            })() : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOpportunities.map((opp) => {
                  const stage = STAGES.find(s => s.value === opp.stage);
                  return (
                    <Card key={opp.opportunity_id} className={`cursor-pointer hover:shadow-md transition-shadow ${stage?.cardBorder || ''}`} onClick={() => navigate(`/sales/${opp.opportunity_id}`)}>
                      <CardHeader className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base line-clamp-2">
                            {opp.opportunity_name}
                          </CardTitle>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSurveyDialogOpp({ id: opp.opportunity_id, company_id: opp.company_id, name: opp.opportunity_name });
                              }}
                              title="ส่ง Survey"
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteOpportunity(opp);
                                }}
                                title="ลบโอกาสการขาย"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditOpportunity(opp);
                              }}
                              title="แก้ไขโอกาสการขาย"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="text-sm">
                          {opp.company_name}
                        </CardDescription>
                        {opp.description && (
                          <CardDescription className="text-sm line-clamp-2">
                            {opp.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className={`${stage?.color || ''}`}>
                            {stage?.label || opp.stage}
                          </Badge>
                          <span className="font-semibold text-lg">
                            {formatBaht(Number(opp.value || 0))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">โอกาส</span>
                          <Badge variant="outline">
                            {opp.probability}%
                          </Badge>
                        </div>
                        {opp.expected_close_date && (
                          <div className="text-sm text-muted-foreground">
                            คาดปิด: {new Date(opp.expected_close_date).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          👤 {opp.assigned_user_name}
                        </div>
                        {opp.quotation_count > 0 && (
                          <Badge variant="secondary">
                            {opp.quotation_count} ใบเสนอราคา
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <h2 className="text-xl font-semibold">ไปป์ไลน์การขาย</h2>
            <p className="text-sm text-muted-foreground">ลากและวางเพื่อเปลี่ยนขั้นตอน</p>
            <DragDropContext onDragEnd={handleDragEnd}>
              <ScrollableKanban className="sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible sm:pb-0">
                {/* On mobile: horizontal scroll kanban. On sm+: grid */}
                {STAGES.map((stage) => {
                  const stageOpportunities = pipelineOpportunitiesByStage[stage.value] || [];
                  const stageValue = stageOpportunities.reduce((sum, o) => sum + Number(o.value || 0), 0);

                  return (
                    <div key={stage.value} className="space-y-2 min-w-[220px] sm:min-w-0">
                      <div className={`flex items-center justify-between mb-2 rounded-lg px-3 py-2 border ${stage.headerBg} ${stage.borderColor}`}>
                        <h3 className={`font-semibold text-sm ${stage.headerText}`}>{stage.label}</h3>
                        <Badge className={`text-xs ${stage.color}`}>
                          {stageOpportunities.length}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground mb-3 px-1">
                        {formatBaht(stageValue)}
                      </div>

                      <Droppable droppableId={stage.value}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`space-y-2 min-h-[200px] rounded-lg p-1 ${snapshot.isDraggingOver ? 'bg-muted/50' : ''}`}
                          >
                            {stageOpportunities.map((opp, index) => (
                              <Draggable key={opp.opportunity_id} draggableId={opp.opportunity_id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing"
                                    onClick={() => navigate(`/sales/${opp.opportunity_id}`)}
                                  >
                                    <Card className={`hover:shadow-md transition-shadow ${stage.cardBorder} ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}>
                                      <CardHeader className="p-3 space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <CardTitle className="text-sm line-clamp-2">
                                            {opp.opportunity_name}
                                          </CardTitle>
                                          <div className="flex items-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setSurveyDialogOpp({ id: opp.opportunity_id, company_id: opp.company_id, name: opp.opportunity_name });
                                              }}
                                              title="ส่ง Survey"
                                            >
                                              <ClipboardList className="h-3.5 w-3.5" />
                                            </Button>
                                            {isAdmin && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleDeleteOpportunity(opp);
                                                }}
                                                title="ลบโอกาสการขาย"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                openEditOpportunity(opp);
                                              }}
                                              title="แก้ไขโอกาสการขาย"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                        <CardDescription className="text-xs">
                                          {opp.company_name}
                                        </CardDescription>
                                        {opp.description && (
                                          <CardDescription className="text-xs line-clamp-2 mt-1">
                                            {opp.description}
                                          </CardDescription>
                                        )}
                                      </CardHeader>
                                      <CardContent className="p-3 pt-0 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">มูลค่า</span>
                                          <span className="font-medium">
                                            {formatBaht(Number(opp.value || 0))}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">โอกาส</span>
                                          <Badge variant="outline" className="text-xs">
                                            {opp.probability}%
                                          </Badge>
                                        </div>
                                        {opp.expected_close_date && (
                                          <div className="text-xs text-muted-foreground">
                                            คาดปิด: {new Date(opp.expected_close_date).toLocaleDateString('th-TH', {
                                              year: 'numeric',
                                              month: 'short',
                                              day: 'numeric'
                                            })}
                                          </div>
                                        )}
                                        <div className="text-xs text-muted-foreground">
                                          👤 {opp.assigned_user_name}
                                        </div>
                                        {opp.quotation_count > 0 && (
                                          <Badge variant="secondary" className="text-xs">
                                            {opp.quotation_count} ใบเสนอราคา
                                          </Badge>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </div>
                                )}
                              </Draggable>
                            ))}

                            {stageOpportunities.length === 0 && (
                              <div className="text-xs text-muted-foreground text-center py-4">
                                ไม่มีโอกาสในขั้นตอนนี้
                              </div>
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </ScrollableKanban>
            </DragDropContext>
          </TabsContent>

          <TabsContent value="funnel" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funnel Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>กรวยการขายตามจำนวน</CardTitle>
                  <CardDescription>จำนวนโอกาสในแต่ละขั้นตอน</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={STAGES.map(stage => ({
                        name: stage.label,
                        count: (opportunitiesByStage[stage.value] || []).length,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Conversion Rates */}
              <Card>
                <CardHeader>
                  <CardTitle>Stage Conversion</CardTitle>
                  <CardDescription>อัตราการเปลี่ยนแปลงระหว่างขั้นตอน</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {STAGES.slice(0, -2).map((stage, idx) => {
                      const currentCount = (opportunitiesByStage[stage.value] || []).length;
                      const nextStage = STAGES[idx + 1];
                      const nextCount = (opportunitiesByStage[nextStage.value] || []).length;
                      const conversionRate = currentCount > 0 ? Math.round((nextCount / currentCount) * 100) : 0;

                      return (
                        <div key={stage.value} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{stage.label} → {nextStage.label}</span>
                            <span className="font-medium">{conversionRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${conversionRate}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Win Rate */}
                    <div className="pt-4 border-t space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Win Rate</span>
                        <span className="font-bold text-green-600">
                          {filteredOpportunities.length > 0
                            ? Math.round((stats.wonCount / filteredOpportunities.length) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${filteredOpportunities.length > 0
                              ? Math.round((stats.wonCount / filteredOpportunities.length) * 100)
                              : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="value" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Value by Stage */}
              <Card>
                <CardHeader>
                  <CardTitle>Value by Stage</CardTitle>
                  <CardDescription>มูลค่ารวมในแต่ละขั้นตอน</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={STAGES.map(stage => {
                        const stageOpps = opportunitiesByStage[stage.value] || [];
                        const stageValue = stageOpps.reduce((sum, o) => sum + Number(o.value || 0), 0);
                        return {
                          name: stage.label,
                          value: stageValue,
                        };
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis 
                        tickFormatter={(value) => formatBaht(Number(value))}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatBaht(value)}
                      />
                      <Bar dataKey="value" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Average Deal Size */}
              <Card>
                <CardHeader>
                  <CardTitle>Average Deal Size by Stage</CardTitle>
                  <CardDescription>มูลค่าเฉลี่ยต่อดีล</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={STAGES.map(stage => {
                        const stageOpps = opportunitiesByStage[stage.value] || [];
                        const avgValue = stageOpps.length > 0
                          ? stageOpps.reduce((sum, o) => sum + Number(o.value || 0), 0) / stageOpps.length
                          : 0;
                        return {
                          name: stage.label,
                          avgValue: avgValue,
                        };
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis 
                        tickFormatter={(value) => formatBaht(Number(value))}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatBaht(value)}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="avgValue" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Count Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Opportunity Distribution</CardTitle>
                  <CardDescription>การกระจายจำนวนโอกาส</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={STAGES.map((stage, idx) => ({
                          name: stage.label,
                          value: (opportunitiesByStage[stage.value] || []).length,
                          color: ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#22c55e', '#ef4444'][idx],
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => 
                          percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {STAGES.map((stage, idx) => (
                          <Cell 
                            key={`cell-${idx}`} 
                            fill={['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#22c55e', '#ef4444'][idx]} 
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
                  <CardTitle>Value Distribution</CardTitle>
                  <CardDescription>การกระจายมูลค่า</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={STAGES.map((stage, idx) => {
                          const stageOpps = opportunitiesByStage[stage.value] || [];
                          const stageValue = stageOpps.reduce((sum, o) => sum + Number(o.value || 0), 0);
                          return {
                            name: stage.label,
                            value: stageValue,
                            color: ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#22c55e', '#ef4444'][idx],
                          };
                        })}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => 
                          percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {STAGES.map((stage, idx) => (
                          <Cell 
                            key={`cell-${idx}`} 
                            fill={['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#22c55e', '#ef4444'][idx]} 
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
          </TabsContent>

          {/* ─────────────────────────────────────────────── */}
          {/* Customer Activity Evaluation Tab               */}
          {/* ─────────────────────────────────────────────── */}
          <TabsContent value="activity-eval" className="space-y-6">

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                  <CardTitle className="text-xs sm:text-sm font-medium">บริษัทที่มีกิจกรรม</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold">{evalData?.summary.companies_total ?? 0}</div>
                  <p className="text-xs text-muted-foreground">บริษัท</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                  <CardTitle className="text-xs sm:text-sm font-medium">Open Rate เฉลี่ย</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold">{evalData?.summary.avg_open_rate ?? 0}%</div>
                  <p className="text-xs text-muted-foreground">อัตราเปิดอีเมล</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                  <CardTitle className="text-xs sm:text-sm font-medium">Click Rate เฉลี่ย</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold">{evalData?.summary.avg_click_rate ?? 0}%</div>
                  <p className="text-xs text-muted-foreground">อัตราคลิกลิงก์</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                  <CardTitle className="text-xs sm:text-sm font-medium">อัตราปิดการขาย</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold">{evalData?.summary.win_rate ?? 0}%</div>
                  <p className="text-xs text-muted-foreground">Won / Total opportunities</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activity breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">กิจกรรม CRM ตามประเภท</CardTitle>
                  <CardDescription>จำนวนกิจกรรมการขายแต่ละประเภทรวมทุกบริษัท</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={[
                      { name: 'อีเมล',        value: evalData?.summary.activity_breakdown.email          ?? 0 },
                      { name: 'โทรศัพท์',    value: evalData?.summary.activity_breakdown.call           ?? 0 },
                      { name: 'ประชุม',       value: evalData?.summary.activity_breakdown.meeting        ?? 0 },
                      { name: 'โน้ต',         value: evalData?.summary.activity_breakdown.note           ?? 0 },
                      { name: 'ใบเสนอราคา', value: evalData?.summary.activity_breakdown.quotation_sent ?? 0 },
                      { name: 'อื่นๆ',        value: evalData?.summary.activity_breakdown.other          ?? 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" name="กิจกรรม" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Engagement score distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Engagement Score รายบริษัท</CardTitle>
                  <CardDescription>คะแนน engagement (open rate + click rate + replies + กิจกรรม)</CardDescription>
                </CardHeader>
                <CardContent>
                  {evalLoading ? (
                    <div className="flex items-center justify-center h-[240px]">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={[...evalCompanies]
                          .sort((a, b) => b.engagement_score - a.engagement_score)
                          .slice(0, 10)
                          .map(c => ({ name: c.company_name.length > 12 ? c.company_name.slice(0, 12) + '…' : c.company_name, score: c.engagement_score, win: c.win_rate }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => `${v}`} />
                        <Legend />
                        <Bar dataKey="score" name="Engagement" fill="#6366f1" radius={[0,4,4,0]} />
                        <Bar dataKey="win" name="Win Rate %" fill="#22c55e" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Per-company evaluation table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ประเมินผลรายบริษัท</CardTitle>
                <CardDescription className="hidden sm:block">คลิกหัวตารางเพื่อเรียงลำดับ — รวมข้อมูลอีเมล, กิจกรรม CRM, โอกาสการขาย และแบบสอบถาม</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {evalLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : evalCompanies.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Activity className="w-10 h-10 mx-auto mb-3" />
                    <p>ไม่พบข้อมูลกิจกรรม</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards (< sm) */}
                    <div className="sm:hidden divide-y">
                      {evalCompanies.map((row) => {
                        const engColor = row.engagement_score >= 60 ? 'text-green-600 font-semibold'
                          : row.engagement_score >= 30 ? 'text-yellow-600 font-semibold'
                          : 'text-muted-foreground';
                        return (
                          <div key={row.company_id} className="px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm truncate">{row.company_name}</span>
                              <span className={`text-sm shrink-0 ${engColor}`}>
                                Engage: {row.engagement_score > 0 ? row.engagement_score : '—'}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                              <div className="text-muted-foreground">กิจกรรม</div>
                              <div className="text-muted-foreground">อีเมล</div>
                              <div className="text-muted-foreground">โอกาส</div>
                              <div className="font-medium">{row.sales_act_total > 0 ? row.sales_act_total : '—'}</div>
                              <div>
                                {row.emails_sent > 0
                                  ? <span>{row.emails_sent} <span className="text-muted-foreground">({row.open_rate}%)</span></span>
                                  : <span className="text-muted-foreground">—</span>}
                              </div>
                              <div>
                                {row.opp_count > 0
                                  ? <span>{row.opp_count} <span className={row.win_rate >= 50 ? 'text-green-600' : 'text-muted-foreground'}>Win {row.win_rate}%</span></span>
                                  : <span className="text-muted-foreground">—</span>}
                              </div>
                            </div>
                            {row.opp_value > 0 && (
                              <div className="text-xs text-muted-foreground">
                                มูลค่า: <span className="text-foreground font-medium">{row.opp_value.toLocaleString('th-TH')} ฿</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop table (sm+) */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-xs">
                            <th className="text-left px-4 py-2 font-medium sticky left-0 bg-muted/30">บริษัท</th>
                            {([
                              { field: 'customers_count' as const,  label: 'ลูกค้า' },
                              { field: 'emails_sent'     as const,  label: 'ส่งอีเมล' },
                              { field: 'open_rate'       as const,  label: 'Open%' },
                              { field: 'click_rate'      as const,  label: 'Click%' },
                              { field: 'ca_email_replied' as const, label: 'ตอบ' },
                              { field: 'sales_act_total' as const,  label: 'กิจกรรม' },
                              { field: 'sa_call'         as const,  label: 'โทร' },
                              { field: 'sa_meeting'      as const,  label: 'ประชุม' },
                              { field: 'opp_count'          as const, label: 'โอกาส' },
                              { field: 'opp_won'            as const, label: 'Won' },
                              { field: 'win_rate'           as const, label: 'Win%' },
                              { field: 'opp_value'          as const, label: 'มูลค่า' },
                              { field: 'survey_count'       as const, label: 'สำรวจ' },
                              { field: 'survey_responded'   as const, label: 'ตอบกลับ' },
                              { field: 'avg_pain_score'     as const, label: 'Pain' },
                              { field: 'engagement_score'   as const, label: 'Engage' },
                            ].map(({ field, label }) => (
                              <th key={field}
                                className="text-right px-3 py-2 font-medium cursor-pointer select-none hover:text-foreground whitespace-nowrap"
                                onClick={() => handleEvalSort(field)}
                              >
                                <span className="inline-flex items-center gap-0.5 justify-end">
                                  {label}
                                  {evalSortField === field
                                    ? (evalSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                                    : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                                </span>
                              </th>
                            )))}
                          </tr>
                        </thead>
                        <tbody>
                          {evalCompanies.map((row, i) => {
                            const engColor = row.engagement_score >= 60 ? 'text-green-600'
                              : row.engagement_score >= 30 ? 'text-yellow-600'
                              : 'text-muted-foreground';
                            return (
                              <tr key={row.company_id} className={`border-b transition-colors hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                                <td className="px-4 py-2 font-medium max-w-[160px] truncate sticky left-0 bg-background" title={row.company_name}>
                                  {row.company_name}
                                </td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{row.customers_count}</td>
                                <td className="px-3 py-2 text-right">{row.emails_sent > 0 ? row.emails_sent : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right">
                                  {row.emails_sent > 0
                                    ? <span className={row.open_rate >= 20 ? 'text-green-600 font-medium' : row.open_rate > 0 ? 'text-yellow-600' : 'text-muted-foreground'}>{row.open_rate}%</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {row.emails_sent > 0
                                    ? <span className={row.click_rate >= 5 ? 'text-green-600 font-medium' : row.click_rate > 0 ? 'text-yellow-600' : 'text-muted-foreground'}>{row.click_rate}%</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2 text-right">{row.ca_email_replied > 0 ? <span className="text-blue-600 font-medium">{row.ca_email_replied}</span> : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right">{row.sales_act_total > 0 ? row.sales_act_total : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right">{row.sa_call > 0 ? row.sa_call : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right">{row.sa_meeting > 0 ? row.sa_meeting : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right">{row.opp_count > 0 ? row.opp_count : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right">{row.opp_won > 0 ? <span className="text-green-600 font-medium">{row.opp_won}</span> : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right">
                                  {row.opp_count > 0
                                    ? <span className={row.win_rate >= 50 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>{row.win_rate}%</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2 text-right">{row.opp_value > 0 ? `${row.opp_value.toLocaleString('th-TH')} ฿` : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">
                                  {row.survey_count > 0 ? row.survey_count : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {row.survey_responded > 0
                                    ? <span className={row.survey_response_rate >= 50 ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                                        {row.survey_responded}
                                        <span className="text-[10px] text-muted-foreground ml-0.5">({row.survey_response_rate}%)</span>
                                      </span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {row.avg_pain_score !== null && row.avg_pain_score > 0
                                    ? <span className={row.avg_pain_score >= 70 ? 'text-red-600 font-medium' : row.avg_pain_score >= 40 ? 'text-yellow-600' : 'text-muted-foreground'}>
                                        {row.avg_pain_score}
                                      </span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className={`px-3 py-2 text-right font-semibold ${engColor}`}>
                                  {row.engagement_score > 0 ? row.engagement_score : <span className="text-muted-foreground font-normal">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === Activities Tab === */}
          <TabsContent value="activities" className="space-y-4">
            <SalesActivitiesTab
              opportunities={opportunities}
              companies={companies}
              users={users}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>แก้ไขโอกาสการขาย</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              {/* ชื่อ */}
              <div>
                <Label>ชื่อโอกาสการขาย *</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>

              {/* บริษัท | ผู้ติดต่อ | ผู้รับผิดชอบ PM */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>บริษัท *</Label>
                  <CompanyCombobox
                    value={editCompanyId}
                    onChange={(id) => { setEditCompanyId(id); setEditCustomerId(''); }}
                    placeholder="เลือกบริษัท"
                    allowNone={false}
                  />
                </div>
                <div>
                  <Label>ผู้ติดต่อ</Label>
                  <Select value={editCustomerId || '__none__'} onValueChange={(v) => setEditCustomerId(v === '__none__' ? '' : v)} disabled={!editCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder={editCompanyId ? 'เลือกผู้ติดต่อ' : 'เลือกบริษัทก่อน'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ไม่เลือก</SelectItem>
                      {editCustomers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.position ? ` (${c.position})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ผู้รับผิดชอบ (PM) *</Label>
                  <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                    <SelectTrigger><SelectValue placeholder="เลือก PM" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ขั้นตอน | มูลค่า | วันที่คาดปิดดีล */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>ขั้นตอน</Label>
                  <Select value={editStage} onValueChange={(value) => {
                    const s = value as OpportunityStage;
                    setEditStage(s);
                    if (['won', 'lost'].includes(s) && !editActualClose) setEditActualClose(new Date().toISOString().slice(0, 10));
                    else if (!['won', 'lost'].includes(s)) setEditActualClose('');
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>มูลค่า (บาท)</Label>
                  <Input type="number" min="0" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                </div>
                <div>
                  <Label>คาดปิดดีล</Label>
                  <Input type="date" value={editExpectedClose} onChange={(e) => setEditExpectedClose(e.target.value)} />
                </div>
              </div>

              {/* แหล่งที่มา | ผู้หา Lead */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>แหล่งที่มา</Label>
                  <LeadSourceCombobox value={editLeadSource} onChange={setEditLeadSource} />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-blue-500" />ผู้หา Lead (BD)</Label>
                  {isAdmin ? (
                    <Select value={editCreatedBy || '__none__'} onValueChange={(v) => setEditCreatedBy(v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="เลือกผู้หา Lead" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                        {users.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 h-9 mt-1">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                        {users.find((u: any) => u.id === editCreatedBy)?.display_name || '—'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">แอดมินแก้ไขได้</span>
                    </div>
                  )}
                </div>
              </div>

              {/* รายละเอียด */}
              <div>
                <Label>รายละเอียด</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="รายละเอียดเพิ่มเติม" rows={2} />
              </div>

              {/* ส่วนหุบ: ความน่าจะเป็น, Campaign, บันทึก, วันปิดดีลจริง */}
              <Collapsible open={editAdvancedOpen} onOpenChange={setEditAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-center justify-between rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
                    <span>ข้อมูลเพิ่มเติม (ความน่าจะเป็น, Campaign, บันทึก{['won','lost'].includes(editStage) ? ', วันปิดดีลจริง' : ''})</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${editAdvancedOpen ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>ความน่าจะเป็น (%)</Label>
                      <Input type="number" min="0" max="100" value={editProbability} onChange={(e) => setEditProbability(e.target.value)} />
                    </div>
                    <div>
                      <Label>Campaign</Label>
                      <Select value={editCampaignId || '__none__'} onValueChange={(v) => setEditCampaignId(v === '__none__' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="— ไม่ระบุ —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                          {campaigns.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>บันทึกเพิ่มเติม</Label>
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="หมายเหตุหรือข้อมูลเพิ่มเติม" rows={2} />
                  </div>
                  {['won', 'lost'].includes(editStage) && (
                    <div>
                      <Label>วันที่ปิดดีลจริง</Label>
                      <Input type="date" value={editActualClose} onChange={(e) => setEditActualClose(e.target.value)} />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>ยกเลิก</Button>
                <Button type="submit" disabled={updateOpportunity.isPending || !editCompanyId || !editAssignedTo}>
                  {updateOpportunity.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      {surveyDialogOpp && (
        <SendSurveyDialog
          open={!!surveyDialogOpp}
          onOpenChange={open => { if (!open) setSurveyDialogOpp(null); }}
          opportunityId={surveyDialogOpp.id}
          companyId={surveyDialogOpp.company_id}
          opportunityName={surveyDialogOpp.name}
        />
      )}
      {wbsOpp && (
        <WbsSurveyPrompt
          opportunityId={wbsOpp.id}
          onClose={() => setWbsOpp(null)}
          onOpenWbs={() => setWbsOpp(null)}
        />
      )}
    </PageShell>
  );
}
