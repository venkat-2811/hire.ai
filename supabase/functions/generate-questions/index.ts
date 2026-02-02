import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuestionGenerationRequest {
  role: "salesforce_developer" | "qa_engineer" | "business_analyst";
  level: "intern" | "junior" | "mid" | "senior";
  resumeData: {
    skills: string[];
    experience: Array<{ title: string; company: string; description: string }>;
    summary: string;
  };
  jobDescription: {
    title: string;
    description: string;
    must_have_skills: string[];
  };
  questionSeed: string;
  questionTypes: ("technical" | "practical" | "behavioral")[];
  count: number;
}

const ROLE_QUESTION_TEMPLATES = {
  salesforce_developer: {
    technical: [
      "Apex triggers and their execution context",
      "Governor limits and optimization strategies",
      "Lightning Web Components architecture",
      "Salesforce integration patterns",
      "SOQL query optimization",
      "Bulk API vs REST API differences",
      "Platform events and CDC",
      "Sharing and security model",
    ],
    practical: [
      "Debug a trigger that's hitting governor limits",
      "Write an LWC component with wire service",
      "Design a custom object relationship",
      "Implement an integration with external system",
    ],
  },
  qa_engineer: {
    technical: [
      "Test case design techniques",
      "API testing strategies",
      "Automation framework architecture",
      "CI/CD integration for tests",
      "Performance testing approaches",
      "Security testing fundamentals",
      "Mobile testing considerations",
      "Test data management",
    ],
    practical: [
      "Write test cases for a login feature",
      "Create an automation script for API testing",
      "Design a regression test suite",
      "Identify bugs in a given scenario",
    ],
  },
  business_analyst: {
    technical: [
      "Requirements elicitation techniques",
      "User story writing standards",
      "Process mapping methodologies",
      "Gap analysis frameworks",
      "Stakeholder management",
      "Agile vs Waterfall comparison",
      "Data analysis for business decisions",
      "Change management principles",
    ],
    practical: [
      "Write user stories from requirements",
      "Create a process flow diagram",
      "Conduct a gap analysis",
      "Prioritize a product backlog",
    ],
  },
};

const DIFFICULTY_BY_LEVEL = {
  intern: { min: 1, max: 2, focus: "fundamentals and basic concepts" },
  junior: { min: 2, max: 3, focus: "practical application and common scenarios" },
  mid: { min: 3, max: 4, focus: "complex scenarios and best practices" },
  senior: { min: 4, max: 5, focus: "architecture, leadership, and advanced patterns" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      role, 
      level, 
      resumeData, 
      jobDescription, 
      questionSeed, 
      questionTypes,
      count = 10 
    } = await req.json() as QuestionGenerationRequest;
    
    if (!role || !level || !resumeData || !jobDescription) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const roleTemplates = ROLE_QUESTION_TEMPLATES[role];
    const levelConfig = DIFFICULTY_BY_LEVEL[level];

    const systemPrompt = `You are an expert technical interviewer for ${role.replace("_", " ")} positions. 

Your task is to generate unique, one-time interview questions that:
1. Are tailored to the candidate's resume and the specific job
2. Cannot be easily googled or prepared for in advance
3. Test real competency, not memorization
4. Are appropriate for ${level} level (focus on ${levelConfig.focus})
5. Include a mix of question types

For each question, provide:
- The question text (clear and specific)
- Expected answer or evaluation criteria
- Difficulty level (${levelConfig.min}-${levelConfig.max})
- Time limit in seconds
- Question type (technical/practical/behavioral)

Use this unique seed for randomization: ${questionSeed}

Output valid JSON array with this structure:
[
  {
    "question_text": "Full question text",
    "expected_answer": "Key points to look for in the answer",
    "difficulty_level": ${levelConfig.min}-${levelConfig.max},
    "time_limit_seconds": 120-600 depending on complexity,
    "question_type": "technical|practical|behavioral",
    "metadata": {
      "skill_tested": "primary skill being tested",
      "resume_reference": "which part of resume this relates to"
    }
  }
]`;

    const userPrompt = `Generate ${count} unique interview questions for this candidate:

POSITION: ${jobDescription.title} (${level} level)
JOB DESCRIPTION: ${jobDescription.description}
REQUIRED SKILLS: ${jobDescription.must_have_skills.join(", ")}

CANDIDATE BACKGROUND:
- Summary: ${resumeData.summary}
- Skills: ${resumeData.skills.join(", ")}
- Recent Experience: ${resumeData.experience.slice(0, 3).map(e => 
    `${e.title} at ${e.company}: ${e.description}`
  ).join("\n")}

QUESTION TYPES TO INCLUDE: ${questionTypes.join(", ")}

ROLE-SPECIFIC TOPICS TO COVER:
Technical: ${roleTemplates.technical.slice(0, 4).join(", ")}
Practical: ${roleTemplates.practical.slice(0, 2).join(", ")}

Generate questions that probe the candidate's actual knowledge based on their claimed experience. 
Make questions specific enough that generic answers won't suffice.
Ensure questions are unique using seed: ${questionSeed}

Return only valid JSON array.`;

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
        temperature: 0.7, // Higher temperature for more variety
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

    const questions = JSON.parse(jsonContent);

    // Add order index to each question
    const indexedQuestions = questions.map((q: any, i: number) => ({
      ...q,
      order_index: i + 1,
    }));

    console.log(`Generated ${indexedQuestions.length} questions for ${role} ${level} position`);

    return new Response(
      JSON.stringify({ success: true, data: indexedQuestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating questions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
