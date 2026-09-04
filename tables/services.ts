import { type Row, t, table, type TableDatabase } from "@the8020/db";

const Services = table("the8020__services__services", {
  serviceId: t.text().primaryKey(),
  packageId: t.text(),
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

declare module "@the8020/db/types" {
  interface Database extends TableDatabase<typeof Services> {}
}

export type ServiceRow = Row<typeof Services>;
export default Services;
