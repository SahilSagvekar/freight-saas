// Local Postgres launcher built on the embedded-postgres binaries.
// Lets anyone run the app with no separate Postgres install:
//   node scripts/local-pg.mjs start [--name dev] [--port 54320]
//   node scripts/local-pg.mjs stop  [--name dev]
//   node scripts/local-pg.mjs status [--name dev]
//
// Dev-only: connections on 127.0.0.1 use trust auth. Never use this for production.
import { execFileSync, spawnSync } from "node:child_process";
import { chownSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
const RUN_AS = "pgdev"; // Postgres refuses to run as root, so we drop to this user.

const PLATFORM_PACKAGES = {
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
  "darwin-x64": "darwin-x64",
  "darwin-arm64": "darwin-arm64",
  "win32-x64": "windows-x64",
};

function binDir() {
  const key = PLATFORM_PACKAGES[`${process.platform}-${process.arch}`];
  if (!key) throw new Error(`Unsupported platform ${process.platform}-${process.arch}`);
  // The package only exports its entry file, so resolve that and step up to the package root.
  const entry = require.resolve(`@embedded-postgres/${key}`);
  return path.join(path.dirname(path.dirname(entry)), "native", "bin");
}

function exe(name) {
  const file = process.platform === "win32" ? `${name}.exe` : name;
  return path.join(binDir(), file);
}

function ensureRunUser() {
  if (!isRoot) return;
  try {
    execFileSync("id", [RUN_AS], { stdio: "ignore" });
  } catch {
    execFileSync("useradd", ["--system", "--no-create-home", "--shell", "/usr/sbin/nologin", RUN_AS]);
  }
}

function chownTree(dir) {
  if (!isRoot) return;
  const uid = Number(execFileSync("id", ["-u", RUN_AS]).toString().trim());
  const gid = Number(execFileSync("id", ["-g", RUN_AS]).toString().trim());
  const walk = (p) => {
    chownSync(p, uid, gid);
    if (statSync(p).isDirectory()) for (const f of readdirSync(p)) walk(path.join(p, f));
  };
  walk(dir);
}

function run(cmd, args, opts = {}) {
  const [file, fileArgs] = isRoot
    ? ["runuser", ["-u", RUN_AS, "--", cmd, ...args]]
    : [cmd, args];
  return spawnSync(file, fileArgs, { encoding: "utf8", ...opts });
}

export function clusterInfo(name = "dev", port = 54320) {
  const dataDir = path.join(root, ".pgdata", name);
  return { name, port, dataDir, log: path.join(root, ".pgdata", `${name}.log`) };
}

export function adminUrl({ port }, database = "postgres") {
  return `postgres://postgres@127.0.0.1:${port}/${database}`;
}

export async function startCluster(name = "dev", port = 54320, { fresh = false } = {}) {
  ensureRunUser();
  const info = clusterInfo(name, port);
  const base = path.dirname(info.dataDir);
  mkdirSync(base, { recursive: true });
  if (fresh) stopCluster(name, port);
  if (fresh && existsSync(info.dataDir)) {
    const { rmSync } = await import("node:fs");
    rmSync(info.dataDir, { recursive: true, force: true });
  }
  chownTree(base);

  if (!existsSync(path.join(info.dataDir, "PG_VERSION"))) {
    const r = run(exe("initdb"), [
      "-D", info.dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C", "--no-sync",
    ]);
    if (r.status !== 0) throw new Error(`initdb failed:\n${r.stdout}\n${r.stderr}`);
  }

  const status = run(exe("pg_ctl"), ["-D", info.dataDir, "status"]);
  if (status.status !== 0) {
    const opts = [
      `-p ${port}`,
      "-c listen_addresses=127.0.0.1",
      `-c unix_socket_directories=${info.dataDir}`,
      "-c fsync=off",
      "-c synchronous_commit=off",
      "-c full_page_writes=off",
    ].join(" ");
    // stdio is ignored: the server inherits piped handles, and on Windows spawnSync would wait on them forever.
    const r = run(exe("pg_ctl"), ["-D", info.dataDir, "-o", opts, "-l", info.log, "-w", "-t", "60", "start"], { stdio: "ignore" });
    if (r.status !== 0) throw new Error(`pg_ctl start failed (see ${info.log})`);
  }
  return info;
}

export function stopCluster(name = "dev", port = 54320) {
  const info = clusterInfo(name, port);
  if (!existsSync(path.join(info.dataDir, "PG_VERSION"))) return info;
  run(exe("pg_ctl"), ["-D", info.dataDir, "-m", "fast", "-w", "stop"]);
  return info;
}

/** Creates the database and the non-superuser role the app connects as (RLS applies to it). */
export async function provision(info, { database, appRole, appPassword }) {
  const client = new pg.Client({ connectionString: adminUrl(info) });
  await client.connect();
  try {
    const exists = await client.query("select 1 from pg_database where datname = $1", [database]);
    if (exists.rowCount === 0) await client.query(`create database "${database}"`);
    const role = await client.query("select 1 from pg_roles where rolname = $1", [appRole]);
    if (role.rowCount === 0) {
      await client.query(
        `create role "${appRole}" login password '${appPassword}' nosuperuser nocreatedb nocreaterole nobypassrls`,
      );
    }
  } finally {
    await client.end();
  }
}

// CLI
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const [command = "status"] = process.argv.slice(2);
  const arg = (flag, fallback) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : fallback;
  };
  const name = arg("--name", "dev");
  const port = Number(arg("--port", "54320"));
  if (command === "start") {
    const info = await startCluster(name, port);
    await provision(info, { database: "freight", appRole: "freight_app", appPassword: "freight_app" });
    console.log(`Postgres "${name}" running on 127.0.0.1:${port}`);
  } else if (command === "stop") {
    stopCluster(name, port);
    console.log(`Postgres "${name}" stopped`);
  } else {
    const info = clusterInfo(name, port);
    const r = run(exe("pg_ctl"), ["-D", info.dataDir, "status"]);
    console.log((r.stdout || r.stderr || "").trim());
    process.exit(r.status ?? 1);
  }
}
