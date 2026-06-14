import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { TaskService } from '../services/task.service';
import {
  createTaskSchema,
  listTasksSchema,
  moveTaskSchema,
  reorderTaskSchema,
  taskIdSchema,
  updateTaskSchema,
} from '../utils/validation';

/**
 * Task router. All procedures are id/project-based, so they use
 * `protectedProcedure` and let the service authorize via the parent project.
 */
export const taskRouter = router({
  list: protectedProcedure.input(listTasksSchema).query(async ({ ctx, input }) => {
    return unwrap(await TaskService.list(ctx.db, ctx.userId, input.projectId));
  }),

  create: protectedProcedure.input(createTaskSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TaskService.create(ctx.db, ctx.userId, input));
  }),

  update: protectedProcedure.input(updateTaskSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TaskService.update(ctx.db, ctx.userId, input));
  }),

  complete: protectedProcedure.input(taskIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TaskService.complete(ctx.db, ctx.userId, input.id));
  }),

  reopen: protectedProcedure.input(taskIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TaskService.reopen(ctx.db, ctx.userId, input.id));
  }),

  reorder: protectedProcedure.input(reorderTaskSchema).mutation(async ({ ctx, input }) => {
    return unwrap(
      await TaskService.reorder(ctx.db, ctx.userId, input.projectId, input.taskId, input.newOrder),
    );
  }),

  move: protectedProcedure.input(moveTaskSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TaskService.move(ctx.db, ctx.userId, input.taskId, input.newProjectId));
  }),
});
