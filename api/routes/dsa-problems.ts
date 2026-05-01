/**
 * DSA Problems route handler.
 * GET  /api/dsa-problems — list problems (with filters)
 * POST /api/dsa-problems — create new problem
 * GET  /api/dsa-problems/:id — get single problem
 * PATCH /api/dsa-problems/:id — update problem
 * DELETE /api/dsa-problems/:id — archive problem
 * Extracted verbatim from api/[...path].ts — lines 1924-2012.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabase';
import { ok, badRequest, notFound, methodNotAllowed, requireAuth } from '../_lib/helpers';

export default async function handleDsaProblems(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const supabase = getSupabaseAdmin();

  if (segments.length === 1) {
    if (req.method === 'GET') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { difficulty, category, is_active } = req.query;
      let q = supabase.from('dsa_problems').select('id, slug, title, difficulty, category, tags, points, is_active, created_at');
      if (difficulty) q = q.eq('difficulty', difficulty);
      if (category) q = q.ilike('category', `%${category}%`);
      if (is_active !== 'false') q = q.eq('is_active', true);
      const { data, error } = await q.order('difficulty').order('category');
      if (error) return res.status(500).json({ error: error.message });
      return ok(res, data);
    }

    if (req.method === 'POST') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const body = req.body;
      if (!body.slug || !body.title || !body.difficulty || !body.category || !body.description) {
        return badRequest(res, 'slug, title, difficulty, category, and description are required');
      }

      const { data, error } = await supabase.from('dsa_problems').insert({
        slug: body.slug,
        title: body.title,
        difficulty: body.difficulty,
        category: body.category,
        tags: body.tags || [],
        description: body.description,
        constraints: body.constraints || '',
        examples: body.examples || [],
        starter_code: body.starter_code || {},
        solution_wrappers: body.solution_wrappers || {},
        test_cases: body.test_cases || [],
        points: body.points || 100,
        time_limit_seconds: body.time_limit_seconds || 5,
        memory_limit_kb: body.memory_limit_kb || 262144,
      }).select().single();

      if (error) return res.status(500).json({ error: error.message });
      return ok(res, data, 201);
    }

    return methodNotAllowed(res);
  }

  if (segments.length === 2) {
    const problemId = segments[1];

    if (req.method === 'GET') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { data, error } = await supabase.from('dsa_problems').select('*').eq('id', problemId).single();
      if (error || !data) return notFound(res, 'Problem not found');
      return ok(res, data);
    }

    if (req.method === 'PATCH') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { data, error } = await supabase.from('dsa_problems')
        .update({ ...req.body, updated_at: new Date().toISOString() })
        .eq('id', problemId)
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return notFound(res, 'Problem not found');
      return ok(res, data);
    }

    if (req.method === 'DELETE') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { error } = await supabase.from('dsa_problems').update({ is_active: false }).eq('id', problemId);
      if (error) return res.status(500).json({ error: error.message });
      return ok(res, { success: true, message: 'Problem archived' });
    }

    return methodNotAllowed(res);
  }

  return notFound(res);
}
