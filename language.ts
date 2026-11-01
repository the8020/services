import { withLocalization } from "/p/the8020/i18n/mod.ts";
import {
  InvalidLanguage,
  languageHeader,
  requestLocalization,
} from "/p/the8020/i18n/request.ts";
import type { RuntimeServiceContext } from "./http.ts";

/** HTTP and WebSocket handlers share request-local language selection. */
export async function localizedRequest(
  request: Request,
  context: RuntimeServiceContext,
  run: () => Response | Promise<Response>,
): Promise<Response> {
  let localization;
  try {
    localization = await requestLocalization(
      request,
      context.meta.user.username,
    );
  } catch (error) {
    if (!(error instanceof InvalidLanguage)) throw error;
    return Response.json({
      error: { code: "invalid_language", message: error.message },
    }, { status: 400 });
  }
  return await withLocalization(localization, async () => {
    const response = await run();
    if (!localization.used) return response;
    const headers = new Headers(response.headers);
    if (!headers.has("content-language")) {
      headers.set("content-language", localization.language);
    }
    const vary = headers.get("vary");
    if (
      vary !== "*" &&
      !vary?.toLowerCase().split(/\s*,\s*/).includes(languageHeader)
    ) {
      headers.set("vary", vary ? `${vary}, ${languageHeader}` : languageHeader);
    }
    if (
      !request.headers.has(languageHeader) && context.meta.auth.authenticated
    ) headers.set("cache-control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}
