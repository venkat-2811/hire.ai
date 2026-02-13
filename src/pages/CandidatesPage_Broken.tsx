import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Play,
  FileText,
  Loader2,
  Sparkles,
  Mail,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Users,
  Briefcase,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { JobRole, InterviewStatus } from '@/types/database';
import { useCandidates } from '@/hooks/useCandidates';
import { useCreateInterview, useStartInterview } from '@/hooks/useInterviews';
import { useJobs } from '@/hooks/useJobs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

type SortField = 'name' | 'date' | 'score';
type SortOrder = 'asc' | 'desc';

export default function CandidatesPage() {
  const { loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJobId, setFilterJobId] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: candidates, isLoading: candidatesLoading } = useCandidates();
  const createInterview = useCreateInterview();
  const startInterview = useStartInterview();
  const { data: jobs, isLoading: jobsLoading } = useJobs({ is_active: true });

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startCandidateId, setStartCandidateId] = useState<string | null>(null);
  const [startJobId, setStartJobId] = useState<string>('');
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);

  const activeJobs = useMemo(() => jobs || [], [jobs]);

  // Group candidates by job
  const candidatesByJob = useMemo(() => {
    const result = candidates || [];
    
    // Apply search filter
    let filtered = result;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.full_name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query)
      );
    }
    
    // Group by job
    const grouped: Record<string, any[]> = {};
    
    // Add "No Job" group for candidates without job assignments
    grouped['no-job'] = [];
    
    filtered.forEach(candidate => {
      // For now, we'll simulate job assignment
      // In a real implementation, candidates would have a job_id field
      // We'll use a simple hash to assign candidates to jobs for demo
      const candidateHash = candidate.id.charCodeAt(0) % (activeJobs.length || 1);
      const jobId = (candidate as any).job_id || (activeJobs[candidateHash]?.id || 'no-job');
      if (!grouped[jobId]) {
        grouped[jobId] = [];
      }
      grouped[jobId].push(candidate);
    });
    
    // Sort within each group
    Object.keys(grouped).forEach(jobId => {
      grouped[jobId] = grouped[jobId].sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'name':
            comparison = a.full_name.localeCompare(b.full_name);
            break;
          case 'date':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          case 'score':
            comparison = 0; // Will implement when we have scores
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    });
    
    return grouped;
  }, [candidates, searchQuery, sortField, sortOrder]);
  
  // Get job title by ID
  const getJobTitle = (jobId: string) => {
    if (jobId === 'no-job') return 'No Job Assigned';
    const job = activeJobs.find(j => j.id === jobId);
    return job ? job.title : 'Unknown Job';
  };

  const toggleSelectAll = () => {
    // Get all candidates from all jobs
    const allCandidates = Object.values(candidatesByJob).flat();
    if (selectedIds.size === allCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allCandidates.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAssessment = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one candidate');
      return;
    }
    setAssessmentDialogOpen(true);
  };

  const sendAssessmentInvites = async () => {
    if (!startJobId) {
      toast.error('Please select a job');
      return;
    }
    
    setSendingInvites(true);
    try {
      const response = await fetch(`/api/assessments/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_ids: Array.from(selectedIds),
          job_id: startJobId,
          deadline_hours: 72,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to send invites');
      
      const data = await response.json();
      toast.success(`Assessment invites sent to ${data.invites_sent} candidate(s)`);
      setAssessmentDialogOpen(false);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Failed to send assessment invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleBulkInterview = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one candidate');
      return;
    }
    setInterviewDialogOpen(true);
  };

  const sendInterviewInvites = async () => {
    if (!startJobId) {
      toast.error('Please select a job');
      return;
    }
    
    setSendingInvites(true);
    try {
      const response = await fetch(`/api/ai-interview/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_ids: Array.from(selectedIds),
          job_id: startJobId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to send invites');
      
      const data = await response.json();
      toast.success(`Interview invites sent to ${data.invites_sent} candidate(s)`);
      setInterviewDialogOpen(false);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Failed to send interview invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleStartInterview = (candidateId: string) => {
    setStartCandidateId(candidateId);
    setStartJobId(activeJobs[0]?.id || '');
    setStartDialogOpen(true);
  };

  const handleCreateAndStart = () => {
    if (!startCandidateId || !startJobId) return;

    createInterview.mutate(
      { candidate_id: startCandidateId, job_id: startJobId },
      {
        onSuccess: (session) => {
          startInterview.mutate(session.id, {
            onSuccess: () => {
              setStartDialogOpen(false);
              setStartCandidateId(null);
              navigate(`/interviews/${session.id}`);
            },
            onError: () => {
              setStartDialogOpen(false);
              setStartCandidateId(null);
              navigate('/interviews');
            },
          });
        },
      }
    );
  };

  if (authLoading || candidatesLoading) {
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
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold"
            >
              Candidates
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Manage and review all candidate applications
            </p>
          </div>
          <Button asChild>
            <Link to="/candidates/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidates..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterJobId} onValueChange={setFilterJobId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {activeJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      Sort: {sortField === 'name' ? 'Name' : sortField === 'date' ? 'Date' : 'Score'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => { setSortField('name'); setSortOrder('asc'); }}>
                      Name (A-Z)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortField('name'); setSortOrder('desc'); }}>
                      Name (Z-A)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortField('date'); setSortOrder('desc'); }}>
                      Newest First
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSortField('date'); setSortOrder('asc'); }}>
                      Oldest First
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedIds.size} candidate(s) selected
                  </span>
                  <Button size="sm" onClick={handleBulkAssessment}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Assessment
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleBulkInterview}>
                    <Play className="mr-2 h-4 w-4" />
                    Send Interview Invite
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Grouped Candidates by Job */}
        <div className="space-y-4">
          {Object.entries(candidatesByJob).map(([jobId, jobCandidates]) => (
            <Collapsible key={jobId} defaultOpen className="w-full">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{getJobTitle(jobId)}</CardTitle>
                          <CardDescription>{jobCandidates.length} candidate(s)</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={jobCandidates.every(c => selectedIds.has(c.id))}
                          onCheckedChange={() => {
                            const newSet = new Set(selectedIds);
                            jobCandidates.forEach(c => {
                              if (newSet.has(c.id)) {
                                newSet.delete(c.id);
                              } else {
                                newSet.add(c.id);
                              }
                            });
                            setSelectedIds(newSet);
                          }}
                        />
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={jobCandidates.every(c => selectedIds.has(c.id))}
                              onCheckedChange={() => {
                                const newSet = new Set(selectedIds);
                                jobCandidates.forEach(c => {
                                  if (newSet.has(c.id)) {
                                    newSet.delete(c.id);
                                  } else {
                                    newSet.add(c.id);
                                  }
                                });
                                setSelectedIds(newSet);
                              }}
                            />
                          </TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Resume</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Interview</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobCandidates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No candidates in this job group.
                            </TableCell>
                          </TableRow>
                        ) : (
                          jobCandidates.map((candidate, index) => (
                            <motion.tr
                              key={candidate.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`group ${selectedIds.has(candidate.id) ? 'bg-primary/5' : ''}`}
                            >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(candidate.id)}
                          onCheckedChange={() => toggleSelect(candidate.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {candidate.full_name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{candidate.full_name}</p>
                            <p className="text-sm text-muted-foreground">{candidate.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {candidate.resume_parsed_data ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">
                            Resume Parsed
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            No Resume
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {candidate.consent_given ? 'Consent Given' : 'Pending Consent'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status="pending" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(candidate.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              View Resume
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStartInterview(candidate.id)}>
                              <Play className="mr-2 h-4 w-4" />
                              Start Interview
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Assessment Invite Dialog */}
        <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Assessment Invites</DialogTitle>
              <DialogDescription>
                Send technical assessment invitations to {selectedIds.size} selected candidate(s).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Job Position</Label>
                <Select value={startJobId} onValueChange={setStartJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Candidates will receive an email with a link to complete the technical assessment.
                The assessment includes MCQ and hands-on coding sections with proctoring.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssessmentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendAssessmentInvites} disabled={!startJobId || sendingInvites}>
                {sendingInvites ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Send Invites</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Interview Invite Dialog */}
        <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send AI Interview Invites</DialogTitle>
              <DialogDescription>
                Send AI interview invitations to {selectedIds.size} selected candidate(s).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Job Position</Label>
                <Select value={startJobId} onValueChange={setStartJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Candidates will receive an email with a link to complete an AI-powered interview.
                The interview uses speech recognition and camera proctoring.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setInterviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendInterviewInvites} disabled={!startJobId || sendingInvites}>
                {sendingInvites ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Play className="mr-2 h-4 w-4" />Send Invites</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Interview Session</DialogTitle>
              <DialogDescription>Select a job position to generate questions for this candidate.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="text-sm font-medium">Job</div>
              <Select value={startJobId} onValueChange={(v) => setStartJobId(v)}>
                <SelectTrigger disabled={jobsLoading || activeJobs.length === 0}>
                  <SelectValue placeholder={jobsLoading ? 'Loading jobs...' : 'Select a job'} />
                </SelectTrigger>
                <SelectContent>
                  {activeJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={handleCreateAndStart}
                disabled={!startCandidateId || !startJobId || createInterview.isPending || startInterview.isPending}
              >
                {(createInterview.isPending || startInterview.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Interview'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
                            </motion.tr>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
