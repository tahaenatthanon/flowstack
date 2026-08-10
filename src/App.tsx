import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { DashboardLayout } from "./components/DashboardLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

// ── Route-level code splitting ──
const HomePage = lazy(() => import('./pages/HomePage'));
const Index = lazy(() => import('./pages/Index'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const ResourceDashboard = lazy(() => import('./pages/ResourceDashboard'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const SalesDetailPage = lazy(() => import('./pages/SalesDetailPage'));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage'));
const LeadGenerationPage = lazy(() => import('./pages/LeadGenerationPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ImpactOSPage = lazy(() => import('./pages/ImpactOSPage'));
const RevenuePage = lazy(() => import('./pages/RevenuePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const TaskIntelligencePage = lazy(() => import('./pages/TaskIntelligencePage'));
const TaskHoursPage = lazy(() => import('./pages/TaskHoursPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));
const InboxPage = lazy(() => import('./pages/InboxPage'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('./pages/NotFound'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const AutomationPage = lazy(() => import('./pages/AutomationPage'));
const BudgetPage = lazy(() => import('./pages/BudgetPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));
const CampaignAnalyticsPage = lazy(() => import('./pages/CampaignAnalyticsPage'));
const ContentPage = lazy(() => import('./pages/ContentPage'));
const ContentPlannerPage = lazy(() => import('./pages/ContentPlannerPage'));
const ContentApprovalPage = lazy(() => import('./pages/ContentApprovalPage'));
const ContentDashboardPage = lazy(() => import('./pages/ContentDashboardPage'));
const MediaStudioPage = lazy(() => import('./pages/MediaStudioPage'));
const RecurringTasksPage = lazy(() => import('./pages/RecurringTasksPage'));
const SurveyPage = lazy(() => import('@/pages/SurveyPage'));
const SurveyPublicPage = lazy(() => import('@/pages/SurveyPublicPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const WorkflowPage = lazy(() => import('./pages/WorkflowPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const BrandSettingPage = lazy(() => import('./pages/BrandSettingPage'));
const DataManagementPage = lazy(() => import('./pages/DataManagementPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes - reduces API calls on page navigation
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Don't refetch on window focus for better UX
      refetchOnWindowFocus: false,
      // Retry failed requests once
      retry: 1,
    },
  },
});

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    กำลังโหลด...
  </div>
);

// Requires login only
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <DashboardLayout><ErrorBoundary section="Page">{children}</ErrorBoundary></DashboardLayout>;
};

// Redirect to home if already logged in
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Requires login + specific menu permission
const PermissionRoute = ({
  children,
  menuKey,
}: {
  children: React.ReactNode;
  menuKey: string;
}) => {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission(menuKey)) return <Navigate to="/" replace />;
  return <DashboardLayout><ErrorBoundary section="Page">{children}</ErrorBoundary></DashboardLayout>;
};

const AuthGate = ({ guest, auth }: { guest: React.ReactNode; auth: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <>{auth}</> : <>{guest}</>;
};

// Use HashRouter for compatibility with /flowstack subdirectory
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConfirmProvider>
          <Toaster />
          <Sonner />
          <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/" element={<AuthGate guest={<LandingPage />} auth={<PermissionRoute menuKey="home"><HomePage /></PermissionRoute>} />} />
                <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
                <Route path="/superadmin" element={<ProtectedRoute><SuperAdminPage /></ProtectedRoute>} />
                <Route path="/projects"  element={<PermissionRoute menuKey="projects">  <Index />            </PermissionRoute>} />
                <Route path="/project/:id" element={<PermissionRoute menuKey="projects"><ProjectDetail />    </PermissionRoute>} />
                <Route path="/resources" element={<PermissionRoute menuKey="resources"> <ResourceDashboard /></PermissionRoute>} />
                <Route path="/task-hours" element={<PermissionRoute menuKey="task_hours"> <TaskHoursPage /></PermissionRoute>} />
                <Route path="/goals" element={<PermissionRoute menuKey="goals"> <GoalsPage /></PermissionRoute>} />
                <Route path="/automation" element={<PermissionRoute menuKey="automation"> <AutomationPage /></PermissionRoute>} />
                <Route path="/workflow" element={<PermissionRoute menuKey="workflow"> <WorkflowPage /></PermissionRoute>} />
                <Route path="/budget" element={<PermissionRoute menuKey="budget"> <BudgetPage /></PermissionRoute>} />
                <Route path="/companies" element={<PermissionRoute menuKey="companies"> <CompaniesPage /> </PermissionRoute>} />
                <Route path="/sales"     element={<PermissionRoute menuKey="sales">     <SalesPage />        </PermissionRoute>} />
                <Route path="/sales/:id" element={<PermissionRoute menuKey="sales"> <SalesDetailPage /> </PermissionRoute>} />
                <Route path="/surveys" element={<PermissionRoute menuKey="sales"><SurveyPage /></PermissionRoute>} />
                <Route path="/lead-generation" element={<PermissionRoute menuKey="lead_generation"><LeadGenerationPage /></PermissionRoute>} />
                <Route path="/survey/public/:token" element={<SurveyPublicPage />} />
                <Route path="/quotations" element={<PermissionRoute menuKey="quotations"><QuotationsPage />   </PermissionRoute>} />
                <Route path="/analytics" element={<PermissionRoute menuKey="analytics"> <AnalyticsPage />    </PermissionRoute>} />
                <Route path="/impactos" element={<PermissionRoute menuKey="analytics"> <ImpactOSPage />     </PermissionRoute>} />
                <Route path="/revenue"   element={<PermissionRoute menuKey="revenue">   <RevenuePage />      </PermissionRoute>} />
                <Route path="/reports"   element={<Navigate to="/analytics" replace />} />
                <Route path="/task-intelligence" element={<PermissionRoute menuKey="task_intelligence"><TaskIntelligencePage /></PermissionRoute>} />
                <Route path="/marketing" element={<PermissionRoute menuKey="marketing"><MarketingPage />   </PermissionRoute>} />
                <Route path="/admin"     element={<PermissionRoute menuKey="admin">     <AdminPage />        </PermissionRoute>} />
                <Route path="/help"      element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
                <Route path="/api-docs" element={<ProtectedRoute><ApiDocsPage /></ProtectedRoute>} />
                <Route path="/profile"  element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/inbox"    element={<PermissionRoute menuKey="inbox"><InboxPage /></PermissionRoute>} />
                <Route path="/support"         element={<PermissionRoute menuKey="support">   <SupportPage />      </PermissionRoute>} />
                <Route path="/knowledge-base" element={<PermissionRoute menuKey="support">   <KnowledgeBasePage /></PermissionRoute>} />
                <Route path="/brand-setting" element={<PermissionRoute menuKey="brand_setting"><BrandSettingPage /></PermissionRoute>} />
                <Route path="/data-management" element={<PermissionRoute menuKey="data_management"><DataManagementPage /></PermissionRoute>} />
                <Route path="/campaigns" element={<Navigate to="/marketing" replace />} />
                <Route path="/campaign-analytics" element={<PermissionRoute menuKey="marketing"> <CampaignAnalyticsPage /> </PermissionRoute>} />
                <Route path="/content"         element={<PermissionRoute menuKey="marketing"> <ContentPage />         </PermissionRoute>} />
                <Route path="/content-dashboard" element={<PermissionRoute menuKey="marketing"> <ContentDashboardPage />         </PermissionRoute>} />
                <Route path="/content-approval" element={<PermissionRoute menuKey="content_approval"> <ContentApprovalPage /> </PermissionRoute>} />
                <Route path="/content-planner" element={<PermissionRoute menuKey="marketing"> <ContentPlannerPage /> </PermissionRoute>} />
                <Route path="/media-studio" element={<PermissionRoute menuKey="media_studio"><MediaStudioPage /></PermissionRoute>} />
                <Route path="/recurring-tasks" element={<Navigate to="/task-hours" replace />} />
                <Route path="/calendar"        element={<PermissionRoute menuKey="calendar">   <CalendarPage />      </PermissionRoute>} />
                <Route path="/export"          element={<Navigate to="/admin" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </HashRouter>
        </ConfirmProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
