import { type Row, t, table, type TableDatabase } from "@the8020/db";

const Versions = table("the8020__services__versions", {
  serviceId: t.text().primaryKey(),
  version: t.integer().primaryKey(),
  packageCommit: t.text(),
  manifestHash: t.text(),
  policyHash: t.text(),
  serviceType: t.enum(["stateless", "session"] as const),
  sessionKeepAliveMs: t.integer(),
  minimumWorkers: t.integer(),
  maximumWorkers: t.integer(),
  concurrencyPerWorker: t.integer(),
  targetUtilization: t.float(),
  workerKeepAliveMs: t.integer(),
  sandboxGroup: t.text(),
  minimumSandboxes: t.integer(),
  workersPerSandbox: t.integer(),
  createdAt: t.datetime().defaultNow(),
}, {
  indexes: [{ columns: ["packageCommit"] }],
});

declare module "@the8020/db/types" {
  interface Database extends TableDatabase<typeof Versions> {}
}

export type ServiceVersionRow = Row<typeof Versions>;
export default Versions;
