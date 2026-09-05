import { assertEquals, assertRejects } from "@std/assert";
import { DatabaseSync } from "node:sqlite";
import {
  kernelDatabaseBackendSymbol,
  kernelInvokeSymbol,
} from "@the8020/kernel";

const globals = globalThis as unknown as Record<symbol, unknown>;
globals[kernelDatabaseBackendSymbol] = "sqlite";
const { descriptorOf } = await import("/p/the8020/db/mod.ts");
const { buildIndex } = await import("./indexing.ts");
const Services = (await import("../tables/services.ts")).default;
const Overrides = (await import("../tables/overrides.ts")).default;
const Versions = (await import("../tables/versions.ts")).default;
const Revisions =
  (await import("/p/the8020/system/tables/revisions.ts")).default;
const Packages =
  (await import("/p/the8020/packages/tables/packages.ts")).default;
const Settings = (await import("/p/the8020/system/tables/settings.ts")).default;

function database() {
  const sql = new DatabaseSync(":memory:");
  for (
    const table of [
      Services,
      Overrides,
      Versions,
      Revisions,
      Packages,
      Settings,
    ]
  ) {
    const descriptor = descriptorOf(table);
    const columns = descriptor.columns.map((column) =>
      `"${column.name}" ${
        ["integer", "boolean"].includes(column.logical_type)
          ? "INTEGER"
          : column.logical_type === "float"
          ? "REAL"
          : "TEXT"
      }`
    );
    columns.push(
      `PRIMARY KEY (${
        descriptor.primary_key.map((key) => `"${key}"`).join(",")
      })`,
    );
    sql.exec(`CREATE TABLE "${descriptor.table_id}" (${columns.join(",")})`);
  }
  globals[kernelInvokeSymbol] = (
    operation: string,
    input: Record<string, unknown>,
  ) => {
    if (operation.startsWith("database.transaction.")) {
      const action = operation.split(".").at(-1)!;
      sql.exec(action === "begin" ? "BEGIN" : action.toUpperCase());
      return Promise.resolve({ transaction: "transaction" });
    }
    if (operation !== "database.execute") {
      throw new Error(`unexpected operation ${operation}`);
    }
    const parameters = (input.parameters as unknown[]).map((value) => {
      if (value !== null && typeof value === "object") {
        const tagged = value as { type: string; value: string | boolean };
        return tagged.type === "boolean" ? Number(tagged.value) : tagged.value;
      }
      return typeof value === "boolean" ? Number(value) : value;
    }) as Array<string | number | null>;
    const statement = sql.prepare(String(input.statement));
    if (input.return_rows) {
      const rows = statement.all(...parameters);
      const columns = Object.keys(rows[0] ?? {});
      return Promise.resolve({
        columns,
        rows: rows.map((row) => columns.map((column) => row[column])),
      });
    }
    const result = statement.run(...parameters);
    return Promise.resolve({
      columns: [],
      rows: [],
      affected_rows: { type: "bigint", value: String(result.changes) },
    });
  };
  return sql;
}

Deno.test("package index provider owns durable declarations, versions, overrides, and retirement", async () => {
  const sql = database();
  const root = await Deno.makeTempDir();
  const packageRoot = new URL(`file://${root}/`);
  const packageId = "acme/api";
  const scope = {
    package_id: packageId,
    package_commit: "commit-a",
    active: true,
  };
  sql.prepare(
    `INSERT INTO ${Packages.table} (packageId, state, activeCommit) VALUES (?, 'ready', ?)`,
  )
    .run(packageId, scope.package_commit);
  const manifest = (maximum = 4) =>
    `schema = 2\ndescription = 'API'\n[lifecycle]\ndefault_enabled = true\n[scaling]\nmaximum_workers = ${maximum}\n`;
  const count = () =>
    Number(
      sql.prepare(`SELECT COUNT(*) AS count FROM ${Versions.table}`).get()!
        .count,
    );
  try {
    for (const name of ["one", "two"]) {
      await Deno.mkdir(new URL(`services/${name}/`, packageRoot), {
        recursive: true,
      });
      await Deno.writeTextFile(
        new URL(`services/${name}/service.toml`, packageRoot),
        manifest(),
      );
      await Deno.writeTextFile(
        new URL(`services/${name}/service.ts`, packageRoot),
        "export default {};",
      );
    }
    const initial = { services: [] };
    await buildIndex(initial, scope, packageRoot);
    assertEquals(initial.services.length, 2);
    assertEquals(count(), 2);
    await buildIndex({ services: [] }, scope, packageRoot);
    assertEquals(
      count(),
      2,
      "idempotent reindex must not allocate another application version",
    );
    sql.prepare(
      `INSERT INTO ${Overrides.table} (serviceId, maximumWorkers, anonymousUser) VALUES (?, 8, 'alice')`,
    )
      .run(`${packageId}/one`);
    const overridden = {
      services: [] as import("./configuration.ts").Specification[],
    };
    await buildIndex(overridden, scope, packageRoot);
    assertEquals(
      overridden.services[0]!.configuration.scaling.maximum_workers,
      8,
    );
    assertEquals(
      overridden.services[0]!.configuration.execution.anonymous_user,
      "alice",
    );
    assertEquals(overridden.services[0]!.version, 2);
    assertEquals(count(), 3);
    await Deno.writeTextFile(
      new URL("services/one/service.toml", packageRoot),
      manifest(12),
    );
    await Deno.writeTextFile(
      new URL("services/two/service.toml", packageRoot),
      "schema = 1",
    );
    const failed = { services: [] };
    await assertRejects(
      () => buildIndex(failed, scope, packageRoot),
      TypeError,
      "schema",
    );
    assertEquals(failed.services, []);
    assertEquals(
      count(),
      3,
      "failure in another service must not partially update the package",
    );
    await Deno.remove(new URL("services/two/", packageRoot), {
      recursive: true,
    });
    scope.package_commit = "commit-b";
    sql.prepare(
      `UPDATE ${Packages.table} SET activeCommit = ? WHERE packageId = ?`,
    ).run("commit-b", packageId);
    const replacement = {
      services: [] as import("./configuration.ts").Specification[],
    };
    await buildIndex(replacement, scope, packageRoot);
    assertEquals(replacement.services.length, 1);
    assertEquals(
      replacement.services[0]!.configuration.scaling.maximum_workers,
      8,
    );
    assertEquals(replacement.services[0]!.version, 3);
    assertEquals(
      sql.prepare(`SELECT active FROM ${Services.table} WHERE serviceId = ?`)
        .get(`${packageId}/two`)!.active,
      0,
    );
    await assertRejects(
      () =>
        buildIndex(
          { services: [] },
          { ...scope, package_commit: "stale" },
          packageRoot,
        ),
      Error,
      "changed while indexing",
    );
    assertEquals(count(), 4);
    sql.prepare(
      `UPDATE ${Packages.table} SET state = 'retired' WHERE packageId = ?`,
    ).run(packageId);
    await buildIndex(
      { services: [] },
      { ...scope, active: false },
      packageRoot,
    );
    assertEquals(
      sql.prepare(
        `SELECT COUNT(*) AS count FROM ${Services.table} WHERE active`,
      ).get()!.count,
      0,
    );
    assertEquals(
      sql.prepare(`SELECT enabled FROM ${Services.table} WHERE serviceId = ?`)
        .get(`${packageId}/one`)!.enabled,
      1,
      "retirement must retain desired enablement and overrides",
    );
  } finally {
    delete globals[kernelInvokeSymbol];
    sql.close();
    await Deno.remove(root, { recursive: true });
  }
});
