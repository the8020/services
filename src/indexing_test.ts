import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
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

Deno.test("restart commands use typed lifecycle without writing configuration", async () => {
  const previous = globals[kernelInvokeSymbol];
  const { lifecycle } = await import("./commands.ts");
  const calls: unknown[] = [];
  globals[kernelInvokeSymbol] = (operation: string, input: unknown) => {
    calls.push([operation, input]);
    return Promise.resolve({
      success: true,
      result: { service: { service_id: "acme/api/one", state: "READY" } },
    });
  };
  try {
    await lifecycle("restart", ["acme/api/one"]);
    assertEquals(
      await lifecycle("restart", ["acme/api/one", "--hard", "--detail"]),
      {
        service: { service_id: "acme/api/one", state: "READY" },
      },
    );
    assertEquals(
      calls,
      ["soft", "hard"].map((mode) => ["runtime.operation", {
        operation: "service.restart",
        input: { service_id: "acme/api/one", mode },
      }]),
    );
  } finally {
    globals[kernelInvokeSymbol] = previous;
  }
});

Deno.test("service help searches active declarations and pages disabled services too", async () => {
  const previous = globals[kernelInvokeSymbol];
  const sql = database();
  try {
    sql.exec(
      `INSERT INTO "the8020__services__services" ("serviceId", "description", "enabled", "active") VALUES
      ('example/app/a', 'Public API', 1, 1),
      ('example/app/b', 'Private API', 0, 1),
      ('example/app/c', 'Retired API', 1, 0)`,
    );
    const { serviceId } = await import("../types/service.ts");
    const { fieldMetadata } = await import("/p/the8020/db/fields.ts");
    const lookup = fieldMetadata(serviceId)!.valueHelp!;
    const query = { search: " API ", filters: {}, sort: null };
    const first = await lookup({ query, offset: 0, limit: 1 });
    assertEquals(Object.keys(first.schema.shape), [
      "serviceId",
      "description",
      "enabled",
    ]);
    assertEquals(first.rows, [{
      serviceId: "example/app/a",
      description: "Public API",
      enabled: true,
    }]);
    assertEquals([first.more, first.totalItems], [true, 2]);
    const last = await lookup({ query, offset: 1, limit: 1 });
    assertEquals(last.rows, [{
      serviceId: "example/app/b",
      description: "Private API",
      enabled: false,
    }]);
    assertEquals([last.more, last.totalItems], [false, 2]);
    const sorted = await lookup({
      query: { ...query, sort: { column: "description", direction: "asc" } },
      offset: 0,
      limit: 1,
    });
    assertEquals(sorted.rows, last.rows);
    const filtered = await lookup({
      query: { ...query, filters: { enabled: "no" } },
      offset: 0,
      limit: 1,
    });
    assertEquals(filtered.rows, last.rows);
    assertEquals([filtered.more, filtered.totalItems], [false, 1]);
  } finally {
    sql.close();
    globals[kernelInvokeSymbol] = previous;
  }
});

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
  const packagesRoot = new URL(`file://${root}/`);
  const packageRoot = new URL("acme/api/", packagesRoot);
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
    const index = async (selected = scope) => {
      const state: import("./indexing.ts").IndexState = {
        packages: {
          [packageId]: { services: [] },
          "acme/empty": { services: [] },
        },
      };
      await buildIndex(state, {
        packages: [selected, {
          package_id: "acme/empty",
          package_commit: "",
          active: false,
        }],
      }, packagesRoot);
      assertEquals(state.packages["acme/empty"], { services: [] });
      return state.packages[packageId]!;
    };
    const initial = await index();
    assertEquals(initial.services.length, 2);
    assertEquals(count(), 2);
    await index();
    assertEquals(
      count(),
      2,
      "idempotent reindex must not allocate another application version",
    );
    sql.prepare(
      `INSERT INTO ${Overrides.table} (serviceId, maximumWorkers, anonymousUser) VALUES (?, 8, 'alice')`,
    )
      .run(`${packageId}/one`);
    const overridden = await index();
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
    scope.package_commit = "source-only";
    sql.prepare(
      `UPDATE ${Packages.table} SET activeCommit = ? WHERE packageId = ?`,
    ).run(scope.package_commit, packageId);
    const sourceOnly = await index();
    assertEquals(sourceOnly.services[0]!.version, 2);
    assertEquals(sourceOnly.services[0]!.code_revision, "source-only");
    assertEquals(
      count(),
      3,
      "source-only changes do not allocate policy versions",
    );
    await Deno.writeTextFile(
      new URL("services/one/service.toml", packageRoot),
      manifest(12),
    );
    await Deno.writeTextFile(
      new URL("services/two/service.toml", packageRoot),
      "schema = 1",
    );
    const failed = await index();
    assertStringIncludes(failed.error!, "schema");
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
    const replacement = await index();
    assertEquals(replacement.services.length, 1);
    assertEquals(
      replacement.services[0]!.configuration.scaling.maximum_workers,
      8,
    );
    assertEquals(replacement.services[0]!.version, 3);
    assertEquals(replacement.services[0]!.code_revision, "commit-b");
    assertEquals(
      count(),
      4,
      "declaration changes still allocate policy versions",
    );
    assertEquals(
      sql.prepare(`SELECT active FROM ${Services.table} WHERE serviceId = ?`)
        .get(`${packageId}/two`)!.active,
      0,
    );
    const stale = await index({ ...scope, package_commit: "stale" });
    assertStringIncludes(stale.error!, "changed while indexing");
    assertEquals(count(), 4);
    const { updateDesired } = await import("./admin.ts");
    for (const accessMode of ["authenticated", "public", null] as const) {
      const before = count();
      assertEquals(
        await updateDesired(`${packageId}/one`, { overrides: { accessMode } }),
        packageId,
      );
      const published = await index();
      assertEquals(published.error, undefined);
      assertEquals(published.services[0]!.access.mode, accessMode ?? "public");
      assertEquals(
        count(),
        before + 1,
        "publication must reuse the saved version",
      );
      assertEquals(
        sql.prepare(
          `SELECT accessMode FROM ${Overrides.table} WHERE serviceId = ?`,
        )
          .get(`${packageId}/one`)!.accessMode,
        accessMode,
      );
      assertEquals(
        sql.prepare(
          `SELECT accessMode FROM ${Services.table} WHERE serviceId = ?`,
        )
          .get(`${packageId}/one`)!.accessMode,
        "public",
        "operator visibility must not overwrite the declaration",
      );
      assertEquals(
        sql.prepare(
          `SELECT accessMode FROM ${Versions.table} WHERE serviceId = ? AND version = ?`,
        )
          .get(`${packageId}/one`, published.services[0]!.version)!.accessMode,
        accessMode ?? "public",
      );
      assertEquals(
        published.services[0]!.configuration.execution.anonymous_user,
        "alice",
      );
    }
    const beforeInvalid = count();
    await assertRejects(
      () =>
        updateDesired(`${packageId}/one`, {
          overrides: { accessMode: "private" as "public" },
        }),
      Error,
      "access.mode",
    );
    assertEquals(
      count(),
      beforeInvalid,
      "invalid visibility must not write a version",
    );
    sql.prepare(
      `UPDATE ${Packages.table} SET state = 'retired' WHERE packageId = ?`,
    ).run(packageId);
    await index({ ...scope, active: false });
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
