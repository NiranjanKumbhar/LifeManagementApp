import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'lifesync',
  // In production, INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY are picked up
  // automatically from the environment by the SDK.
});
