import { type Row, t, table, type TableDatabase } from "/p/the8020/db/mod.ts";

const Routes = table("the8020__services__routes", {
  tokenHash: t.text().primaryKey(),
  serviceId: t.text(),
  nodeId: t.text(),
  poolId: t.text(),
  runtimeGroupId: t.text(),
  sandboxId: t.text(),
  workerId: t.text(),
  executionId: t.text(),
  userId: t.text(),
  keepAliveMs: t.integer(),
  expiresAt: t.datetime(),
  connected: t.integer().default(0),
}, {
  indexes: [
    { columns: ["serviceId"] },
    { columns: ["executionId"] },
    { columns: ["poolId"] },
    { columns: ["expiresAt"] },
  ],
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Routes> {}
}

export type RouteRow = Row<typeof Routes>;
export default Routes;
