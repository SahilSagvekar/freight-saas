/**
 * Minimal error reporting to Sentry (or anything that accepts Sentry envelopes, such as GlitchTip), with no SDK.
 * Off until SENTRY_DSN is set. Reports carry the message, stack and route only: no cookies, no form data,
 * no query strings, no emails.
 */

export type Dsn = { endpoint: string; key: string };

export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+/, "");
    if (!u.username || !project) return null;
    return { endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username };
  } catch {
    return null;
  }
}

export type ErrorReport = { message: string; stack?: string; name?: string; route?: string; source: "server" | "browser"; extra?: Record<string, string> };

/** Strips query strings and anything that looks like an id or token out of a path. */
export function cleanPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return path.split("?")[0]!.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id").slice(0, 200);
}

export function buildEnvelope(report: ErrorReport, dsn: Dsn, now = new Date(), environment = process.env.NODE_ENV ?? "production"): string {
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "javascript",
    level: "error",
    environment,
    release: process.env.APP_VERSION,
    tags: { source: report.source, ...(report.route ? { route: cleanPath(report.route) } : {}) },
    extra: report.extra,
    exception: {
      values: [{ type: report.name ?? "Error", value: report.message.slice(0, 1000), ...(report.stack ? { stacktrace: { frames: [{ filename: "stack", function: report.stack.slice(0, 6000) }] } } : {}) }],
    },
  };
  const header = { event_id: eventId, sent_at: now.toISOString(), dsn: `${dsn.endpoint}` };
  return [JSON.stringify(header), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
}

export async function captureException(error: unknown, ctx: { route?: string; source?: "server" | "browser"; extra?: Record<string, string> } = {}): Promise<void> {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const report: ErrorReport = { message: err.message, stack: err.stack, name: err.name, route: ctx.route, source: ctx.source ?? "server", extra: ctx.extra };
  if (!dsn) {
    console.error("[error]", report.source, cleanPath(report.route) ?? "", err);
    return;
  }
  try {
    await fetch(dsn.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=harborline/1` },
      body: buildEnvelope(report, dsn),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    console.error("[error]", report.source, err);
  }
}
