import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/useAuth';
import { Loader2, Save } from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { subscriptionApi, type Profile } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

export default function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();

  const { data: subData, isLoading: subLoading, refetch: refetchSub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.get(),
    enabled: !!user,
  });

  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  const handleCancelClick = async () => {
    setCancelLoading(true);
    try {
      const res = await subscriptionApi.cancel();
      toast.success(res.message);
      setShowCancelModal(false);
      refetchSub();
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  const getBillingCycle = (planStr: string) => planStr.includes('yearly') ? 'Yearly' : 'Monthly';
  
  const getRenewalDate = (dateStr?: string | null, planStr?: string) => {
    if (!dateStr || !planStr) return 'N/A';
    const date = new Date(dateStr);
    if (planStr.includes('yearly')) {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date.toLocaleDateString();
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

  const cycle = subData?.plan ? getBillingCycle(subData.plan) : 'Monthly';
  const renewalDate = getRenewalDate(subData?.plan_selected_at, subData?.plan);
  const isCancelled = subData?.status === 'cancel_at_period_end';

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

            {/* Subscription Block moved from Dashboard */}
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle>Usage & Subscription</CardTitle>
                <CardDescription>Manage your current plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {subLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : subData ? (
                  <>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Plan</span>
                        <span className="text-sm font-semibold">{subData.limits.label}</span>
                      </div>
                      {subData.plan !== 'free' && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Billing Cycle</span>
                            <span className="text-sm">{cycle}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              {isCancelled ? 'Cancels on' : 'Renews on'}
                            </span>
                            <span className="text-sm">{renewalDate}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-4">
                      {Object.entries({
                        'Job Roles': { used: subData.usage.jobs_count, limit: subData.limits.max_jobs },
                        'Technical Assessments': { used: subData.usage.assessments_count, limit: subData.limits.max_assessments },
                        'Interviews': { used: subData.usage.interviews_count, limit: subData.limits.max_interviews }
                      }).map(([label, { used, limit }]) => {
                        const percent = Math.min(100, Math.round((used / limit) * 100));
                        const isHigh = percent >= 80;
                        return (
                          <div key={label} className="space-y-1.5">
                            <div className="flex justify-between items-end">
                              <Label className="text-xs text-muted-foreground">{label}</Label>
                              <span className="text-xs font-medium">
                                {used} / {limit > 900000 ? '∞' : limit}
                              </span>
                            </div>
                            <Progress
                              value={percent}
                              className={`h-2 ${isHigh ? '[&>div]:bg-destructive' : ''}`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <Button variant="outline" className="w-full" onClick={() => setShowUpgrade(true)}>
                        {subData.plan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                      </Button>
                      
                      {subData.plan !== 'free' && !isCancelled && (
                        <div className="flex justify-center mt-2">
                          <button 
                            type="button" 
                            onClick={() => setShowCancelModal(true)}
                            className="text-xs text-muted-foreground hover:text-destructive underline decoration-muted-foreground hover:decoration-destructive transition-colors"
                          >
                            Cancel subscription
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
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

        {subData && (
          <UpgradePrompt
            open={showUpgrade}
            onClose={() => setShowUpgrade(false)}
            resource="operations"
            current={subData.usage.jobs_count}
            limit={subData.limits.max_jobs}
            plan={subData.limits.label}
          />
        )}

        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel your subscription?</DialogTitle>
              <DialogDescription className="pt-2 text-base">
                You'll keep access until <strong>{renewalDate}</strong>. After that, your account moves to the free plan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-end">
              <Button 
                variant="outline" 
                className="text-destructive hover:bg-destructive hover:text-white"
                onClick={handleCancelClick}
                disabled={cancelLoading}
              >
                {cancelLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, cancel
              </Button>
              <Button onClick={() => setShowCancelModal(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Keep my plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
