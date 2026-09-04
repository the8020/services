import { type Row, t, table, type TableDatabase } from "@the8020/db";

const Overrides = table("the8020__services__overrides", {
  serviceId: t.text().primaryKey(),
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
  updatedAt: t.datetime().defaultNow(),
});

declare module "@the8020/db/types" {
  interface Database extends TableDatabase<typeof Overrides> {}
}

export type ServiceOverrideRow = Row<typeof Overrides>;
export default Overrides;
