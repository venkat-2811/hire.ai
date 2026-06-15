import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/useAuth';
import { Loader2, Save, Building2, User, Globe2, Briefcase, MapPin } from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { type Profile } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();

  const [formData, setFormData] = useState<Partial<Profile>>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        organization_email: profile.organization_email || user?.email || '',
        company_website: profile.company_website || '',
        company_size: profile.company_size || '',
        industry: profile.industry || '',
        headquarters_location: profile.headquarters_location || '',
        country: profile.country || '',
        hiring_roles: profile.hiring_roles || '',
        hiring_regions: profile.hiring_regions || '',
        preferred_timezone: profile.preferred_timezone || '',
        contact_phone: profile.contact_phone || '',
      });
    }
  }, [profile, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
  };

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Organization Profile</h1>
          <p className="text-muted-foreground mt-2">
            Manage your organization's details, hiring preferences, and account settings.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-2xl mb-8">
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Company Details
              </TabsTrigger>
              <TabsTrigger value="hiring" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Hiring Preferences
              </TabsTrigger>
              <TabsTrigger value="account" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Organization Information</CardTitle>
                  <CardDescription>
                    These details will be used across your hiring pipelines and external communications.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        name="company_name"
                        value={formData.company_name || ''}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                        placeholder="e.g. Acme Corp"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_website">Website URL</Label>
                      <Input
                        id="company_website"
                        name="company_website"
                        value={formData.company_website || ''}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                        placeholder="e.g. https://acmecorp.com"
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
                      <Label htmlFor="company_size">Company Size</Label>
                      <Input
                        id="company_size"
                        name="company_size"
                        value={formData.company_size || ''}
                        onChange={handleChange}
                        placeholder="e.g. 50-200"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" /> Location Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="headquarters_location">Headquarters (City/State)</Label>
                        <Input
                          id="headquarters_location"
                          name="headquarters_location"
                          value={formData.headquarters_location || ''}
                          onChange={handleChange}
                          placeholder="e.g. San Francisco, CA"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          name="country"
                          value={formData.country || ''}
                          onChange={handleChange}
                          placeholder="e.g. United States"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="hiring" className="space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Hiring Setup</CardTitle>
                  <CardDescription>
                    Configure your recruitment scope and operational preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="hiring_roles">Primary Hiring Roles</Label>
                      <Input
                        id="hiring_roles"
                        name="hiring_roles"
                        value={formData.hiring_roles || ''}
                        onChange={handleChange}
                        placeholder="e.g. Engineering, Sales, Product"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hiring_regions">Hiring Regions / Scope</Label>
                      <Input
                        id="hiring_regions"
                        name="hiring_regions"
                        value={formData.hiring_regions || ''}
                        onChange={handleChange}
                        placeholder="e.g. Remote Worldwide, US & Canada"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-muted-foreground" /> Operational Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account" className="space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Account Credentials</CardTitle>
                  <CardDescription>
                    Security and primary contact details for this account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="organization_email">Organization / Login Email</Label>
                      <Input
                        id="organization_email"
                        name="organization_email"
                        type="email"
                        value={formData.organization_email || user?.email || ''}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
                        Your mail ID cannot be changed. Contact support for modifications.
                      </p>
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
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-6 border-t mt-8">
            <Button type="submit" size="lg" disabled={isUpdating} className="font-semibold px-8">
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
