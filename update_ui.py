import re

with open('src/pages/CandidateDetailsPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the Generate button
content = content.replace(
    """{Array.isArray(interviewDetails.questions) && interviewDetails.questions.some((q: any) => !q.expected_answer && !q.expected_response) && (
                          <Button variant="outline" size="sm" onClick={handleGenerateExpectedAnswers} disabled={generatingAnswers}>
                            {generatingAnswers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Missing Expected Answers
                          </Button>
                        )}""",
    ""
)

# 2. Add automatic generation in useEffect
# We'll put it right after the main useEffect
use_effect_auto_generate = """
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
"""
# Insert before `const handleExpandAllMcq`
content = content.replace("  const handleExpandAllMcq", use_effect_auto_generate + "\n  const handleExpandAllMcq")

# 3. Remove Rejected/Accepted badges completely
content = content.replace('{screening?.shortlisted === true && <Badge className="h-6" variant="default">Shortlisted</Badge>}', '')
content = content.replace('{screening?.shortlisted === false && <Badge className="h-6" variant="destructive">Rejected</Badge>}', '')

# 4. Fix saveManualInterview to updateManualInterview
content = content.replace("await candidatesApi.saveManualInterview(", "await candidatesApi.updateManualInterview(")

# Wait, `updateManualInterview` takes 3 args: id, jobId, body.
# Let's check how I called it.
# `await candidatesApi.saveManualInterview(candidateId, { job_id: jobId, ... })`
# So I need to change it to `await candidatesApi.updateManualInterview(candidateId, jobId || '', { manual_interview_score: ... })`
fix_manual = """
      await candidatesApi.updateManualInterview(candidateId, jobId || '', {
        manual_interview_score: manualScore ? parseFloat(manualScore) : null,
        manual_interview_notes: manualNotes,
        manual_interview_feedback: manualFeedback
      });
"""
# I need to replace the old try block content.
old_try_block = """
      await candidatesApi.saveManualInterview(candidateId, {
        job_id: jobId,
        manual_interview_score: manualScore ? parseFloat(manualScore) : null,
        manual_interview_notes: manualNotes,
        manual_interview_feedback: manualFeedback
      });
"""
old_try_block2 = """
      await candidatesApi.updateManualInterview(candidateId, {
        job_id: jobId,
        manual_interview_score: manualScore ? parseFloat(manualScore) : null,
        manual_interview_notes: manualNotes,
        manual_interview_feedback: manualFeedback
      });
"""

if old_try_block in content:
    content = content.replace(old_try_block, fix_manual)
elif old_try_block2 in content:
    content = content.replace(old_try_block2, fix_manual)
elif "candidatesApi.saveManualInterview(" in content:
    content = re.sub(
        r"await candidatesApi\.saveManualInterview\([^;]+;",
        "await candidatesApi.updateManualInterview(candidateId, jobId || '', { manual_interview_score: manualScore ? parseFloat(manualScore) : null, manual_interview_notes: manualNotes, manual_interview_feedback: manualFeedback });",
        content
    )
elif "candidatesApi.updateManualInterview(" in content:
    content = re.sub(
        r"await candidatesApi\.updateManualInterview\(candidateId, \{[\s\S]*?\}\);",
        "await candidatesApi.updateManualInterview(candidateId, jobId || '', { manual_interview_score: manualScore ? parseFloat(manualScore) : null, manual_interview_notes: manualNotes, manual_interview_feedback: manualFeedback });",
        content
    )


# 5. Make Detailed Feedback more visible
old_feedback = """
                        {interviewDetails.final_evaluation.detailed_feedback && (
                          <div>
                            <h5 className="font-semibold text-sm mb-3 flex items-center text-primary/80">
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Detailed Feedback
                            </h5>
                            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded border">
                              {typeof interviewDetails.final_evaluation.detailed_feedback === 'object' ? JSON.stringify(interviewDetails.final_evaluation.detailed_feedback, null, 2) : interviewDetails.final_evaluation.detailed_feedback}
                            </p>
                          </div>
                        )}
"""

new_feedback = """
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
"""
content = content.replace(old_feedback, new_feedback)

with open('src/pages/CandidateDetailsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("UI Updates Applied.")
