import type {
  ServiceConfiguration as Configuration,
  ServiceSpecification as Specification,
} from "@the8020/kernel";
export type {
  ServiceConfiguration as Configuration,
  ServiceSpecification as Specification,
} from "@the8020/kernel";
// Package dependencies use qualified imports under the shared runtime import map.
// deno-lint-ignore no-import-prefix
import { parse } from "jsr:@std/toml@1.0.11";
import type { Selectable } from "/p/the8020/db/mod.ts";
import type { ServiceOverrideRow } from "../tables/overrides.ts";

export type OverrideValues = {
  -readonly [K in keyof Selectable<ServiceOverrideRow>]?: Selectable<
    ServiceOverrideRow
  >[K];
};

// Application defaults live here. Numeric durations crossing the runtime
// boundary use its existing nanosecond convention; durable rows use milliseconds.
export const defaults: Readonly<Configuration> = {
  execution: { anonymous_user: "system" },
  lifecycle: { service_type: "stateless", session_keep_alive: 600_000_000_000 },
  scaling: {
    minimum_workers: 0,
    maximum_workers: 0,
    concurrency_per_worker: 32,
    target_utilization: 0.7,
    worker_keep_alive: 120_000_000_000,
  },
  placement: {
    sandbox_group: "",
    minimum_sandboxes: 0,
    workers_per_sandbox: 4,
  },
  timeouts: { request: 30_000_000_000, drain: 30_000_000_000, idle: 0 },
};

function object(value: unknown, name: string, keys: string[]) {
  if (value === undefined) return {} as Record<string, unknown>;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a table`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new TypeError(`unknown ${name}.${key}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string, fallback = ""): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new TypeError(`${name} must be text`);
  return value;
}

function number(value: unknown, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function boolean(value: unknown, name: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be boolean`);
  }
  return value;
}

export function duration(
  value: unknown,
  name: string,
  allowZero = false,
): number {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a positive duration`);
  }
  const units: Record<string, number> = {
    ns: 1,
    us: 1000,
    "µs": 1000,
    "μs": 1000,
    ms: 1_000_000,
    s: 1_000_000_000,
    m: 60_000_000_000,
    h: 3_600_000_000_000,
  };
  let total = 0;
  let offset = 0;
  for (
    const match of value.matchAll(
      /(\d+(?:\.\d*)?|\.\d+)(ns|us|µs|μs|ms|s|m|h)/g,
    )
  ) {
    if (match.index !== offset) {
      throw new TypeError(`${name} is not a duration`);
    }
    total += Number(match[1]) * units[match[2]!]!;
    offset += match[0].length;
  }
  if (
    offset === 0 || offset !== value.length || !Number.isSafeInteger(total) ||
    (allowZero ? total < 0 : total <= 0)
  ) {
    throw new TypeError(
      `${name} must be a ${
        allowZero ? "nonnegative" : "positive"
      }, representable duration`,
    );
  }
  return total;
}

export interface Declaration {
  entrypoint: string;
  description: string;
  defaultEnabled: boolean;
  openapi: Specification["openapi"];
  access: Specification["access"];
  declared: Omit<OverrideValues, "serviceId" | "updatedAt">;
}

export function declaration(source: string): Declaration {
  const manifest = object(parse(source), "service", [
    "schema",
    "description",
    "entrypoint",
    "lifecycle",
    "openapi",
    "scaling",
    "placement",
    "access",
    "execution",
  ]);
  if (manifest.schema !== 2) throw new TypeError("service.schema must be 2");
  const lifecycle = object(manifest.lifecycle, "lifecycle", [
    "default_enabled",
    "service_type",
    "session_keep_alive",
  ]);
  const scaling = object(manifest.scaling, "scaling", [
    "minimum_workers",
    "maximum_workers",
    "concurrency_per_worker",
    "target_utilization",
    "worker_keep_alive",
  ]);
  const placement = object(manifest.placement, "placement", [
    "sandbox_group",
    "minimum_sandboxes",
    "workers_per_sandbox",
  ]);
  const execution = object(manifest.execution, "execution", ["anonymous_user"]);
  const access = object(manifest.access, "access", ["mode", "unauthenticated"]);
  const policy = object(access.unauthenticated, "access.unauthenticated", [
    "action",
    "status",
    "message",
    "redirect_url",
  ]);
  const openapi = object(manifest.openapi, "openapi", [
    "title",
    "version",
    "description",
  ]);
  const mode = text(access.mode, "access.mode", "public");
  if (mode !== "public" && mode !== "authenticated") {
    throw new TypeError("access.mode must be public or authenticated");
  }
  const action = text(policy.action, "access.unauthenticated.action", "reject");
  if (action !== "reject" && action !== "redirect") {
    throw new TypeError(
      "access.unauthenticated.action must be reject or redirect",
    );
  }
  const status = number(
    policy.status,
    "access.unauthenticated.status",
    action === "reject" ? 401 : 302,
  );
  const redirect = text(
    policy.redirect_url,
    "access.unauthenticated.redirect_url",
  );
  if (
    !Number.isInteger(status) ||
    (action === "reject"
      ? status < 400 || status > 599
      : status < 300 || status > 399)
  ) {
    throw new TypeError("unauthenticated status does not match its action");
  }
  // Reject header control bytes in configured redirects.
  // deno-lint-ignore no-control-regex
  const invalidRedirect = /[\x00-\x1f\x7f]/.test(redirect);
  if (action === "redirect" && (redirect === "" || invalidRedirect)) {
    throw new TypeError(
      "unauthenticated redirect_url must be a configured URL",
    );
  }
  if (action === "redirect") new URL(redirect, "http://service.invalid");
  const serviceType = text(
    lifecycle.service_type,
    "lifecycle.service_type",
    "stateless",
  );
  if (serviceType !== "stateless" && serviceType !== "session") {
    throw new TypeError("lifecycle.service_type must be stateless or session");
  }
  const description = text(manifest.description, "description");
  const result: Declaration = {
    entrypoint: text(manifest.entrypoint, "entrypoint", "service.ts"),
    description,
    defaultEnabled: boolean(
      lifecycle.default_enabled,
      "lifecycle.default_enabled",
      false,
    ),
    openapi: {
      title: text(openapi.title, "openapi.title"),
      version: text(openapi.version, "openapi.version"),
      description: text(
        openapi.description,
        "openapi.description",
        description,
      ),
    },
    access: {
      mode,
      unauthenticated: {
        action,
        status,
        redirect_url: redirect,
        message: text(
          policy.message,
          "access.unauthenticated.message",
          "Authentication is required.",
        ),
      },
    },
    declared: { serviceType },
  };
  for (
    const [key, value] of Object.entries({
      minimumWorkers: scaling.minimum_workers,
      maximumWorkers: scaling.maximum_workers,
      concurrencyPerWorker: scaling.concurrency_per_worker,
      targetUtilization: scaling.target_utilization,
      minimumSandboxes: placement.minimum_sandboxes,
      workersPerSandbox: placement.workers_per_sandbox,
    })
  ) {
    if (value !== undefined) {
      Object.assign(result.declared, { [key]: number(value, key, 0) });
    }
  }
  if (lifecycle.session_keep_alive !== undefined) {
    result.declared.sessionKeepAliveMs = duration(
      lifecycle.session_keep_alive,
      "lifecycle.session_keep_alive",
      true,
    ) /
      1_000_000;
  }
  if (scaling.worker_keep_alive !== undefined) {
    result.declared.workerKeepAliveMs =
      duration(scaling.worker_keep_alive, "scaling.worker_keep_alive") /
      1_000_000;
  }
  if (placement.sandbox_group !== undefined) {
    result.declared.sandboxGroup = text(
      placement.sandbox_group,
      "placement.sandbox_group",
    );
  }
  if (execution.anonymous_user !== undefined) {
    result.declared.anonymousUser = text(
      execution.anonymous_user,
      "execution.anonymous_user",
    );
  }
  resolveConfiguration(result, undefined);
  return result;
}

export function resolveConfiguration(
  manifest: Declaration,
  override?: OverrideValues,
  base: Readonly<Configuration> = defaults,
): Configuration {
  const value = { ...manifest.declared };
  for (const [key, field] of Object.entries(override ?? {})) {
    if (field !== null && field !== undefined) {
      Object.assign(value, { [key]: field });
    }
  }
  const resolved: Configuration = {
    execution: {
      anonymous_user: value.anonymousUser ?? base.execution.anonymous_user,
    },
    lifecycle: {
      service_type: value.serviceType ?? base.lifecycle.service_type,
      session_keep_alive: value.sessionKeepAliveMs === undefined ||
          value.sessionKeepAliveMs === null
        ? base.lifecycle.session_keep_alive
        : value.sessionKeepAliveMs * 1_000_000,
    },
    scaling: {
      minimum_workers: value.minimumWorkers ?? base.scaling.minimum_workers,
      maximum_workers: value.maximumWorkers ?? base.scaling.maximum_workers,
      concurrency_per_worker: value.concurrencyPerWorker ??
        base.scaling.concurrency_per_worker,
      target_utilization: value.targetUtilization ??
        base.scaling.target_utilization,
      worker_keep_alive: value.workerKeepAliveMs === undefined ||
          value.workerKeepAliveMs === null
        ? base.scaling.worker_keep_alive
        : value.workerKeepAliveMs * 1_000_000,
    },
    placement: {
      sandbox_group: value.sandboxGroup ?? base.placement.sandbox_group,
      minimum_sandboxes: value.minimumSandboxes ??
        base.placement.minimum_sandboxes,
      workers_per_sandbox: value.workersPerSandbox ??
        base.placement.workers_per_sandbox,
    },
    timeouts: { ...base.timeouts },
  };
  validateConfiguration(resolved);
  return resolved;
}

export function validateConfiguration(value: Configuration): void {
  if (!/^[a-z0-9]{3,32}$/.test(value.execution.anonymous_user)) {
    throw new TypeError("invalid execution.anonymous_user");
  }
  if (!["stateless", "session"].includes(value.lifecycle.service_type)) {
    throw new TypeError("invalid lifecycle.service_type");
  }
  for (
    const [name, count] of Object.entries({
      minimum_workers: value.scaling.minimum_workers,
      maximum_workers: value.scaling.maximum_workers,
      minimum_sandboxes: value.placement.minimum_sandboxes,
    })
  ) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new TypeError(`${name} must be a nonnegative integer`);
    }
  }
  for (
    const [name, count] of Object.entries({
      concurrency_per_worker: value.scaling.concurrency_per_worker,
      workers_per_sandbox: value.placement.workers_per_sandbox,
    })
  ) {
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new TypeError(`${name} must be a positive integer`);
    }
  }
  if (
    value.scaling.maximum_workers !== 0 &&
    value.scaling.minimum_workers > value.scaling.maximum_workers
  ) throw new TypeError("minimum_workers exceeds maximum_workers");
  if (
    !(value.scaling.target_utilization > 0 &&
      value.scaling.target_utilization <= 1)
  ) throw new TypeError("target_utilization must be in (0, 1]");
  if (
    value.placement.sandbox_group.trim() !== value.placement.sandbox_group ||
    value.placement.sandbox_group.includes("\0")
  ) throw new TypeError("invalid sandbox_group");
  for (
    const [name, time] of Object.entries({
      worker_keep_alive: value.scaling.worker_keep_alive,
      request_timeout: value.timeouts.request,
      drain_timeout: value.timeouts.drain,
    })
  ) {
    if (!Number.isSafeInteger(time) || time <= 0) {
      throw new TypeError(`${name} must be positive`);
    }
  }
  const sessionKeepAlive = value.lifecycle.session_keep_alive;
  if (
    !Number.isSafeInteger(sessionKeepAlive) || sessionKeepAlive < 0 ||
    sessionKeepAlive > 0 && sessionKeepAlive < 1_000_000
  ) {
    throw new TypeError(
      "session_keep_alive must be zero or at least one millisecond",
    );
  }
  if (!Number.isSafeInteger(value.timeouts.idle) || value.timeouts.idle < 0) {
    throw new TypeError("invalid idle timeout");
  }
}
