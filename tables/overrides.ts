import { type Row, t, table, type TableDatabase } from "/p/the8020/db/mod.ts";

import { serviceId, serviceSettings } from "../types/service.ts";
import { username } from "/p/the8020/users/types/user.ts";

const Overrides = table("the8020__services__overrides", {
  serviceId: t.from(serviceId).primaryKey(),
  serviceType: t.from(serviceSettings.shape.serviceType).nullable(),
  sessionKeepAliveMs: t.integer().nullable(),
  minimumWorkers: t.from(serviceSettings.shape.minimumWorkers).nullable(),
  maximumWorkers: t.from(serviceSettings.shape.maximumWorkers).nullable(),
  concurrencyPerWorker: t.from(serviceSettings.shape.concurrencyPerWorker)
    .nullable(),
  targetUtilization: t.float().nullable(),
  workerKeepAliveMs: t.integer().nullable(),
  sandboxGroup: t.from(serviceSettings.shape.sandboxGroup).nullable(),
  minimumSandboxes: t.from(serviceSettings.shape.minimumSandboxes).nullable(),
  workersPerSandbox: t.from(serviceSettings.shape.workersPerSandbox).nullable(),
  anonymousUser: t.from(username).nullable(),
  updatedAt: t.datetime().defaultNow(),
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Overrides> {}
}

export type ServiceOverrideRow = Row<typeof Overrides>;
export default Overrides;
