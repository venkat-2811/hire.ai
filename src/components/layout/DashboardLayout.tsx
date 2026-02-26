import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (location.pathname === '/onboarding') return;
    if (profile && profile.onboarding_completed === false) {
      navigate('/onboarding', { replace: true });
    }
  }, [location.pathname, navigate, profile]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
