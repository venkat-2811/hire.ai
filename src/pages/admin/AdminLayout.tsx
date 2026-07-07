import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Loader2, ShieldAlert, Activity, CreditCard, Users, ListFilter } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminLayout() {
  const { loading: authLoading } = useRequireAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && !adminLoading && !isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, adminLoading, isAdmin, navigate]);

  if (authLoading || adminLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const currentTab = location.pathname.split('/').pop() || 'operational';
  const activeTab = currentTab === 'logins-today' ? 'operational' : currentTab;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Secure operational overview for founder accounts.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            <span>Restricted to 3 admin accounts</span>
          </div>
        </div>

        {/* Navigation */}
        <Tabs value={activeTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="operational" asChild>
              <Link to="/admin/operational" className="gap-2">
                <Activity className="h-4 w-4" />
                Operational
              </Link>
            </TabsTrigger>
            <TabsTrigger value="business" asChild>
              <Link to="/admin/business" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Business
              </Link>
            </TabsTrigger>
            <TabsTrigger value="people" asChild>
              <Link to="/admin/people" className="gap-2">
                <Users className="h-4 w-4" />
                People
              </Link>
            </TabsTrigger>
            <TabsTrigger value="usage-history" asChild>
              <Link to="/admin/usage-history" className="gap-2">
                <ListFilter className="h-4 w-4" />
                Usage History
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </DashboardLayout>
  );
}
