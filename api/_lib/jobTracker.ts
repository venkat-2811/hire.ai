/**
 * Background job lifecycle management.
 * Tracks long-running tasks (AI screening, MCQ gen, etc.) in the
 * `background_jobs` Supabase table so clients can poll for completion.
 */
import { getSupabaseAdmin } from './supabase';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface BackgroundJob {
  id: string;
  type: string;
  status: JobStatus;
  input: any;
  result: any;
  error: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Create a new background job record.
 * Returns the job ID for client polling.
 */
export async function createJob(type: string, input: any, userId?: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('background_jobs')
    .insert({
      type,
      status: 'queued' as JobStatus,
      input: input || {},
      user_id: userId || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create background job: ${error.message}`);
  return data.id;
}

/**
 * Update a job's status, and optionally its result or error message.
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  result?: any,
  error?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const update: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (result !== undefined) update.result = result;
  if (error !== undefined) update.error = error;
  if (status === 'completed' || status === 'failed') {
    update.completed_at = new Date().toISOString();
  }

  const { error: dbError } = await supabase
    .from('background_jobs')
    .update(update)
    .eq('id', jobId);

  if (dbError) {
    console.error(`[jobTracker] Failed to update job ${jobId}:`, dbError.message);
  }
}

/**
 * Get the current status of a background job.
 */
export async function getJobStatus(jobId: string): Promise<BackgroundJob | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    console.error(`[jobTracker] Failed to get job ${jobId}:`, error.message);
    return null;
  }
  return data as BackgroundJob | null;
}
