import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBillingStatus } from '@/hooks/useBilling';
import { cn } from '@/lib/utils';
import {
  Home, FolderKanban, TrendingUp, FileText, Building2, BarChart3,
  LineChart, LogOut, Menu, DollarSign, ShieldCheck, ClipboardList,
  Clock, Mail, Target, Zap, Wallet, Database, Search,
  ChevronDown, ChevronRight, Plus, Globe, Inbox,
  LifeBuoy, Megaphone, Layers, HelpCircle, BookOpen,
  Cpu, Sparkles, Send, PenTool, RefreshCw, CalendarDays, Calendar, GitBranch,
  CreditCard, Wand2, Palette, UserSearch, LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect } from 'react';
import GlobalSearch from '@/components/GlobalSearch';
import { useUnreadCount } from '@/hooks/useProjectData';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  menuKey: string;
  disabled?: boolean;
  children?: NavItem[];
}

interface NavGroup {
  key: string;
  label: string;
  icon?: React.ElementType;
  items: NavItem[];
  showAdd?: boolean;        // แสดงปุ่ม + หน้า label
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'projects',
    label: 'จัดการโปรเจค',
    icon: FolderKanban,
    showAdd: false,
    defaultOpen: true,
    items: [
      { title: 'โปรเจกต์',       href: '/projects',   icon: FolderKanban, menuKey: 'projects'   },
      { title: 'บันทึกชั่วโมง',  href: '/task-hours',  icon: Clock,        menuKey: 'task_hours'  },

      { title: 'ปฏิทินทีม',      href: '/calendar',        icon: Calendar,  menuKey: 'calendar'  },
      { title: 'เป้าหมาย & OKR', href: '/goals',      icon: Target,       menuKey: 'goals'      },
      { title: 'งบประมาณ',       href: '/budget',     icon: Wallet,       menuKey: 'budget'     },
      { title: 'ระบบอัตโนมัติ',  href: '/automation', icon: Zap,          menuKey: 'automation' },
      { title: 'Workflow BPM',   href: '/workflow',   icon: GitBranch,    menuKey: 'workflow'   },
    ],
  },
  {
    key: 'crm',
    label: 'การขายและ CRM',
    icon: TrendingUp,
    defaultOpen: false,
    items: [
      { title: 'บริษัทและลูกค้า', href: '/companies',  icon: Building2,  menuKey: 'companies'  },
      { title: 'ไปป์ไลน์การขาย',  href: '/sales',      icon: TrendingUp,    menuKey: 'sales'      },
      { title: 'ค้นหาลูกค้าใหม่',  href: '/lead-generation', icon: UserSearch, menuKey: 'lead_generation' },
      { title: 'แบบสอบถาม',       href: '/surveys',    icon: ClipboardList, menuKey: 'sales'      },
      { title: 'ใบเสนอราคา',      href: '/quotations', icon: FileText,      menuKey: 'quotations' },
      { title: 'รายงานรายได้',    href: '/revenue',    icon: DollarSign, menuKey: 'revenue'    },
    ],
  },
  {
    key: 'support',
    label: 'สนับสนุน',
    icon: LifeBuoy,
    defaultOpen: false,
    items: [
      { title: 'ศูนย์ช่วยเหลือ',       href: '/support',        icon: LifeBuoy,  menuKey: 'support' },
      { title: 'ฐานความรู้',       href: '/knowledge-base', icon: BookOpen,  menuKey: 'support' },
    ],
  },
  {
    key: 'marketing',
    label: 'การตลาด',
    icon: Megaphone,
    defaultOpen: false,
    items: [
      { title: 'แดชบอร์ดคอนเทนต์', href: '/content-dashboard', icon: LayoutDashboard, menuKey: 'marketing' },
      { title: 'คอนเทนต์โซเชียล',  href: '/content',           icon: PenTool,         menuKey: 'marketing' },
      { title: 'ปฏิทินคอนเทนต์',  href: '/content-planner',   icon: CalendarDays,    menuKey: 'marketing' },
      { title: 'แคมเปญอีเมล',     href: '/marketing',          icon: Send,            menuKey: 'marketing' },
      { title: 'วิเคราะห์แคมเปญ',   href: '/campaign-analytics', icon: BarChart3,       menuKey: 'marketing' },
      { title: 'สตูดิโอสื่อ', href: '/media-studio', icon: Wand2, menuKey: 'media_studio' },
    ],
  },
  {
    key: 'impactos',
    label: 'ImpactOS',
    icon: Layers,
    defaultOpen: false,
    items: [
      { title: 'ImpactOS',       href: '/impactos',  icon: Layers,        menuKey: 'analytics' },
      { title: 'วิเคราะห์และรายงาน', href: '/analytics', icon: BarChart3,     menuKey: 'analytics' },
      { title: 'ประเมินผลงาน', href: '/task-intelligence', icon: ShieldCheck, menuKey: 'task_intelligence' },
    ],
  },
  {
    key: 'admin',
    label: 'การจัดการระบบ',
    icon: ShieldCheck,
    defaultOpen: false,
    items: [
      { title: 'ผู้ดูแลระบบ',   href: '/admin',            icon: ShieldCheck, menuKey: 'admin' },
      { title: 'ปรับปรุงข้อมูล', href: '/data-management', icon: Database,    menuKey: 'data_management' },
      { title: 'ตั้งค่าแบรนด์', href: '/brand-setting',   icon: Palette,     menuKey: 'brand_setting' },
    ],
  },
];

function UserAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { user } = useAuth();
  const initials = user?.display_name?.charAt(0)?.toUpperCase() ?? 'U';
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-sm';
  const medalSize = size === 'sm' ? 'h-4 w-4 text-[13px]' : 'h-5 w-5 text-base';
  const navigate = useNavigate();
  return (
    <span className="relative inline-block">
      <Avatar className={sizeClass}>
        <AvatarImage src={user?.avatar_url} alt={user?.display_name} />
        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      {/* Medal overlay */}
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); navigate('/impactos?tab=dev'); }}
        title="ดูรายงาน KPI ของคุณ"
        tabIndex={-1}
        className={`absolute -bottom-1 -right-1 rounded-full bg-yellow-400 border-2 border-white dark:border-slate-900 flex items-center justify-center shadow z-10 ${medalSize} p-0.5 hover:scale-110 active:scale-95 transition-all`}
        style={{ boxShadow: '0 1px 4px 0 rgba(0,0,0,0.10)' }}
      >
        <span className="leading-none">🏅</span>
      </button>
    </span>
  );
}

function NestedNavItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  const children = item.children ?? [];

  const isAnyChildActive = children.some(child =>
    child.href === '/'
      ? location.pathname === '/'
      : location.pathname === child.href || location.pathname.startsWith(child.href + '/')
  );

  useEffect(() => {
    if (isAnyChildActive) setOpen(true);
  }, [isAnyChildActive]);

  if (children.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          isAnyChildActive && 'bg-sidebar-accent text-sidebar-foreground font-medium'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.title}</span>
        {open
          ? <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
          : <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {children.map((child) => {
            const isActive =
              child.href === '/'
                ? location.pathname === '/'
                : location.pathname === child.href || location.pathname.startsWith(child.href + '/');
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.title + child.href}
                to={child.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <ChildIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{child.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollapsibleGroup({
  group, onNavigate,
}: {
  group: NavGroup;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(group.defaultOpen ?? false);

  const visibleItems = group.items.filter((item) => hasPermission(item.menuKey));
  // Deduplicate by href
  const seen = new Set<string>();
  const items = visibleItems.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  const GroupIcon = group.icon;

  // Check if any item or dynamic route in this group is active
  const dynamicPrefixes: Record<string, string[]> = {
    projects: ['/project'], // for /project/:id pages
    crm: ['/company', '/opportunity', '/quotation'],
  };

  const allPrefixes = [
    ...group.items.map(item => item.href).filter(h => h !== ''),
    ...group.items.flatMap(item => (item.children ?? []).map(c => c.href)),
    ...(dynamicPrefixes[group.key] || [])
  ];

  const isAnyActive = allPrefixes.some(prefix =>
    location.pathname === prefix || location.pathname.startsWith(prefix + '/')
  );

  // Auto-expand group when a submenu is active (must be before any early returns)
  useEffect(() => {
    if (isAnyActive) {
      setOpen(true);
    }
  }, [isAnyActive]);

  if (items.length === 0) return null;

  return (
    <div className="mb-0.5">
      {/* Group header */}
      <div className="flex items-center gap-1 px-2 py-1.5 group/hdr">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex flex-1 items-center gap-2 text-left rounded-md px-1 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors text-sidebar-foreground hover:text-sidebar-foreground'
          )}
        >
          {GroupIcon && <GroupIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="flex-1 truncate">{group.label}</span>
          {open
            ? <ChevronDown className="h-3 w-3 opacity-60" />
            : <ChevronRight className="h-3 w-3 opacity-60" />}
        </button>
        {group.showAdd && (
          <button
            type="button"
            title="เพิ่ม"
            className="h-5 w-5 rounded flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors opacity-0 group-hover/hdr:opacity-100"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Items */}
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-2">
          {items.map((item) => {
            // Render as nested sub-group if item has children
            if (item.children && item.children.length > 0) {
              return <NestedNavItem key={item.title} item={item} onNavigate={onNavigate} />;
            }

            const isActive =
              item.href === '/'
                ? location.pathname === '/'
                : location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = Number(user?.is_admin) === 1;
  const isSuperAdmin = Number(user?.is_superadmin) === 1;
  const unreadCount = useUnreadCount();
  const { data: billingStatus } = useBillingStatus();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">

      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-base">🚀</span>
        </div>
        <span className="text-base font-bold font-heading tracking-tight">Flowstack</span>
      </div>

      {/* Workspace section */}
      <div className="px-3 pt-3 pb-1 border-b border-sidebar-border">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          พื้นที่ทำงาน
        </p>

        {/* Inbox */}
        <Link
          to="/inbox"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
            location.pathname === '/inbox'
              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span className="flex-1">กล่องข้อความ</span>
          {unreadCount > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Dashboard */}
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
            location.pathname === '/'
              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <BarChart3 className="h-4 w-4 shrink-0" />
          <span>แดชบอร์ด</span>
        </Link>
      </div>

      {/* Collapsible nav groups */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-0.5">
          {NAV_GROUPS.map((group) => (
            <CollapsibleGroup key={group.key} group={group} onNavigate={onNavigate} />
          ))}
        </nav>
      </ScrollArea>

      {/* Billing + SuperAdmin links */}
      <div className="px-3 pb-2 space-y-0.5">
        <Link
          to="/billing"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
            location.pathname === '/billing'
              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <CreditCard className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">การสมัครสมาชิก</span>
          {billingStatus?.status === 'expired' && (
            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold">หมดอายุ</span>
          )}
        </Link>
        {isSuperAdmin && (
          <Link
            to="/superadmin"
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              location.pathname === '/superadmin'
                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Super Admin</span>
          </Link>
        )}
      </div>

      {/* Bottom user section */}
      <div className="border-t border-sidebar-border p-3 flex items-center gap-1">
        {/* User profile */}
        <Link
          to="/profile"
          onClick={onNavigate}
          className="flex flex-1 items-center gap-2.5 rounded-md px-2 py-2 hover:bg-sidebar-accent transition-colors min-w-0"
        >
          <UserAvatar />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-none mb-0.5">
              {user?.display_name || 'ผู้ใช้'}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user?.email || ''}
            </p>
          </div>
          {isAdmin && (
            <span className="shrink-0 text-[10px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
              Admin
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={signOut}
          className="shrink-0 h-8 w-8 rounded-md flex items-center justify-center text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="ออกจากระบบ"
        >
          <LogOut className="h-4 w-4" />
        </button>

      </div>
    </div>
  );
}

// Desktop Sidebar
export function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r border-sidebar-border bg-sidebar">
      <SidebarContent />
    </aside>
  );
}

// Mobile Sidebar (Sheet)
export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0 border-sidebar-border bg-sidebar">
        <SheetTitle className="sr-only">เมนูนำทาง</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

// Top Navigation Bar
export function TopNav() {
  const { user } = useAuth();
  const isAdmin = Number(user?.is_admin) === 1;
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center gap-2 px-4 lg:px-6">
        <MobileSidebar />

        {/* Mobile Logo */}
        <div className="flex lg:hidden items-center gap-2">
          <span className="text-lg">🚀</span>
          <h2 className="text-lg font-bold font-heading">Flowstack</h2>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors border border-input"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">ค้นหา</span>
          <kbd className="hidden sm:inline text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

        {/* Language toggle */}
        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="สลับภาษา"
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline text-xs font-medium">TH ไทย</span>
        </button>

        <Link
          to="/api-docs"
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="คู่มือ API"
        >
          <BarChart3 className="h-4 w-4" />
          <span className="hidden xl:inline">API Docs</span>
        </Link>

        <Link to="/profile" className="hidden lg:flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="text-right">
            <p className="text-sm font-medium">{user?.display_name}</p>
            <p className="text-xs text-muted-foreground">{user?.role_label || user?.position}</p>
          </div>
          <UserAvatar />
        </Link>
      </div>
    </header>
  );
}
