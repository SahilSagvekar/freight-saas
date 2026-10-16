import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // `next build` also loads this file, with no runtime secrets. Only a running production server is checked.
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { productionEnvProblems } = await import("@/lib/env");
    const problems = productionEnvProblems(process.env);
    if (problems.length) throw new Error(`Refusing to start:\n - ${problems.join("\n - ")}`);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureException } = await import("@/lib/monitor");
  await captureException(err, { route: request.path, source: "server", extra: { method: request.method } });
};
