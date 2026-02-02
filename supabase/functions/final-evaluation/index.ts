import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FinalEvaluationRequest {
  sessionId: string;
  candidateName: string;
  role: string;
  level: string;
  atsScreening: {
    overall_score: number;
    skill_relevance_score: number;
    shortlisted: boolean;
    reason_codes: Array<{ code: string; type: string; description: string }>;
  };
  questionResponses: Array<{
    question_type: string;
    ai_score: number;
    technical_accuracy?: number;
    communication_score?: number;
    problem_solving_score?: number;
  }>;
  practicalSubmissions: Array<{
    task_title: string;
    score: number;
    feedback: string;
  }>;
  proctoringData: {
    tabSwitches: number;
    copyPasteCount: number;
    fullscreenExits: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      sessionId,
      candidateName,
      role, 
      level, 
      atsScreening, 
      questionResponses, 
      practicalSubmissions,
      proctoringData 
    } = await req.json() as FinalEvaluationRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate integrity score
    const integrityPenalties = 
      (proctoringData.tabSwitches * 5) + 
      (proctoringData.copyPasteCount * 3) + 
      (proctoringData.fullscreenExits * 10);
    const integrityScore = Math.max(0, 100 - integrityPenalties);

    // Calculate component scores
    const technicalScores = questionResponses
      .filter(r => r.question_type === 'technical')
      .map(r => r.ai_score);
    const technicalScore = technicalScores.length > 0 
      ? Math.round(technicalScores.reduce((a, b) => a + b, 0) / technicalScores.length)
      : 0;

    const problemSolvingScores = questionResponses
      .filter(r => r.problem_solving_score)
      .map(r => r.problem_solving_score!);
    const problemSolvingScore = problemSolvingScores.length > 0
      ? Math.round(problemSolvingScores.reduce((a, b) => a + b, 0) / problemSolvingScores.length)
      : 0;

    const communicationScores = questionResponses
      .filter(r => r.communication_score)
      .map(r => r.communication_score!);
    const communicationScore = communicationScores.length > 0
      ? Math.round(communicationScores.reduce((a, b) => a + b, 0) / communicationScores.length)
      : 0;

    const practicalScore = practicalSubmissions.length > 0
      ? Math.round(practicalSubmissions.reduce((a, b) => a + b.score, 0) / practicalSubmissions.length)
      : 0;

    // Calculate overall score (weighted)
    const overallScore = Math.round(
      (technicalScore * 0.30) +
      (problemSolvingScore * 0.25) +
      (practicalScore * 0.25) +
      (communicationScore * 0.10) +
      (integrityScore * 0.10)
    );

    // Calculate role fit index
    const roleFitIndex = Math.round(
      (atsScreening.skill_relevance_score * 0.4) +
      (technicalScore * 0.35) +
      (practicalScore * 0.25)
    );

    const systemPrompt = `You are a senior hiring committee member making a final recommendation for a ${role.replace("_", " ")} position at ${level} level.

Based on comprehensive evaluation data, provide:
1. Final recommendation (Strong Hire / Hire / Borderline / No Hire)
2. Key strengths
3. Key weaknesses
4. Detailed feedback for the hiring manager
5. Suggestions for the candidate (if borderline or no hire)

Be objective and base your recommendation on the data provided.

Output JSON:
{
  "recommendation": "strong_hire|hire|borderline|no_hire",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "detailed_feedback": "Comprehensive feedback paragraph",
  "key_differentiators": "What makes this candidate stand out or fall short",
  "risk_assessment": "Any hiring risks to consider",
  "onboarding_suggestions": "Suggestions if hired"
}`;

    const userPrompt = `Generate final hiring recommendation for:

CANDIDATE: ${candidateName}
POSITION: ${role.replace("_", " ")} (${level})

SCORES SUMMARY:
- ATS Screening: ${atsScreening.overall_score}/100 (${atsScreening.shortlisted ? "Shortlisted" : "Not shortlisted"})
- Technical Score: ${technicalScore}/100
- Problem Solving: ${problemSolvingScore}/100
- Communication: ${communicationScore}/100
- Practical Tasks: ${practicalScore}/100
- Integrity Score: ${integrityScore}/100
- Role Fit Index: ${roleFitIndex}/100
- OVERALL SCORE: ${overallScore}/100

ATS FINDINGS:
${atsScreening.reason_codes.map(r => `- ${r.type.toUpperCase()}: ${r.description}`).join("\n")}

PROCTORING DATA:
- Tab Switches: ${proctoringData.tabSwitches}
- Copy/Paste Events: ${proctoringData.copyPasteCount}
- Fullscreen Exits: ${proctoringData.fullscreenExits}

PRACTICAL ASSESSMENTS:
${practicalSubmissions.map(p => `- ${p.task_title}: ${p.score}/100 - ${p.feedback}`).join("\n")}

INTERVIEW PERFORMANCE:
- ${questionResponses.length} questions answered
- Average score: ${questionResponses.length > 0 ? Math.round(questionResponses.reduce((a, b) => a + b.ai_score, 0) / questionResponses.length) : 0}/100

Provide your recommendation. Return only valid JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    const aiRecommendation = JSON.parse(jsonContent);

    const finalEvaluation = {
      session_id: sessionId,
      technical_score: technicalScore,
      problem_solving_score: problemSolvingScore,
      communication_score: communicationScore,
      integrity_score: integrityScore,
      role_fit_index: roleFitIndex,
      overall_score: overallScore,
      recommendation: aiRecommendation.recommendation,
      strengths: aiRecommendation.strengths,
      weaknesses: aiRecommendation.weaknesses,
      detailed_feedback: aiRecommendation.detailed_feedback,
    };

    console.log(`Final evaluation complete. Recommendation: ${aiRecommendation.recommendation}, Score: ${overallScore}`);

    return new Response(
      JSON.stringify({ success: true, data: finalEvaluation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in final evaluation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
