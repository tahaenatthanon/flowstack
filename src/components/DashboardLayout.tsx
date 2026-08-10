import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DesktopSidebar, TopNav } from './AppSidebar';
import { ChatWidget } from '@/components/ChatWidget';
import { useBillingStatus } from '@/hooks/useBilling';
import { useAuth } from '@/hooks/useAuth';
import { getSATenant, clearSATenant, type SATenantCtx } from '@/lib/superadmin-tenant';
import { ShieldCheck, X } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: billingStatus } = useBillingStatus();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [saTenant, setSaTenantState] = useState<SATenantCtx | null>(() => getSATenant());

  // Sync banner whenever location changes (e.g. after navigation)
  useEffect(() => {
    setSaTenantState(getSATenant());
  }, [location.pathname]);

  const isSuperadmin = Number(user?.is_superadmin) === 1;

  useEffect(() => {
    if (
      billingStatus?.status === 'expired' &&
      !isSuperadmin &&
      !location.pathname.startsWith('/billing') &&
      !location.pathname.startsWith('/profile') &&
      !location.pathname.startsWith('/auth')
    ) {
      navigate('/billing?expired=1', { replace: true });
    }
  }, [billingStatus, location.pathname, navigate, isSuperadmin]);

  const handleExitTenant = () => {
    clearSATenant();
    // Full reload to clear React Query cache when exiting tenant context
    window.location.href = '/#/superadmin';
    window.location.reload();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Superadmin tenant impersonation banner */}
        {isSuperadmin && saTenant && (
          <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-violet-600 text-white text-xs font-medium shrink-0 z-50">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} />
              <span>Super Admin — กำลังจัดการ: <strong>{saTenant.name}</strong></span>
            </div>
            <button
              onClick={handleExitTenant}
              className="flex items-center gap-1 hover:bg-violet-700 rounded px-2 py-0.5 transition-colors"
            >
              <X size={12} /> ออกจากโหมดนี้
            </button>
          </div>
        )}

        {/* Top Navigation */}
        <TopNav />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background relative">
          {children}
        </main>

        <ChatWidget />
      </div>
    </div>
  );
}
