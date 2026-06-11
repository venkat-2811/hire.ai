import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoFull from "@/assets/LOGO_full.png";
import { useAdmin } from "@/hooks/useAdmin";


interface DashboardLayoutProps {
  children: ReactNode;
  fitContent?: boolean;
}

export function DashboardLayout({ children, fitContent = false }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { isAdmin } = useAdmin();

  const { data: billingUsage } = useQuery({
    queryKey: ['layout-billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    // Skip billing fetch entirely for admins — they have unlimited access
    enabled: !isAdmin,
  });

  useEffect(() => {
    if (location.pathname === '/onboarding') return;
    if (profile && (profile.onboarding_completed === false || !profile.company_name?.trim())) {
      navigate('/onboarding', { replace: true });
    }
  }, [location.pathname, navigate, profile]);

  const rootClassName = fitContent ? "flex" : "flex h-screen overflow-hidden";
  const mainClassName = fitContent ? "flex-1 bg-background" : "flex-1 overflow-auto bg-background";

  // Admin users: never show the plan limit banner — they have unlimited access.
  const showLimitBanner = !isAdmin
    && billingUsage
    && (
      billingUsage.status === 'paused'
      || billingUsage.status === 'overdue'
      || billingUsage.candidates_count >= billingUsage.candidates_limit
    )
    && location.pathname !== '/billing';

  return (
    <div className={rootClassName}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar className="border-r" />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b bg-sidebar">
          <div className="flex items-center">
            <div className="rounded-xl bg-white/95 px-2.5 py-1.5">
              <img
                src={logoFull}
                alt="Rekshift"
                className="h-7 w-auto object-contain block"
                draggable={false}
              />
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r-0">
              <Sidebar isMobile />
            </SheetContent>
          </Sheet>
        </header>
        
        <main className={mainClassName}>
          {showLimitBanner && (
            <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 flex items-center justify-between gap-3">
              <p className="text-sm text-destructive">
                You have reached your plan limit. Please choose a subscription plan to continue assessing additional candidates.
              </p>
              <Button size="sm" variant="destructive" onClick={() => navigate('/billing')}>
                Upgrade Plan
              </Button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
