import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth, useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, X, Loader2, Sparkles, Database, Cloud } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateJob, type JobDescriptionCreate } from '@/hooks/useJobs';
import { LEVEL_CONFIG, type RoleLevel } from '@/types/database';
import { toast } from 'sonner';
import { jobsApi } from '@/lib/api';

export default function NewJobPage() {
  const { loading: authLoading } = useRequireAuth();
  useAuth();
  const navigate = useNavigate();
  const createJob = useCreateJob();

  const [extractingSkills, setExtractingSkills] = useState(false);

  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState<RoleLevel | ''>('');
  const [description, setDescription] = useState('');
  const [minExperience, setMinExperience] = useState(0);
  const [resumeCutOff, setResumeCutOff] = useState(35);
  const [assessmentCutOff, setAssessmentCutOff] = useState(40);
  const [interviewCutOff, setInterviewCutOff] = useState(40);
  const [location, setLocation] = useState('');
  const [endCustomer, setEndCustomer] = useState<'your_own_company' | 'end_customer' | ''>('');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>([]);
  const [goodToHaveSkills, setGoodToHaveSkills] = useState<string[]>([]);
  const [newMustHave, setNewMustHave] = useState('');
  const [newGoodToHave, setNewGoodToHave] = useState('');
  // Recruiter-controlled Salesforce/Apex flags
  const [isSalesforceJob, setIsSalesforceJob] = useState(false);

  const handleAddMustHave = () => {
    if (newMustHave.trim() && !mustHaveSkills.includes(newMustHave.trim())) {
      setMustHaveSkills([...mustHaveSkills, newMustHave.trim()]);
      setNewMustHave('');
    }
  };

  const handleAddGoodToHave = () => {
    if (newGoodToHave.trim() && !goodToHaveSkills.includes(newGoodToHave.trim())) {
      setGoodToHaveSkills([...goodToHaveSkills, newGoodToHave.trim()]);
      setNewGoodToHave('');
    }
  };

  const handleRemoveMustHave = (skill: string) => {
    setMustHaveSkills(mustHaveSkills.filter(s => s !== skill));
  };

  const handleRemoveGoodToHave = (skill: string) => {
    setGoodToHaveSkills(goodToHaveSkills.filter(s => s !== skill));
  };

  const extractSkillsFromDescription = async () => {
    if (!description || description.trim().length < 20) {
      toast.error('Please enter a job description (at least 20 characters) before extracting skills');
      return;
    }
    setExtractingSkills(true);
    try {
      const data = await jobsApi.extractSkills({ description, title, role });
      const newMustHave = (data.must_have_skills || []).filter(
        (s: string) => !mustHaveSkills.includes(s)
      );
      const newGoodToHave = (data.good_to_have_skills || []).filter(
        (s: string) => !goodToHaveSkills.includes(s) && !mustHaveSkills.includes(s)
      );
      if (newMustHave.length > 0 || newGoodToHave.length > 0) {
        setMustHaveSkills([...mustHaveSkills, ...newMustHave]);
        setGoodToHaveSkills([...goodToHaveSkills, ...newGoodToHave]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !role || !level || !description) {
      return;
    }

    if (endCustomer === 'end_customer' && !endCustomerName.trim()) {
      toast.error('Name of Customer/Client is required when hiring for End Customer');
      return;
    }

    createJob.mutate({
      title,
      role: role,
      level: level as RoleLevel,
      description,
      must_have_skills: mustHaveSkills,
      good_to_have_skills: goodToHaveSkills,
      min_experience_years: minExperience,
      resume_cutoff: resumeCutOff,
      assessment_cutoff: assessmentCutOff,
      interview_cutoff: interviewCutOff,
      location: location || undefined,
      endCustomer: (endCustomer as any) || undefined,
      end_customer_name: endCustomer === 'end_customer' ? endCustomerName : null,
      is_salesforce_job: isSalesforceJob,
      include_apex_assessment: isSalesforceJob,
    }, {
      onSuccess: () => {
        navigate('/jobs');
      }
    });
  };

  if (authLoading) {
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/jobs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create New Job</h1>
            <p className="text-muted-foreground">Define the job requirements for AI-powered screening</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Job title and classification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    className="border-slate-200 dark:border-slate-800 shadow-sm"
                    placeholder="e.g., Senior Salesforce Developer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role Type *</Label>
                    <Input
                      id="role"
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      placeholder="e.g. Software Development, Sales"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Experience Level *</Label>
                    <Select value={level} onValueChange={(v) => setLevel(v as RoleLevel)}>
                      <SelectTrigger className="border-slate-200 dark:border-slate-800 shadow-sm">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LEVEL_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label} ({config.experienceRange})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experience">Min. Years Experience</Label>
                    <Input
                      id="experience"
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      type="number"
                      min={0}
                      max={20}
                      value={minExperience}
                      onChange={(e) => setMinExperience(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      placeholder="e.g., Remote, New York"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hiring For</Label>
                    <Select value={endCustomer} onValueChange={(v) => setEndCustomer(v as any)}>
                      <SelectTrigger className="border-slate-200 dark:border-slate-800 shadow-sm">
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
                        className="border-slate-200 dark:border-slate-800 shadow-sm"
                        placeholder="e.g., Acme Corp"
                        value={endCustomerName}
                        onChange={(e) => setEndCustomerName(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex flex-col justify-center border border-slate-200 dark:border-slate-800 p-4 rounded-lg bg-card shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_salesforce_job"
                      checked={isSalesforceJob}
                      onCheckedChange={(checked) => setIsSalesforceJob(checked)}
                      className="border border-primary/30"
                    />
                    <Label htmlFor="is_salesforce_job" className="cursor-pointer font-semibold">
                      Salesforce Related Job
                    </Label>
                  </div>
                  <p className="text-sm text-foreground font-medium mt-1">
                    Enable to automatically use Apex assessments instead of standard DSA coding challenges
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Job Description *</Label>
                  <Textarea
                    id="description"
                    className="border-slate-200 dark:border-slate-800 shadow-sm"
                    placeholder="Describe the role, responsibilities, and what you're looking for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    required
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
                      <>
                        <svg className="mr-2" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M9 17.5H3.5M6.5 12H2M9 6.5H4M17 3L10.4036 12.235C10.1116 12.6438 9.96562 12.8481 9.97194 13.0185C9.97744 13.1669 10.0486 13.3051 10.1661 13.3958C10.3011 13.5 10.5522 13.5 11.0546 13.5H16L15 21L21.5964 11.765C21.8884 11.3562 22.0344 11.1519 22.0281 10.9815C22.0226 10.8331 21.9514 10.6949 21.8339 10.6042C21.6989 10.5 21.4478 10.5 20.9454 10.5H16L17 3Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Auto-Extract Skills from Description
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="resume_cutoff">Resume Cut-off Score (0-100)</Label>
                    <Input
                      id="resume_cutoff"
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      type="number"
                      min={0}
                      max={100}
                      value={resumeCutOff}
                      onChange={(e) => setResumeCutOff(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assessment_cutoff">Assessment Cut-off Score (0-100)</Label>
                    <Input
                      id="assessment_cutoff"
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      type="number"
                      min={0}
                      max={100}
                      value={assessmentCutOff}
                      onChange={(e) => setAssessmentCutOff(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interview_cutoff">Interview Cut-off Score (0-100)</Label>
                    <Input
                      id="interview_cutoff"
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      type="number"
                      min={0}
                      max={100}
                      value={interviewCutOff}
                      onChange={(e) => setInterviewCutOff(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle>Required Skills</CardTitle>
                <CardDescription>Define must-have and good-to-have skills for AI screening</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Must-Have Skills */}
                <div className="space-y-3">
                  <Label>Must-Have Skills</Label>
                  <div className="flex gap-2">
                    <Input
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      placeholder="Add a required skill..."
                      value={newMustHave}
                      onChange={(e) => setNewMustHave(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMustHave())}
                    />
                    <Button type="button" onClick={handleAddMustHave} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mustHaveSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm"
                      >
                        {skill}
                        <button type="button" onClick={() => handleRemoveMustHave(skill)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Good-to-Have Skills */}
                <div className="space-y-3">
                  <Label>Good-to-Have Skills</Label>
                  <div className="flex gap-2">
                    <Input
                      className="border-slate-200 dark:border-slate-800 shadow-sm"
                      placeholder="Add a nice-to-have skill..."
                      value={newGoodToHave}
                      onChange={(e) => setNewGoodToHave(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoodToHave())}
                    />
                    <Button type="button" onClick={handleAddGoodToHave} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {goodToHaveSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-info/10 text-info text-sm"
                      >
                        {skill}
                        <button type="button" onClick={() => handleRemoveGoodToHave(skill)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>



            {/* Submit */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link to="/jobs">Cancel</Link>
              </Button>
              <Button type="submit" disabled={createJob.isPending}>
                {createJob.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Job'
                )}
              </Button>
            </div>
          </div>
        </form>

      </div>
    </DashboardLayout>
  );
}
