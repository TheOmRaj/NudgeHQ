import { postRouter } from "~/server/api/routers/post";
import { gmailRouter } from "~/server/api/routers/gmail";
import { calendarRouter } from "~/server/api/routers/calendar";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  gmail: gmailRouter,
  calendar: calendarRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
