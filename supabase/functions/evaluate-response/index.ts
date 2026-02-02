import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EvaluateResponseRequest {
  question: {
    question_text: string;
    expected_answer: string;
    question_type: "technical" | "practical" | "behavioral";
    difficulty_level: number;
    max_score: number;
    metadata?: {
      skill_tested?: string;
    };
  };
  response: {
    response_text?: string;
    response_code?: string;
    time_taken_seconds: number;
  };
  role: string;
  level: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, response, role, level } = await req.json() as EvaluateResponseRequest;
    
    if (!question || !response) {
      return new Response(
        JSON.stringify({ error: "Question and response are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert interview evaluator for ${role.replace("_", " ")} positions at ${level} level.

Evaluate candidate responses fairly and objectively. Consider:
1. Technical accuracy and depth
2. Communication clarity
3. Problem-solving approach
4. Relevance to the question
5. Time taken vs expected

Provide evaluation in this JSON format:
{
  "score": 0-100,
  "feedback": "Detailed constructive feedback",
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"],
  "technical_accuracy": 0-100,
  "communication_score": 0-100,
  "problem_solving_score": 0-100,
  "key_points_covered": ["point1", "point2"],
  "missed_points": ["point1", "point2"],
  "recommendation": "Strong candidate for this topic | Needs improvement | Not suitable"
}

Be fair but rigorous. A score of 70+ indicates competency.`;

    const userPrompt = `Evaluate this interview response:

QUESTION (${question.question_type}, Difficulty: ${question.difficulty_level}/5):
${question.question_text}

EXPECTED ANSWER/CRITERIA:
${question.expected_answer}

SKILL BEING TESTED: ${question.metadata?.skill_tested || "General competency"}

CANDIDATE'S RESPONSE:
${response.response_text || ""}
${response.response_code ? `\nCODE SUBMITTED:\n${response.response_code}` : ""}

TIME TAKEN: ${response.time_taken_seconds} seconds
MAX SCORE: ${question.max_score}

Evaluate the response thoroughly. Return only valid JSON.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    const evaluation = JSON.parse(jsonContent);

    console.log(`Evaluated response. Score: ${evaluation.score}`);

    return new Response(
      JSON.stringify({ success: true, data: evaluation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error evaluating response:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
