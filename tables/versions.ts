import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { type Row, t, table, type TableDatabase } from "/p/the8020/db/mod.ts";

import { serviceId, serviceInfo, serviceSettings } from "../types/service.ts";
import { username } from "/p/the8020/users/types/user.ts";

const Versions = table("the8020__services__versions", {
  serviceId: t.from(serviceId).primaryKey(),
  version: t.from(serviceInfo.shape.version).primaryKey(),
  packageCommit: t.from(sourceInfo.shape.commit),
  manifestHash: t.text(),
  policyHash: t.text(),
  accessMode: t.from(serviceSettings.shape.accessMode).nullable(),
  serviceType: t.from(serviceSettings.shape.serviceType),
  sessionKeepAliveMs: t.integer(),
  minimumWorkers: t.from(serviceSettings.shape.minimumWorkers),
  maximumWorkers: t.from(serviceSettings.shape.maximumWorkers),
  concurrencyPerWorker: t.from(serviceSettings.shape.concurrencyPerWorker),
  targetUtilization: t.float(),
  workerKeepAliveMs: t.integer(),
  sandboxGroup: t.from(serviceSettings.shape.sandboxGroup),
  minimumSandboxes: t.from(serviceSettings.shape.minimumSandboxes),
  workersPerSandbox: t.from(serviceSettings.shape.workersPerSandbox),
  anonymousUser: t.from(username),
  createdAt: t.datetime().defaultNow(),
}, {
  indexes: [{ columns: ["packageCommit"] }],
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Versions> {}
}

export type ServiceVersionRow = Row<typeof Versions>;
export default Versions;
