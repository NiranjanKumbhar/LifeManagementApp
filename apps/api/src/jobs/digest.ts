import { inngest } from './inngest';

/**
 * Weekly digest — sent every Monday at 8 AM UTC.
 * Summarises the week's upcoming deadlines, low-stock items, and partner actions.
 * Delivery is via Resend (same pattern as reminder delivery).
 * Implementation: TODO — requires DigestService.build() (see digest.service.ts stub).
 */
export const sendWeeklyDigest = inngest.createFunction(
  { id: 'send-weekly-digest', name: 'Send Weekly Digest' },
  { cron: '0 8 * * 1' },
  async ({ logger }) => {
    logger.info('Weekly digest cron fired — delivery not yet implemented');
    return { skipped: true, reason: 'digest delivery not yet implemented' };
  },
);
