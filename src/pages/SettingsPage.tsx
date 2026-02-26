import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Basic app settings (demo mode)</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="font-medium">Email</div>
              <div className="text-muted-foreground">{user?.email ?? '—'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>Stored details used across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Company Name</div>
                <div className="text-muted-foreground">{profile?.company_name ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Organization Email</div>
                <div className="text-muted-foreground">{profile?.organization_email ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Website</div>
                <div className="text-muted-foreground">{profile?.company_website ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Company Size</div>
                <div className="text-muted-foreground">{profile?.company_size ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Industry</div>
                <div className="text-muted-foreground">{profile?.industry ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">HQ Location</div>
                <div className="text-muted-foreground">{profile?.headquarters_location ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Hiring Roles</div>
                <div className="text-muted-foreground">{profile?.hiring_roles ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Hiring Regions</div>
                <div className="text-muted-foreground">{profile?.hiring_regions ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Timezone</div>
                <div className="text-muted-foreground">{profile?.preferred_timezone ?? '—'}</div>
              </div>
              <div>
                <div className="font-medium">Contact Phone</div>
                <div className="text-muted-foreground">{profile?.contact_phone ?? '—'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backend</CardTitle>
            <CardDescription>Current API base URL</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              /api (Vercel Serverless Functions)
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
