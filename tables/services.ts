import { type Row, t, table, type TableDatabase } from "/p/the8020/db/mod.ts";

import { serviceId } from "../types/service.ts";
import { username } from "/p/the8020/users/types/user.ts";

import { packageId } from "/p/the8020/packages/types/package.ts";

const Services = table("the8020__services__services", {
  serviceId: t.from(serviceId).primaryKey(),
  packageId: t.from(packageId),
  packageCommit: t.text(),
  manifestHash: t.text(),
  description: t.text(),
  entrypoint: t.text(),
  accessMode: t.enum(["public", "authenticated"] as const),
  unauthenticatedAction: t.enum(["reject", "redirect"] as const),
  unauthenticatedStatus: t.integer(),
  unauthenticatedMessage: t.text(),
  unauthenticatedRedirectUrl: t.text(),
  declaredServiceType: t.enum(["stateless", "session"] as const).nullable(),
  declaredSessionKeepAliveMs: t.integer().nullable(),
  declaredMinimumWorkers: t.integer().nullable(),
  declaredMaximumWorkers: t.integer().nullable(),
  declaredConcurrencyPerWorker: t.integer().nullable(),
  declaredTargetUtilization: t.float().nullable(),
  declaredWorkerKeepAliveMs: t.integer().nullable(),
  declaredSandboxGroup: t.text().nullable(),
  declaredMinimumSandboxes: t.integer().nullable(),
  declaredWorkersPerSandbox: t.integer().nullable(),
  declaredAnonymousUser: t.from(username).nullable(),
  enabled: t.boolean(),
  active: t.boolean().default(true),
  desiredVersion: t.integer(),
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
