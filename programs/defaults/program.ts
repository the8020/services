import {
  AdminCommandError,
  kernel,
  parseCommandArguments,
} from "@the8020/kernel";
import { listDefaults, setDefault } from "../../src/defaults.ts";

export default async function (...args: string[]) {
  const parsed = parseCommandArguments(args, { booleans: ["unset"] });
  if (parsed.positionals.length === 0) {
    return { defaults: await listDefaults() };
  }
  const [name, value] = parsed.positionals;
  if (
    parsed.positionals.length > 2 || parsed.options.unset === true
      ? value !== undefined
      : value === undefined || !/^-?\d+$/.test(value)
  ) {
    throw new AdminCommandError({
      code: "invalid_arguments",
      message: "use services.defaults <name> <integer>, or <name> --unset",
    });
  }
  const packages = await setDefault(
    name!,
    parsed.options.unset === true ? undefined : Number(value),
  );
  if (packages.length > 0) {
    await kernel.admin.execute("kernel.reindex", {
      packages: packages.join(","),
    });
  }
  return { defaults: await listDefaults() };
}
