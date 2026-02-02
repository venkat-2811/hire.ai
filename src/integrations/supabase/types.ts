export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ats_screenings: {
        Row: {
          candidate_id: string
          credibility_score: number | null
          detailed_analysis: Json | null
          education_score: number | null
          experience_score: number | null
          id: string
          job_id: string
          overall_score: number
          reason_codes: Json
          screened_at: string
          shortlist_reason: string | null
          shortlisted: boolean
          skill_relevance_score: number | null
        }
        Insert: {
          candidate_id: string
          credibility_score?: number | null
          detailed_analysis?: Json | null
          education_score?: number | null
          experience_score?: number | null
          id?: string
          job_id: string
          overall_score: number
          reason_codes?: Json
          screened_at?: string
          shortlist_reason?: string | null
          shortlisted?: boolean
          skill_relevance_score?: number | null
        }
        Update: {
          candidate_id?: string
          credibility_score?: number | null
          detailed_analysis?: Json | null
          education_score?: number | null
          experience_score?: number | null
          id?: string
          job_id?: string
          overall_score?: number
          reason_codes?: Json
          screened_at?: string
          shortlist_reason?: string | null
          shortlisted?: boolean
          skill_relevance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_screenings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_screenings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_responses: {
        Row: {
          ai_feedback: string | null
          ai_score: number | null
          id: string
          manual_feedback: string | null
          manual_score: number | null
          question_id: string
          response_code: string | null
          response_text: string | null
          session_id: string
          submitted_at: string
          time_taken_seconds: number | null
        }
        Insert: {
          ai_feedback?: string | null
          ai_score?: number | null
          id?: string
          manual_feedback?: string | null
          manual_score?: number | null
          question_id: string
          response_code?: string | null
          response_text?: string | null
          session_id: string
          submitted_at?: string
          time_taken_seconds?: number | null
        }
        Update: {
          ai_feedback?: string | null
          ai_score?: number | null
          id?: string
          manual_feedback?: string | null
          manual_score?: number | null
          question_id?: string
          response_code?: string | null
          response_text?: string | null
          session_id?: string
          submitted_at?: string
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          consent_given: boolean
          consent_timestamp: string | null
          created_at: string
          email: string
          full_name: string
          github_url: string | null
          id: string
          phone: string | null
          portfolio_url: string | null
          resume_parsed_data: Json | null
          resume_text: string | null
          resume_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          email: string
          full_name: string
          github_url?: string | null
          id?: string
          phone?: string | null
          portfolio_url?: string | null
          resume_parsed_data?: Json | null
          resume_text?: string | null
          resume_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          consent_given?: boolean
          consent_timestamp?: string | null
          created_at?: string
          email?: string
          full_name?: string
          github_url?: string | null
          id?: string
          phone?: string | null
          portfolio_url?: string | null
          resume_parsed_data?: Json | null
          resume_text?: string | null
          resume_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      interview_evaluations: {
        Row: {
          communication_score: number | null
          detailed_feedback: string | null
          evaluated_at: string
          evaluator_notes: string | null
          id: string
          integrity_score: number | null
          overall_score: number | null
          problem_solving_score: number | null
          recommendation:
            | Database["public"]["Enums"]["hire_recommendation"]
            | null
          role_fit_index: number | null
          session_id: string
          strengths: Json | null
          technical_score: number | null
          weaknesses: Json | null
        }
        Insert: {
          communication_score?: number | null
          detailed_feedback?: string | null
          evaluated_at?: string
          evaluator_notes?: string | null
          id?: string
          integrity_score?: number | null
          overall_score?: number | null
          problem_solving_score?: number | null
          recommendation?:
            | Database["public"]["Enums"]["hire_recommendation"]
            | null
          role_fit_index?: number | null
          session_id: string
          strengths?: Json | null
          technical_score?: number | null
          weaknesses?: Json | null
        }
        Update: {
          communication_score?: number | null
          detailed_feedback?: string | null
          evaluated_at?: string
          evaluator_notes?: string | null
          id?: string
          integrity_score?: number | null
          overall_score?: number | null
          problem_solving_score?: number | null
          recommendation?:
            | Database["public"]["Enums"]["hire_recommendation"]
            | null
          role_fit_index?: number | null
          session_id?: string
          strengths?: Json | null
          technical_score?: number | null
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          created_at: string
          difficulty_level: number
          expected_answer: string | null
          id: string
          max_score: number
          metadata: Json | null
          order_index: number
          question_text: string
          question_type: Database["public"]["Enums"]["assessment_type"]
          session_id: string
          time_limit_seconds: number | null
        }
        Insert: {
          created_at?: string
          difficulty_level: number
          expected_answer?: string | null
          id?: string
          max_score?: number
          metadata?: Json | null
          order_index: number
          question_text: string
          question_type: Database["public"]["Enums"]["assessment_type"]
          session_id: string
          time_limit_seconds?: number | null
        }
        Update: {
          created_at?: string
          difficulty_level?: number
          expected_answer?: string | null
          id?: string
          max_score?: number
          metadata?: Json | null
          order_index?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["assessment_type"]
          session_id?: string
          time_limit_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          candidate_id: string
          completed_at: string | null
          created_at: string
          id: string
          integrity_score: number | null
          job_id: string
          proctoring_data: Json | null
          question_seed: string | null
          scheduled_at: string | null
          screening_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          updated_at: string
        }
        Insert: {
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          integrity_score?: number | null
          job_id: string
          proctoring_data?: Json | null
          question_seed?: string | null
          scheduled_at?: string | null
          screening_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          integrity_score?: number | null
          job_id?: string
          proctoring_data?: Json | null
          question_seed?: string | null
          scheduled_at?: string | null
          screening_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_screening_id_fkey"
            columns: ["screening_id"]
            isOneToOne: false
            referencedRelation: "ats_screenings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          good_to_have_skills: Json
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["role_level"]
          min_experience_years: number | null
          must_have_skills: Json
          role: Database["public"]["Enums"]["job_role"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          good_to_have_skills?: Json
          id?: string
          is_active?: boolean
          level: Database["public"]["Enums"]["role_level"]
          min_experience_years?: number | null
          must_have_skills?: Json
          role: Database["public"]["Enums"]["job_role"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          good_to_have_skills?: Json
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["role_level"]
          min_experience_years?: number | null
          must_have_skills?: Json
          role?: Database["public"]["Enums"]["job_role"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      practical_assessments: {
        Row: {
          created_at: string
          evaluation_criteria: Json
          expected_output: string | null
          id: string
          order_index: number
          role: Database["public"]["Enums"]["job_role"]
          session_id: string
          starter_code: string | null
          task_description: string
          task_title: string
          time_limit_minutes: number
        }
        Insert: {
          created_at?: string
          evaluation_criteria?: Json
          expected_output?: string | null
          id?: string
          order_index: number
          role: Database["public"]["Enums"]["job_role"]
          session_id: string
          starter_code?: string | null
          task_description: string
          task_title: string
          time_limit_minutes?: number
        }
        Update: {
          created_at?: string
          evaluation_criteria?: Json
          expected_output?: string | null
          id?: string
          order_index?: number
          role?: Database["public"]["Enums"]["job_role"]
          session_id?: string
          starter_code?: string | null
          task_description?: string
          task_title?: string
          time_limit_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "practical_assessments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practical_submissions: {
        Row: {
          ai_evaluation: Json | null
          assessment_id: string
          execution_result: string | null
          feedback: string | null
          id: string
          score: number | null
          session_id: string
          submitted_answer: string | null
          submitted_at: string
          submitted_code: string | null
          time_taken_seconds: number | null
        }
        Insert: {
          ai_evaluation?: Json | null
          assessment_id: string
          execution_result?: string | null
          feedback?: string | null
          id?: string
          score?: number | null
          session_id: string
          submitted_answer?: string | null
          submitted_at?: string
          submitted_code?: string | null
          time_taken_seconds?: number | null
        }
        Update: {
          ai_evaluation?: Json | null
          assessment_id?: string
          execution_result?: string | null
          feedback?: string | null
          id?: string
          score?: number | null
          session_id?: string
          submitted_answer?: string | null
          submitted_at?: string
          submitted_code?: string | null
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practical_submissions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "practical_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practical_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "interviewer" | "candidate"
      assessment_type: "technical" | "practical" | "behavioral"
      hire_recommendation: "strong_hire" | "hire" | "borderline" | "no_hire"
      interview_status: "pending" | "in_progress" | "completed" | "cancelled"
      job_role: "salesforce_developer" | "qa_engineer" | "business_analyst"
      role_level: "intern" | "junior" | "mid" | "senior"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "recruiter", "interviewer", "candidate"],
      assessment_type: ["technical", "practical", "behavioral"],
      hire_recommendation: ["strong_hire", "hire", "borderline", "no_hire"],
      interview_status: ["pending", "in_progress", "completed", "cancelled"],
      job_role: ["salesforce_developer", "qa_engineer", "business_analyst"],
      role_level: ["intern", "junior", "mid", "senior"],
    },
  },
} as const
