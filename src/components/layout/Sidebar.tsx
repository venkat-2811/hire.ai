import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Trophy,
  UserCircle,
  Wallet,
  BarChart3,
  Shield,
} from "lucide-react";
import logoFull from "@/assets/LOGO_full.png";
import logoIcon from "@/assets/logo.png";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Results', href: '/results', icon: Trophy },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Admin', href: '/admin', icon: Shield, adminOnly: true },
  { name: 'Billing', href: '/billing', icon: Wallet },
  { name: 'Profile', href: '/profile', icon: UserCircle },
];

export function Sidebar({ isMobile, className }: { isMobile?: boolean; className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const { isAdmin } = useIsAdmin();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/sign-in');
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300",
        !isMobile && collapsed ? "w-16" : "w-56",
        isMobile && "w-full",
        className
      )}
    >
      {/* Branding Section */}
      <div className="flex items-center h-[68px] px-4 border-b border-sidebar-border/60">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 w-full min-w-0 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {(!isMobile && collapsed) ? (
            /* Collapsed: Square Icon centered */
            <div className="flex items-center justify-center h-9 w-9 mx-auto flex-shrink-0 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <img
                src={logoIcon}
                alt="Rekshift"
                className="h-5 w-auto object-contain"
                draggable={false}
              />
            </div>
          ) : (
            /* Expanded: logo left + company info right */
            <>
              <div className="flex-shrink-0">
                <img
                  src={logoFull}
                  alt="Rekshift"
                  className="h-16 w-auto object-contain"
                  draggable={false}
                />
              </div>
              {profile?.company_name && (
                <div className="flex flex-col justify-center min-w-0 border-l border-sidebar-border/50 pl-3">
                  <span
                    className="text-[15px] font-bold text-sidebar-foreground truncate leading-tight tracking-tight"
                    title={profile.company_name}
                  >
                    {profile.company_name}
                  </span>
                  <span className="text-[11px] text-sidebar-foreground/45 font-medium leading-none mt-0.5">
                    Workspace
                  </span>
                </div>
              )}
            </>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!((!isMobile && collapsed)) && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            (!isMobile && collapsed) && "justify-center"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!((!isMobile && collapsed)) && <span>Logout</span>}
        </Button>

        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full text-sidebar-foreground/50 hover:text-sidebar-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
