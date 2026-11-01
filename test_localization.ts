import {
  defaultConfiguration,
  Localization,
  withLocalization,
} from "/p/the8020/i18n/mod.ts";

export function test(name: string, run: () => void | Promise<void>) {
  Deno.test(
    name,
    () =>
      withLocalization(
        new Localization(
          "en",
          defaultConfiguration,
          async (packageId, chain) => ({
            package: packageId,
            language: chain[0]!,
            texts: (await import(`/p/${packageId}/i18n/locales/en.json`, {
              with: { type: "json" },
            })).default.texts,
          }),
        ),
        run,
      ),
  );
}
