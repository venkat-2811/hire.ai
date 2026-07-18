import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { useJob } from '@/hooks/useJobs';
import { useProfile } from '@/hooks/useProfile';
import {
  useLinkedInAccounts,
  useGenerateFilters,
  useLinkedInSearch,
  useRankCandidates,
  useSaveCandidate,
  useUnsaveCandidate,
  useUpdateCandidate,
  useSavedCandidates,
  useAtsScoreProfile,
  useAddAsCandidate,
} from '@/hooks/useLinkedInTalent';
import type { LinkedInCandidate, LinkedInFilters, AtsScoreResult } from '@/hooks/useLinkedInTalent';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Briefcase, MapPin, Clock, ChevronRight, Loader2,
  AlertTriangle, Linkedin, Search, History, Bookmark, RefreshCw,
  Building2, Users, Zap, GripVertical, SlidersHorizontal, Star, TrendingUp,
} from 'lucide-react';
import { SearchFilters } from '@/components/linkedin/SearchFilters';
import { CandidateCard } from '@/components/linkedin/CandidateCard';
import { CandidateSkeletonCard } from '@/components/linkedin/CandidateSkeletonCard';
import { CandidateProfileDrawer } from '@/components/linkedin/CandidateProfileDrawer';
import { OutreachModal } from '@/components/linkedin/OutreachModal';
import { AtsScoreModal } from '@/components/linkedin/AtsScoreModal';
import { SearchSummaryBanner } from '@/components/linkedin/SearchSummaryBanner';
import { SearchHistoryPanel } from '@/components/linkedin/SearchHistoryPanel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEFAULT_FILTERS: LinkedInFilters = {
  keywords: '',
  skills: [],
  job_titles: [],
  similar_roles: [],
  experience_min: 0,
  experience_max: 10,
  industry: '',
  location: '',
  seniority: '',
  preferred_education: '',
};

// Resizable Divider
function ResizeDivider({ onDrag }: { onDrag: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      onDrag(delta);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-2 shrink-0 cursor-col-resize hover:bg-[#0077B5]/20 transition-colors group flex items-center justify-center relative z-10"
      title="Drag to resize"
    >
      <div className="absolute inset-y-0 w-px bg-border/50 left-1/2" />
      <GripVertical className="h-4 w-4 text-muted-foreground/20 group-hover:text-[#0077B5]/50 transition-colors relative z-10" />
    </div>
  );
}

// JD Panel
function JDPanel({ job }: { job: any }) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-foreground leading-tight">{job.title}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5">
            {(job.end_customer_name || job.company_name) && (
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{job.end_customer_name || 'Your Company'}</span>
            )}
            {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
            {job.min_experience_years != null && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.min_experience_years}+ yrs</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {job.role && <Badge variant="outline" className="text-[10px] h-5 px-2">{job.role}</Badge>}
          {job.level && <Badge variant="outline" className="text-[10px] h-5 px-2">{job.level}</Badge>}
          <Badge className={cn('text-[10px] h-5 px-2', job.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground')}>
            {job.is_active ? '● Active' : '● Closed'}
          </Badge>
        </div>
      </div>

      {job.must_have_skills?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Required Skills</p>
          <div className="flex flex-wrap gap-1">
            {job.must_have_skills.map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">{s}</span>
            ))}
          </div>
        </div>
      )}
      {job.good_to_have_skills?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preferred Skills</p>
          <div className="flex flex-wrap gap-1">
            {job.good_to_have_skills.map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 border border-border/40 text-muted-foreground">{s}</span>
            ))}
          </div>
        </div>
      )}
      {job.description && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-[20]">{job.description}</p>
        </div>
      )}
    </div>
  );
}

// Stats Bar
function StatsBar({ total, saved, isSearching }: { total: number; saved: number; isSearching: boolean }) {
  return (
    <div className="hidden sm:flex items-center gap-4">
      {[
        { icon: Users, label: 'Found', value: total, color: 'text-blue-400' },
        { icon: Bookmark, label: 'Saved', value: saved, color: 'text-amber-400' },
        { icon: TrendingUp, label: 'Ranked', value: isSearching ? '…' : total > 0 ? 'Yes' : '—', color: 'text-violet-400' },
      ].map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          <Icon className={cn('h-3 w-3', color)} />
          <span className="text-muted-foreground/70">{label}:</span>
          <span className="font-semibold text-foreground tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function LinkedInJobTalentPage() {
  const { loading: authLoading } = useRequireAuth();
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading: jobLoading } = useJob(jobId!);
  const { data: profile } = useProfile();
  const { data: accountsData } = useLinkedInAccounts();
  const { data: savedData } = useSavedCandidates(jobId!);

  const [filters, setFilters] = useState<LinkedInFilters>(DEFAULT_FILTERS);
  const [candidateCount, setCandidateCount] = useState(10);
  const [candidates, setCandidates] = useState<LinkedInCandidate[]>([]);
  const [searchResult, setSearchResult] = useState<{ requested: number; retrieved: number; search_id?: string } | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<LinkedInCandidate | null>(null);
  const [contactCandidate, setContactCandidate] = useState<LinkedInCandidate | null>(null);
  const [atsScoreCandidate, setAtsScoreCandidate] = useState<LinkedInCandidate | null>(null);
  const [atsScoreResult, setAtsScoreResult] = useState<AtsScoreResult | null>(null);
  const [atsScoreLoading, setAtsScoreLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('results');
  const [jdWidth, setJdWidth] = useState(256);
  const [filterWidth, setFilterWidth] = useState(272);

  const generateFilters = useGenerateFilters();
  const searchLinkedIn = useLinkedInSearch();
  const rankCandidates = useRankCandidates();
  const saveCandidate = useSaveCandidate();
  const unsaveCandidate = useUnsaveCandidate();
  const updateCandidate = useUpdateCandidate();
  const atsScoreProfile = useAtsScoreProfile();
  const addAsCandidate = useAddAsCandidate();

  const savedCandidates = savedData?.candidates || [];
  const savedIds = new Set(savedCandidates.map((c: any) => c.linkedin_id).filter(Boolean));
  const isConnected = accountsData?.connected ?? false;
  const linkedInAccountId = accountsData?.accounts?.[0]?.id;

  const handleGenerateFilters = useCallback(async () => {
    if (!job) return;
    toast.info('Analyzing Job Description…', { duration: 2000 });
    const result = await generateFilters.mutateAsync({
      job_id: job.id, title: job.title, description: job.description,
      must_have_skills: job.must_have_skills, good_to_have_skills: job.good_to_have_skills,
      min_experience_years: job.min_experience_years, location: job.location,
    });
    if (result) {
      setFilters({
        keywords: (result as any).keywords || '',
        skills: (result as any).skills || [],
        job_titles: (result as any).job_titles || [],
        similar_roles: (result as any).similar_roles || [],
        experience_min: (result as any).experience_min ?? job.min_experience_years ?? 0,
        experience_max: (result as any).experience_max ?? 10,
        industry: (result as any).industry || '',
        location: (result as any).location || job.location || '',
        seniority: (result as any).seniority || '',
        preferred_education: (result as any).preferred_education || '',
      });
      toast.success('Search filters generated from JD');
    }
  }, [job, generateFilters]);

  const handleSearch = useCallback(async () => {
    if (!job) return;
    if (!isConnected) { toast.error('LinkedIn account not connected. Configure Unipile credentials first.'); return; }
    const count = Math.min(Math.max(candidateCount, 1), 30);
    setCandidates([]); setHasSearched(true); setActiveTab('results');
    const searchRes = await searchLinkedIn.mutateAsync({
      job_id: job.id, filters, candidate_count: count,
      title: job.title, description: job.description, must_have_skills: job.must_have_skills,
    });
    if (!searchRes) return;
    const raw: LinkedInCandidate[] = (searchRes as any).profiles || [];
    setSearchResult({ requested: (searchRes as any).requested ?? count, retrieved: (searchRes as any).retrieved ?? raw.length, search_id: (searchRes as any).search_id });
    if (raw.length === 0) { setCandidates([]); return; }
    toast.info('AI ranking candidates…', { duration: 3000 });
    const ranked = await rankCandidates.mutateAsync({
      job_id: job.id, title: job.title, description: job.description,
      must_have_skills: job.must_have_skills, good_to_have_skills: job.good_to_have_skills,
      min_experience_years: job.min_experience_years, candidates: raw,
    });
    setCandidates((ranked as any)?.ranked || raw);
    toast.success(`${raw.length} candidates ranked by AI`);
  }, [job, filters, candidateCount, isConnected, searchLinkedIn, rankCandidates]);

  const handleSave = useCallback(async (candidate: LinkedInCandidate) => {
    if (!job) return;
    if (savedIds.has(candidate.provider_id)) {
      await unsaveCandidate.mutateAsync({ job_id: job.id, linkedin_id: candidate.provider_id });
    } else {
      await saveCandidate.mutateAsync({ job_id: job.id, search_id: searchResult?.search_id, profile: candidate, match_score: candidate.match_score ?? 0, ai_summary: candidate.ai_summary });
    }
  }, [job, searchResult, saveCandidate, unsaveCandidate, savedIds]);

  const handleMarkContacted = useCallback(async (candidate: LinkedInCandidate) => {
    const saved = savedCandidates.find((c: any) => c.linkedin_id === candidate.provider_id);
    if (saved) await updateCandidate.mutateAsync({ id: saved.id, job_id: job?.id ?? '', status: 'contacted' });
  }, [savedCandidates, job, updateCandidate]);

  const handleRerun = useCallback((histFilters: LinkedInFilters, count: number) => {
    setFilters(histFilters); setCandidateCount(count);
    toast.info('Filters restored. Click "Search LinkedIn" to rerun.');
  }, []);

  const handleAtsScore = useCallback(async (candidate: LinkedInCandidate) => {
    if (!job) return;
    setAtsScoreCandidate(candidate);
    setAtsScoreResult(null);
    setAtsScoreLoading(true);
    try {
      const result = await atsScoreProfile.mutateAsync({
        job_id: job.id,
        profile: candidate,
      });
      setAtsScoreResult(result as AtsScoreResult);
    } catch {
      // error toast already shown by hook
    } finally {
      setAtsScoreLoading(false);
    }
  }, [job, atsScoreProfile]);

  const handleAddCandidate = useCallback(async (candidate: LinkedInCandidate): Promise<boolean> => {
    if (!job) return false;
    try {
      const result = await addAsCandidate.mutateAsync({
        job_id: job.id,
        profile: candidate,
      });
      const res = result as any;
      if (res?.already_exists) {
        toast.info(res.message || 'Candidate already exists in this job.');
      } else {
        toast.success(res?.message || 'Candidate added successfully!');
      }
      return true;
    } catch {
      return false;
    }
  }, [job, addAsCandidate]);

  const isSearching = searchLinkedIn.isPending || rankCandidates.isPending;

  if (authLoading || jobLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-[#0077B5]" /></div></DashboardLayout>;
  }
  if (!job) {
    return <DashboardLayout><div className="flex flex-col items-center justify-center h-full gap-4"><p className="text-muted-foreground">Job not found.</p><Button onClick={() => navigate('/linkedin-talent')}>Back to Jobs</Button></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Top Bar */}
        <div className="flex items-center gap-3 px-4 h-11 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0 z-20">
          <Button variant="ghost" size="sm" onClick={() => navigate('/linkedin-talent')} className="h-7 px-2 gap-1 text-muted-foreground hover:text-foreground text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />Back
          </Button>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Linkedin className="h-4 w-4 text-[#0077B5] shrink-0" />
            <span className="font-semibold text-sm text-foreground truncate">{job.title}</span>
            <ChevronRight className="h-3 w-3 text-border shrink-0" />
            <span className="text-xs text-muted-foreground hidden sm:block">LinkedIn Talent</span>
          </div>
          <StatsBar total={candidates.length} saved={savedCandidates.length} isSearching={isSearching} />
          {!isConnected && (
            <Badge className="shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 text-[10px] py-0">
              <AlertTriangle className="h-3 w-3" />Not Connected
            </Badge>
          )}
        </div>

        {/* Three-Column Resizable Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Col 1: JD */}
          <div className="shrink-0 overflow-y-auto hidden lg:block bg-muted/5" style={{ width: jdWidth, minWidth: 180, maxWidth: 420 }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Job Brief</span>
              </div>
              <JDPanel job={job} />
            </div>
          </div>

          <ResizeDivider onDrag={(d) => setJdWidth(w => Math.min(420, Math.max(180, w + d)))} />

          {/* Col 2: Filters */}
          <div className="shrink-0 overflow-y-auto hidden xl:block bg-muted/5" style={{ width: filterWidth, minWidth: 220, maxWidth: 400 }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Search Controls</span>
              </div>
              <SearchFilters
                filters={filters} onChange={setFilters} onGenerate={handleGenerateFilters}
                onSearch={handleSearch} isGenerating={generateFilters.isPending} isSearching={isSearching}
                candidateCount={candidateCount} onCandidateCountChange={(n) => setCandidateCount(Math.min(n, 30))}
              />
            </div>
          </div>

          <ResizeDivider onDrag={(d) => setFilterWidth(w => Math.min(400, Math.max(220, w + d)))} />

          {/* Col 3: Results */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
              {/* Tab Header */}
              <div className="flex items-center justify-between px-4 pt-2.5 pb-0 border-b border-border/30 shrink-0">
                <TabsList className="h-8 bg-transparent gap-0 p-0">
                  {[
                    { value: 'results', icon: Search, label: 'Results', count: candidates.length, color: 'text-blue-400 bg-blue-500/20' },
                    { value: 'saved', icon: Bookmark, label: 'Saved', count: savedCandidates.length, color: 'text-amber-400 bg-amber-500/20' },
                    { value: 'history', icon: History, label: 'History', count: 0, color: '' },
                  ].map(({ value, icon: Icon, label, count, color }) => (
                    <TabsTrigger key={value} value={value} className={cn(
                      'h-8 px-3 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0077B5] data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                    )}>
                      <Icon className="h-3 w-3" />
                      {label}
                      {count > 0 && <span className={cn('text-[10px] px-1.5 rounded-full font-bold', color)}>{count}</span>}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Mobile quick actions */}
                <div className="flex gap-1.5 xl:hidden">
                  <Button size="sm" variant="outline" onClick={handleGenerateFilters} disabled={generateFilters.isPending || isSearching} className="h-7 text-xs gap-1 px-2.5">
                    <RefreshCw className={cn('h-3 w-3', generateFilters.isPending && 'animate-spin')} />Generate
                  </Button>
                  <Button size="sm" onClick={handleSearch} disabled={isSearching || generateFilters.isPending} className="h-7 text-xs gap-1 px-2.5 bg-[#0077B5] hover:bg-[#005f91] text-white">
                    {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Linkedin className="h-3 w-3" />}Search
                  </Button>
                </div>
              </div>

              {/* Results Content */}
              <TabsContent value="results" className="flex-1 overflow-y-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                <div className="p-4 space-y-3 flex-1">
                  {searchResult && !isSearching && (
                    <SearchSummaryBanner requested={searchResult.requested} retrieved={searchResult.retrieved} ranked={candidates.length > 0} />
                  )}

                  {isSearching && (
                    <>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0077B5]/5 border border-[#0077B5]/15">
                        <div className="relative shrink-0">
                          <Linkedin className="h-5 w-5 text-[#0077B5]" />
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#0077B5] animate-ping" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {searchLinkedIn.isPending ? 'Searching LinkedIn & enriching profiles…' : 'AI ranking candidates…'}
                          </p>
                          <p className="text-xs text-muted-foreground">This may take 15–30 seconds</p>
                        </div>
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50 shrink-0" />
                      </div>
                      <div className="space-y-3">
                        {Array.from({ length: Math.min(candidateCount, 4) }).map((_, i) => <CandidateSkeletonCard key={i} />)}
                      </div>
                    </>
                  )}

                  {!isSearching && candidates.length > 0 && (
                    <AnimatePresence>
                      {candidates.map((c, i) => (
                        <motion.div key={c.provider_id || c.public_identifier || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                          <CandidateCard
                            candidate={c}
                            isSaved={savedIds.has(c.provider_id)}
                            onViewProfile={setSelectedCandidate}
                            onSave={handleSave}
                            onContact={setContactCandidate}
                            onAtsScore={handleAtsScore}
                            onAddCandidate={handleAddCandidate}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}

                  {!isSearching && hasSearched && candidates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mb-4">
                        <Search className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                      <h3 className="font-semibold mb-1">No candidates found</h3>
                      <p className="text-xs text-muted-foreground max-w-xs mb-4">Try broadening your keywords or adjusting filters.</p>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGenerateFilters}>
                        <RefreshCw className="h-3.5 w-3.5" />Regenerate Filters
                      </Button>
                    </div>
                  )}

                  {!isSearching && !hasSearched && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-20 h-20 rounded-3xl bg-[#0077B5]/8 border border-[#0077B5]/15 flex items-center justify-center mb-5">
                        <Linkedin className="h-10 w-10 text-[#0077B5]/40" />
                      </div>
                      <h3 className="font-bold text-base mb-2">LinkedIn Talent Discovery</h3>
                      <p className="text-xs text-muted-foreground max-w-xs mb-5 leading-relaxed">
                        Generate AI-powered search filters from this JD, then search LinkedIn for matching candidates.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleGenerateFilters} disabled={generateFilters.isPending} className="gap-1.5">
                          <Zap className={cn('h-3.5 w-3.5', generateFilters.isPending && 'animate-pulse')} />Generate Filters
                        </Button>
                        <Button size="sm" onClick={handleSearch} disabled={isSearching || !isConnected} className="gap-1.5 bg-[#0077B5] hover:bg-[#005f91] text-white">
                          <Linkedin className="h-3.5 w-3.5" />Search LinkedIn
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Saved Content */}
              <TabsContent value="saved" className="flex-1 overflow-y-auto mt-0">
                <div className="p-4">
                  {savedCandidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mb-4">
                        <Bookmark className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                      <h3 className="font-semibold mb-1">No saved candidates</h3>
                      <p className="text-xs text-muted-foreground">Bookmark candidates from search results to track them here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2">
                        <Star className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{savedCandidates.length} Saved</span>
                      </div>
                      {savedCandidates.map((saved: any) => (
                        <CandidateCard key={saved.id} candidate={{ ...saved.profile_data, match_score: saved.match_score, ai_summary: saved.ai_summary }} isSaved onViewProfile={setSelectedCandidate} onSave={handleSave} onContact={setContactCandidate} />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* History Content */}
              <TabsContent value="history" className="flex-1 overflow-y-auto mt-0">
                <div className="p-4">
                  <SearchHistoryPanel jobId={jobId!} onRerun={handleRerun} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {selectedCandidate && (
        <CandidateProfileDrawer
          candidate={selectedCandidate}
          isSaved={savedIds.has(selectedCandidate.provider_id)}
          onClose={() => setSelectedCandidate(null)}
          onContact={(c) => { setSelectedCandidate(null); setContactCandidate(c); }}
          onSave={handleSave}
        />
      )}
      {contactCandidate && (
        <OutreachModal
          candidate={contactCandidate}
          jobTitle={job.title}
          companyName={job.end_customer_name || profile?.company_name || 'Our Company'}
          jobDescription={job.description}
          recruiterName={profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined}
          onClose={() => setContactCandidate(null)}
          onMarkContacted={handleMarkContacted}
        />
      )}
      {atsScoreCandidate && (
        <AtsScoreModal
          candidate={atsScoreCandidate}
          result={atsScoreResult}
          isLoading={atsScoreLoading}
          onClose={() => { setAtsScoreCandidate(null); setAtsScoreResult(null); }}
        />
      )}
    </DashboardLayout>
  );
}
