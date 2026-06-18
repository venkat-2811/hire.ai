import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Globe,
  Github,
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  Code,
  MessageSquare,
  ClipboardList,
  ExternalLink,
  Shield,
  MapPin,
  User,
  Briefcase,
  Database,
  Target,
} from 'lucide-react';
import { useCandidate, useCandidateScreenings } from '@/hooks/useCandidates';
import { useProfile } from '@/hooks/useProfile';
import { candidatesApi, jobsApi, type AssessmentDetails, type InterviewDetails, type ManualInterviewDetails } from '@/lib/api';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Award, Clock, CheckSquare, Activity, ChevronRight } from 'lucide-react';
import { PDFExportService } from '@/lib/pdf-export';
import { Download, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { EditCandidateModal } from '@/components/ui/EditCandidateModal';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';

const safeRender = (val: any): string => {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
};

const formatDateWithOrdinal = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
};

const getAssessmentContent = (assessmentDetails: any): any => {
  if (!assessmentDetails) return {};
  
  const pd = assessmentDetails?.proctoring_data;
  if (pd && typeof pd === 'object') {
    const ac = (pd as any)?.assessment_content;
    if (ac && typeof ac === 'object') return ac;
  }
  return {};
};

export default function CandidateDetailsPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job_id') || undefined;
  const initialTab = searchParams.get('tab') || undefined;
  const { loading: authLoading } = useRequireAuth();
  const { data: candidate, isLoading, error: candidateError, refetch } = useCandidate(candidateId || '');

  const { data: profile } = useProfile();
  const { data: screenings } = useCandidateScreenings(candidateId || '');
  const screening = jobId
    ? (screenings || []).find((s: any) => s.job_id === jobId)
    : (screenings || [])[0] || null;

  const [assessmentDetails, setAssessmentDetails] = useState<AssessmentDetails | null>(null);
  const [interviewDetails, setInterviewDetails] = useState<InterviewDetails | null>(null);
  const [manualInterviewDetails, setManualInterviewDetails] = useState<ManualInterviewDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Screenshot Evidence State
  const [assessmentScreenshot, setAssessmentScreenshot] = useState<string | null>(null);
  const [interviewScreenshot, setInterviewScreenshot] = useState<string | null>(null);
  const [screenshotDialogOpen, setScreenshotDialogOpen] = useState(false);
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState<string | null>(null);

  const [manualScore, setManualScore] = useState<string>('');
  const [manualFeedback, setManualFeedback] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [jobData, setJobData] = useState<any>(null);

  useEffect(() => {
    if (jobId) {
      jobsApi.get(jobId).then(setJobData).catch(() => {});
    }
  }, [jobId]);

  
  const handleSaveManualInterview = async () => {
    if (!candidateId) return;
    setSavingManual(true);
    try {
      await candidatesApi.updateManualInterview(candidateId, jobId || '', {
        manual_interview_score: manualScore ? parseFloat(manualScore) : null,
        manual_interview_notes: manualNotes,
        manual_interview_feedback: manualFeedback
      });
      toast.success('Manual interview evaluation saved successfully');
      const [interview, manual] = await Promise.all([
        candidatesApi.getInterviewDetails(candidateId, jobId).catch(() => null),
        candidatesApi.getManualInterview(candidateId, jobId).catch(() => null),
      ]);
      setInterviewDetails(interview);
      setManualInterviewDetails(manual);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save evaluation');
    } finally {
      setSavingManual(false);
    }
  };

  const pd = assessmentDetails?.proctoring_data;
  const sqlChallenges = asArray<any>(pd?.assessment_content?.sql_challenges);
  const sqlSubs = asArray<any>(pd?.sql_submissions);
  const hasSql = sqlChallenges.length > 0 || sqlSubs.length > 0 || assessmentDetails?.sql_score != null;

  
  const [expandedMcq, setExpandedMcq] = useState<string[]>([]);
  const [expandedApex, setExpandedApex] = useState<string[]>([]);
  const [expandedSql, setExpandedSql] = useState<string[]>([]);
  const [expandedInterview, setExpandedInterview] = useState<string[]>([]);
  const [generatingAnswers, setGeneratingAnswers] = useState(false);

  const handleGenerateExpectedAnswers = async () => {
    if (!candidateId) return;
    setGeneratingAnswers(true);
    try {
      const res = await candidatesApi.generateExpectedAnswers(candidateId, jobId);
      if (res.updated) {
        toast.success('Expected answers generated successfully');
        // Refresh interview details
        const updatedInterview = await candidatesApi.getInterviewDetails(candidateId, jobId).catch(() => null);
        setInterviewDetails(updatedInterview);
      } else {
        toast.info('No missing expected answers to generate');
      }
    } catch (e: any) {
      toast.error('Failed to generate expected answers');
    } finally {
      setGeneratingAnswers(false);
    }
  };


  useEffect(() => {
    if (interviewDetails && Array.isArray(interviewDetails.questions)) {
      const missing = interviewDetails.questions.some((q: any) => !q.expected_answer && !q.expected_response);
      if (missing && !generatingAnswers && candidateId) {
        setGeneratingAnswers(true);
        candidatesApi.generateExpectedAnswers(candidateId, jobId).then((res) => {
          if (res.updated) {
            candidatesApi.getInterviewDetails(candidateId, jobId).then(updatedInterview => {
              setInterviewDetails(updatedInterview);
            }).catch(() => {});
          }
        }).catch(() => {}).finally(() => setGeneratingAnswers(false));
      }
    }
  }, [interviewDetails, candidateId, jobId, generatingAnswers]);

  const handleExpandAllMcq = () => {
    if (!assessmentDetails) return;
    const content = getAssessmentContent(assessmentDetails);
    const questions = asArray<any>(assessmentDetails.mcq_questions).length > 0
      ? asArray<any>(assessmentDetails.mcq_questions)
      : asArray<any>((content as any)?.mcq_questions);
    
    if (expandedMcq.length === questions.length) {
      setExpandedMcq([]);
    } else {
      setExpandedMcq(questions.map((q: any, idx: number) => `item-${q?.id != null ? q.id : idx}`));
    }
  };

  const handleExpandAllApex = () => {
    if (!assessmentDetails) return;
    const content = getAssessmentContent(assessmentDetails);
    const isSalesforce = jobData?.is_salesforce_job || jobData?.include_apex_assessment;
    const challenges = isSalesforce 
      ? (asArray<any>((assessmentDetails as any).apex_blanks).length > 0 ? asArray<any>((assessmentDetails as any).apex_blanks) : asArray<any>((content as any)?.apex_blanks))
      : (asArray<any>(assessmentDetails.coding_challenges).length > 0 ? asArray<any>(assessmentDetails.coding_challenges) : asArray<any>((content as any)?.coding_challenges));
    
    if (expandedApex.length === challenges.length) {
      setExpandedApex([]);
    } else {
      setExpandedApex(challenges.map((ch: any, idx: number) => `coding-${ch?.id != null ? String(ch.id) : String(idx)}`));
    }
  };

  const handleExpandAllSql = () => {
    if (!assessmentDetails) return;
    const pd = assessmentDetails.proctoring_data as any;
    const sqlChallenges: any[] = pd?.assessment_content?.sql_challenges || [];
    const sqlSubs: any[] = pd?.sql_submissions || [];
    const displayList: any[] = sqlChallenges.length > 0 ? sqlChallenges : sqlSubs.map((s: any) => ({ id: s?.challenge_id, title: 'SQL Challenge', description: '' }));
    
    if (expandedSql.length === displayList.length) {
      setExpandedSql([]);
    } else {
      setExpandedSql(displayList.map((ch: any, idx: number) => `sql-${ch?.id != null ? String(ch.id) : String(idx)}`));
    }
  };

  const handleExpandAllInterview = () => {
    if (!interviewDetails?.questions) return;
    if (expandedInterview.length === interviewDetails.questions.length) {
      setExpandedInterview([]);
    } else {
      setExpandedInterview(interviewDetails.questions.map((_, idx) => `interview-q-${idx}`));
    }
  };

  const [evaluationTab, setEvaluationTab] = useState<string>(() => {
    if (initialTab === 'manual') return 'manual';
    if (initialTab === 'interview') return 'interview';
    return 'assessment';
  });

  const handleDownloadReport = () => {
    if (candidate) {
      PDFExportService.generateCandidateReport(
        candidate as any,
        assessmentDetails,
        interviewDetails,
        screening,
        manualInterviewDetails,
        profile as any
      );
    }
  };

  useEffect(() => {
    if (!candidateId) return;
    setLoadingDetails(true);
    Promise.all([
      candidatesApi.getAssessmentDetails(candidateId, jobId).catch(() => null),
      candidatesApi.getInterviewDetails(candidateId, jobId).catch(() => null),
      jobId ? candidatesApi.getManualInterview(candidateId, jobId).catch(() => null) : Promise.resolve(null),
    ]).then(([assessment, interview, manualInterview]) => {
      setAssessmentDetails(assessment);
      setInterviewDetails(interview);
      setManualInterviewDetails(manualInterview);

      if (manualInterview) {
        setManualScore(manualInterview.manual_interview_score != null ? String(manualInterview.manual_interview_score) : '');
        // Use feedback field (backend normalises both feedback and notes)
        setManualFeedback(manualInterview.manual_interview_feedback || manualInterview.manual_interview_notes || '');
        setManualNotes(manualInterview.manual_interview_notes || '');
      } else {
        setManualScore('');
        setManualFeedback('');
        setManualNotes('');
      }
    }).finally(() => setLoadingDetails(false));
  }, [candidateId, jobId]);

  // Fetch Screenshot Evidence URLs
  // NOTE: assessment-details endpoint returns raw DB row where session id = 'id'.
  //       interview-details endpoint explicitly maps it to 'session_id'.
  //       We check both to be safe.
  useEffect(() => {
    const fetchScreenshots = async () => {
      console.log('[Screenshot] assessmentDetails:', assessmentDetails);
      const assessmentSessionId = (assessmentDetails as any)?.session_id || (assessmentDetails as any)?.id;
      console.log('[Screenshot] assessmentSessionId derived:', assessmentSessionId);
      if (assessmentSessionId) {
        const url = `${supabase.storage.from('session-screenshots').getPublicUrl(`assessment/${assessmentSessionId}/latest.jpg`).data.publicUrl}?t=${Date.now()}`;
        console.log('[Screenshot] Attempting to load Assessment URL:', url);
        const img = new Image();
        img.onload = () => {
          console.log('[Screenshot] Assessment image loaded successfully!');
          setAssessmentScreenshot(url);
        };
        img.onerror = () => console.log('[Screenshot] Assessment image not found for session:', assessmentSessionId, url);
        img.src = url;
      }
      
      console.log('[Screenshot] interviewDetails:', interviewDetails);
      const interviewSessionId = (interviewDetails as any)?.session_id || (interviewDetails as any)?.id;
      console.log('[Screenshot] interviewSessionId derived:', interviewSessionId);
      if (interviewSessionId) {
        const url = `${supabase.storage.from('session-screenshots').getPublicUrl(`ai_interview/${interviewSessionId}/latest.jpg`).data.publicUrl}?t=${Date.now()}`;
        console.log('[Screenshot] Attempting to load Interview URL:', url);
        const img = new Image();
        img.onload = () => {
          console.log('[Screenshot] Interview image loaded successfully!');
          setInterviewScreenshot(url);
        };
        img.onerror = () => console.log('[Screenshot] Interview image not found for session:', interviewSessionId, url);
        img.src = url;
      }
    };
    fetchScreenshots();
  }, [(assessmentDetails as any)?.session_id || (assessmentDetails as any)?.id, (interviewDetails as any)?.session_id || (interviewDetails as any)?.id]);

  useEffect(() => {
    if (initialTab === 'manual' || initialTab === 'interview' || initialTab === 'assessment' || initialTab === 'sql-assessment') {
      setEvaluationTab(initialTab);
    }
  }, [initialTab]);

  const saveManualInterview = async () => {
    if (!candidateId || !jobId) {
      toast.error('job_id is required to save manual interview details');
      return;
    }

    const scoreValue = manualScore.trim() === '' ? null : Number(manualScore);
    if (scoreValue != null && (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100)) {
      toast.error('Score must be a number between 0 and 100');
      return;
    }

    setSavingManual(true);
    try {
      const updated = await candidatesApi.updateManualInterview(candidateId, jobId, {
        interview_mode: 'manual',
        manual_interview_score: scoreValue,
        manual_interview_feedback: manualFeedback || null,
        manual_interview_notes: manualNotes || null,
      });
      setManualInterviewDetails(updated);
      toast.success('Manual interview saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save manual interview');
    } finally {
      setSavingManual(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (candidateError || !candidate) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">
                {candidateError
                  ? `Error loading candidate: ${candidateError instanceof Error ? candidateError.message : 'Unknown error'}`
                  : 'Candidate not found'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {candidateError && (
                  <Button variant="outline" onClick={() => refetch()}>
                    Retry
                  </Button>
                )}
                <Button asChild>
                  <Link to="/candidates">Back to the Candidates</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        
        {/* 1. Sticky Header & Quick Actions */}
        <div className="bg-card text-card-foreground border rounded-xl shadow-sm p-5 sm:p-6 sticky top-0 z-20">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate(jobId ? `/candidates?job_id=${encodeURIComponent(jobId)}` : '/candidates')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                  <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl lg:text-3xl font-bold"
                  >
                    {safeRender(candidate.full_name)}
                  </motion.h1>
                  <Badge variant={candidate.consent_given ? 'default' : 'secondary'} className="h-6">
                    {candidate.consent_given ? 'Consent Given' : 'No Consent'}
                  </Badge>
                  {(candidate.applied_at || screening?.created_at) && (
                    <span className="text-xs text-muted-foreground font-medium bg-muted/60 px-2.5 py-0.5 rounded-full border border-muted-foreground/10">
                      Applied: {formatDateWithOrdinal(candidate.applied_at || screening?.created_at)}
                    </span>
                  )}
                  {jobData?.title && (
                    <Badge variant="outline" className="h-6 border-primary/20 bg-primary/5 text-primary">
                      {jobData.title}
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-2">
                  {candidate.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      <span>{safeRender(candidate.email)}</span>
                    </div>
                  )}
                  {candidate.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      <span>{safeRender(candidate.phone)}</span>
                    </div>
                  )}
                  {candidate.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      <span>{safeRender(candidate.location)}</span>
                    </div>
                  )}
                  {candidate.mainSkillset && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4" />
                      <span>{safeRender(candidate.mainSkillset)}</span>
                    </div>
                  )}
                  {candidate.applied_at && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>Applied: {new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(candidate.applied_at))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
              <Button variant="outline" onClick={() => setEditModalOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
              <Button variant="default" onClick={handleDownloadReport}>
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Summary Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-card shadow-sm border-muted">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resume Score</p>
              {screening?.overall_score != null ? (
                <ScoreBadge score={screening.overall_score} size="lg" />
              ) : <span className="text-xl font-bold text-muted-foreground">-</span>}
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-sm border-muted">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assessment Score</p>
              {assessmentDetails?.total_score != null ? (
                <ScoreBadge score={assessmentDetails.total_score} size="lg" />
              ) : <span className="text-xl font-bold text-muted-foreground">-</span>}
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-sm border-muted">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {jobData?.is_salesforce_job || jobData?.include_apex_assessment ? 'Apex Score' : 'Coding Score'}
              </p>
              {assessmentDetails?.coding_score != null ? (
                <ScoreBadge score={assessmentDetails.coding_score} size="lg" />
              ) : <span className="text-xl font-bold text-muted-foreground">-</span>}
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-sm border-muted">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">SQL Score</p>
              {hasSql ? (
                <ScoreBadge score={assessmentDetails?.sql_score ?? 0} size="lg" />
              ) : (
                <span className="text-xl font-bold text-muted-foreground">-</span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm border-muted">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interview Score</p>
              {manualInterviewDetails?.manual_interview_score != null ? (
                <ScoreBadge score={manualInterviewDetails.manual_interview_score} size="lg" />
              ) : interviewDetails?.final_evaluation?.overall_score != null ? (
                <ScoreBadge score={interviewDetails.final_evaluation.overall_score} size="lg" />
              ) : <span className="text-xl font-bold text-muted-foreground">-</span>}
            </CardContent>
          </Card>
          
          <Card className={
            interviewDetails?.final_evaluation?.recommendation?.toLowerCase() === 'hire' || interviewDetails?.final_evaluation?.recommendation?.toLowerCase() === 'strong_hire' 
              ? "bg-success/10 border-success/20 shadow-sm" 
              : interviewDetails?.final_evaluation?.recommendation?.toLowerCase() === 'maybe' 
                ? "bg-warning/10 border-warning/20 shadow-sm"
                : interviewDetails?.final_evaluation?.recommendation ? "bg-destructive/10 border-destructive/20 shadow-sm" : "bg-card shadow-sm border-muted"
          }>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Final Recommendation</p>
              {interviewDetails?.final_evaluation?.recommendation ? (
                <span className="text-sm font-bold uppercase tracking-wide">
                  {interviewDetails.final_evaluation.recommendation.replace(/_/g, ' ')}
                </span>
              ) : <span className="text-xl font-bold text-muted-foreground">-</span>}
            </CardContent>
          </Card>
        </div>

        {/* 3. Tab-Based Navigation */}
        <Tabs defaultValue={evaluationTab === 'overview' ? 'overview' : evaluationTab || 'overview'} onValueChange={setEvaluationTab} className="w-full space-y-6">
          <div className="overflow-x-auto pb-2 scrollbar-hide">
            <TabsList className="w-full justify-start inline-flex h-12 items-center rounded-md bg-muted p-1 text-muted-foreground min-w-max">
              <TabsTrigger value="overview" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
              <TabsTrigger value="resume" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Resume Analysis</TabsTrigger>
              <TabsTrigger value="assessment" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Assessment Results</TabsTrigger>
              <TabsTrigger value="coding" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                {jobData?.is_salesforce_job || jobData?.include_apex_assessment ? 'Apex' : 'Coding'}
              </TabsTrigger>
              <TabsTrigger value="sql" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">SQL</TabsTrigger>
              <TabsTrigger value="interview" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">AI Interview</TabsTrigger>
              <TabsTrigger value="activity" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Activity & Timeline</TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                
                {candidate.resume_parsed_data && typeof candidate.resume_parsed_data === 'object' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Candidate Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {typeof (candidate.resume_parsed_data as any).summary === 'string' && (candidate.resume_parsed_data as any).summary.trim() && (
                        <div>
                          <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {safeRender((candidate.resume_parsed_data as any).summary)}
                          </div>
                        </div>
                      )}
                      
                      {Array.isArray((candidate.resume_parsed_data as any).skills) && (
                        <div>
                          <div className="text-sm font-semibold mb-3">Key Skills</div>
                          <div className="flex flex-wrap gap-2">
                            {asArray<string>((candidate.resume_parsed_data as any).skills).map((s, i) => (
                              <Badge key={i} variant="secondary" className="px-3 py-1 font-medium">{safeRender(s)}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Hiring Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Resume Status</span>
                        {screening ? (
                          <Badge className="bg-success/10 text-success hover:bg-success/20 border-none">Screened</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Assessment</span>
                        {assessmentDetails?.total_score != null ? (
                          <Badge className="bg-success/10 text-success hover:bg-success/20 border-none">Completed</Badge>
                        ) : assessmentDetails ? (
                          <Badge className="bg-warning/10 text-warning hover:bg-warning/20 border-none">Pending Completion</Badge>
                        ) : (
                          <Badge variant="secondary">Not Sent</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Interview</span>
                        {(interviewDetails?.final_evaluation?.overall_score != null || manualInterviewDetails?.manual_interview_score != null) ? (
                          <Badge className="bg-success/10 text-success hover:bg-success/20 border-none">Completed</Badge>
                        ) : (interviewDetails || manualInterviewDetails?.interview_mode === 'manual' || manualInterviewDetails?.interview_status) ? (
                          <Badge className="bg-warning/10 text-warning hover:bg-warning/20 border-none">Pending Completion</Badge>
                        ) : (
                          <Badge variant="secondary">Not Sent</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {candidate.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{safeRender(candidate.email)}</span>
                      </div>
                    )}
                    {candidate.phone ? (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{safeRender(candidate.phone)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground italic">No phone provided</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Links & Profiles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {candidate.portfolio_url && (
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium text-sm">
                          {safeRender(candidate.portfolio_url)}
                        </a>
                      </div>
                    )}
                    {candidate.github_url && (
                      <div className="flex items-center gap-3">
                        <Github className="h-5 w-5 text-muted-foreground" />
                        <a href={candidate.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium text-sm">
                          {safeRender(candidate.github_url)}
                        </a>
                      </div>
                    )}
                    {(!candidate.portfolio_url && !candidate.github_url) && (
                      <div className="text-sm text-muted-foreground italic">No links provided</div>
                    )}
                    {candidate.vendorName && (
                      <div className="flex items-center gap-3 pt-2 border-t mt-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground text-sm">Vendor: <span className="font-medium text-foreground">{safeRender(candidate.vendorName)}</span></span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: RESUME ANALYSIS */}
          <TabsContent value="resume" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {screening && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>ATS Screening Scores</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {typeof screening.skill_relevance_score === 'number' && (
                          <div className="p-3 bg-muted/30 rounded-lg text-center">
                            <p className="text-xs text-muted-foreground mb-1">Skills</p>
                            <div className="flex justify-center">
                              <ScoreBadge score={screening.skill_relevance_score} size="sm" />
                            </div>
                          </div>
                        )}
                        {typeof screening.experience_score === 'number' && (
                          <div className="p-3 bg-muted/30 rounded-lg text-center">
                            <p className="text-xs text-muted-foreground mb-1">Experience</p>
                            <div className="flex justify-center">
                              <ScoreBadge score={screening.experience_score} size="sm" />
                            </div>
                          </div>
                        )}
                        {typeof screening.education_score === 'number' && (
                          <div className="p-3 bg-muted/30 rounded-lg text-center">
                            <p className="text-xs text-muted-foreground mb-1">Education</p>
                            <div className="flex justify-center">
                              <ScoreBadge score={screening.education_score} size="sm" />
                            </div>
                          </div>
                        )}
                        {typeof screening.credibility_score === 'number' && (
                          <div className="p-3 bg-muted/30 rounded-lg text-center">
                            <p className="text-xs text-muted-foreground mb-1">Credibility</p>
                            <div className="flex justify-center">
                              <ScoreBadge score={screening.credibility_score} size="sm" />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>ATS Feedback</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const whatsGood = screening.detailed_analysis?.whats_good?.length 
                          ? screening.detailed_analysis.whats_good 
                          : (screening.reason_codes || []).filter((r: any) => r.type?.toLowerCase() === 'positive').map((r: any) => r.description);

                        const whatLacks = screening.detailed_analysis?.what_lacks?.length 
                          ? screening.detailed_analysis.what_lacks 
                          : (screening.reason_codes || []).filter((r: any) => r.type?.toLowerCase() === 'negative').map((r: any) => r.description);

                        return (
                          <div className="space-y-4">
                            {whatsGood.length > 0 && (
                              <div className="text-sm text-muted-foreground bg-success/5 border border-success/20 p-4 rounded-lg">
                                <p className="font-semibold text-success mb-2 flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4" /> What's Good
                                </p>
                                <ul className="space-y-2 list-disc pl-5">
                                  {whatsGood.map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="text-sm text-muted-foreground bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                              <p className="font-semibold text-destructive mb-2 flex items-center gap-2">
                                <XCircle className="h-4 w-4" /> What Lacks
                              </p>
                              {whatLacks.length > 0 ? (
                                <ul className="space-y-2 list-disc pl-5">
                                  {whatLacks.map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">No significant gaps detected for this role.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  {candidate.resume_parsed_data && typeof candidate.resume_parsed_data === 'object' ? (
                    <>
                      {/* Added Resume Summary and Skills to Resume tab */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Resume Summary & Skills</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {typeof (candidate.resume_parsed_data as any).summary === 'string' && (candidate.resume_parsed_data as any).summary.trim() && (
                            <div>
                              <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {safeRender((candidate.resume_parsed_data as any).summary)}
                              </div>
                            </div>
                          )}
                          
                          {Array.isArray((candidate.resume_parsed_data as any).skills) && (
                            <div>
                              <div className="text-sm font-semibold mb-3">Key Skills</div>
                              <div className="flex flex-wrap gap-2">
                                {asArray<string>((candidate.resume_parsed_data as any).skills).map((s, i) => (
                                  <Badge key={i} variant="secondary" className="px-3 py-1 font-medium">{safeRender(s)}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {Array.isArray((candidate.resume_parsed_data as any).experience) && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Experience</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {asArray<any>((candidate.resume_parsed_data as any).experience).map((e, i) => (
                              <div key={i} className="relative pl-6 pb-6 last:pb-0 border-l border-muted">
                                <div className="absolute w-3 h-3 bg-primary rounded-full -left-[6.5px] top-1"></div>
                                <div className="font-semibold text-base">{safeRender(e?.title) || 'Role'}</div>
                                <div className="text-sm text-primary font-medium mt-1">{safeRender(e?.company)}{e?.duration ? ` • ${safeRender(e.duration)}` : ''}</div>
                                {e?.description && (
                                  <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{safeRender(e.description)}</div>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {Array.isArray((candidate.resume_parsed_data as any).education) && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Education</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {asArray<any>((candidate.resume_parsed_data as any).education).map((ed, i) => (
                              <div key={i} className="p-4 rounded-lg border bg-muted/10">
                                <div className="font-semibold">{safeRender(ed?.degree) || 'Degree'}</div>
                                <div className="text-sm text-muted-foreground mt-1">{safeRender(ed?.institution)}{ed?.year ? ` • ${safeRender(ed.year)}` : ''}</div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {Array.isArray((candidate.resume_parsed_data as any).projects) && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Projects</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-4 md:grid-cols-2">
                            {asArray<any>((candidate.resume_parsed_data as any).projects).map((p, i) => (
                              <div key={i} className="p-4 rounded-lg border bg-muted/10 flex flex-col">
                                <div className="font-semibold">{safeRender(p?.name || p?.title) || 'Project'}</div>
                                {p?.description && (
                                  <div className="mt-2 text-sm text-muted-foreground flex-1">{safeRender(p.description)}</div>
                                )}
                                {Array.isArray(p?.technologies) && p.technologies.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {p.technologies.map((t: any, ti: number) => (
                                      <Badge key={ti} variant="outline" className="text-xs">{safeRender(t)}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center text-muted-foreground">
                        No parsed resume details available.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: ASSESSMENT RESULTS */}
          <TabsContent value="assessment" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {assessmentDetails ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle>Multiple Choice Assessment</CardTitle>
                    <CardDescription>Topic-wise performance and detailed responses</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExpandAllMcq}>
                    {expandedMcq.length > 0 ? 'Collapse All' : 'Expand All'}
                  </Button>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const content = getAssessmentContent(assessmentDetails);
                    const questions = asArray<any>(assessmentDetails.mcq_questions).length > 0
                      ? asArray<any>(assessmentDetails.mcq_questions)
                      : asArray<any>((content as any)?.mcq_questions);
                    const subs = asArray<any>(assessmentDetails.mcq_submissions);
                    if (questions.length === 0 && subs.length === 0) return (
                      <div className="text-center p-8 text-muted-foreground">No MCQ assessment data available.</div>
                    );

                    const subMap = new Map<string, any>();
                    subs.forEach((s: any) => {
                      const qid = s?.question_id != null ? String(s.question_id) : '';
                      if (qid) subMap.set(qid, s);
                    });

                    const correctCount = subs.filter((s: any) => s?.is_correct).length;
                    const totalForScore = questions.length || subs.length;
                    const mcqScore100 = totalForScore === 0
                      ? 0
                      : correctCount === 0
                        ? 0
                        : Math.ceil((correctCount / totalForScore) * 100);

                    return (
                      <div className="space-y-6">
                        <div className="flex items-center gap-6 bg-muted/30 p-5 rounded-xl border">
                          <div className="text-center">
                            <div className="text-5xl font-bold text-primary">{mcqScore100}</div>
                            <div className="text-xs text-muted-foreground mt-1 font-medium">out of 100</div>
                          </div>
                          <div className="h-12 w-px bg-border" />
                          <div>
                            <div className="font-semibold text-foreground text-lg">{correctCount} / {totalForScore} Correct</div>
                            <div className="text-sm text-muted-foreground mt-0.5">MCQ Assessment Score</div>
                          </div>
                        </div>

                        <Accordion type="multiple" value={expandedMcq} onValueChange={setExpandedMcq} className="w-full space-y-3">
                          {questions.map((q: any, idx: number) => {
                            const qid = q?.id != null ? String(q.id) : String(idx);
                            const sub = subMap.get(qid);
                            const attempted = !!sub;
                            const isCorrect = !!sub?.is_correct;
                            return (
                              <AccordionItem value={`item-${qid}`} key={qid} className="border rounded-lg px-4 bg-card shadow-sm data-[state=open]:border-primary/50 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4">
                                  <div className="flex items-center justify-between w-full pr-4 gap-4 text-left">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                        {idx + 1}
                                      </div>
                                      <span className="text-sm font-medium line-clamp-1 flex-1">{safeRender(q?.question || q?.text || q?.question_text)}</span>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                      {attempted ? (
                                        isCorrect ? (
                                          <Badge className="bg-success/10 text-success hover:bg-success/20 border-none"><CheckCircle className="mr-1.5 h-3 w-3" /> Correct</Badge>
                                        ) : (
                                          <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-none"><XCircle className="mr-1.5 h-3 w-3" /> Incorrect</Badge>
                                        )
                                      ) : (
                                        <Badge variant="secondary">Unanswered</Badge>
                                      )}
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4 border-t mt-2">
                                  <div className="space-y-4 mt-4">
                                    <div className="text-sm font-medium leading-relaxed">{safeRender(q?.question || q?.text || q?.question_text)}</div>
                                    
                                    <div className="grid gap-2 mt-4">
                                      {Array.isArray(q?.options) ? q.options.map((opt: string, i: number) => {
                                        const isSelected = sub?.selected_index === i;
                                        const isCorrectOpt = sub?.correct_index === i;
                                        
                                        return (
                                          <div key={i} className={`p-3 rounded-md text-sm border flex items-center gap-3 ${
                                            isCorrectOpt ? 'bg-success/10 border-success/30' :
                                            isSelected && !isCorrectOpt ? 'bg-destructive/10 border-destructive/30' :
                                            'bg-muted/10 border-muted'
                                          }`}>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                                            }`}>
                                              {isSelected && <div className="w-1.5 h-1.5 bg-background rounded-full" />}
                                            </div>
                                            <span className="flex-1">{opt}</span>
                                            {isCorrectOpt && <CheckCircle className="h-4 w-4 text-success" />}
                                            {isSelected && !isCorrectOpt && <XCircle className="h-4 w-4 text-destructive" />}
                                          </div>
                                        )
                                      }) : (
                                        <div className="p-4 bg-muted/20 rounded-md space-y-3">
                                          <div className="text-sm">
                                            <span className="text-muted-foreground block mb-1">Candidate Answer:</span>
                                            <span className={`font-medium ${attempted ? (isCorrect ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
                                              {attempted ? (Array.isArray(sub?.options) ? sub.options[sub.selected_index] : String(sub?.selected_index ?? 'Unknown')) : 'Not Attempted'}
                                            </span>
                                          </div>
                                          {attempted && !isCorrect && (
                                            <div className="text-sm">
                                              <span className="text-muted-foreground block mb-1">Correct Answer:</span>
                                              <span className="font-medium text-success">
                                                {Array.isArray(sub?.options) ? sub.options[sub.correct_index] : String(sub?.correct_index ?? 'Unknown')}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex gap-2 mt-4">
                                      <Badge variant="outline">{safeRender(q?.difficulty || sub?.difficulty || 'Medium')}</Badge>
                                      {q?.topic && <Badge variant="outline">{safeRender(q.topic)}</Badge>}
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center p-12 bg-card rounded-lg border text-muted-foreground">
                No assessment data available for this candidate.
              </div>
            )}

            {/* Question Generation Criteria — Assessment */}
            {(() => {
              const pd = assessmentDetails?.proctoring_data as any;
              const cfg = pd?.assessment_config;
              const focusAreas: string = cfg?.focus_areas || '';
              const strictFocus: boolean = !!cfg?.strict_focus;
              if (!focusAreas.trim()) return null;
              const topics = focusAreas.split(/[,\n]+/).map((t: string) => t.trim()).filter(Boolean);
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-4 w-4 text-primary" />
                      Question Generation Criteria
                    </CardTitle>
                    <CardDescription>Topics the recruiter prioritized for this assessment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Topics To Prioritize</p>
                      <div className="flex flex-wrap gap-2">
                        {topics.map((topic: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-sm font-medium">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <div className={`w-2 h-2 rounded-full ${strictFocus ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      <span className="text-sm text-muted-foreground">
                        Strict Focus: <span className="font-medium text-foreground">{strictFocus ? 'Enabled (80%+ from focus areas)' : 'Disabled (60%+ from focus areas)'}</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          {/* TAB 4: CODING ASSESSMENT */}
          <TabsContent value="coding" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {assessmentDetails ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle>{jobData?.is_salesforce_job || jobData?.include_apex_assessment ? 'Apex Challenges' : 'Coding Challenges'}</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExpandAllApex}>
                      {expandedApex.length > 0 ? 'Collapse All' : 'Expand All'}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const content = getAssessmentContent(assessmentDetails);
                      const isSalesforce = jobData?.is_salesforce_job || jobData?.include_apex_assessment;
                      const pd = assessmentDetails?.proctoring_data as any;
                      const challenges = isSalesforce 
                        ? (asArray<any>((assessmentDetails as any).apex_blanks).length > 0 ? asArray<any>((assessmentDetails as any).apex_blanks) : asArray<any>((content as any)?.apex_blanks))
                        : (asArray<any>(assessmentDetails.coding_challenges).length > 0 ? asArray<any>(assessmentDetails.coding_challenges) : asArray<any>((content as any)?.coding_challenges));
                        
                      const subs = isSalesforce 
                        ? (asArray<any>((assessmentDetails as any).apex_blanks_results).length > 0 ? asArray<any>((assessmentDetails as any).apex_blanks_results) : asArray<any>(pd?.apex_blanks_results))
                        : asArray<any>(assessmentDetails.coding_submissions);

                      if (challenges.length === 0 && subs.length === 0) return (
                        <div className="text-muted-foreground text-center p-4 text-xl font-bold">
                          {isSalesforce ? '-' : 'No coding challenges found.'}
                        </div>
                      );

                      const subMap = new Map<string, any>();
                      subs.forEach((s: any) => {
                        const cid = s?.challenge_id != null ? String(s.challenge_id) : s?.question_id != null ? String(s.question_id) : '';
                        if (cid) subMap.set(cid, s);
                      });

                      return (
                        <Accordion type="multiple" value={expandedApex} onValueChange={setExpandedApex} className="w-full space-y-4">
                          {challenges.map((ch: any, idx: number) => {
                            const cid = ch?.id != null ? String(ch.id) : String(idx);
                            const sub = subMap.get(cid);
                            const attempted = !!sub;
                            const passRate = attempted && sub.total_tests > 0 ? (sub.passed_count / sub.total_tests) * 100 : 0;
                            
                            return (
                              <AccordionItem value={`coding-${cid}`} key={cid} className="border rounded-lg bg-card shadow-sm overflow-hidden">
                                <AccordionTrigger className="hover:no-underline px-5 py-4 bg-muted/10">
                                  <div className="flex items-center justify-between w-full pr-4 text-left">
                                    <div className="font-semibold">{safeRender(ch?.title) || `Challenge ${idx + 1}`}</div>
                                    <div className="flex items-center gap-3">
                                      {attempted ? (
                                        isSalesforce ? (
                                          <Badge variant={(sub?.score || 0) >= (ch?.points || 1) * 0.8 ? 'default' : 'secondary'} className="font-mono">
                                            Score: {safeRender(sub?.score)}/{safeRender(ch?.points || sub?.max_score || '?')}
                                          </Badge>
                                        ) : (
                                          <Badge variant={passRate >= 100 ? 'default' : passRate > 50 ? 'secondary' : 'destructive'} className="font-mono">
                                            {safeRender(sub?.passed_count)}/{safeRender(sub?.total_tests)} Passed
                                          </Badge>
                                        )
                                      ) : (
                                        <Badge variant="outline">Not Attempted</Badge>
                                      )}
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 py-4 border-t">
                                  {isSalesforce ? (
                                    <div className="space-y-6 mt-2">
                                      {(ch?.description || ch?.prompt || ch?.instructions) && (
                                        <div>
                                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prompt</div>
                                          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90 bg-muted/30 p-4 rounded-lg">
                                            <ReactMarkdown>{safeRender(ch.description || ch.prompt || ch.instructions)}</ReactMarkdown>
                                          </div>
                                        </div>
                                      )}
                                      <div>
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Code Snippet</div>
                                        <pre className="text-sm bg-slate-950 text-slate-100 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-auto leading-relaxed border border-slate-800">
                                          {safeRender(ch?.code_with_blanks || ch?.code)}
                                        </pre>
                                      </div>

                                      {attempted && Array.isArray(sub?.per_blank) && sub.per_blank.length > 0 && (
                                        <div>
                                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Blank Evaluations</div>
                                          <div className="space-y-2 border rounded-lg overflow-hidden">
                                            {sub.per_blank.map((b: any, bi: number) => (
                                              <div key={bi} className={`p-3 text-sm flex flex-col sm:flex-row sm:items-start gap-4 ${bi > 0 ? 'border-t' : ''} ${b?.correct ? 'bg-success/5' : 'bg-destructive/5'}`}>
                                                <div className="flex items-center gap-2 w-full sm:w-32 shrink-0 pt-1">
                                                  {b?.correct ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                                                  <span className={`font-medium ${b?.correct ? 'text-success' : 'text-destructive'}`}>Blank {bi + 1}</span>
                                                </div>
                                                <div className="flex-1 font-mono text-xs overflow-auto">
                                                  <div className="text-muted-foreground mb-1">Expected: <span className="text-foreground">{safeRender(b?.expected)}</span></div>
                                                  <div className={b?.correct ? "text-success font-medium" : "text-destructive font-medium"}>
                                                    Candidate: <span>{safeRender(b?.received) || '(empty)'}</span>
                                                  </div>
                                                  {b?.notes && (
                                                    <div className="text-muted-foreground mt-2 italic">Notes: {safeRender(b?.notes)}</div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {attempted && sub?.feedback && (
                                        <div>
                                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Feedback</div>
                                          <div className="text-sm bg-muted/20 p-4 rounded-lg">
                                            <ReactMarkdown>{safeRender(sub.feedback)}</ReactMarkdown>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-6 mt-2">
                                      {ch?.description && (
                                        <div>
                                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Problem Statement</div>
                                          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90 bg-muted/30 p-4 rounded-lg">
                                            <ReactMarkdown>{safeRender(ch.description)}</ReactMarkdown>
                                          </div>
                                        </div>
                                      )}
                                      <div>
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Candidate Solution</div>
                                        {!attempted ? (
                                          <div className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-lg text-center">No solution submitted</div>
                                        ) : (
                                          <pre className="text-sm bg-slate-950 text-slate-100 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-auto leading-relaxed border border-slate-800">
                                            {typeof sub?.code === 'object' ? JSON.stringify(sub.code, null, 2) : String(sub?.code || '(empty solution)')}
                                          </pre>
                                        )}
                                      </div>
                                      {attempted && Array.isArray(sub?.test_results) && sub.test_results.length > 0 && (
                                        <div>
                                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Test Cases</div>
                                          <div className="space-y-2 border rounded-lg overflow-hidden">
                                            {sub.test_results.map((tr: any, ti: number) => (
                                              <div key={ti} className={`p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-4 ${ti > 0 ? 'border-t' : ''} ${tr?.passed ? 'bg-success/5' : 'bg-destructive/5'}`}>
                                                <div className="flex items-center gap-2 w-full sm:w-32 shrink-0">
                                                  {tr?.passed ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                                                  <span className={`font-medium ${tr?.passed ? 'text-success' : 'text-destructive'}`}>Test {ti + 1}</span>
                                                </div>
                                                <div className="flex-1 font-mono text-xs overflow-auto">
                                                  <div className="text-muted-foreground mb-1">Input: <span className="text-foreground">{safeRender(tr?.input)}</span></div>
                                                  <div className="text-muted-foreground">Expected: <span className="text-foreground">{safeRender(tr?.expected_output)}</span></div>
                                                  {!tr?.passed && (
                                                    <div className="text-destructive mt-1 font-semibold">Got: <span className="text-destructive">{safeRender(tr?.actual_output) || 'Error'}</span></div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center p-12 bg-card rounded-lg border text-muted-foreground">
                No {jobData?.is_salesforce_job || jobData?.include_apex_assessment ? 'Apex' : 'coding'} assessment data available for this candidate.
              </div>
            )}
          </TabsContent>

          {/* TAB 4.5: SQL ASSESSMENT */}
          <TabsContent value="sql" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {assessmentDetails ? (
              <div className="space-y-6">
                {(() => {
                  const pd = assessmentDetails.proctoring_data as any;
                  const sqlChallenges: any[] = pd?.assessment_content?.sql_challenges || [];
                  const sqlSubs: any[] = pd?.sql_submissions || [];
                  if (sqlChallenges.length === 0 && sqlSubs.length === 0) return (
                    <div className="text-center p-12 bg-card rounded-lg border text-muted-foreground">
                      No SQL assessment data available for this candidate.
                    </div>
                  );

                  const subMap = new Map<string, any>();
                  sqlSubs.forEach((s: any) => {
                    const cid = s?.challenge_id != null ? String(s.challenge_id) : '';
                    if (cid) subMap.set(cid, s);
                  });

                  const displayList: any[] = sqlChallenges.length > 0 ? sqlChallenges : sqlSubs.map((s: any) => ({ id: s?.challenge_id, title: 'SQL Challenge', description: '' }));

                  return (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                          <CardTitle>SQL Challenges</CardTitle>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExpandAllSql}>
                          {expandedSql.length > 0 ? 'Collapse All' : 'Expand All'}
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="multiple" value={expandedSql} onValueChange={setExpandedSql} className="w-full space-y-4">
                          {displayList.map((ch: any, idx: number) => {
                            const cid = ch?.id != null ? String(ch.id) : String(idx);
                            const sub = subMap.get(cid) || (sqlChallenges.length === 0 ? sqlSubs[idx] : undefined);
                            const attempted = !!sub;
                            const score = sub?.score_percentage ?? null;
                            const testResults: any[] = sub?.test_results || [];
                            const firstResult = testResults[0];

                            return (
                              <AccordionItem value={`sql-${cid}`} key={cid} className="border rounded-lg bg-card shadow-sm overflow-hidden">
                                <AccordionTrigger className="hover:no-underline px-5 py-4 bg-muted/10">
                                  <div className="flex items-center justify-between w-full pr-4 text-left">
                                    <div className="font-semibold flex items-center gap-2">
                                      <Database className="h-4 w-4 text-indigo-500" />
                                      {safeRender(ch?.title) || `SQL Challenge ${idx + 1}`}
                                    </div>
                                    {attempted ? (
                                      <Badge variant={score != null && score >= 70 ? 'default' : 'secondary'} className="font-mono">
                                        {score != null ? `${Math.round(score)}%` : 'Submitted'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">Not Attempted</Badge>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 py-4 border-t space-y-6 mt-2">
                                  {ch?.description && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Problem Statement</div>
                                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90 bg-muted/30 p-4 rounded-lg">
                                        <ReactMarkdown>{safeRender(ch.description)}</ReactMarkdown>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {attempted ? (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Candidate's Query</div>
                                      <pre className="text-sm bg-slate-950 text-slate-100 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-auto leading-relaxed border border-slate-800">
                                        {typeof sub?.code === 'string' && sub.code.trim() ? sub.code : '(no query submitted)'}
                                      </pre>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-lg text-center">No query submitted</div>
                                  )}

                                  {attempted && firstResult && (
                                    <div className="space-y-4">
                                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evaluation Result</div>
                                      <div className="flex items-center gap-3">
                                        {firstResult?.passed ? (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-semibold bg-success/10 text-success">
                                            <CheckCircle className="h-4 w-4" /> Passed / Accepted
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-semibold bg-destructive/10 text-destructive">
                                            <XCircle className="h-4 w-4" /> {firstResult?.status || 'Wrong Answer'}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {(firstResult?.error || sub?.runtime_error) && (
                                        <div className="p-4 rounded-lg text-sm font-mono whitespace-pre-wrap bg-destructive/10 text-destructive border border-destructive/20 leading-relaxed">
                                          {safeRender(firstResult?.error || sub.runtime_error).replace(/Your query/g, "Candidate's query")}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center p-12 bg-card rounded-lg border text-muted-foreground">
                No SQL assessment data available for this candidate.
              </div>
            )}
          </TabsContent>

          {/* TAB 5: AI INTERVIEW */}
          <TabsContent value="interview" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {/* Question Generation Criteria — Interview */}
            {(() => {
              const pd = (interviewDetails as any)?.proctoring_data;
              const focusAreas: string = pd?.focus_areas || '';
              const strictFocus: boolean = !!pd?.strict_focus;
              if (!focusAreas.trim()) return null;
              const topics = focusAreas.split(/[,\n]+/).map((t: string) => t.trim()).filter(Boolean);
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-4 w-4 text-primary" />
                      Question Generation Criteria
                    </CardTitle>
                    <CardDescription>Topics the recruiter prioritized for this AI interview</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Topics To Prioritize</p>
                      <div className="flex flex-wrap gap-2">
                        {topics.map((topic: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-sm font-medium">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <div className={`w-2 h-2 rounded-full ${strictFocus ? 'bg-primary' : 'bg-muted-foreground'}`} />
                      <span className="text-sm text-muted-foreground">
                        Strict Focus: <span className="font-medium text-foreground">{strictFocus ? 'Enabled (questions heavily focused on specified areas)' : 'Disabled (priority-based guidance applied)'}</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
            {interviewDetails ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="space-y-1">
                        <CardTitle>AI Interview Responses</CardTitle>
                        <CardDescription>
                          Review candidate transcripts, expected answers, and AI evaluations
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        
                        <Button variant="outline" size="sm" onClick={handleExpandAllInterview}>
                          {expandedInterview.length > 0 ? 'Collapse All' : 'Expand All'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {Array.isArray(interviewDetails.questions) && interviewDetails.questions.length > 0 ? (
                        <Accordion type="multiple" value={expandedInterview} onValueChange={setExpandedInterview} className="w-full space-y-4 mt-4">
                          {interviewDetails.questions.map((q, idx) => {
                            const response = Array.isArray(interviewDetails.responses)
                              ? interviewDetails.responses.find(r => r.question_index === idx)
                              : undefined;
                            const transcript = response
                              ? (typeof response.transcript === 'object'
                                  ? JSON.stringify(response.transcript)
                                  : String(response.transcript ?? ''))
                              : null;
                            const hasTranscript = transcript !== null && transcript.trim().length > 0;
                            const wasAttempted = response !== undefined;
                            const durSecs = response?.audio_duration_seconds;
                            const expected = (q as any).expected_answer || (q as any).expected_response;

                            return (
                              <AccordionItem value={`interview-q-${idx}`} key={idx} className="border rounded-lg bg-card shadow-sm overflow-hidden">
                                <AccordionTrigger className="hover:no-underline px-5 py-4 bg-muted/10">
                                  <div className="flex items-start gap-4 w-full pr-4 text-left">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                      Q{idx + 1}
                                    </div>
                                    <div className="flex-1 mt-1">
                                      <div className="font-semibold text-[15px] leading-snug pr-4">{safeRender(q.question_text)}</div>
                                      <div className="flex gap-2 mt-2">
                                        <Badge variant="outline" className="text-xs bg-background">{safeRender(q.question_type)}</Badge>
                                        {!hasTranscript && <Badge variant="secondary" className="text-xs bg-background">Not Answered</Badge>}
                                      </div>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 py-6 border-t bg-background space-y-6">
                                  {/* Candidate Response */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Candidate Response</h4>
                                      {typeof durSecs === 'number' && durSecs > 0 && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/> {durSecs.toFixed(0)}s</span>
                                      )}
                                    </div>
                                    {hasTranscript ? (
                                      <div className="bg-muted/50 p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap">
                                        {transcript}
                                      </div>
                                    ) : wasAttempted ? (
                                      <div className="bg-muted/30 p-4 rounded-lg border text-sm text-muted-foreground italic">
                                        No speech detected.
                                      </div>
                                    ) : (
                                      <div className="bg-muted/30 p-4 rounded-lg border text-sm text-muted-foreground italic">
                                        Not attempted.
                                      </div>
                                    )}
                                  </div>

                                  {/* Expected Response */}
                                  {expected && (
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">Expected Response</h4>
                                      <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                        {safeRender(expected)}
                                      </div>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      ) : (
                        <div className="text-center p-8 text-muted-foreground">
                          No interview questions found.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  {/* Highlights (Strengths/Weaknesses/Feedback) */}
                  {interviewDetails.final_evaluation && (
                    <Card>
                      <CardHeader>
                        <CardTitle>AI Interview Highlights</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <h5 className="font-semibold text-sm mb-3 flex items-center text-success">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Strengths
                          </h5>
                          <ul className="space-y-2">
                            {Array.isArray(interviewDetails.final_evaluation.strengths) ? interviewDetails.final_evaluation.strengths.map((s, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 bg-muted/30 p-2 rounded">
                                <span className="mt-0.5">•</span>
                                {typeof s === 'string' ? s : JSON.stringify(s)}
                              </li>
                            )) : (
                              <li className="text-sm text-muted-foreground">{typeof interviewDetails.final_evaluation.strengths === 'string' ? interviewDetails.final_evaluation.strengths : 'None noted'}</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-semibold text-sm mb-3 flex items-center text-destructive">
                            <XCircle className="mr-2 h-4 w-4" />
                            Areas to Improve
                          </h5>
                          <ul className="space-y-2">
                            {(() => {
                              const items = (interviewDetails.final_evaluation as any).areas_for_improvement
                                || (interviewDetails.final_evaluation as any).weaknesses;
                              return Array.isArray(items) ? items.map((w: any, i: number) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 bg-muted/30 p-2 rounded">
                                  <span className="mt-0.5">•</span>
                                  {typeof w === 'string' ? w : JSON.stringify(w)}
                                </li>
                              )) : (
                                <li className="text-sm text-muted-foreground">{typeof items === 'string' ? items : 'None noted'}</li>
                              );
                            })()}
                          </ul>
                        </div>
                        {interviewDetails.final_evaluation.detailed_feedback && (
                          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mt-4 shadow-sm">
                            <h5 className="font-bold text-lg mb-4 flex items-center text-primary">
                              <MessageSquare className="mr-2 h-5 w-5" />
                              Detailed AI Feedback
                            </h5>
                            <p className="text-[15px] text-foreground leading-relaxed">
                              {typeof interviewDetails.final_evaluation.detailed_feedback === 'object' ? JSON.stringify(interviewDetails.final_evaluation.detailed_feedback, null, 2) : interviewDetails.final_evaluation.detailed_feedback}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Manual Interview Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Manual Interview Evaluation</CardTitle>
                      <CardDescription>Add your own score and notes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Score (0-100)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={manualScore}
                          onChange={(e) => setManualScore(e.target.value)}
                          placeholder="e.g. 85"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Detailed Feedback</Label>
                        <Textarea
                          value={manualFeedback}
                          onChange={(e) => setManualFeedback(e.target.value)}
                          placeholder="Feedback on candidate's performance..."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Private Notes</Label>
                        <Textarea
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                          placeholder="Internal notes (not visible to candidate)"
                          rows={3}
                        />
                      </div>
                      <Button onClick={handleSaveManualInterview} disabled={savingManual} className="w-full">
                        {savingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Evaluation
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-center p-12 bg-card rounded-lg border text-muted-foreground">
                No AI interview data available for this candidate.
              </div>
            )}
          </TabsContent>

          {/* TAB 6: ACTIVITY & TIMELINE */}
          <TabsContent value="activity" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            <Card>
              <CardHeader>
                <CardTitle>Candidate Activity</CardTitle>
                <CardDescription>Timeline of events and sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
                  
                  {/* Applied Event */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border bg-card shadow-sm">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-foreground">Candidate Applied</div>
                        <div className="text-xs font-medium text-muted-foreground">
                          {candidate.applied_at ? new Date(candidate.applied_at).toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">Profile created in the system.</div>
                    </div>
                  </div>

                  {/* Assessment Event */}
                  {assessmentDetails && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-indigo-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <CheckSquare className="h-4 w-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border bg-card shadow-sm">
                        <div className="flex items-center justify-between space-x-2 mb-1">
                          <div className="font-bold text-foreground">Assessment Completed</div>
                          <div className="text-xs font-medium text-muted-foreground">
                            {assessmentDetails.completed_at ? new Date(assessmentDetails.completed_at).toLocaleDateString() : 'Done'}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Scored {assessmentDetails.total_score}% overall.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Interview Event */}
                  {interviewDetails && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-teal-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border bg-card shadow-sm">
                        <div className="flex items-center justify-between space-x-2 mb-1">
                          <div className="font-bold text-foreground">AI Interview Completed</div>
                          <div className="text-xs font-medium text-muted-foreground">
                            {interviewDetails.completed_at ? new Date(interviewDetails.completed_at).toLocaleDateString() : 'Done'}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {interviewDetails.final_evaluation?.recommendation 
                            ? `AI recommended: ${interviewDetails.final_evaluation.recommendation.replace(/_/g, ' ')}` 
                            : 'Interview session completed.'}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>

            {/* Screenshots section moved here for evidence */}
            {(assessmentScreenshot || interviewScreenshot) && (
              <Card>
                <CardHeader>
                  <CardTitle>Proctoring Evidence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {assessmentScreenshot && (
                      <div>
                        <h4 className="font-semibold text-sm mb-3">Technical Assessment</h4>
                        <div 
                          className="relative group rounded-lg overflow-hidden border cursor-pointer inline-block w-full" 
                          onClick={() => { setSelectedScreenshotUrl(assessmentScreenshot); setScreenshotDialogOpen(true); }}
                        >
                          <img src={assessmentScreenshot} alt="Assessment Evidence" className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                            Click to Expand
                          </div>
                        </div>
                      </div>
                    )}
                    {interviewScreenshot && (
                      <div>
                        <h4 className="font-semibold text-sm mb-3">AI Interview</h4>
                        <div 
                          className="relative group rounded-lg overflow-hidden border cursor-pointer inline-block w-full" 
                          onClick={() => { setSelectedScreenshotUrl(interviewScreenshot); setScreenshotDialogOpen(true); }}
                        >
                          <img src={interviewScreenshot} alt="Interview Evidence" className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-medium">
                            Click to Expand
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
        </Tabs>
      </div>

      <EditCandidateModal
        candidate={candidate as any}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onUpdated={() => refetch()}
      />

      <Dialog open={screenshotDialogOpen} onOpenChange={setScreenshotDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Screenshot Evidence</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex justify-center bg-muted/50 rounded-lg p-2">
            {selectedScreenshotUrl && (
              <img src={selectedScreenshotUrl} alt="Evidence" className="max-w-full max-h-[70vh] object-contain rounded border shadow-sm" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
