import { assertEquals } from "@std/assert";
import { kernelDatabaseBackendSymbol } from "@the8020/kernel";

(globalThis as unknown as Record<symbol, unknown>)[
  kernelDatabaseBackendSymbol
] = "sqlite";
const { descriptorOf } = await import("/p/the8020/db/mod.ts");
const Overrides = (await import("./overrides.ts")).default;
const Services = (await import("./services.ts")).default;
const Versions = (await import("./versions.ts")).default;

Deno.test("service tables separate declarations overrides and versions", () => {
  assertEquals(Services.table, "the8020__services__services");
  assertEquals(Overrides.table, "the8020__services__overrides");
  assertEquals(descriptorOf(Versions).primary_key, ["serviceId", "version"]);
  assertEquals(
    descriptorOf(Services).columns.some((column) =>
      column.name === "declaredAnonymousUser"
    ),
    true,
  );
  assertEquals(
    descriptorOf(Overrides).columns.some((column) =>
      column.name === "anonymousUser"
    ),
    true,
  );
  assertEquals(
    descriptorOf(Versions).columns.find((column) =>
      column.name === "anonymousUser"
    )?.nullable,
    false,
  );
});
