import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import logoFull from "@/assets/LOGO_full.png";


interface DashboardLayoutProps {
  children: ReactNode;
  fitContent?: boolean;
}

export function DashboardLayout({ children, fitContent = false }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: billingUsage } = useQuery({
    queryKey: ['layout-billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const { mutate: updateProfile, isPending: isSavingCountry } = useUpdateProfile();
  const [countryInput, setCountryInput] = useState('');
  const [countrySaved, setCountrySaved] = useState(false);

  // Show blocking modal when profile has loaded but country is not set
  const needsCountry = !profileLoading && !!profile && !profile.country?.trim() && !countrySaved;

  const handleSaveCountry = () => {
    const trimmed = countryInput.trim();
    if (!trimmed) return;
    updateProfile({ country: trimmed }, {
      onSuccess: () => setCountrySaved(true),
    });
  };

  useEffect(() => {
    if (location.pathname === '/onboarding') return;
    if (profile && (profile.onboarding_completed === false || !profile.company_name?.trim())) {
      navigate('/onboarding', { replace: true });
    }
  }, [location.pathname, navigate, profile]);

  const rootClassName = fitContent ? "flex" : "flex h-screen overflow-hidden";
  const mainClassName = fitContent ? "flex-1 bg-background" : "flex-1 overflow-auto bg-background";

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
            <SheetContent side="left" className="p-0 w-56 bg-sidebar border-r-0">
              <Sidebar isMobile />
            </SheetContent>
          </Sheet>
        </header>
        
        <main className={mainClassName}>
          {billingUsage && (billingUsage.status === 'paused' || billingUsage.status === 'overdue' || billingUsage.candidates_count >= billingUsage.candidates_limit) && location.pathname !== '/billing' && (
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

          {/* Blocking modal: country is required */}
          <Dialog open={needsCountry}>
            <DialogContent
              className="max-w-md"
              onPointerDownOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              hideCloseButton
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-primary" />
                  One quick step required
                </DialogTitle>
                <DialogDescription>
                  Please enter your country so we can personalise your experience.
                  This helps us show you the correct onboarding fields.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="country-prompt">Country <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="country-prompt"
                      className="pl-9"
                      placeholder="e.g. United States, India, Canada…"
                      value={countryInput}
                      onChange={(e) => setCountryInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCountry(); }}
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!countryInput.trim() || isSavingCountry}
                  onClick={handleSaveCountry}
                >
                  {isSavingCountry ? 'Saving…' : 'Save & Continue'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
