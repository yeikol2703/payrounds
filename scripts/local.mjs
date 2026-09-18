/**
 * One-command local stack: Docker emulators → seed → Next (emulator env only).
 * Aborts if Docker ports are not reachable after start.
 */
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");

function run(cmd, opts = {}) {
  console.log(">", cmd);
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    ...opts,
  });
}

async function waitPort(host, port, label, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`http://${host}:${port}/`, {
        signal: AbortSignal.timeout(1500),
      });
      // Any HTTP response means the port is open (Storage may 404).
      void res;
      return;
    } catch {
      // TCP may accept before HTTP is ready — also try raw connect via fetch fail patterns
    }
    // Fallback: use docker / powershell-free node net
    try {
      await new Promise((resolveP, rejectP) => {
        import("node:net").then(({ default: net }) => {
          const s = net.connect({ host, port }, () => {
            s.end();
            resolveP(undefined);
          });
          s.on("error", rejectP);
          s.setTimeout(1500, () => {
            s.destroy();
            rejectP(new Error("timeout"));
          });
        });
      });
      return;
    } catch {
      // retry
    }
    await delay(1500);
  }
  throw new Error(
    `[payround] ${label} not reachable at ${host}:${port}. Is Docker running? Try: npm run emulator:up`,
  );
}

async function main() {
  if (!existsSync(resolve(root, ".env.emulator"))) {
    throw new Error("[payround] Missing .env.emulator — local stack requires it.");
  }

  console.log("\n=== Payround LOCAL (Docker emulators only) ===\n");
  run("docker compose -f docker-compose.emulators.yml up -d");

  console.log("\nWaiting for Auth / Firestore / Storage…");
  await waitPort("127.0.0.1", 9099, "Auth emulator");
  await waitPort("127.0.0.1", 8181, "Firestore emulator");
  await waitPort("127.0.0.1", 9199, "Storage emulator");
  console.log("Emulators ready.\n");

  const seedEnv = {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8181",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    GCLOUD_PROJECT: "demo-payround",
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: "true",
  };
  run("node scripts/seed-emulator.mjs", { env: seedEnv });

  console.log("\nStarting Next with emulator env (port 3002)…\n");
  const child = spawn("node", ["scripts/dev-emulator.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: process.env.PORT || "3002" },
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
