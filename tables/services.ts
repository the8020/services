import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { type Row, t, table, type TableDatabase } from "/p/the8020/db/mod.ts";

import { serviceId, serviceInfo, serviceSettings } from "../types/service.ts";
import { username } from "/p/the8020/users/types/user.ts";

import { packageId } from "/p/the8020/packages/types/package.ts";

const Services = table("the8020__services__services", {
  serviceId: t.from(serviceId).primaryKey(),
  packageId: t.from(packageId),
  packageCommit: t.from(sourceInfo.shape.commit),
  manifestHash: t.text(),
  description: t.from(serviceInfo.shape.description),
  entrypoint: t.from(sourceInfo.shape.entrypoint),
  accessMode: t.enum(["public", "authenticated"] as const),
  unauthenticatedAction: t.enum(["reject", "redirect"] as const),
  unauthenticatedStatus: t.integer(),
  unauthenticatedMessage: t.text(),
  unauthenticatedRedirectUrl: t.text(),
  declaredServiceType: t.from(serviceSettings.shape.serviceType).nullable(),
  declaredSessionKeepAliveMs: t.integer().nullable(),
  declaredMinimumWorkers: t.from(serviceSettings.shape.minimumWorkers)
    .nullable(),
  declaredMaximumWorkers: t.from(serviceSettings.shape.maximumWorkers)
    .nullable(),
  declaredConcurrencyPerWorker: t.from(
    serviceSettings.shape.concurrencyPerWorker,
  ).nullable(),
  declaredTargetUtilization: t.float().nullable(),
  declaredWorkerKeepAliveMs: t.integer().nullable(),
  declaredSandboxGroup: t.from(serviceSettings.shape.sandboxGroup).nullable(),
  declaredMinimumSandboxes: t.from(serviceSettings.shape.minimumSandboxes)
    .nullable(),
  declaredWorkersPerSandbox: t.from(serviceSettings.shape.workersPerSandbox)
    .nullable(),
  declaredAnonymousUser: t.from(username).nullable(),
  enabled: t.from(serviceInfo.shape.enabled),
  active: t.boolean().default(true),
  desiredVersion: t.from(serviceInfo.shape.desiredVersion),
  createdAt: t.datetime().defaultNow(),
  updatedAt: t.datetime().defaultNow(),
}, {
  indexes: [
    { columns: ["packageId", "active"] },
    { columns: ["enabled", "active"] },
  ],
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Services> {}
}

export type ServiceRow = Row<typeof Services>;
export default Services;
