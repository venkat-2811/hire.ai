import type { VercelRequest, VercelResponse } from '@vercel/node';

import handleJobs from './routes/jobs';
import handleAnalytics from './routes/analytics';
import handleScreening from './routes/screening';
import handleCandidates from './routes/candidates';
import handleAssessments from './routes/assessments';
import handleAiInterview from './routes/ai-interview';
import handleApply from './routes/apply';
import handleInterviews from './routes/interviews';
import handleBilling from './routes/billing';
import handleProfile from './routes/profile';
import handleSubscription from './routes/subscription';
import handleUsage from './routes/usage';
import handleJobStatus from './routes/job-status';
import handleDsaProblems from './routes/dsa-problems';

export default async function routeRequest(req: VercelRequest, res: VercelResponse) {
  // CORS check
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const urlStr = req.url || '/';
    const parsedUrl = new URL(urlStr, 'http://localhost');
    const pathParts = parsedUrl.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
    
    // In some environments, Vercel puts the catch-all segments in req.query.path
    // If we have a query parameter 'path', use it, otherwise use parsed URL
    let segments: string[] = pathParts;
    if (req.query && req.query.path) {
      segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
    }
    
    if (segments.length === 0) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const route = segments[0];

    switch (route) {
      case 'jobs':
        return await handleJobs(req, res, segments);
      case 'analytics':
        return await handleAnalytics(req, res, segments);
      case 'screening':
        return await handleScreening(req, res, segments);
      case 'candidates':
        return await handleCandidates(req, res, segments);
      case 'assessments':
        return await handleAssessments(req, res, segments);
      case 'ai-interview':
        return await handleAiInterview(req, res, segments);
      case 'apply':
        return await handleApply(req, res, segments);
      case 'interviews':
        return await handleInterviews(req, res, segments);
      case 'billing':
        return await handleBilling(req, res, segments);
      case 'profile':
        return await handleProfile(req, res, segments);
      case 'subscription':
        return await handleSubscription(req, res, segments);
      case 'usage':
        return await handleUsage(req, res, segments);
      case 'job-status':
        return await handleJobStatus(req, res, segments);
      case 'dsa-problems':
        return await handleDsaProblems(req, res, segments);
      default:
        return res.status(404).json({ error: 'Route not found' });
    }
  } catch (err: any) {
    console.error('[API Router Error]:', err, { route: req.url, method: req.method });
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
