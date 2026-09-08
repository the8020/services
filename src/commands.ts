import {
  AdminCommandError,
  kernel,
  parseCommandArguments,
  requiredCommandArgument,
} from "@the8020/kernel";
import { applyDesired, serviceResult } from "./admin.ts";
import { duration, type OverrideValues } from "./configuration.ts";

function integer(value: string | boolean | undefined, name: string) {
  if (typeof value !== "string" || !/^-?[0-9]+$/.test(value)) {
    throw new AdminCommandError({
      code: "invalid_arguments",
      message: `--${name} must be an integer`,
    });
  }
  return Number(value);
}

export function list() {
  return kernel.services.list().then((services) => ({ services }));
}

export function inspect(...args: string[]) {
  return kernel.services.inspect(requiredCommandArgument(args, 0, "service ID"))
    .then((service) => ({ service }));
}

export function lifecycle(
  action: "start" | "stop" | "restart",
  args: string[],
) {
  const parsed = parseCommandArguments(args, {
    booleans: action === "restart" ? ["detail", "hard"] : ["detail"],
  });
  const serviceId = requiredCommandArgument(
    parsed.positionals,
    0,
    "service ID",
  );
  if (action === "restart") {
    return kernel.services.restart(
      serviceId,
      parsed.options.hard === true ? "hard" : "soft",
    )
      .then((service) =>
        serviceResult(service, parsed.options.detail === true)
      );
  }
  return applyDesired(
    serviceId,
    { enabled: action !== "stop" },
    parsed.options.detail === true,
  );
}

export function validate(...args: string[]) {
  return kernel.services.validate(
    requiredCommandArgument(args, 0, "service ID"),
  );
}

export function openapi(...args: string[]) {
  return kernel.services.openapi(requiredCommandArgument(args, 0, "service ID"))
    .then((openapi) => ({ openapi }));
}

export function scale(...args: string[]) {
  const valueNames = [
    "anonymous-user",
    "minimum-workers",
    "maximum-workers",
    "concurrency-per-worker",
    "target-utilization",
    "worker-keep-alive",
    "workers-per-sandbox",
    "sandbox-group",
    "minimum-sandboxes",
    "service-type",
    "session-keep-alive",
  ] as const;
  const parsed = parseCommandArguments(args, {
    values: valueNames,
    booleans: ["detail"],
  });
  const serviceId = requiredCommandArgument(
    parsed.positionals,
    0,
    "service ID",
  );
  const overrides: OverrideValues = {};
  for (const name of valueNames) {
    const value = parsed.options[name];
    if (value === undefined) continue;
    const key = name.replace(
      /-([a-z])/g,
      (_, letter: string) => letter.toUpperCase(),
    );
    let parsedValue: unknown = [
        "minimum-workers",
        "maximum-workers",
        "concurrency-per-worker",
        "workers-per-sandbox",
        "minimum-sandboxes",
      ].includes(name)
      ? integer(value, name)
      : value;
    if (name === "target-utilization") parsedValue = Number(value);
    if (name === "worker-keep-alive" || name === "session-keep-alive") {
      try {
        parsedValue = duration(value, name) / 1_000_000;
      } catch (error) {
        throw new AdminCommandError({
          code: "invalid_arguments",
          message: String(error),
        });
      }
    }
    Object.assign(overrides, {
      [
        name.endsWith("keep-alive")
          ? `${key}Ms`
          : name === "anonymous-user"
          ? "anonymousUser"
          : key
      ]: parsedValue,
    });
  }
  if (Object.keys(overrides).length === 0) {
    throw new AdminCommandError({
      code: "invalid_arguments",
      message: "at least one scaling option is required",
    });
  }
  return applyDesired(serviceId, { overrides }, parsed.options.detail === true);
}

export function request(...args: string[]) {
  const parsed = parseCommandArguments(args, {
    values: ["headers", "body", "json", "timeout-ms"],
  });
  const input: Record<string, unknown> = {
    service_id: requiredCommandArgument(parsed.positionals, 0, "service ID"),
    method: requiredCommandArgument(parsed.positionals, 1, "method"),
    relative_path: requiredCommandArgument(
      parsed.positionals,
      2,
      "relative path",
    ),
  };
  for (const name of ["headers", "body", "json"] as const) {
    if (parsed.options[name] !== undefined) input[name] = parsed.options[name];
  }
  if (parsed.options["timeout-ms"] !== undefined) {
    input.timeout = integer(parsed.options["timeout-ms"], "timeout-ms");
  }
  return kernel.services.request(input).then((response) => ({ response }));
}
