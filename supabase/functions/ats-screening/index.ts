import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ATSScreeningRequest {
  resumeData: {
    skills: string[];
    experience: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }>;
    education: Array<{
      degree: string;
      institution: string;
      year: string;
    }>;
    summary: string;
    total_years_experience?: number;
    certifications?: string[];
    career_gaps?: string[];
    credibility_flags?: string[];
  };
  jobDescription: {
    title: string;
    role: string;
    level: string;
    description: string;
    must_have_skills: string[];
    good_to_have_skills: string[];
    min_experience_years: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resumeData, jobDescription } = await req.json() as ATSScreeningRequest;
    
    if (!resumeData || !jobDescription) {
      return new Response(
        JSON.stringify({ error: "Resume data and job description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert ATS (Applicant Tracking System) screening engine for a hiring platform. Your job is to analyze candidate resumes against job requirements and provide:

1. Objective, semantic matching (not just keyword matching)
2. Explainable scoring with reason codes
3. Fair evaluation based on actual competencies

Output must be valid JSON with this structure:
{
  "overall_score": 0-100,
  "skill_relevance_score": 0-100,
  "experience_score": 0-100,
  "education_score": 0-100,
  "credibility_score": 0-100,
  "shortlisted": boolean (true if overall_score >= 70),
  "shortlist_reason": "Brief explanation of the decision",
  "reason_codes": [
    {
      "code": "SKILL_MATCH_HIGH",
      "type": "positive|negative|neutral",
      "description": "Human-readable explanation",
      "impact": -10 to +10
    }
  ],
  "skill_match": [
    {
      "skill": "skill name",
      "found": boolean,
      "relevance": "must_have|good_to_have",
      "evidence": "Where in resume this skill was demonstrated"
    }
  ],
  "experience_analysis": "Detailed analysis of experience fit",
  "education_analysis": "Analysis of education qualifications",
  "career_gap_analysis": "Analysis of any career gaps",
  "improvement_suggestions": ["suggestion1", "suggestion2"]
}

Reason code examples:
- SKILL_MATCH_HIGH: Candidate demonstrates strong proficiency in required skills
- EXPERIENCE_EXCEEDS: Experience exceeds requirements
- EXPERIENCE_BELOW: Experience below minimum requirements
- EDUCATION_MISMATCH: Education doesn't align with role requirements
- CAREER_GAP_UNEXPLAINED: Unexplained gaps in employment history
- CREDIBILITY_CONCERN: Potential authenticity issues detected
- ROLE_PROGRESSION: Shows healthy career progression`;

    const userPrompt = `Perform ATS screening for this candidate:

JOB REQUIREMENTS:
- Title: ${jobDescription.title}
- Role Type: ${jobDescription.role}
- Level: ${jobDescription.level}
- Description: ${jobDescription.description}
- Must-Have Skills: ${jobDescription.must_have_skills.join(", ")}
- Good-to-Have Skills: ${jobDescription.good_to_have_skills.join(", ")}
- Minimum Experience: ${jobDescription.min_experience_years} years

CANDIDATE PROFILE:
- Summary: ${resumeData.summary}
- Skills: ${resumeData.skills.join(", ")}
- Total Experience: ${resumeData.total_years_experience || "Not specified"} years
- Experience: ${JSON.stringify(resumeData.experience, null, 2)}
- Education: ${JSON.stringify(resumeData.education, null, 2)}
- Certifications: ${resumeData.certifications?.join(", ") || "None listed"}
- Career Gaps: ${resumeData.career_gaps?.join(", ") || "None detected"}
- Credibility Flags: ${resumeData.credibility_flags?.join(", ") || "None"}

Provide comprehensive, explainable ATS screening results. Return only valid JSON.`;

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

    const screeningResult = JSON.parse(jsonContent);

    console.log("ATS screening completed. Score:", screeningResult.overall_score);

    return new Response(
      JSON.stringify({ success: true, data: screeningResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ATS screening:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
