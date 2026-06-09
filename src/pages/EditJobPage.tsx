import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth, useAuth } from '@/hooks/useAuth';
import { useJob } from '@/hooks/useJobs';
import { LEVEL_CONFIG, type RoleLevel } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Save, Sparkles, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { jobsApi } from '@/lib/api';

export default function EditJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useRequireAuth();
  useAuth();
  const { data: job, isLoading } = useJob(jobId || '');

  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState<RoleLevel | ''>('');
  const [description, setDescription] = useState('');
  const [mustHaveSkills, setMustHaveSkills] = useState('');
  const [goodToHaveSkills, setGoodToHaveSkills] = useState('');
  const [minExperience, setMinExperience] = useState('0');
  const [resumeCutoff, setResumeCutoff] = useState('0');
  const [assessmentCutoff, setAssessmentCutoff] = useState('0');
  const [interviewCutoff, setInterviewCutoff] = useState('0');
  const [location, setLocation] = useState('');
  const [endCustomer, setEndCustomer] = useState<'your_own_company' | 'end_customer' | ''>('');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [extractingSkills, setExtractingSkills] = useState(false);
  // Recruiter-controlled Salesforce/Apex flags
  const [isSalesforceJob, setIsSalesforceJob] = useState(false);

  useEffect(() => {
    if (job) {
      setTitle(job.title || '');
      setRole(job.role || '');
      setLevel(job.level || '');
      setDescription(job.description || '');
      setMustHaveSkills((job.must_have_skills || []).join(', '));
      setGoodToHaveSkills((job.good_to_have_skills || []).join(', '));
      setMinExperience(String(job.min_experience_years || 0));
      setResumeCutoff(String(job.resume_cutoff || 0));
      setAssessmentCutoff(String(job.assessment_cutoff || 0));
      setInterviewCutoff(String(job.interview_cutoff || 0));
      setLocation(job.location || '');
      setEndCustomer((job.endCustomer || job.end_customer) as any || '');
      setEndCustomerName(job.end_customer_name || '');
      setIsSalesforceJob(job.is_salesforce_job ?? false);
    }
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !role || !level) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (endCustomer === 'end_customer' && !endCustomerName.trim()) {
      toast.error('Name of Customer/Client is required when hiring for End Customer');
      return;
    }

    setSaving(true);
    try {
      await jobsApi.update(jobId || '', {
        title,
        role: role as any,
        level,
        description,
        must_have_skills: mustHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
        good_to_have_skills: goodToHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
        min_experience_years: parseInt(minExperience) || 0,
        resume_cutoff: parseInt(resumeCutoff) || 0,
        assessment_cutoff: parseInt(assessmentCutoff) || 0,
        interview_cutoff: parseInt(interviewCutoff) || 0,
        location: location || undefined,
        endCustomer: endCustomer || undefined,
        end_customer_name: endCustomer === 'end_customer' ? endCustomerName.trim() : null,
        is_salesforce_job: isSalesforceJob,
        include_apex_assessment: isSalesforceJob,
      } as any);

      toast.success('Job updated successfully');
      navigate(`/jobs/${jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update a job');
    } finally {
      setSaving(false);
    }
  };

  const extractSkillsFromDescription = async () => {
    if (!description || description.trim().length < 20) {
      toast.error('Please enter a job description (at least 20 characters) before extracting skills');
      return;
    }
    setExtractingSkills(true);
    try {
      const data = await jobsApi.extractSkills({ description, title, role });
      const currentMustHave = mustHaveSkills.split(',').map(s => s.trim()).filter(Boolean);
      const currentGoodToHave = goodToHaveSkills.split(',').map(s => s.trim()).filter(Boolean);
      const newMustHave = (data.must_have_skills || []).filter(
        (s: string) => !currentMustHave.includes(s)
      );
      const newGoodToHave = (data.good_to_have_skills || []).filter(
        (s: string) => !currentGoodToHave.includes(s) && !currentMustHave.includes(s)
      );
      if (newMustHave.length > 0 || newGoodToHave.length > 0) {
        if (newMustHave.length > 0) {
          setMustHaveSkills([...currentMustHave, ...newMustHave].join(', '));
        }
        if (newGoodToHave.length > 0) {
          setGoodToHaveSkills([...currentGoodToHave, ...newGoodToHave].join(', '));
        }
        toast.success(`Added ${newMustHave.length} must-have and ${newGoodToHave.length} good-to-have skills`);
      } else {
        toast.info('No new skills found — all extracted skills are already added');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to extract skills');
    } finally {
      setExtractingSkills(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout fitContent>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fitContent>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl lg:text-3xl font-bold"
          >
            Edit Job
          </motion.h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>Update the job posting information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Senior Frontend Developer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g., Frontend Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Level *</Label>
                  <Select value={level} onValueChange={(v) => setLevel(v as RoleLevel)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEVEL_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {(config as any).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 flex flex-col justify-center">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_salesforce_job"
                    checked={isSalesforceJob}
                    onCheckedChange={(checked) => setIsSalesforceJob(checked)}
                  />
                  <Label htmlFor="is_salesforce_job" className="cursor-pointer">
                    Salesforce Related Job
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Enable to automatically use Apex assessments instead of standard DSA coding challenges
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Job description..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mustHave">Must Have Skills (comma-separated)</Label>
                <Input
                  id="mustHave"
                  value={mustHaveSkills}
                  onChange={(e) => setMustHaveSkills(e.target.value)}
                  placeholder="e.g., React, TypeScript, Node.js"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goodToHave">Good to Have Skills (comma-separated)</Label>
                <Input
                  id="goodToHave"
                  value={goodToHaveSkills}
                  onChange={(e) => setGoodToHaveSkills(e.target.value)}
                  placeholder="e.g., GraphQL, AWS, Docker"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={extractSkillsFromDescription}
                  disabled={extractingSkills || !description || description.trim().length < 20}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
                >
                  {extractingSkills ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting Skills...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />Auto-Extract Skills from Description</>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="experience">Minimum Experience (years)</Label>
                  <Input
                    id="experience"
                    type="number"
                    min="0"
                    value={minExperience}
                    onChange={(e) => setMinExperience(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Remote, New York"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hiring For</Label>
                  <Select value={endCustomer} onValueChange={(v: any) => setEndCustomer(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="your_own_company">Your Own Company</SelectItem>
                      <SelectItem value="end_customer">End Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {endCustomer === 'end_customer' && (
                  <div className="space-y-2">
                    <Label htmlFor="end_customer_name">Name of Customer/Client *</Label>
                    <Input
                      id="end_customer_name"
                      placeholder="e.g., Acme Corp"
                      value={endCustomerName}
                      onChange={(e) => setEndCustomerName(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resume_cutoff">Resume Cut-off Score</Label>
                  <Input
                    id="resume_cutoff"
                    type="number"
                    min="0"
                    max="100"
                    value={resumeCutoff}
                    onChange={(e) => setResumeCutoff(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assessment_cutoff">Assessment Cut-off Score</Label>
                  <Input
                    id="assessment_cutoff"
                    type="number"
                    min="0"
                    max="100"
                    value={assessmentCutoff}
                    onChange={(e) => setAssessmentCutoff(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interview_cutoff">Interview Cut-off Score</Label>
                  <Input
                    id="interview_cutoff"
                    type="number"
                    min="0"
                    max="100"
                    value={interviewCutoff}
                    onChange={(e) => setInterviewCutoff(e.target.value)}
                  />
                </div>
              </div>



              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Save Changes</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
