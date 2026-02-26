import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';

const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Australia/Sydney',
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const initial = useMemo(() => {
    return {
      organization_email: profile?.organization_email ?? '',
      company_name: profile?.company_name ?? '',
      company_website: profile?.company_website ?? '',
      company_size: profile?.company_size ?? '',
      industry: profile?.industry ?? '',
      headquarters_location: profile?.headquarters_location ?? '',
      hiring_regions: profile?.hiring_regions ?? '',
      hiring_roles: profile?.hiring_roles ?? '',
      preferred_timezone: profile?.preferred_timezone ?? 'Asia/Kolkata',
      contact_phone: profile?.contact_phone ?? '',
    };
  }, [profile]);

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  useEffect(() => {
    if (profile?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile?.onboarding_completed, navigate]);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.organization_email.trim()) return;
    if (!form.company_name.trim()) return;

    updateProfile.mutate(
      {
        organization_email: form.organization_email.trim(),
        company_name: form.company_name.trim(),
        company_website: form.company_website.trim() || null,
        company_size: form.company_size || null,
        industry: form.industry.trim() || null,
        headquarters_location: form.headquarters_location.trim() || null,
        hiring_regions: form.hiring_regions.trim() || null,
        hiring_roles: form.hiring_roles.trim() || null,
        preferred_timezone: form.preferred_timezone || null,
        contact_phone: form.contact_phone.trim() || null,
        onboarding_completed: true,
      },
      {
        onSuccess: () => {
          navigate('/dashboard', { replace: true });
        },
      },
    );
  };

  if (isLoading) {
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
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold">Company Setup</h1>
          <p className="text-muted-foreground mt-1">Tell us a bit about your company so we can personalize hiring workflows.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>These details will appear in your profile and can be edited later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orgEmail">Organization Email *</Label>
                <Input
                  id="orgEmail"
                  type="email"
                  placeholder="you@company.com"
                  value={form.organization_email}
                  onChange={(e) => onChange('organization_email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="Acme Inc"
                  value={form.company_name}
                  onChange={(e) => onChange('company_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Company Website</Label>
                <Input
                  id="website"
                  placeholder="https://company.com"
                  value={form.company_website}
                  onChange={(e) => onChange('company_website', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Company Size</Label>
                <Select value={form.company_size} onValueChange={(v) => onChange('company_size', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="SaaS, FinTech, Healthcare..."
                  value={form.industry}
                  onChange={(e) => onChange('industry', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hq">Headquarters Location</Label>
                <Input
                  id="hq"
                  placeholder="Bengaluru, India"
                  value={form.headquarters_location}
                  onChange={(e) => onChange('headquarters_location', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Contact Phone</Label>
                <Input
                  id="phone"
                  placeholder="+91 9xxxx xxxxx"
                  value={form.contact_phone}
                  onChange={(e) => onChange('contact_phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Preferred Timezone</Label>
                <Select value={form.preferred_timezone} onValueChange={(v) => onChange('preferred_timezone', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hiringRoles">Hiring Roles (comma-separated)</Label>
              <Textarea
                id="hiringRoles"
                placeholder="Frontend Engineer, Backend Engineer, Salesforce Developer..."
                value={form.hiring_roles}
                onChange={(e) => onChange('hiring_roles', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regions">Hiring Regions (comma-separated)</Label>
              <Textarea
                id="regions"
                placeholder="India, US, Remote..."
                value={form.hiring_regions}
                onChange={(e) => onChange('hiring_regions', e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
