import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const connectRouter = createTRPCRouter({
  status: protectedProcedure.query(async ({ ctx }) => {
    try {
      // @ts-ignore
      const internal = ctx.corsair[Symbol.for("corsair:internal")];
      if (!internal?.database) return { connected: false };

      const accounts = await internal.database.db
        .selectFrom("corsair_accounts as a")
        .innerJoin("corsair_integrations as i", "i.id", "a.integration_id")
        .select(["i.name as integrationName", "a.dek"])
        .where("a.tenant_id", "=", ctx.userId!)
        .execute();

      const connectedPlugins = accounts
        .filter((a: { dek: string | null }) => !!a.dek)
        .map((a: { integrationName: string }) => a.integrationName);

      const hasGmail = connectedPlugins.includes("gmail");
      const hasCalendar = connectedPlugins.includes("googlecalendar");

      return {
        connected: hasGmail && hasCalendar,
        connectedPlugins,
      };
    } catch (err) {
      console.error("[connect.status] error:", err);
      return { connected: false, connectedPlugins: [] };
    }
  }),
});
