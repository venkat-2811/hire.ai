import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const { queue_id } = await req.json()
    
    if (!queue_id) {
      return new Response(JSON.stringify({ error: 'queue_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`[assessment-invite-worker] Processing queue entry: ${queue_id}`)
    
    // Update status to processing
    await supabase.from('assessment_invite_queue').update({ status: 'processing' }).eq('id', queue_id)

    // Fetch queue entry
    const { data: queueEntry, error: fetchError } = await supabase
      .from('assessment_invite_queue')
      .select('*')
      .eq('id', queue_id)
      .single()

    if (fetchError || !queueEntry) {
      throw new Error(`Failed to fetch queue entry: ${fetchError?.message}`)
    }

    // Fetch job details
    const { data: job } = await supabase
      .from('job_descriptions')
      .select('id, title, role, level, description, must_have_skills, good_to_have_skills')
      .eq('id', queueEntry.job_id)
      .single()

    if (!job) throw new Error('Job not found')

    // Fetch candidates
    const candidateIds = queueEntry.candidate_ids as string[]
    const { data: candidates } = await supabase.from('candidates').select('id, email, full_name').in('id', candidateIds)
    if (!candidates?.length) throw new Error('No candidates found')

    // Generate MCQ questions if needed
    let preGeneratedMcqQuestions: any[] = []
    if (queueEntry.include_mcq && queueEntry.mcq_question_count > 0) {
      console.log(`[assessment-invite-worker] Generating ${queueEntry.mcq_question_count} MCQ questions`)
      
      // Call the generate-questions Edge Function
      const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job,
          mcqCount: queueEntry.mcq_question_count,
          difficulty: queueEntry.difficulty
        })
      })

      if (generateResponse.ok) {
        const generateData = await generateResponse.json()
        preGeneratedMcqQuestions = generateData.questions || []
      } else {
        throw new Error('Failed to generate MCQ questions')
      }

      if (preGeneratedMcqQuestions.length < queueEntry.mcq_question_count) {
        console.warn(`[assessment-invite-worker] Generated ${preGeneratedMcqQuestions.length}/${queueEntry.mcq_question_count} questions, proceeding with available questions`)
      }
    }

    // Calculate total time if not provided
    let totalTimeMinutes = queueEntry.total_time_minutes
    if (!totalTimeMinutes) {
      const mcqTimePerQuestion = queueEntry.difficulty === 'easy' ? 1 : queueEntry.difficulty === 'hard' ? 2 : 1.5
      const codingTimePerChallenge = queueEntry.difficulty === 'easy' ? 15 : queueEntry.difficulty === 'hard' ? 30 : 20
      totalTimeMinutes = Math.ceil(
        (queueEntry.mcq_question_count * mcqTimePerQuestion) + (queueEntry.coding_challenge_count * codingTimePerChallenge)
      )
      totalTimeMinutes = Math.max(15, totalTimeMinutes)
    }

    const deadline = new Date(Date.now() + Number(queueEntry.deadline_hours) * 60 * 60 * 1000)
    const frontendUrl = 'https://hiretec.netlify.app'

    let invitesSent = 0
    const failed: string[] = []

    // Create assessment sessions and send invites
    for (const c of candidates) {
      try {
        const token = crypto.randomUUID()
        await supabase.from('assessment_sessions').insert({
          id: crypto.randomUUID(),
          candidate_id: c.id,
          job_id: queueEntry.job_id,
          token,
          status: 'pending',
          deadline: deadline.toISOString(),
          mcq_question_count: queueEntry.mcq_question_count,
          coding_challenge_count: queueEntry.coding_challenge_count,
          total_time_minutes: totalTimeMinutes,
          mcq_questions: preGeneratedMcqQuestions,
          proctoring_data: {
            tab_switches: 0,
            fullscreen_exits: 0,
            copy_paste_attempts: 0,
            warnings: [],
            terminated: false,
            assessment_config: {
              include_mcq: queueEntry.include_mcq,
              include_coding: queueEntry.include_coding,
              difficulty: queueEntry.difficulty,
            },
          },
          created_at: new Date().toISOString(),
        })

        // Send email invite
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: c.email,
            subject: `Assessment Invite: ${job.title}`,
            html: `
              <h2>Assessment Invitation</h2>
              <p>Dear ${c.full_name},</p>
              <p>You have been invited to complete an assessment for the position of <strong>${job.title}</strong>.</p>
              <p><strong>Deadline:</strong> ${deadline.toLocaleString()}</p>
              <p><a href="${frontendUrl}/assessment/${encodeURIComponent(token)}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Assessment</a></p>
              <p>Good luck!</p>
            `
          })
        })

        invitesSent += 1
      } catch (e: any) {
        console.error(`[assessment-invite-worker] Failed to send invite to ${c.email}:`, e?.message)
        failed.push(c.id)
      }
    }

    // Update queue entry as completed
    await supabase.from('assessment_invite_queue').update({
      status: 'completed',
      invites_sent: invitesSent,
      failed_candidates: failed,
      completed_at: new Date().toISOString(),
    }).eq('id', queueId)

    console.log(`[assessment-invite-worker] Completed queue entry ${queueId}: ${invitesSent} invites sent, ${failed.length} failed`)

    return new Response(JSON.stringify({ success: true, invites_sent: invitesSent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[assessment-invite-worker] Error:', error?.message || error)
    
    if (queue_id) {
      await supabase.from('assessment_invite_queue').update({
        status: 'failed',
        error_message: error?.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      }).eq('id', queue_id)
    }

    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
