import { type Row, t, table, type TableDatabase } from "/p/the8020/db/mod.ts";

import { serviceId } from "../types/service.ts";
import { username } from "/p/the8020/users/types/user.ts";

const Overrides = table("the8020__services__overrides", {
  serviceId: t.from(serviceId).primaryKey(),
  serviceType: t.enum(["stateless", "session"] as const).nullable(),
  sessionKeepAliveMs: t.integer().nullable(),
  minimumWorkers: t.integer().nullable(),
  maximumWorkers: t.integer().nullable(),
  concurrencyPerWorker: t.integer().nullable(),
  targetUtilization: t.float().nullable(),
  workerKeepAliveMs: t.integer().nullable(),
  sandboxGroup: t.text().nullable(),
  minimumSandboxes: t.integer().nullable(),
  workersPerSandbox: t.integer().nullable(),
  anonymousUser: t.from(username).nullable(),
  updatedAt: t.datetime().defaultNow(),
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Overrides> {}
}

export type ServiceOverrideRow = Row<typeof Overrides>;
export default Overrides;
