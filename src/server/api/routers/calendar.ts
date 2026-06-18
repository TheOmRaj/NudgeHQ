import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const calendarRouter = createTRPCRouter({
  listToday: protectedProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const now = input?.date ? new Date(input.date) : new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        // @ts-ignore
        const result = await ctx.corsair
          .withTenant(ctx.userId)
          .googlecalendar.api.events.getMany({
            calendarId: "primary",
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
          });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const events = (result?.items ?? []).map((ev: any) => {
          const start = ev.start?.dateTime ?? ev.start?.date ?? "";
          const end = ev.end?.dateTime ?? ev.end?.date ?? "";
          const startDate = new Date(start as string);

          return {
            id: ev.id as string,
            title: (ev.summary as string) ?? "(no title)",
            start: start as string,
            end: end as string,
            hour: startDate.getHours(),
            durationMin: getDurationMin(start as string, end as string),
            attendees: ((ev.attendees ?? []) as unknown[]).length,
            location: (ev.location as string) ?? "",
            meetLink: (ev.hangoutLink as string) ?? "",
          };
        });

        return { events };
      } catch (err) {
        console.error("[calendar.listToday] error:", err);
        throw err;
      }
    }),

  blockTime: protectedProcedure
    .input(z.object({
      title: z.string(),
      startTime: z.string(),
      durationMin: z.number().default(30),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const start = new Date(input.startTime);
        const end = new Date(start.getTime() + input.durationMin * 60 * 1000);

        // @ts-ignore
        const event = await ctx.corsair
          .withTenant(ctx.userId)
          .googlecalendar.api.events.create({
            calendarId: "primary",
            summary: input.title,
            description: input.description ?? "",
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
          });

        return { event };
      } catch (err) {
        console.error("[calendar.blockTime] error:", err);
        throw err;
      }
    }),
});

function getDurationMin(start: string, end: string): number {
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.round(diff / 60000);
  } catch {
    return 30;
  }
}
