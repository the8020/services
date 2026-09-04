import { assertEquals } from "@std/assert";
import { kernelDatabaseBackendSymbol } from "@the8020/kernel";

(globalThis as unknown as Record<symbol, unknown>)[
  kernelDatabaseBackendSymbol
] = "sqlite";
const { descriptorOf } = await import("@the8020/db");
const Overrides = (await import("./overrides.ts")).default;
const Routes = (await import("./routes.ts")).default;
const Services = (await import("./services.ts")).default;
const Versions = (await import("./versions.ts")).default;

Deno.test("service tables separate declarations overrides versions and routes", () => {
  assertEquals(Services.table, "the8020__services__services");
  assertEquals(Overrides.table, "the8020__services__overrides");
  assertEquals(descriptorOf(Versions).primary_key, ["serviceId", "version"]);
  assertEquals(descriptorOf(Routes).columns[0]?.name, "tokenHash");
});
