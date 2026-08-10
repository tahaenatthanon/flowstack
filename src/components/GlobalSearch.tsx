import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { useProjects, useAllTasks, useCompanies, useOpportunities } from '@/hooks/useProjectData';
import { getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';
import {
  FolderKanban, CheckSquare, Building2, TrendingUp, Home,
  Clock, Target, Wallet, Zap, BarChart3, FileText, DollarSign,
  LifeBuoy, Megaphone, ShieldCheck, Layers, Sparkles, ClipboardList,
} from 'lucide-react';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem { title: string; href: string; icon: any; keywords?: string[]; }

const NAV_ITEMS: NavItem[] = [
  { title: 'แดชบอร์ด',         href: '/',            icon: Home },
  { title: 'โปรเจกต์',         href: '/projects',    icon: FolderKanban },
  { title: 'ไทม์ชีต',           href: '/task-hours',   icon: Clock,        keywords: ['บันทึกเวลา', 'บันทึกงาน', 'บันทึกชั่วโมง', 'task_hours'] },
  { title: 'เป้าหมาย & OKR',   href: '/goals',       icon: Target },
  { title: 'งบประมาณ',          href: '/budget',      icon: Wallet },
  { title: 'ระบบอัตโนมัติ',     href: '/automation',  icon: Zap },
  { title: 'บริษัทและลูกค้า',  href: '/companies',   icon: Building2 },
  { title: 'ไปป์ไลน์การขาย',   href: '/sales',       icon: TrendingUp },
  { title: 'ใบเสนอราคา',        href: '/quotations',  icon: FileText },
  { title: 'รายงานรายได้',      href: '/revenue',     icon: DollarSign },
  { title: 'Helpdesk',           href: '/support',     icon: LifeBuoy },
  { title: 'การตลาด',           href: '/marketing',   icon: Megaphone },
  { title: 'แคมเปญ',            href: '/campaigns',   icon: Megaphone },
  { title: 'IMPACTOS',          href: '/impactos',    icon: Layers },
  { title: 'Benchmark',          href: '/benchmark',   icon: BarChart3 },
  { title: 'KPI Analytics',      href: '/analytics',   icon: BarChart3 },
  { title: 'AI วิเคราะห์',      href: '/ai-insights', icon: Sparkles },
  { title: 'รายงาน',            href: '/reports',     icon: ClipboardList },
  { title: 'ผู้ดูแลระบบ',       href: '/admin',       icon: ShieldCheck },
];

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
   const navigate = useNavigate();

   const { data: projects = [] } = useProjects();
   const { data: tasksPage = { data: [] } } = useAllTasks();
   const allTasks = tasksPage.data;
   const { data: companies = [] } = useCompanies();
   const { data: opportunities = [] } = useOpportunities();

  // Reset query when closed
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const q = query.toLowerCase().trim();

  const filteredNav = useMemo(() =>
    q ? NAV_ITEMS.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.keywords?.some((kw) => kw.toLowerCase().includes(q))
    ) : NAV_ITEMS.slice(0, 6),
    [q]
  );

  const filteredProjects = useMemo(() => {
    if (!q) return [];
    return projects
      .filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [projects, q]);

  const filteredTasks = useMemo(() => {
    if (!q) return [];
    return allTasks
      .filter((t: any) =>
        t.title?.toLowerCase().includes(q) ||
        t.assignee?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [allTasks, q]);

  const filteredCompanies = useMemo(() => {
    if (!q) return [];
    return companies
      .filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [companies, q]);

  const filteredOpportunities = useMemo(() => {
    if (!q) return [];
    return opportunities
      .filter((o: any) =>
        o.title?.toLowerCase().includes(q) ||
        o.company_name?.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [opportunities, q]);

  const go = (href: string) => {
    navigate(href);
    onOpenChange(false);
  };

  const hasResults = filteredProjects.length + filteredTasks.length +
    filteredCompanies.length + filteredOpportunities.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="ค้นหาโปรเจกต์, งาน, บริษัท, เมนู..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        {q && !hasResults && filteredNav.length === 0 && (
          <CommandEmpty>ไม่พบผลลัพธ์สำหรับ "{query}"</CommandEmpty>
        )}

        {/* Navigation */}
        {filteredNav.length > 0 && (
          <CommandGroup heading={q ? 'เมนู' : 'เมนูหลัก'}>
            {filteredNav.map(item => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={`nav-${item.title}`} onSelect={() => go(item.href)}>
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Projects */}
        {filteredProjects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="โปรเจกต์">
              {filteredProjects.map((p: any) => (
                <CommandItem key={p.id} value={`project-${p.name}`} onSelect={() => go(`/project/${p.id}`)}>
                  <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground shrink-0">{getStatusLabel(p.status)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Tasks */}
        {filteredTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="งาน">
              {filteredTasks.map((t: any) => (
                <CommandItem key={t.id} value={`task-${t.title}`} onSelect={() => go(`/project/${t.project_id}`)}>
                  <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground shrink-0">{getPriorityLabel(t.priority)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Companies */}
        {filteredCompanies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="บริษัท">
              {filteredCompanies.map((c: any) => (
                <CommandItem key={c.id} value={`company-${c.name}`} onSelect={() => go('/companies')}>
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Sales Opportunities */}
        {filteredOpportunities.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="โอกาสการขาย">
              {filteredOpportunities.map((o: any) => (
                <CommandItem key={o.id} value={`opp-${o.title}`} onSelect={() => go(`/sales/${o.id}`)}>
                  <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{o.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground shrink-0">{o.company_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
