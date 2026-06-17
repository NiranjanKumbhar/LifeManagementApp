import { router } from '../trpc';
import { workspaceRouter } from './workspace';
import { projectRouter } from './project';
import { taskRouter } from './task';
import { reminderRouter } from './reminder';
import { householdRouter } from './household';
import { personRouter } from './person';
import { notificationRouter } from './notification';
import { resourceRouter } from './resource';
import { templateRouter } from './template';
import { searchRouter } from './search';
import { activityRouter } from './activity';
import { userRouter } from './user';
import { inboxRouter } from './inbox';
import { calendarRouter } from './calendar';
import { accountRouter } from './account';

/** Root application router — all LifeSync domains. */
export const appRouter = router({
  workspace: workspaceRouter,
  project: projectRouter,
  task: taskRouter,
  reminder: reminderRouter,
  household: householdRouter,
  person: personRouter,
  notification: notificationRouter,
  resource: resourceRouter,
  template: templateRouter,
  search: searchRouter,
  activity: activityRouter,
  user: userRouter,
  inbox: inboxRouter,
  calendar: calendarRouter,
  account: accountRouter,
});

export type AppRouter = typeof appRouter;
