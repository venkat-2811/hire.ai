import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/useAuth';
import { 
  Loader2, Save, Building2, User, Globe2, Briefcase, MapPin, 
  Link as LinkIcon, Users, Building, Phone, Mail, Clock 
} from 'lucide-react';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { type Profile } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        
        {/* Hero / Header Section */}
        <div className="mb-10 flex flex-col sm:flex-row gap-6 items-start sm:items-center bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/10 shadow-sm">
          <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
            <Building2 className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {formData.company_name || 'Organization Profile'}
            </h1>
            <p className="text-muted-foreground mt-2 text-base max-w-2xl">
              Manage your organization's details, hiring preferences, and account settings to customize your recruitment experience.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Tabs defaultValue="company" className="w-full">
            
            {/* Segmented Control */}
            <div className="flex justify-center mb-8">
              <TabsList className="grid w-full grid-cols-3 max-w-2xl p-1 bg-muted/50 rounded-full">
                <TabsTrigger value="company" className="rounded-full data-[state=active]:shadow-sm data-[state=active]:bg-background transition-all">
                  <div className="flex items-center gap-2 py-1 px-2">
                    <Building2 className="h-4 w-4" /> 
                    <span className="font-medium">Company Details</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="hiring" className="rounded-full data-[state=active]:shadow-sm data-[state=active]:bg-background transition-all">
                  <div className="flex items-center gap-2 py-1 px-2">
                    <Briefcase className="h-4 w-4" /> 
                    <span className="font-medium">Hiring Preferences</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="account" className="rounded-full data-[state=active]:shadow-sm data-[state=active]:bg-background transition-all">
                  <div className="flex items-center gap-2 py-1 px-2">
                    <User className="h-4 w-4" /> 
                    <span className="font-medium">Account Settings</span>
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="company" asChild>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                
                {/* Company Identity Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/50 shadow-sm overflow-hidden">
                    <div className="h-2 bg-primary/20 w-full" />
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Building className="h-5 w-5 text-primary" />
                        Company Identity
                      </CardTitle>
                      <CardDescription>
                        Core information about your organization used across your hiring pipelines.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2.5">
                          <Label htmlFor="company_name" className="text-sm font-medium">Company Name</Label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="company_name"
                              name="company_name"
                              value={formData.company_name || ''}
                              readOnly
                              disabled
                              className="pl-9 bg-muted/50 cursor-not-allowed border-muted"
                              placeholder="e.g. Acme Corp"
                            />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor="company_website" className="text-sm font-medium">Website URL</Label>
                          <div className="relative">
                            <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="company_website"
                              name="company_website"
                              value={formData.company_website || ''}
                              readOnly
                              disabled
                              className="pl-9 bg-muted/50 cursor-not-allowed border-muted"
                              placeholder="e.g. https://acmecorp.com"
                            />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor="industry" className="text-sm font-medium">Industry</Label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="industry"
                              name="industry"
                              value={formData.industry || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
                              placeholder="e.g. Technology"
                            />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor="company_size" className="text-sm font-medium">Company Size</Label>
                          <div className="relative">
                            <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="company_size"
                              name="company_size"
                              value={formData.company_size || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
                              placeholder="e.g. 50-200"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Location Details Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Location Details
                      </CardTitle>
                      <CardDescription>
                        Where your organization is primarily headquartered.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2.5">
                          <Label htmlFor="headquarters_location" className="text-sm font-medium">Headquarters (City/State)</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="headquarters_location"
                              name="headquarters_location"
                              value={formData.headquarters_location || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
                              placeholder="e.g. San Francisco, CA"
                            />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                          <div className="relative">
                            <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="country"
                              name="country"
                              value={formData.country || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
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

            <TabsContent value="hiring" asChild>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                
                {/* Recruitment Scope Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/50 shadow-sm">
                    <div className="h-2 bg-primary/20 w-full" />
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Recruitment Scope
                      </CardTitle>
                      <CardDescription>
                        Define the primary areas and regions you are hiring for.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2.5">
                          <Label htmlFor="hiring_roles" className="text-sm font-medium">Primary Hiring Roles</Label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="hiring_roles"
                              name="hiring_roles"
                              value={formData.hiring_roles || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
                              placeholder="e.g. Engineering, Sales, Product"
                            />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor="hiring_regions" className="text-sm font-medium">Hiring Regions / Scope</Label>
                          <div className="relative">
                            <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="hiring_regions"
                              name="hiring_regions"
                              value={formData.hiring_regions || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
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
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Operational Settings
                      </CardTitle>
                      <CardDescription>
                        Configure timezone preferences for interviews and scheduling.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2.5">
                          <Label htmlFor="preferred_timezone" className="text-sm font-medium">Preferred Timezone</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="preferred_timezone"
                              name="preferred_timezone"
                              value={formData.preferred_timezone || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
                              placeholder="e.g. PST, UTC"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

              </motion.div>
            </TabsContent>

            <TabsContent value="account" asChild>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                
                {/* Account Credentials Card */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/50 shadow-sm border-l-4 border-l-primary">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Account Credentials
                      </CardTitle>
                      <CardDescription>
                        Security and primary contact details for this account.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2.5">
                          <Label htmlFor="organization_email" className="text-sm font-medium">Organization / Login Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="organization_email"
                              name="organization_email"
                              type="email"
                              value={formData.organization_email || user?.email || ''}
                              readOnly
                              disabled
                              className="pl-9 bg-muted/50 cursor-not-allowed border-muted"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium mt-1.5 flex items-center gap-1.5">
                            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                            Your mail ID cannot be changed. Contact support for modifications.
                          </p>
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor="contact_phone" className="text-sm font-medium">Contact Phone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="contact_phone"
                              name="contact_phone"
                              value={formData.contact_phone || ''}
                              onChange={handleChange}
                              className="pl-9 transition-colors focus-visible:ring-primary/20"
                              placeholder="e.g. +1 555-0123"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

              </motion.div>
            </TabsContent>
          </Tabs>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t md:relative md:bg-transparent md:backdrop-blur-none md:border-t md:pt-6 md:pb-0 z-10 md:z-auto">
            <div className="max-w-5xl mx-auto flex justify-end">
              <Button 
                type="submit" 
                size="lg" 
                disabled={isUpdating} 
                className="font-semibold px-8 shadow-md hover:shadow-lg transition-all w-full md:w-auto"
              >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Profile Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
