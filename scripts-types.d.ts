declare module "*/local-pg.mjs" {
  export function startCluster(
    name?: string,
    port?: number,
    opts?: { fresh?: boolean },
  ): Promise<{ name: string; port: number; dataDir: string; log: string }>;
  export function stopCluster(name?: string, port?: number): { name: string; port: number; dataDir: string; log: string };
  export function provision(
    info: { port: number },
    opts: { database: string; appRole: string; appPassword: string },
  ): Promise<void>;
}
