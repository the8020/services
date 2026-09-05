import { AdminCommandError } from "@the8020/kernel";
import { type Database, db } from "/p/the8020/db/mod.ts";
import type { Transaction } from "kysely";
import Settings from "/p/the8020/system/tables/settings.ts";
import {
  invalidateIndexes,
  lockIndexRevision,
} from "/p/the8020/system/src/indexes.ts";
import Services from "../tables/services.ts";
import {
  type Configuration,
  defaults,
  validateConfiguration,
} from "./configuration.ts";

const fields = [
  ["minimum_workers", "scaling", "minimum_workers", 1],
  ["maximum_workers", "scaling", "maximum_workers", 1],
  ["concurrency_per_worker", "scaling", "concurrency_per_worker", 1],
  ["target_utilization_percent", "scaling", "target_utilization", 0.01],
  ["worker_keep_alive", "scaling", "worker_keep_alive", 1_000_000],
  ["session_keep_alive", "lifecycle", "session_keep_alive", 1_000_000],
  ["minimum_sandboxes", "placement", "minimum_sandboxes", 1],
  ["workers_per_sandbox", "placement", "workers_per_sandbox", 1],
  ["request_timeout", "timeouts", "request", 1_000_000],
  ["drain_timeout", "timeouts", "drain", 1_000_000],
] as const;

function resolve(values: Map<string, unknown>): Configuration {
  const result = structuredClone(defaults);
  for (const [name, group, field, multiplier] of fields) {
    const value = values.get(`services.default_${name}`);
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw new TypeError(`default ${name} must be an integer`);
    }
    Object.assign(result[group], { [field]: value * multiplier });
  }
  validateConfiguration(result);
  return result;
}

async function values(tx: Transaction<Database> | typeof db) {
  const rows = await tx.selectFrom(Settings.table).select(["key", "value"])
    .where("key", "in", fields.map(([name]) => `services.default_${name}`))
    .execute();
  return new Map<string, unknown>(rows.map((row) => [row.key, row.value]));
}

// Existing stored service defaults retain their keys and values. Their meaning
// and editing now belong to this package, without a second override store.
export async function loadDefaults(
  tx: Transaction<Database>,
): Promise<Configuration> {
  return resolve(await values(tx));
}

export async function listDefaults() {
  const configured = await values(db);
  return fields.map(([name, group, field, multiplier]) => ({
    name,
    value: configured.get(`services.default_${name}`) ??
      Number((defaults[group] as Record<string, unknown>)[field]) / multiplier,
    overridden: configured.has(`services.default_${name}`),
  }));
}

export async function setDefault(
  name: string,
  value: number | undefined,
): Promise<string[]> {
  if (
    !fields.some(([key]) => key === name) ||
    value !== undefined && !Number.isSafeInteger(value)
  ) {
    throw new AdminCommandError({
      code: "invalid_arguments",
      message:
        "a known service default and integer value are required; durations use milliseconds",
    });
  }
  try {
    return await db.transaction().execute(async (tx) => {
      await lockIndexRevision(tx);
      const configured = await values(tx);
      const key = `services.default_${name}`;
      if (value === undefined) configured.delete(key);
      else configured.set(key, value);
      resolve(configured);
      if (value === undefined) {
        await tx.deleteFrom(Settings.table).where("key", "=", key).execute();
      } else {await tx.insertInto(Settings.table).values({
          key,
          value,
          definitionHash: "the8020/services",
          updatedAt: new Date(),
        })
          .onConflict((conflict) =>
            conflict.column("key").doUpdateSet({
              value,
              definitionHash: "the8020/services",
              updatedAt: new Date(),
            })
          ).execute();}
      const packages =
        (await tx.selectFrom(Services.table).select("packageId").distinct()
          .where("active", "=", true).execute()).map((row) => row.packageId);
      await invalidateIndexes(tx, packages);
      return packages;
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
