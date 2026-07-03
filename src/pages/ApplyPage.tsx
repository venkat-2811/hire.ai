/**
 * Public job application page.
 * Candidates can view job details and submit their application.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import logoFull from '@/assets/LOGO_full.png';
import {
  Briefcase,
  MapPin,
  Clock,
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  ArrowLeft,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { applyApi, type PublicJob } from '@/lib/api';

export default function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [location, setLocation] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [mainSkillset, setMainSkillset] = useState('');

  // Fetch job details
  useEffect(() => {
    async function fetchJob() {
      if (!jobId) return;

      try {
        const data = await applyApi.getJob(jobId);
        setJob(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no longer accepting')) {
          setError('This job is no longer accepting applications.');
        } else {
          setError('Candidates cannot be onboarded into this job');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [jobId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setResumeFile(acceptedFiles[0]);
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!resumeFile) {
      toast.error('Please upload your resume');
      return;
    }

    if (!consentGiven) {
      toast.error('Please agree to the terms to continue');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('job_id', jobId || '');
      formData.append('full_name', fullName);
      formData.append('email', email);
      if (phone) formData.append('phone', phone);
      if (portfolioUrl) formData.append('portfolio_url', portfolioUrl);
      if (githubUrl) formData.append('github_url', githubUrl);
      if (location) formData.append('location', location);
      if (vendorName) formData.append('vendorName', vendorName);
      if (mainSkillset) formData.append('mainSkillset', mainSkillset);
      formData.append('consent_given', String(consentGiven));
      formData.append('resume', resumeFile);

      await applyApi.submit(formData);

      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to submit application';
      if (errMsg.includes('already applied')) {
        toast.error('Candidate has existing application for this Job', { duration: 7000 });
      } else {
        toast.error(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Job Not Found</CardTitle>
            <CardDescription>{error || 'This job posting is no longer available.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl">Application Submitted!</CardTitle>
              <CardDescription className="text-base">
                Thank you for applying to <strong>{job.title}</strong>. We've sent a confirmation
                email to <strong>{email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Our team will review your application and contact you soon regarding the next steps of your application.
              </p>
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => navigate('/')}>
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    salesforce_developer: 'Salesforce Developer',
    qa_engineer: 'QA Engineer',
    business_analyst: 'Business Analyst',
  };

  const levelLabels: Record<string, string> = {
    intern: 'Intern',
    junior: 'Junior',
    mid: 'Mid-Level',
    senior: 'Senior',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src={logoFull}
              alt="Rekshift"
              className="h-9 w-auto object-contain"
              draggable={false}
            />
          </div>
          {isLoaded && !isSignedIn && (
            <Button variant="outline" size="sm" onClick={() => navigate('/sign-in')}>
              Sign In
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Job Details */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="secondary">{roleLabels[job.role] || job.role}</Badge>
                <Badge variant="outline">{levelLabels[job.level] || job.level}</Badge>
                {job.min_experience_years > 0 && (
                  <Badge variant="outline">
                    <Clock className="mr-1 h-3 w-3" />
                    {job.min_experience_years}+ years
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-2xl lg:text-3xl">{job.title}</CardTitle>
                <div className="flex items-center text-muted-foreground gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="font-medium text-lg">{job.company_name}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">About the Role</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </div>

              <Separator />

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.must_have_skills.map((skill) => (
                      <Badge key={skill} variant="default">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Nice to Have</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.good_to_have_skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Form */}
          <Card>
            <CardHeader>
              <CardTitle>Apply for this Position</CardTitle>
              <CardDescription>
                Fill out the form below to submit your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="github">GitHub URL</Label>
                    <Input
                      id="github"
                      type="url"
                      placeholder="https://github.com/username"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g. Current or Preferred Location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mainSkillset">Primary Skill/Domain</Label>
                    <Input
                      id="mainSkillset"
                      placeholder="e.g. Frontend, Backend, Design"
                      value={mainSkillset}
                      onChange={(e) => setMainSkillset(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portfolio">Portfolio URL</Label>
                  <Input
                    id="portfolio"
                    type="url"
                    placeholder="https://yourportfolio.com"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendorName">Resume provided by</Label>
                  <Input
                    id="vendorName"
                    placeholder="e.g. Vendor name, Referral"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </div>

                {/* Resume Upload */}
                <div className="space-y-2">
                  <Label>Resume *</Label>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/25 hover:border-primary/50'
                      }`}
                  >
                    <input {...getInputProps()} />
                    {resumeFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        <div className="text-left">
                          <p className="font-medium">{resumeFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResumeFile(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Drag & drop your resume here, or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PDF, DOC, or DOCX (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Consent */}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                  />
                  <Label htmlFor="consent" className="text-sm leading-relaxed">
                    I agree to the processing of my personal data for recruitment purposes and
                    understand that my information will be used to evaluate my candidacy for this
                    position.
                  </Label>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
