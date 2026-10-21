import { AdminCommandError, kernel } from "@the8020/kernel";
import { filter, requirePermission } from "/p/the8020/auth/mod.ts";
import { context } from "@the8020/context";
import { db } from "/p/the8020/db/mod.ts";
import {
  invalidateIndexes,
  lockIndexRevision,
} from "/p/the8020/system/src/indexes.ts";
import Services from "../tables/services.ts";
import Overrides from "../tables/overrides.ts";
import Versions from "../tables/versions.ts";
import {
  type OverrideValues,
  resolveAccess,
  resolveConfiguration,
} from "./configuration.ts";
import { hash, storedDeclaration, versionRow } from "./indexing.ts";
import { loadDefaults } from "./defaults.ts";

const VIEW = "the8020.services.service.view";

/** Observed services the current user may view; never audits. */
export async function listServices<
  Result extends { service_id: string } = { service_id: string },
>(): Promise<Result[]> {
  return await filter(
    context.username,
    await kernel.services.list<Result>(),
    { service_id: VIEW } as Partial<Record<keyof Result, string>>,
  );
}

/** One observed service; requires view for its ID. */
export async function inspectService<Result = Record<string, unknown>>(
  serviceId: string,
): Promise<Result> {
  await requirePermission(VIEW, serviceId);
  return await kernel.services.inspect<Result>(serviceId);
}

export async function updateDesired(
  serviceId: string,
  change: { enabled?: boolean; overrides?: OverrideValues },
): Promise<string> {
  await requirePermission("the8020.services.service.edit", serviceId);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/
      .test(serviceId)
  ) {
    throw new AdminCommandError({
      code: "invalid_arguments",
      message: "service ID must be namespace/package/service",
    });
  }
  try {
    return await db.transaction().execute(async (tx) => {
      await lockIndexRevision(tx);
      const row = await tx.selectFrom(Services.table).selectAll().where(
        "serviceId",
        "=",
        serviceId,
      ).executeTakeFirst();
      if (row === undefined || !row.active) {
        throw new AdminCommandError({
          code: "not_found",
          message: `service ${serviceId} is not installed`,
        });
      }
      const previous = await tx.selectFrom(Overrides.table).selectAll().where(
        "serviceId",
        "=",
        serviceId,
      ).executeTakeFirst();
      const override = { ...previous, ...change.overrides };
      const manifest = storedDeclaration(row);
      const access = resolveAccess(manifest, override);
      const configuration = resolveConfiguration(
        manifest,
        override,
        await loadDefaults(tx),
      );
      const version = row.desiredVersion + 1;
      const now = new Date();
      if (change.overrides !== undefined) {
        await tx.insertInto(Overrides.table).values({
          ...override,
          serviceId,
          updatedAt: now,
        })
          .onConflict((conflict) =>
            conflict.column("serviceId").doUpdateSet({
              ...change.overrides,
              updatedAt: now,
            })
          ).execute();
      }
      await tx.updateTable(Services.table).set({
        enabled: change.enabled ?? row.enabled,
        desiredVersion: version,
        updatedAt: now,
      }).where("serviceId", "=", serviceId).execute();
      await tx.insertInto(Versions.table).values(versionRow(
        serviceId,
        version,
        row.packageCommit,
        row.manifestHash,
        await hash({ configuration, accessMode: access.mode }),
        configuration,
        access,
      )).execute();
      await invalidateIndexes(tx, [row.packageId]);
      return row.packageId;
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new AdminCommandError({
        code: "invalid_arguments",
        message: error.message,
      });
    }
    throw error;
  }
}

export async function applyDesired(
  serviceId: string,
  change: Parameters<typeof updateDesired>[1],
  detail: boolean,
): Promise<Record<string, unknown>> {
  const packageId = await updateDesired(serviceId, change);
  try {
    await kernel.admin.execute("kernel.reindex", { packages: packageId });
  } catch (error) {
    throw new AdminCommandError({
      code: "runtime_operation",
      message: `desired configuration was saved; package reindex failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
  const status = await kernel.services.inspect(serviceId);
  return serviceResult(status, detail);
}

export function serviceResult(
  status: Record<string, unknown>,
  detail: boolean,
) {
  if (detail) return { service: status };
  return Object.fromEntries([
    "service_id",
    "state",
    "enabled",
    "desired_version",
    "loaded_version",
    "version_count",
    "sandbox_count",
    "worker_count",
  ].map((key) => [key, status[key]]));
}

export async function restart(
  serviceId: string,
  mode: "soft" | "hard" = "soft",
) {
  await requirePermission("the8020.services.service.restart", serviceId);
  return kernel.services.restart(serviceId, mode);
}
