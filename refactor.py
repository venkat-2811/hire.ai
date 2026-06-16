import re

with open('backup_CandidateDetailsPage.tsx', 'r', encoding='utf-16') as f:
    original = f.read()

return_start = original.find('  return (\n    <DashboardLayout>')
if return_start == -1:
    print("Could not find return block")
    exit(1)

pre_return = original[:return_start]

import_find = "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';"
import_replace = "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';\nimport { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';"
pre_return = pre_return.replace(import_find, import_replace)

import_find2 = "import { ScoreBadge } from '@/components/ui/score-badge';"
import_replace2 = "import { ScoreBadge } from '@/components/ui/score-badge';\nimport { Award, Clock, CheckSquare, Activity, ChevronRight } from 'lucide-react';"
pre_return = pre_return.replace(import_find2, import_replace2)

new_page_code = pre_return + """  return (
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
                  {screening?.shortlisted && <Badge className="h-6" variant="default">Shortlisted</Badge>}
                  {screening?.shortlisted === false && <Badge className="h-6" variant="destructive">Rejected</Badge>}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coding Score</p>
              {assessmentDetails?.coding_score != null ? (
                <ScoreBadge score={assessmentDetails.coding_score} size="lg" />
              ) : <span className="text-xl font-bold text-muted-foreground">-</span>}
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-sm border-muted">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interview Score</p>
              {interviewDetails?.final_evaluation?.overall_score != null ? (
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Final Rec</p>
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
              <TabsTrigger value="coding" className="px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Coding & SQL</TabsTrigger>
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

                {interviewDetails?.final_evaluation && (
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Interview Highlights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            Weaknesses
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
                      </div>
                    </CardContent>
                  </Card>
                )}

                {interviewDetails?.final_evaluation?.detailed_feedback && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Final Recommendation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {typeof interviewDetails.final_evaluation.detailed_feedback === 'object' ? JSON.stringify(interviewDetails.final_evaluation.detailed_feedback, null, 2) : interviewDetails.final_evaluation.detailed_feedback}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Links & Profiles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {candidate.portfolio_url && (
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                          {safeRender(candidate.portfolio_url)}
                        </a>
                      </div>
                    )}
                    {candidate.github_url && (
                      <div className="flex items-center gap-3">
                        <Github className="h-5 w-5 text-muted-foreground" />
                        <a href={candidate.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                          {safeRender(candidate.github_url)}
                        </a>
                      </div>
                    )}
                    {candidate.vendorName && (
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Vendor: <span className="font-medium text-foreground">{safeRender(candidate.vendorName)}</span></span>
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
                <CardHeader>
                  <CardTitle>Multiple Choice Assessment</CardTitle>
                  <CardDescription>Topic-wise performance and detailed responses</CardDescription>
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

                    return (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                          <div className="text-4xl font-bold text-primary">{correctCount}</div>
                          <div>
                            <div className="font-semibold text-foreground">Correct Answers</div>
                            <div className="text-sm text-muted-foreground">Out of {questions.length} total questions</div>
                          </div>
                        </div>

                        <Accordion type="single" collapsible className="w-full space-y-3">
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
          </TabsContent>

          {/* TAB 4: CODING ASSESSMENT */}
          <TabsContent value="coding" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {assessmentDetails ? (
              <div className="space-y-6">
                {/* Coding Challenges */}
                <Card>
                  <CardHeader>
                    <CardTitle>Coding Challenges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const content = getAssessmentContent(assessmentDetails);
                      const challenges = asArray<any>(assessmentDetails.coding_challenges).length > 0
                        ? asArray<any>(assessmentDetails.coding_challenges)
                        : asArray<any>((content as any)?.coding_challenges);
                      const subs = asArray<any>(assessmentDetails.coding_submissions);

                      if (challenges.length === 0 && subs.length === 0) return (
                        <div className="text-muted-foreground text-center p-4">No coding challenges found.</div>
                      );

                      const subMap = new Map<string, any>();
                      subs.forEach((s: any) => {
                        const cid = s?.challenge_id != null ? String(s.challenge_id) : '';
                        if (cid) subMap.set(cid, s);
                      });

                      return (
                        <Accordion type="single" collapsible className="w-full space-y-4">
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
                                        <Badge variant={passRate >= 100 ? 'default' : passRate > 50 ? 'secondary' : 'destructive'} className="font-mono">
                                          {safeRender(sub?.passed_count)}/{safeRender(sub?.total_tests)} Passed
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline">Not Attempted</Badge>
                                      )}
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 py-4 border-t">
                                  <div className="space-y-6 mt-2">
                                    {/* Question */}
                                    {ch?.description && (
                                      <div>
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Problem Statement</div>
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90 bg-muted/30 p-4 rounded-lg">
                                          <ReactMarkdown>{safeRender(ch.description)}</ReactMarkdown>
                                        </div>
                                      </div>
                                    )}

                                    {/* Candidate Solution */}
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

                                    {/* Test Results */}
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
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* SQL Challenges */}
                {(() => {
                  const pd = assessmentDetails.proctoring_data as any;
                  const sqlChallenges: any[] = pd?.assessment_content?.sql_challenges || [];
                  const sqlSubs: any[] = pd?.sql_submissions || [];
                  if (sqlChallenges.length === 0 && sqlSubs.length === 0) return null;

                  const subMap = new Map<string, any>();
                  sqlSubs.forEach((s: any) => {
                    const cid = s?.challenge_id != null ? String(s.challenge_id) : '';
                    if (cid) subMap.set(cid, s);
                  });

                  const displayList: any[] = sqlChallenges.length > 0 ? sqlChallenges : sqlSubs.map((s: any) => ({ id: s?.challenge_id, title: 'SQL Challenge', description: '' }));

                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle>SQL Challenges</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="w-full space-y-4">
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
                No coding assessment data available for this candidate.
              </div>
            )}
          </TabsContent>

          {/* TAB 5: AI INTERVIEW */}
          <TabsContent value="interview" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {interviewDetails ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle>AI Interview Responses</CardTitle>
                    <CardDescription>
                      Review candidate transcripts, expected answers, and AI evaluations
                    </CardDescription>
                  </div>
                  {interviewDetails.final_evaluation?.overall_score != null && (
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary">{interviewDetails.final_evaluation.overall_score}<span className="text-lg text-muted-foreground">/100</span></div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {Array.isArray(interviewDetails.questions) && interviewDetails.questions.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full space-y-4 mt-4">
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
                              {(q as any).expected_answer && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">Expected Response</h4>
                                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                    {safeRender((q as any).expected_answer)}
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
"""

with open('src/pages/CandidateDetailsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(new_page_code)
print('Page completely rewritten.')
