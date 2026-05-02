import { serve } from 'inngest/lambda';
import { inngest } from '../../api/_lib/inngest';

import { screeningRunWorker } from '../../api/inngest/screening-run';
import { mcqGenerationWorker } from '../../api/inngest/mcq-generation';
import { resumeParseWorker } from '../../api/inngest/resume-parse';
import { interviewEvaluateWorker } from '../../api/inngest/interview-evaluate';
import { interviewQuestionGenWorker } from '../../api/inngest/interview-question-gen';

const inngestHandler = serve({
  client: inngest,
  functions: [
    screeningRunWorker,
    mcqGenerationWorker,
    resumeParseWorker,
    interviewEvaluateWorker,
    interviewQuestionGenWorker,
  ],
});

export { inngestHandler as handler };
export default inngestHandler;
