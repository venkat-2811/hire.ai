/**
 * Job status polling endpoint for background jobs.
 * GET /api/job-status/:jobId
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ok, badRequest, notFound, methodNotAllowed } from '../_lib/helpers';
import { getJobStatus } from '../_lib/jobTracker';

export default async function handleJobStatus(req: VercelRequest, res: VercelResponse, segments: string[]) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (segments.length !== 2) return badRequest(res, 'Job ID required');

  const jobId = segments[1];
  const job = await getJobStatus(jobId);

  if (!job) return notFound(res, 'Job not found');

  return ok(res, {
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.result,
    error: job.error,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
  });
}
