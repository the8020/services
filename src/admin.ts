import { AdminCommandError, kernel } from "@the8020/kernel";
import { db } from "/p/the8020/db/mod.ts";
import {
  invalidateIndexes,
  lockIndexRevision,
} from "/p/the8020/system/src/indexes.ts";
import Services from "../tables/services.ts";
import Overrides from "../tables/overrides.ts";
import Versions from "../tables/versions.ts";
import { type OverrideValues, resolveConfiguration } from "./configuration.ts";
import { hash, storedDeclaration, versionRow } from "./indexing.ts";
import { loadDefaults } from "./defaults.ts";

export async function updateDesired(
  serviceId: string,
  change: { enabled?: boolean; overrides?: OverrideValues },
): Promise<string> {
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
      const configuration = resolveConfiguration(
        storedDeclaration(row),
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
        await hash(configuration),
        configuration,
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
