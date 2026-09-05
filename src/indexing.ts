import type {
  ServiceIndexScope as IndexScope,
  ServiceIndexState as IndexState,
} from "@the8020/kernel";
export type {
  ServiceIndexScope as IndexScope,
  ServiceIndexState as IndexState,
} from "@the8020/kernel";
import {
  type Database,
  db,
  type Insertable,
  type Selectable,
} from "/p/the8020/db/mod.ts";
import type { Transaction } from "kysely";
import { lockIndexRevision } from "/p/the8020/system/src/indexes.ts";
import Packages from "/p/the8020/packages/tables/packages.ts";
import Services, { type ServiceRow } from "../tables/services.ts";
import Overrides, { type ServiceOverrideRow } from "../tables/overrides.ts";
import Versions, { type ServiceVersionRow } from "../tables/versions.ts";
import { loadDefaults } from "./defaults.ts";
import {
  type Configuration,
  type Declaration,
  declaration,
  resolveConfiguration,
  type Specification,
} from "./configuration.ts";

export async function hash(value: unknown): Promise<string> {
  return new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(value)),
    ),
  ).toHex();
}

interface Source {
  id: string;
  manifest: Declaration;
  manifestHash: string;
  entrypoint: string;
}

async function regularFile(url: URL, root: string): Promise<void> {
  const resolved = await Deno.realPath(url);
  if (!resolved.startsWith(`${root}/`) || !(await Deno.stat(url)).isFile) {
    throw new TypeError(`${url.pathname} must be a file within its service`);
  }
}

async function readSources(
  packageId: string,
  packageRoot: URL,
): Promise<Source[]> {
  let entries: Deno.DirEntry[];
  try {
    entries = await Array.fromAsync(
      Deno.readDir(new URL("services/", packageRoot)),
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
  const result: Source[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isSymlink) {
      throw new TypeError(`service ${entry.name} must not be a symlink`);
    }
    if (!entry.isDirectory) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.name)) {
      throw new TypeError(`invalid service name: ${entry.name}`);
    }
    const root = new URL(`services/${entry.name}/`, packageRoot);
    const manifestURL = new URL("service.toml", root);
    try {
      await Deno.lstat(manifestURL);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) continue;
      throw error;
    }
    const canonicalRoot = await Deno.realPath(root);
    await regularFile(manifestURL, canonicalRoot);
    if ((await Deno.stat(manifestURL)).size > 1 << 20) {
      throw new TypeError("service manifest exceeds 1 MiB");
    }
    const manifest = declaration(await Deno.readTextFile(manifestURL));
    if (
      manifest.entrypoint === "" ||
      manifest.entrypoint.split("/").includes("..") ||
      /[\\?#]/.test(manifest.entrypoint) ||
      manifest.entrypoint.includes("\0") ||
      manifest.entrypoint.startsWith("/")
    ) {
      throw new TypeError(`invalid service entrypoint: ${manifest.entrypoint}`);
    }
    const entrypoint = new URL(manifest.entrypoint, root);
    await regularFile(entrypoint, canonicalRoot);
    result.push({
      id: `${packageId}/${entry.name}`,
      manifest,
      manifestHash: await hash(manifest),
      entrypoint: entrypoint.href,
    });
  }
  return result;
}

export function storedDeclaration(row: Selectable<ServiceRow>): Declaration {
  return {
    entrypoint: row.entrypoint,
    description: row.description,
    defaultEnabled: row.enabled,
    openapi: { title: "", version: "", description: row.description },
    access: {
      mode: row.accessMode,
      unauthenticated: {
        action: row.unauthenticatedAction,
        status: row.unauthenticatedStatus,
        message: row.unauthenticatedMessage,
        redirect_url: row.unauthenticatedRedirectUrl,
      },
    },
    declared: {
      serviceType: row.declaredServiceType,
      sessionKeepAliveMs: row.declaredSessionKeepAliveMs,
      minimumWorkers: row.declaredMinimumWorkers,
      maximumWorkers: row.declaredMaximumWorkers,
      concurrencyPerWorker: row.declaredConcurrencyPerWorker,
      targetUtilization: row.declaredTargetUtilization,
      workerKeepAliveMs: row.declaredWorkerKeepAliveMs,
      sandboxGroup: row.declaredSandboxGroup,
      minimumSandboxes: row.declaredMinimumSandboxes,
      workersPerSandbox: row.declaredWorkersPerSandbox,
      anonymousUser: row.declaredAnonymousUser,
    },
  };
}

export function versionRow(
  serviceId: string,
  version: number,
  packageCommit: string,
  manifestHash: string,
  policyHash: string,
  configuration: Configuration,
): Insertable<ServiceVersionRow> {
  return {
    serviceId,
    version,
    packageCommit,
    manifestHash,
    policyHash,
    serviceType: configuration.lifecycle.service_type,
    sessionKeepAliveMs: configuration.lifecycle.session_keep_alive / 1_000_000,
    minimumWorkers: configuration.scaling.minimum_workers,
    maximumWorkers: configuration.scaling.maximum_workers,
    concurrencyPerWorker: configuration.scaling.concurrency_per_worker,
    targetUtilization: configuration.scaling.target_utilization,
    workerKeepAliveMs: configuration.scaling.worker_keep_alive / 1_000_000,
    sandboxGroup: configuration.placement.sandbox_group,
    minimumSandboxes: configuration.placement.minimum_sandboxes,
    workersPerSandbox: configuration.placement.workers_per_sandbox,
    anonymousUser: configuration.execution.anonymous_user,
    createdAt: new Date(),
  };
}

async function install(
  tx: Transaction<Database>,
  scope: IndexScope,
  source: Source,
  existing: Selectable<ServiceRow> | undefined,
  override: Selectable<ServiceOverrideRow> | undefined,
  defaults: Configuration,
): Promise<Specification> {
  const configuration = resolveConfiguration(
    source.manifest,
    override,
    defaults,
  );
  const policyHash = await hash(configuration);
  const previous = existing === undefined
    ? undefined
    : await tx.selectFrom(Versions.table)
      .select("policyHash").where("serviceId", "=", source.id)
      .where("version", "=", existing.desiredVersion).executeTakeFirst();
  const changed = existing === undefined ||
    existing.packageCommit !== scope.package_commit ||
    existing.manifestHash !== source.manifestHash ||
    previous?.policyHash !== policyHash;
  const version = (existing?.desiredVersion ?? 0) + (changed ? 1 : 0);
  const manifest = source.manifest;
  const enabled = existing?.enabled ?? manifest.defaultEnabled;
  const row = {
    packageId: scope.package_id,
    packageCommit: scope.package_commit,
    manifestHash: source.manifestHash,
    description: manifest.description,
    entrypoint: manifest.entrypoint,
    accessMode: manifest.access.mode,
    unauthenticatedAction: manifest.access.unauthenticated.action,
    unauthenticatedStatus: manifest.access.unauthenticated.status,
    unauthenticatedMessage: manifest.access.unauthenticated.message,
    unauthenticatedRedirectUrl: manifest.access.unauthenticated.redirect_url,
    declaredServiceType: manifest.declared.serviceType ?? null,
    declaredSessionKeepAliveMs: manifest.declared.sessionKeepAliveMs ?? null,
    declaredMinimumWorkers: manifest.declared.minimumWorkers ?? null,
    declaredMaximumWorkers: manifest.declared.maximumWorkers ?? null,
    declaredConcurrencyPerWorker: manifest.declared.concurrencyPerWorker ??
      null,
    declaredTargetUtilization: manifest.declared.targetUtilization ?? null,
    declaredWorkerKeepAliveMs: manifest.declared.workerKeepAliveMs ?? null,
    declaredSandboxGroup: manifest.declared.sandboxGroup ?? null,
    declaredMinimumSandboxes: manifest.declared.minimumSandboxes ?? null,
    declaredWorkersPerSandbox: manifest.declared.workersPerSandbox ?? null,
    declaredAnonymousUser: manifest.declared.anonymousUser ?? null,
    enabled,
    active: true,
    desiredVersion: version,
    updatedAt: new Date(),
  };
  if (changed || !existing?.active) {
    await tx.insertInto(Services.table).values({
      serviceId: source.id,
      ...row,
      createdAt: new Date(),
    }).onConflict((conflict) => conflict.column("serviceId").doUpdateSet(row))
      .execute();
  }
  if (changed) {
    await tx.insertInto(Versions.table).values(versionRow(
      source.id,
      version,
      scope.package_commit,
      source.manifestHash,
      policyHash,
      configuration,
    )).execute();
  }
  return {
    service_id: source.id,
    version,
    code_revision: scope.package_commit,
    entrypoint: source.entrypoint,
    description: manifest.description,
    enabled,
    openapi: manifest.openapi,
    access: manifest.access,
    configuration,
  };
}

// Package selection is invocation scope. Later hooks may enhance/filter this
// draft, but cannot change what package the kernel will atomically publish.
export async function buildIndex(
  state: IndexState,
  scope: Readonly<IndexScope>,
  packageRoot = new URL(`file:///workspace/packages/${scope.package_id}/`),
): Promise<void> {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
      scope.package_id,
    )
  ) throw new TypeError("invalid package scope");
  const sources = scope.active
    ? await readSources(scope.package_id, packageRoot)
    : [];
  const specs = await db.transaction().execute(async (tx) => {
    await lockIndexRevision(tx);
    const active = await tx.selectFrom(Packages.table).select([
      "activeCommit",
      "state",
    ])
      .where("packageId", "=", scope.package_id).executeTakeFirst();
    if (
      scope.active &&
      (active?.state !== "ready" ||
        active.activeCommit !== scope.package_commit)
    ) {
      throw new Error(
        `package ${scope.package_id} changed while indexing; draft was not applied`,
      );
    }
    if (!scope.active && active?.state === "ready") {
      throw new Error(`package ${scope.package_id} is still active`);
    }
    const existing = await tx.selectFrom(Services.table).selectAll()
      .where("packageId", "=", scope.package_id).execute();
    const overrides = sources.length === 0
      ? []
      : await tx.selectFrom(Overrides.table).selectAll()
        .where("serviceId", "in", sources.map((source) => source.id)).execute();
    const byId = new Map(existing.map((row) => [row.serviceId, row]));
    const overridesById = new Map(overrides.map((row) => [row.serviceId, row]));
    const defaults = await loadDefaults(tx);
    const result: Specification[] = [];
    for (const source of sources) {
      result.push(
        await install(
          tx,
          scope,
          source,
          byId.get(source.id),
          overridesById.get(source.id),
          defaults,
        ),
      );
    }
    const included = new Set(sources.map((source) => source.id));
    const retired = existing.filter((row) =>
      row.active && !included.has(row.serviceId)
    );
    if (retired.length > 0) {
      await tx.updateTable(Services.table).set({
        active: false,
        updatedAt: new Date(),
      })
        .where("serviceId", "in", retired.map((row) => row.serviceId))
        .execute();
    }
    return result;
  });
  state.services.push(...specs);
}
