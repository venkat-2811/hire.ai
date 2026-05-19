import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";


interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: billingUsage } = useQuery({
    queryKey: ['layout-billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  useEffect(() => {
    if (location.pathname === '/onboarding') return;
    if (profile && (profile.onboarding_completed === false || !profile.company_name?.trim())) {
      navigate('/onboarding', { replace: true });
    }
  }, [location.pathname, navigate, profile]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar className="border-r" />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b bg-sidebar">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-sidebar-foreground">Rekshift</span>
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
        
        <main className="flex-1 overflow-auto bg-background">
          {billingUsage?.status === 'paused' && location.pathname !== '/billing' && (
            <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 flex items-center justify-between gap-3">
              <p className="text-sm text-destructive">
                Billing paused: wallet exhausted. Add funds to resume AI features.
              </p>
              <Button size="sm" variant="destructive" onClick={() => navigate('/billing')}>
                Pay Now
              </Button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
