import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Upload, 
  FileText, 
  Link as LinkIcon, 
  Github,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_CONFIG, LEVEL_CONFIG, type JobRole, type RoleLevel } from '@/types/database';

type Step = 'upload' | 'details' | 'job' | 'consent' | 'processing';

export default function NewCandidatePage() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  // Mock jobs for now
  const jobs = [
    { id: '1', title: 'Senior Salesforce Developer', role: 'salesforce_developer' as JobRole, level: 'senior' as RoleLevel },
    { id: '2', title: 'QA Engineer', role: 'qa_engineer' as JobRole, level: 'mid' as RoleLevel },
    { id: '3', title: 'Business Analyst', role: 'business_analyst' as JobRole, level: 'junior' as RoleLevel },
  ];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setResumeFile(file);
      toast.success('Resume uploaded successfully');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  });

  const handleNext = () => {
    if (currentStep === 'upload' && !resumeFile) {
      toast.error('Please upload a resume');
      return;
    }
    if (currentStep === 'details' && (!fullName || !email)) {
      toast.error('Please fill in required fields');
      return;
    }
    if (currentStep === 'job' && !selectedJob) {
      toast.error('Please select a job');
      return;
    }
    if (currentStep === 'consent' && !consentGiven) {
      toast.error('Please provide consent to proceed');
      return;
    }

    const steps: Step[] = ['upload', 'details', 'job', 'consent', 'processing'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setCurrentStep(nextStep);
      
      if (nextStep === 'processing') {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['upload', 'details', 'job', 'consent'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    
    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast.success('Candidate processed successfully!');
      navigate('/candidates');
    } catch (error) {
      toast.error('Failed to process candidate');
      setCurrentStep('consent');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  const steps = [
    { key: 'upload', label: 'Resume' },
    { key: 'details', label: 'Details' },
    { key: 'job', label: 'Job' },
    { key: 'consent', label: 'Consent' },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/candidates">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Add New Candidate</h1>
            <p className="text-muted-foreground">Upload resume and run AI screening</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                steps.findIndex(s => s.key === currentStep) >= index
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {index + 1}
              </div>
              <span className={cn(
                "ml-2 text-sm hidden sm:inline",
                steps.findIndex(s => s.key === currentStep) >= index
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-12 h-0.5 mx-4",
                  steps.findIndex(s => s.key === currentStep) > index
                    ? "bg-primary"
                    : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 'upload' && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Resume</CardTitle>
                <CardDescription>
                  Upload the candidate's resume in PDF or Word format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : resumeFile
                      ? "border-success bg-success/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                >
                  <input {...getInputProps()} />
                  {resumeFile ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-success/10">
                        <CheckCircle className="h-8 w-8 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{resumeFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(resumeFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Replace File
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-muted">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {isDragActive ? 'Drop the file here' : 'Drag & drop resume here'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          or click to browse (PDF, DOC, DOCX - Max 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'details' && (
            <Card>
              <CardHeader>
                <CardTitle>Candidate Details</CardTitle>
                <CardDescription>
                  Provide additional information about the candidate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-medium">Optional Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="portfolio" className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" /> Portfolio URL
                      </Label>
                      <Input
                        id="portfolio"
                        placeholder="https://portfolio.com"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="github" className="flex items-center gap-2">
                        <Github className="h-4 w-4" /> GitHub URL
                      </Label>
                      <Input
                        id="github"
                        placeholder="https://github.com/username"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'job' && (
            <Card>
              <CardHeader>
                <CardTitle>Select Job Position</CardTitle>
                <CardDescription>
                  Choose the job this candidate is applying for
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job.id)}
                      className={cn(
                        "p-4 rounded-lg border-2 cursor-pointer transition-all",
                        selectedJob === job.id
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/25"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{job.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                              ROLE_CONFIG[job.role].color
                            )}>
                              {ROLE_CONFIG[job.role].icon} {ROLE_CONFIG[job.role].label}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {LEVEL_CONFIG[job.level].label}
                            </span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          selectedJob === job.id
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/25"
                        )}>
                          {selectedJob === job.id && (
                            <CheckCircle className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'consent' && (
            <Card>
              <CardHeader>
                <CardTitle>Consent & Agreement</CardTitle>
                <CardDescription>
                  Confirm candidate consent for AI-powered evaluation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">What happens next?</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5 text-accent" />
                      AI will parse and analyze the resume
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5 text-accent" />
                      Skills will be matched against job requirements
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5 text-accent" />
                      An ATS score and shortlisting decision will be generated
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5 text-accent" />
                      Interview questions will be customized based on the profile
                    </li>
                  </ul>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                  />
                  <div>
                    <Label htmlFor="consent" className="cursor-pointer">
                      I confirm that the candidate has provided consent for AI-powered evaluation
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      By checking this box, you confirm that the candidate has agreed to have their 
                      resume and responses analyzed by AI systems for hiring purposes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'processing' && (
            <Card className="ai-glow">
              <CardContent className="py-16">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="relative">
                    <div className="p-6 rounded-full bg-accent/10 animate-pulse">
                      <Sparkles className="h-12 w-12 text-accent" />
                    </div>
                    <div className="absolute inset-0 rounded-full animate-ping bg-accent/20" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Processing with AI</h3>
                    <p className="text-muted-foreground mt-2">
                      Analyzing resume, matching skills, and generating insights...
                    </p>
                  </div>
                  <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent animate-shimmer rounded-full" style={{ width: '60%' }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Navigation Buttons */}
        {currentStep !== 'processing' && (
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 'upload'}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleNext}>
              {currentStep === 'consent' ? 'Start Processing' : 'Continue'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
