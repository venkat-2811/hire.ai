import { inngest } from './api/_lib/inngest';
inngest.createFunction({ id: 'test', triggers: [{ event: 'test' }] }, async () => {});
