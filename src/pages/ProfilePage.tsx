import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/useAuth';
import { Loader2, Save } from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import type { Profile } from '@/lib/api';

export default function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();

  const [formData, setFormData] = useState<Partial<Profile>>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        organization_email: profile.organization_email || '',
        company_website: profile.company_website || '',
        company_size: profile.company_size || '',
        industry: profile.industry || '',
        headquarters_location: profile.headquarters_location || '',
        hiring_roles: profile.hiring_roles || '',
        hiring_regions: profile.hiring_regions || '',
        preferred_timezone: profile.preferred_timezone || '',
        contact_phone: profile.contact_phone || '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
  };

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
      <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account and company details</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6 md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
                <CardDescription>Your personal login information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} readOnly disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed directly.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Technical details</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>
                  <span className="font-medium">API Endpoint: </span>
                  <span className="text-muted-foreground">/api (Vercel)</span>
                </div>
                <div>
                  <span className="font-medium">User ID: </span>
                  <span className="text-muted-foreground break-all text-xs">{user?.id}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card>
              <form onSubmit={handleSubmit}>
                <CardHeader>
                  <CardTitle>Company Profile</CardTitle>
                  <CardDescription>This information is used across your hiring pipelines and reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        name="company_name"
                        value={formData.company_name || ''}
                        onChange={handleChange}
                        placeholder="e.g. Acme Corp"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organization_email">Organization Email</Label>
                      <Input
                        id="organization_email"
                        name="organization_email"
                        type="email"
                        value={formData.organization_email || ''}
                        onChange={handleChange}
                        placeholder="e.g. careers@acmecorp.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_website">Website</Label>
                      <Input
                        id="company_website"
                        name="company_website"
                        value={formData.company_website || ''}
                        onChange={handleChange}
                        placeholder="e.g. https://acmecorp.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_size">Company Size</Label>
                      <Input
                        id="company_size"
                        name="company_size"
                        value={formData.company_size || ''}
                        onChange={handleChange}
                        placeholder="e.g. 50-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Input
                        id="industry"
                        name="industry"
                        value={formData.industry || ''}
                        onChange={handleChange}
                        placeholder="e.g. Technology"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="headquarters_location">HQ Location</Label>
                      <Input
                        id="headquarters_location"
                        name="headquarters_location"
                        value={formData.headquarters_location || ''}
                        onChange={handleChange}
                        placeholder="e.g. San Francisco, CA"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hiring_roles">Hiring Roles</Label>
                      <Input
                        id="hiring_roles"
                        name="hiring_roles"
                        value={formData.hiring_roles || ''}
                        onChange={handleChange}
                        placeholder="e.g. Engineering, Sales"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hiring_regions">Hiring Regions</Label>
                      <Input
                        id="hiring_regions"
                        name="hiring_regions"
                        value={formData.hiring_regions || ''}
                        onChange={handleChange}
                        placeholder="e.g. Remote, US"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferred_timezone">Preferred Timezone</Label>
                      <Input
                        id="preferred_timezone"
                        name="preferred_timezone"
                        value={formData.preferred_timezone || ''}
                        onChange={handleChange}
                        placeholder="e.g. PST"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_phone">Contact Phone</Label>
                      <Input
                        id="contact_phone"
                        name="contact_phone"
                        value={formData.contact_phone || ''}
                        onChange={handleChange}
                        placeholder="e.g. +1 555-0123"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-6">
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
