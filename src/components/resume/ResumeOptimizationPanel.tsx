import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, ChevronDown, ChevronUp, CheckCircle,
  XCircle, RotateCcw, Download, AlertTriangle, Info,
  ClipboardCheck, History, FileText, ArrowUpRight,
  Check, X, Zap, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  resumeOptimizationApi,
  type ResumeOptimizationChange,
  type ResumeOptimizationRecord,
} from '@/lib/api';
import { useAuth } from '@clerk/clerk-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  candidateId: string;
  jobId: string;
  screening: any;          // ats_screenings row — provides gap context
  resumeText: string;      // candidates.resume_text — the ORIGINAL, used for all work
  resumeUrl?: string;      // candidates.resume_url — link to the original uploaded file
}

type PanelState = 'idle' | 'loading' | 'review' | 'finalizing' | 'finalized';
type ChangeDecision = 'accepted' | 'rejected' | 'pending';
interface ChangeState { [changeId: string]: ChangeDecision; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHANGE_TYPE_META: Record<string, { label: string; color: string }> = {
  wording:              { label: 'Wording',       color: 'bg-blue-100 text-blue-700 border-blue-200' },
  ats_keyword:          { label: 'ATS Keyword',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
  jd_alignment:         { label: 'JD Alignment',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  formatting:           { label: 'Formatting',    color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  missing_skill_notice: { label: 'Gap Notice',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  gap_caution:          { label: 'Gap Caution',   color: 'bg-red-100 text-red-700 border-red-200' },
};

function ScoreBar({ score, label, accent }: { score: number; label: string; accent: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-bold ${accent}`}>{score}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            score >= 75 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-red-500'
          }`}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ResumeOptimizationPanel({ candidateId, jobId, screening, resumeText, resumeUrl }: Props) {
  const { getToken } = useAuth();
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [optimization, setOptimization] = useState<ResumeOptimizationRecord | null>(null);
  const [changeStates, setChangeStates] = useState<ChangeState>({});
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [showOriginalFor, setShowOriginalFor] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<ResumeOptimizationRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Run optimization ────────────────────────────────────────────────────────
  const handleOptimize = useCallback(async () => {
    if (!resumeText?.trim()) {
      toast.error('No resume content found for this candidate. Please ensure a resume has been uploaded.');
      return;
    }
    setPanelState('loading');
    try {
      const result = await resumeOptimizationApi.optimize(candidateId, jobId, screening);
      setOptimization(result);

      const init: ChangeState = {};
      // Only real changes get accept/reject state — gap_caution is a separate array now
      (result.changes || []).forEach((c: ResumeOptimizationChange) => {
        init[c.change_id] = 'pending';
      });
      setChangeStates(init);
      setPanelState('review');

      // Auto-expand first 3 changes
      const first3 = new Set(
        (result.changes || [])
          .slice(0, 3)
          .map((c: ResumeOptimizationChange) => c.change_id)
      );
      setExpandedSet(first3);
    } catch (err: any) {
      toast.error(err.message || 'Failed to optimize resume. Please try again.');
      setPanelState('idle');
    }
  }, [candidateId, jobId, screening, resumeText]);

  // ── Per-change decisions ─────────────────────────────────────────────────────
  const decide = (id: string, d: ChangeDecision) => setChangeStates(prev => ({ ...prev, [id]: d }));

  const acceptAll = () => {
    if (!optimization) return;
    const next: ChangeState = {};
    optimization.changes.forEach(c => {
      next[c.change_id] = 'accepted';
    });
    setChangeStates(next);
    toast.success('All improvable changes accepted');
  };

  const rejectAll = () => {
    if (!optimization) return;
    const next: ChangeState = {};
    optimization.changes.forEach(c => { next[c.change_id] = 'rejected'; });
    setChangeStates(next);
    toast.info('All changes rejected — original resume will be preserved');
  };

  const revertAll = () => {
    if (!optimization) return;
    const next: ChangeState = {};
    optimization.changes.forEach(c => {
      next[c.change_id] = 'pending';
    });
    setChangeStates(next);
    toast.info('All decisions reset to pending');
  };

  // ── Finalize ────────────────────────────────────────────────────────────────
  const handleFinalize = useCallback(async () => {
    if (!optimization) return;
    const acceptedIds = Object.entries(changeStates).filter(([, d]) => d === 'accepted').map(([id]) => id);
    const rejectedIds = Object.entries(changeStates).filter(([, d]) => d !== 'accepted').map(([id]) => id);

    if (acceptedIds.length === 0) {
      toast.error('Please accept at least one change before finalizing.');
      return;
    }

    setPanelState('finalizing');
    try {
      await resumeOptimizationApi.finalize(optimization.id, {
        accepted_change_ids: acceptedIds,
        rejected_change_ids: rejectedIds,
        final_resume: {},  // Backend rebuilds from text; this field is legacy-compat
      });
      setOptimization(prev => prev ? { ...prev, status: 'finalized', accepted_change_ids: acceptedIds, rejected_change_ids: rejectedIds } : prev);
      setPanelState('finalized');
      toast.success('Optimized resume finalized and saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save optimization');
      setPanelState('review');
    }
  }, [optimization, changeStates]);

  // ── Deploy ──────────────────────────────────────────────────────────────────
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = async () => {
    if (!optimization) return;
    setDeploying(true);
    try {
      const deployed = await resumeOptimizationApi.deploy(optimization.id);
      const scoreText = typeof deployed?.screening_score === 'number'
        ? ` ATS score updated to ${deployed.screening_score}%.`
        : '';
      toast.success(`Resume accepted and overwritten successfully!${scoreText}`);
      
      // Auto close panel to show updated screening
      setPanelState('idle');
      setOptimization(null);
      setChangeStates({});
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to deploy resume');
    } finally {
      setDeploying(false);
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────────
  const handleDownload = async (format: 'pdf' | 'docx', version: 'optimized' | 'original' = 'optimized') => {
    if (!optimization) return;
    const token = await getToken();
    const url = resumeOptimizationApi.getDownloadUrl(optimization.id, format, version);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `resume_${version}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error(`Failed to download ${format.toUpperCase()}`);
    }
  };

  // ── History ──────────────────────────────────────────────────────────────────
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await resumeOptimizationApi.getHistory(candidateId, jobId);
      setHistory(records);
      setShowHistory(true);
    } catch {
      toast.error('Failed to load optimization history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const restoreFromHistory = async (rec: ResumeOptimizationRecord) => {
    try {
      const full = await resumeOptimizationApi.get(rec.id);
      setOptimization(full);
      const states: ChangeState = {};
      (full.accepted_change_ids || []).forEach(id => { states[id] = 'accepted'; });
      (full.rejected_change_ids || []).forEach(id => { states[id] = 'rejected'; });
      (full.changes || []).forEach(c => { if (!states[c.change_id]) states[c.change_id] = 'pending'; });
      setChangeStates(states);
      setPanelState(full.status === 'finalized' ? 'finalized' : 'review');
      setShowHistory(false);
    } catch {
      toast.error('Failed to load this optimization record');
    }
  };

  // ── Toggle expand / show original ────────────────────────────────────────────
  const toggleExpand = (id: string) =>
    setExpandedSet(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleShowOrig = (id: string) =>
    setShowOriginalFor(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Counts ───────────────────────────────────────────────────────────────────
  const counts = optimization ? {
    accepted: Object.values(changeStates).filter(d => d === 'accepted').length,
    rejected: Object.values(changeStates).filter(d => d === 'rejected').length,
    pending: Object.values(changeStates).filter(d => d === 'pending').length,
    actionable: (optimization.changes || []).length,
    gapCautions: (optimization.gap_cautions || []).length,
  } : null;

  const hasNoChanges = optimization !== null && (optimization.changes || []).length === 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="mt-8 space-y-4">
      {/* ── Header banner ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-50/80 via-purple-50/60 to-indigo-50/80 dark:from-violet-950/20 dark:via-purple-950/15 dark:to-indigo-950/20 dark:border-violet-800/30 p-5">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-violet-400/10 blur-3xl -translate-y-16 translate-x-16" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-700 shrink-0">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">AI Resume Optimization</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
                AI analyzes the original resume text (same source used for ATS screening) against the JD —
                improving content only. No formatting, fonts, or layout changes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loadingHistory}
              className="text-violet-600 hover:bg-violet-100/50 text-xs gap-1.5">
              {loadingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
              History
            </Button>

            {panelState === 'idle' && (
              <Button onClick={handleOptimize}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 gap-2 text-sm">
                <Sparkles className="h-4 w-4" />
                Optimize Resume with AI
              </Button>
            )}
            {panelState === 'loading' && (
              <Button disabled className="gap-2 bg-violet-600/80 text-white text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
              </Button>
            )}
            {(panelState === 'review' || panelState === 'finalizing' || panelState === 'finalized') && (
              <Button variant="outline" size="sm"
                onClick={() => { setPanelState('idle'); setOptimization(null); setChangeStates({}); }}
                className="border-violet-200 text-violet-600 hover:bg-violet-50 text-xs gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Re-run
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── History panel ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" /> Optimization History (this job)
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}><X className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No previous optimizations for this job.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(rec => (
                      <div key={rec.id} onClick={() => restoreFromHistory(rec)}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${rec.status === 'finalized' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <div>
                            <p className="text-sm font-medium capitalize">{rec.status} Draft</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(rec.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-bold text-emerald-600">
                            {rec.before_score}% → {rec.after_score}% <ArrowUpRight className="h-3 w-3 inline" />
                          </p>
                          <Badge variant={rec.status === 'finalized' ? 'default' : 'secondary'} className="text-xs capitalize">{rec.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading state ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {panelState === 'loading' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-violet-200/60">
              <CardContent className="py-10 flex flex-col items-center gap-4">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full bg-violet-100 flex items-center justify-center">
                    <Sparkles className="h-7 w-7 text-violet-500" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-violet-300 border-t-violet-600 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">AI is reading the original resume...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Analyzing content against JD requirements and ATS gaps. This may take up to 60 seconds.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Review / Finalized state ──────────────────────────────────────────── */}
      <AnimatePresence>
        {(panelState === 'review' || panelState === 'finalizing' || panelState === 'finalized') && optimization && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Score card */}
            <Card className="overflow-hidden border-violet-200/60">
              <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-semibold text-sm">ATS Score Analysis</h4>
                    <p className="text-violet-200 text-xs mt-0.5 max-w-md">{optimization.optimization_summary}</p>
                  </div>
                  {panelState === 'finalized' && (
                    <Badge className="bg-white/20 text-white border-white/30 text-xs">
                      <Check className="h-3 w-3 mr-1" /> Finalized
                    </Badge>
                  )}
                </div>
              </div>
              <CardContent className="pt-5 pb-4 space-y-5">
                {hasNoChanges ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Info className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">No Corrections or Optimization Tasks Found</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        The AI could not find any verbatim improvements that would genuinely increase the ATS score for this resume against the current JD.
                      </p>
                    </div>
                    <div className="text-center pt-2">
                      <p className="text-3xl font-black text-muted-foreground">{optimization.before_score}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Current ATS Score — No Change</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <ScoreBar score={optimization.before_score} label="Before (Original Resume)" accent="text-amber-600" />
                        <ScoreBar score={optimization.after_score} label="After (All Changes Accepted)" accent="text-emerald-600" />
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-5xl font-black text-emerald-600">
                            +{Math.max(0, optimization.after_score - optimization.before_score)}%
                          </p>
                          <p className="text-xs text-muted-foreground font-medium mt-1">Potential ATS Score Gain</p>
                        </div>
                      </div>
                    </div>

                    {counts && (
                      <div className="grid grid-cols-3 gap-2 pt-4 border-t text-center">
                        <div><p className="text-xl font-bold">{counts.actionable}</p><p className="text-xs text-muted-foreground">Suggestions</p></div>
                        <div><p className="text-xl font-bold text-emerald-600">{counts.accepted}</p><p className="text-xs text-muted-foreground">Accepted</p></div>
                        <div><p className="text-xl font-bold text-destructive">{counts.rejected}</p><p className="text-xs text-muted-foreground">Rejected</p></div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Bulk actions — only shown when there are actual changes */}
            {panelState === 'review' && !hasNoChanges && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={acceptAll} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs">
                  <CheckCircle className="h-3.5 w-3.5" /> Accept All
                </Button>
                <Button size="sm" variant="destructive" onClick={rejectAll} className="gap-1.5 text-xs">
                  <XCircle className="h-3.5 w-3.5" /> Reject All
                </Button>
                <Button size="sm" variant="outline" onClick={revertAll} className="gap-1.5 text-xs">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset All
                </Button>
                <div className="flex-1" />
                <Button size="sm" onClick={handleFinalize}
                  disabled={panelState === 'finalizing' || !counts || counts.accepted === 0}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white gap-1.5 text-xs shadow-lg shadow-violet-500/20">
                  {panelState === 'finalizing'
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                    : <><ClipboardCheck className="h-3.5 w-3.5" /> Finalize &amp; Save {counts?.accepted || 0} Change{counts?.accepted !== 1 ? 's' : ''}</>
                  }
                </Button>
              </div>
            )}

            {/* Finalized download row & Deploy Action */}
            {panelState === 'finalized' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/30">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 flex-1">
                    Saved with {counts?.accepted} accepted improvement{counts?.accepted !== 1 ? 's' : ''} applied to original content.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownload('pdf')}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" /> Optimized PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownload('docx')}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5" /> Optimized DOCX
                    </Button>
                    {resumeUrl && (
                      <a href={resumeUrl} target="_blank" rel="noopener noreferrer" download
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-muted/40 transition-colors">
                        Original File
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between p-4 rounded-xl border border-border bg-card">
                  <div>
                    <h4 className="font-semibold text-sm">Deploy & Replace Candidate Resume</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Accept this optimization to permanently overwrite the candidate's core resume and re-run ATS screening.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => { setPanelState('idle'); setOptimization(null); }}
                      disabled={deploying} className="text-xs">
                      Revert / Keep Original
                    </Button>
                    <Button size="sm" onClick={handleDeploy} disabled={deploying}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg text-xs gap-1.5">
                      {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                      {deploying ? 'Deploying...' : 'Accept Resume & Re-Screen'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Change cards — only real actionable suggestions ───────────── */}
            {!hasNoChanges && (
              <div className="space-y-2.5">
                {(optimization.changes || []).map((change, idx) => {
                  const decision = changeStates[change.change_id] || 'pending';
                  const isExpanded = expandedSet.has(change.change_id);
                  const showOrig = showOriginalFor.has(change.change_id);
                  const typeMeta = CHANGE_TYPE_META[change.change_type] || CHANGE_TYPE_META.wording;

                  const borderCls =
                    decision === 'accepted' ? 'border-emerald-200' :
                    decision === 'rejected' ? 'border-red-200/50 opacity-55' : 'border-border';
                  const bgCls =
                    decision === 'accepted' ? 'bg-emerald-50/30 dark:bg-emerald-950/10' :
                    decision === 'rejected' ? 'bg-muted/15' : '';

                  return (
                    <motion.div key={change.change_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}>
                      <Card className={`transition-all duration-200 ${borderCls} ${bgCls}`}>

                        {/* Header row */}
                        <div className="flex items-start gap-3 p-3.5 cursor-pointer select-none"
                          onClick={() => toggleExpand(change.change_id)}>
                          {/* Status dot */}
                          <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            decision === 'accepted' ? 'bg-emerald-500' :
                            decision === 'rejected' ? 'bg-red-100 border border-red-300' :
                            'bg-muted border border-border'
                          }`}>
                            {decision === 'accepted' ? <Check className="h-3 w-3 text-white" /> :
                             decision === 'rejected' ? <X className="h-3 w-3 text-red-500" /> : null}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold truncate">{change.section_label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeMeta.color}`}>
                                {typeMeta.label}
                              </span>
                              {change.score_impact > 0 && (
                                <span className="text-[10px] text-muted-foreground">+{change.score_impact} pts</span>
                              )}
                            </div>
                            {!isExpanded && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{change.reason}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Accept/Reject buttons */}
                            {panelState !== 'finalized' && (
                              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <button onClick={() => decide(change.change_id, 'accepted')}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    decision === 'accepted' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                  }`} title="Accept">
                                  <Check className="h-3 w-3" />
                                </button>
                                <button onClick={() => decide(change.change_id, 'rejected')}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    decision === 'rejected' ? 'bg-red-500 border-red-500 text-white' : 'border-red-200 text-red-500 hover:bg-red-50'
                                  }`} title="Reject">
                                  <X className="h-3 w-3" />
                                </button>
                                {decision !== 'pending' && (
                                  <button onClick={() => decide(change.change_id, 'pending')}
                                    className="p-1.5 rounded-lg border border-muted-foreground/20 text-muted-foreground hover:bg-muted/50 transition-all" title="Reset">
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            <span className="text-muted-foreground/50">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          </div>
                        </div>

                        {/* Expanded content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                              <div className="px-4 pb-4 pt-3 border-t border-border/30 space-y-3">
                                {/* View toggle */}
                                <button onClick={() => toggleShowOrig(change.change_id)}
                                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                                  {showOrig ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  {showOrig ? 'Show side-by-side' : 'View only original'}
                                </button>

                                {/* Side-by-side diff */}
                                <div className={`grid gap-3 ${showOrig ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Original</p>
                                    <div className="p-3 rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed min-h-[50px] font-mono text-xs">
                                      {change.original || <span className="italic opacity-50">No original text</span>}
                                    </div>
                                  </div>
                                  {!showOrig && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                        <Zap className="h-3 w-3" /> AI Improved
                                      </p>
                                      <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-sm text-foreground whitespace-pre-wrap leading-relaxed min-h-[50px] font-mono text-xs">
                                        {change.improved || <span className="italic text-muted-foreground opacity-50">No improvement</span>}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Reason */}
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/50">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                  <p className="text-xs text-muted-foreground leading-relaxed">{change.reason}</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ── Gap Cautions — shown at the bottom, separate from suggestions ─── */}
            {(optimization.gap_cautions || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Employment Gap Cautions
                </p>
                {(optimization.gap_cautions || []).map((caution, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800/30">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">{caution.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom finalize repeat (for long lists) */}
            {panelState === 'review' && counts && counts.actionable > 5 && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleFinalize} disabled={counts.accepted === 0}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white gap-2 text-xs shadow-lg shadow-violet-500/20">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Finalize {counts.accepted} Change{counts.accepted !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
