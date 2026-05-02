/**
 * Inngest client instance for background job orchestration.
 */
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'talent-scout-ai',
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});
