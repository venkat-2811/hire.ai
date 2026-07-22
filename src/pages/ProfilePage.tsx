import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/useAuth';
import { useClerk } from '@clerk/clerk-react';
import {
  Loader2, Save, Building2, User, Globe2, Briefcase, MapPin,
  Link as LinkIcon, Users, Building, Phone, Mail, Clock, Sparkles, LogOut,
} from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { type Profile } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, type Variants } from 'framer-motion';

const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'America/Toronto',
  'America/Vancouver',
  'Australia/Sydney',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Amsterdam',
  'Europe/Dublin',
  'Pacific/Auckland',
  'Africa/Johannesburg',
];

function LockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const { signOut } = useClerk();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();

  const [formData, setFormData] = useState<Partial<Profile>>({});

  useEffect(() => {
    if (profile && Object.keys(formData).length === 0) {
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
    if (!formData.country?.trim()) {
      toast.error('Country is required.');
      return;
    }
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

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants: Variants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26 } },
  };

  /** Shared class for editable inputs */
  const editableInput = 'pl-9 border border-input shadow-sm bg-background hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/50';

  /** Shared class for read-only / disabled inputs */
  const readonlyInput = 'pl-9 bg-muted/40 cursor-not-allowed border-muted text-muted-foreground select-none';

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-28 md:pb-10">

        {/* ── Hero Header ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 relative overflow-hidden rounded-2xl border border-primary/20 shadow-md"
        >
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/8" />
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-primary/8 blur-xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row gap-5 items-start sm:items-center p-6 sm:p-8">
            {/* Avatar */}
            <div className="h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg ring-4 ring-white/20 dark:ring-white/10">
              <Building2 className="h-10 w-10 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Organization Profile</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
                {formData.company_name || 'Your Organization'}
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm max-w-2xl">
                Manage your organization's details, hiring preferences, and account settings to customise your recruitment experience.
              </p>
            </div>

            {/* Quick action */}
            <Button
              type="button"
              form="profile-form"
              onClick={handleSubmit}
              disabled={isUpdating}
              size="sm"
              className="hidden sm:flex items-center gap-2 font-semibold shadow-md hover:shadow-lg transition-all shrink-0"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </motion.div>

        <form id="profile-form" onSubmit={handleSubmit} className="space-y-8">
          <Tabs defaultValue="company" className="w-full">

            {/* ── Tab Navigation ──────────────────────────────────── */}
            <div className="flex justify-center mb-8">
              <TabsList className="grid w-full grid-cols-3 max-w-2xl p-1 bg-muted/60 rounded-full gap-1 border border-border/50">
                <TabsTrigger
                  value="company"
                  className="rounded-full text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                >
                  <div className="flex items-center gap-2 py-0.5 px-2">
                    <Building2 className="h-4 w-4" />
                    <span>Company</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="hiring"
                  className="rounded-full text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                >
                  <div className="flex items-center gap-2 py-0.5 px-2">
                    <Briefcase className="h-4 w-4" />
                    <span>Hiring</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="account"
                  className="rounded-full text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                >
                  <div className="flex items-center gap-2 py-0.5 px-2">
                    <User className="h-4 w-4" />
                    <span>Account</span>
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Company Tab ─────────────────────────────────────── */}
            <TabsContent value="company" asChild>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

                {/* Company Identity Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/60 shadow-sm overflow-hidden">
                    {/* Accent top bar */}
                    <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30 w-full" />
                    <CardHeader className="pb-4 pt-5 bg-gradient-to-b from-primary/5 to-transparent">
                      <CardTitle className="text-lg flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Building className="h-4 w-4 text-primary" />
                        </div>
                        Company Identity
                      </CardTitle>
                      <CardDescription>
                        Core information about your organization used across your hiring pipelines.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                        {/* Company Name – read-only */}
                        <div className="space-y-2">
                          <Label htmlFor="company_name" className="text-sm font-medium flex items-center gap-1.5">
                            Company Name
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">locked</span>
                          </Label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                            <Input
                              id="company_name"
                              name="company_name"
                              value={formData.company_name || ''}
                              readOnly
                              disabled
                              className={readonlyInput}
                              placeholder="e.g. Acme Corp"
                            />
                            <LockIcon className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                          </div>
                          <p className="text-[13px] text-muted-foreground mt-1.5 flex items-start gap-1.5 leading-snug">
                            <LockIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" /> 
                            <span>Company Name is locked. Please contact Support if you need to update it.</span>
                          </p>
                        </div>

                        {/* Website – editable */}
                        <div className="space-y-2">
                          <Label htmlFor="company_website" className="text-sm font-medium flex items-center gap-1.5">
                            Website URL
                          </Label>
                          <div className="relative">
                            <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-primary/50" />
                            <Input
                              id="company_website"
                              name="company_website"
                              value={formData.company_website || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. https://acmecorp.com"
                            />
                          </div>
                        </div>

                        {/* Industry – editable */}
                        <div className="space-y-2">
                          <Label htmlFor="industry" className="text-sm font-medium">Industry</Label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-primary/50" />
                            <Input
                              id="industry"
                              name="industry"
                              value={formData.industry || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. Technology"
                            />
                          </div>
                        </div>

                        {/* Company Size – editable */}
                        <div className="space-y-2">
                          <Label htmlFor="company_size" className="text-sm font-medium">Company Size</Label>
                          <div className="relative">
                            <Users className="absolute left-3 top-2.5 h-4 w-4 text-primary/50" />
                            <Input
                              id="company_size"
                              name="company_size"
                              value={formData.company_size || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. 50–200"
                            />
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Location Details Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/60 shadow-sm overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400/70 to-emerald-400/20 w-full" />
                    <CardHeader className="pb-4 pt-5 bg-gradient-to-b from-emerald-500/5 to-transparent">
                      <CardTitle className="text-lg flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                          <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        Location Details
                      </CardTitle>
                      <CardDescription>
                        Where your organization is primarily headquartered.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                        <div className="space-y-2">
                          <Label htmlFor="headquarters_location" className="text-sm font-medium">Headquarters (City / State)</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500/60" />
                            <Input
                              id="headquarters_location"
                              name="headquarters_location"
                              value={formData.headquarters_location || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. San Francisco, CA"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="country" className="text-sm font-medium">Country <span className="text-destructive">*</span></Label>
                          <div className="relative">
                            <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500/60" />
                            <Input
                              id="country"
                              name="country"
                              value={formData.country || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. United States"
                            />
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

              </motion.div>
            </TabsContent>

            {/* ── Hiring Tab ──────────────────────────────────────── */}
            <TabsContent value="hiring" asChild>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

                {/* Recruitment Scope Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/60 shadow-sm overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-violet-500 via-violet-400/70 to-violet-400/20 w-full" />
                    <CardHeader className="pb-4 pt-5 bg-gradient-to-b from-violet-500/5 to-transparent">
                      <CardTitle className="text-lg flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-violet-500/10">
                          <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        Recruitment Scope
                      </CardTitle>
                      <CardDescription>
                        Define the primary roles and regions you are actively hiring for.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                        <div className="space-y-2">
                          <Label htmlFor="hiring_roles" className="text-sm font-medium">Primary Hiring Roles</Label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-violet-500/60" />
                            <Input
                              id="hiring_roles"
                              name="hiring_roles"
                              value={formData.hiring_roles || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. Engineering, Sales, Product"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="hiring_regions" className="text-sm font-medium">Hiring Regions / Scope</Label>
                          <div className="relative">
                            <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-violet-500/60" />
                            <Input
                              id="hiring_regions"
                              name="hiring_regions"
                              value={formData.hiring_regions || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. Remote Worldwide, US & Canada"
                            />
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Operational Settings Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/60 shadow-sm overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-400/70 to-amber-400/20 w-full" />
                    <CardHeader className="pb-4 pt-5 bg-gradient-to-b from-amber-500/5 to-transparent">
                      <CardTitle className="text-lg flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-500/10">
                          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        Operational Settings
                      </CardTitle>
                      <CardDescription>
                        Configure timezone preferences for interviews and scheduling.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Preferred Timezone</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-amber-500/60 z-10" />
                            <Select value={formData.preferred_timezone || undefined} onValueChange={(v) => setFormData(prev => ({ ...prev, preferred_timezone: v }))}>
                              <SelectTrigger className={editableInput}>
                                <SelectValue placeholder="Select Your Timezone" />
                              </SelectTrigger>
                              <SelectContent>
                                {TIMEZONES.map((tz) => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

              </motion.div>
            </TabsContent>

            {/* ── Account Tab ─────────────────────────────────────── */}
            <TabsContent value="account" asChild>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

                {/* Account Credentials Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/60 shadow-sm overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/20 w-full" />
                    <CardHeader className="pb-4 pt-5 bg-gradient-to-b from-primary/5 to-transparent">
                      <CardTitle className="text-lg flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        Account Credentials
                      </CardTitle>
                      <CardDescription>
                        Security and primary contact details for this account.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

                        {/* Login Email – read-only */}
                        <div className="space-y-2">
                          <Label htmlFor="login_email" className="text-sm font-medium flex items-center gap-1.5">
                            Login Email
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">locked</span>
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                            <Input
                              id="login_email"
                              name="login_email"
                              type="email"
                              value={user?.email || ''}
                              readOnly
                              disabled
                              className={readonlyInput}
                            />
                            <LockIcon className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                          </div>
                          <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">
                            This is your secure authentication email from Clerk. It cannot be changed here.
                          </p>
                        </div>

                        {/* Organization Email – read-only */}
                        <div className="space-y-2">
                          <Label htmlFor="organization_email" className="text-sm font-medium flex items-center gap-1.5">
                            Organization Email
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">locked</span>
                          </Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                            <Input
                              id="organization_email"
                              name="organization_email"
                              type="email"
                              value={formData.organization_email || ''}
                              readOnly
                              disabled
                              className={readonlyInput}
                              placeholder="e.g. contact@company.com"
                            />
                            <LockIcon className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
                          </div>
                          <p className="text-[13px] text-muted-foreground mt-1.5 flex items-start gap-1.5 leading-snug">
                            <LockIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" /> 
                            <span>Organization Email is locked. Please contact Support if you need to update it.</span>
                          </p>
                        </div>

                        {/* Contact Phone – editable */}
                        <div className="space-y-2">
                          <Label htmlFor="contact_phone" className="text-sm font-medium">Contact Phone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-primary/50" />
                            <Input
                              id="contact_phone"
                              name="contact_phone"
                              value={formData.contact_phone || ''}
                              onChange={handleChange}
                              className={editableInput}
                              placeholder="e.g. +1 555-0123"
                            />
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Account Actions Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/60 shadow-sm overflow-hidden border-red-500/20">
                    <div className="h-1 bg-gradient-to-r from-red-500 via-red-500/70 to-red-500/20 w-full" />
                    <CardHeader className="pb-4 pt-5 bg-gradient-to-b from-red-500/5 to-transparent">
                      <CardTitle className="text-lg flex items-center gap-2.5 text-red-500">
                        <div className="p-1.5 rounded-lg bg-red-500/10">
                          <LogOut className="h-4 w-4 text-red-500" />
                        </div>
                        Account Actions
                      </CardTitle>
                      <CardDescription>
                        Manage your session and account access.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">Sign Out</p>
                          <p className="text-sm text-muted-foreground">
                            Securely sign out of your account on this device.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20 w-full sm:w-auto"
                          onClick={() => signOut()}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Log out
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

              </motion.div>
            </TabsContent>
          </Tabs>

          {/* ── Save Bar ────────────────────────────────────────── */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t border-border/60 md:relative md:bg-transparent md:backdrop-blur-none md:border-none md:pt-6 md:pb-0 z-10 md:z-auto">
            <div className="max-w-5xl mx-auto flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isUpdating}
                className="font-semibold px-10 shadow-md hover:shadow-lg hover:scale-[1.01] transition-all w-full md:w-auto bg-gradient-to-r from-primary to-primary/85"
              >
                {isUpdating
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  : <><Save className="mr-2 h-4 w-4" />Save Profile Changes</>
                }
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
