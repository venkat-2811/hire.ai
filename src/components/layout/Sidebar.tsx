import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trophy,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Results', href: '/results', icon: Trophy },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Profile', href: '/profile', icon: UserCircle },
];

export function Sidebar({ isMobile, className }: { isMobile?: boolean; className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/sign-in');
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300",
        !isMobile && collapsed ? "w-16" : "w-64",
        isMobile && "w-full",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Sparkles className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!((!isMobile && collapsed)) && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground inline-flex items-center gap-2">
                HireAI
                {profile?.company_name && (
                  <>
                    <span className="text-sidebar-foreground/50 text-sm font-normal">|</span>
                    <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]" title={profile.company_name}>
                      {profile.company_name}
                    </span>
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
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
